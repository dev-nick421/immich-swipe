import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
import { useReviewedStore } from '@/stores/reviewed'
import type {
  ImmichAsset,
  ImmichAlbum,
  MetadataSearchRequest,
  MetadataSearchResponse,
  RandomSearchRequest,
} from '@/types/immich'

export function useImmich() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const preferencesStore = usePreferencesStore()
  const reviewedStore = useReviewedStore()

  const currentAsset = ref<ImmichAsset | null>(null)
  const nextAsset = ref<ImmichAsset | null>(null)
  const pendingAssets = ref<ImmichAsset[]>([])
  const error = ref<string | null>(null)
  const SKIP_VIDEOS_BATCH_SIZE = 10
  const SKIP_VIDEOS_MAX_ATTEMPTS = 5
  const CHRONO_PAGE_SIZE = 50
  const RANDOM_BATCH_SIZE = 5
  const RANDOM_MAX_ATTEMPTS = 20

  const albumsCache = ref<ImmichAlbum[] | null>(null)
  // Albums that contain an asset (#20), by asset id; requests in flight are shared
  const assetAlbums = ref<Record<string, ImmichAlbum[]>>({})
  const assetAlbumRequests = new Map<string, Promise<ImmichAlbum[] | null>>()
  // Set while a delete waits for confirmation because the asset is in an album (#20)
  const deleteConfirmation = ref<{ asset: ImmichAsset; albums: ImmichAlbum[] } | null>(null)

  const chronologicalQueue = ref<ImmichAsset[]>([])
  // Next page to request; null once the last page has been loaded
  const chronologicalPage = ref<number | null>(1)
  let chronologicalRequest: Promise<void> | null = null
  // Bumped on every reset so responses from a previous flow are dropped
  let reviewFlowGeneration = 0

  type ReviewAction = {
    asset: ImmichAsset
    type: 'keep' | 'delete' | 'keepToAlbum'
    albumName?: string
  }

  const actionHistory = ref<ReviewAction[]>([])

  function isReviewable(asset: ImmichAsset): boolean {
    if (reviewedStore.isReviewed(asset.id)) return false
    if (uiStore.skipVideos && asset.type === 'VIDEO') return false
    return true
  }

  function resetReviewFlow() {
    reviewFlowGeneration++
    chronologicalQueue.value = []
    chronologicalPage.value = 1
    chronologicalRequest = null
    nextAsset.value = null
    pendingAssets.value = []
    actionHistory.value = []
    deleteConfirmation.value = null
  }

  // Album filter from the settings (#20), same fields for random and metadata search
  function applyAlbumFilter(body: RandomSearchRequest | MetadataSearchRequest) {
    const filter = preferencesStore.albumFilter
    if (filter.type === 'not-in-album') {
      body.isNotInAlbum = true
    } else if (filter.type === 'album') {
      body.albumIds = [filter.albumId]
    }
  }

  watch(
    () => [authStore.serverUrl, authStore.currentUserName],
    () => {
      albumsCache.value = null
      assetAlbums.value = {}
      resetReviewFlow()
    }
  )

  // fetch() only reports "Failed to fetch" / "NetworkError ..." / "Load failed"; name the likely cause
  function describeNetworkError(url: string): string {
    const target = new URL(url, window.location.href)
    if (window.location.protocol === 'https:' && target.protocol === 'http:') {
      return `The browser blocked the request to ${target.origin}: this page uses HTTPS, the Immich server URL uses HTTP. Use an https:// server URL.`
    }
    if (target.origin === window.location.origin) {
      return `Could not reach the built-in Immich proxy at ${target.origin}.`
    }
    return `Could not reach Immich at ${target.origin}. Check the server URL and that Immich (or its reverse proxy) allows CORS requests from ${window.location.origin}, or use the built-in proxy of the Docker image (see README).`
  }

  function describeHttpError(response: Response, errorText: string): string {
    try {
      const errorJson = JSON.parse(errorText)
      // Immich v2 validation errors use a message array, v3 adds an errors array
      let message = Array.isArray(errorJson.message) ? errorJson.message.join('; ') : errorJson.message
      if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
        const details = errorJson.errors
          .map((e: { path?: unknown; message?: string }) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : e.path
            return path ? `${path}: ${e.message}` : e.message
          })
          .filter(Boolean)
          .join('; ')
        if (details) message = `${message || 'Validation failed'} (${details})`
      }
      if (message || errorJson.error) return message || errorJson.error
    } catch {
      // Not JSON, e.g. an HTML error page from a reverse proxy
    }

    if (authStore.useBuiltInProxy && [502, 503, 504].includes(response.status)) {
      return `The built-in proxy could not reach Immich (HTTP ${response.status}). Check the container logs; set IMMICH_URL if the container needs another address to reach Immich.`
    }
    if (response.status === 404) {
      return `API error: 404 - ${response.url || 'endpoint'} not found. Does the server URL point to Immich?`
    }
    const text = errorText.trim()
    const detail = text && !text.startsWith('<') && text.length <= 200 ? ` - ${text}` : ''
    return `API error: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${detail}`
  }

  // Generic Immich API request helper
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!authStore.immichBaseUrl) {
      throw new Error('Immich server URL is not configured')
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${authStore.apiBaseUrl}${normalizedEndpoint}`
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`Invalid Immich server URL "${authStore.serverUrl}": it must start with http:// or https://`)
    }
    const headers: HeadersInit = {
      'x-api-key': authStore.apiKey,
      'Accept': 'application/json',
      ...options.headers,
    }

    // Add Content-Type for non-GET requests with body
    if (options.body && typeof options.body === 'string') {
      (headers as Record<string, string>)['Content-Type'] = 'application/json'
    }

    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers,
      })
    } catch (e) {
      console.error(`[Immich] ${options.method || 'GET'} ${url} failed:`, e)
      throw new Error(describeNetworkError(url))
    }

    if (!response.ok) {
      throw new Error(describeHttpError(response, await response.text()))
    }

    // Handle empty
    const text = await response.text()
    if (!text) return {} as T
    try {
      return JSON.parse(text)
    } catch {
      // Typically index.html of a web app, i.e. the server URL is not the Immich server
      throw new Error(`Unexpected response from ${url} (not JSON). Does the server URL point to Immich?`)
    }
  }

  // Test connection
  async function testConnection(): Promise<boolean> {
    try {
      uiStore.setLoading(true, 'Testing connection...')
      await apiRequest('/users/me')
      return true
    } catch (e) {
      console.error('[Immich] Connection test failed:', e)
      error.value = e instanceof Error ? e.message : 'Connection failed'
      return false
    } finally {
      uiStore.setLoading(false)
    }
  }

  // Fetch a random asset
  async function fetchRandomAsset(): Promise<ImmichAsset | null> {
    try {
      const attempts = uiStore.skipVideos ? SKIP_VIDEOS_MAX_ATTEMPTS : RANDOM_MAX_ATTEMPTS
      for (let attempt = 0; attempt < attempts; attempt++) {
        const body: RandomSearchRequest = {
          size: uiStore.skipVideos ? SKIP_VIDEOS_BATCH_SIZE : RANDOM_BATCH_SIZE,
          // Explicit: Immich v3 otherwise also returns hidden assets (e.g. live photo video parts)
          visibility: 'timeline',
        }
        if (uiStore.skipVideos) {
          body.type = 'IMAGE'
        }
        applyAlbumFilter(body)
        // GET /assets/random was removed in Immich v3; POST /search/random works on v1.116+
        const assets = await apiRequest<ImmichAsset[]>('/search/random', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        if (!assets || assets.length === 0) {
          continue
        }

        // The asset on screen isn't reviewed yet, so the preload must skip it explicitly
        const candidate = assets.find((asset) => isReviewable(asset) && asset.id !== currentAsset.value?.id)
        if (candidate) return candidate
      }

      if (preferencesStore.albumFilter.type !== 'all') {
        throw new Error('No unreviewed photos match the album filter. Change it in the settings.')
      }
      if (uiStore.skipVideos) {
        throw new Error('No unreviewed photos found after skipping videos.')
      }
      throw new Error('No unreviewed assets found. Clear the reviewed cache to start over.')
    } catch (e) {
      console.error('Failed to fetch random asset:', e)
      throw e
    }
  }

  async function fetchChronologicalBatch(page: number): Promise<{ items: ImmichAsset[]; nextPage: number | null }> {
    const body: MetadataSearchRequest = {
      order: preferencesStore.reviewOrder === 'chronological-desc' ? 'desc' : 'asc',
      page,
      size: CHRONO_PAGE_SIZE,
      // Explicit: Immich v3 otherwise also returns hidden assets (e.g. live photo video parts)
      visibility: 'timeline',
    }
    applyAlbumFilter(body)

    const response = await apiRequest<MetadataSearchResponse>('/search/metadata', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const items = response?.assets?.items ?? []
    const rawNextPage = response?.assets?.nextPage
    let nextPage: number | null = null
    if (rawNextPage === undefined) {
      // Server without nextPage: keep going while pages are full
      nextPage = items.length === CHRONO_PAGE_SIZE ? page + 1 : null
    } else if (rawNextPage !== null) {
      const parsed = Number(rawNextPage)
      nextPage = Number.isInteger(parsed) && parsed > page ? parsed : null
    }

    return { items, nextPage }
  }

  async function fetchNextChronologicalAsset(): Promise<ImmichAsset | null> {
    while (chronologicalQueue.value.length === 0 && chronologicalPage.value !== null) {
      await loadChronologicalBatch()
    }

    return chronologicalQueue.value.shift() || null
  }

  // Current asset and preload share one in-flight request, so a page is never fetched twice
  // and callers never spin while another request is running. Errors propagate to the caller.
  function loadChronologicalBatch(): Promise<void> {
    if (chronologicalRequest) return chronologicalRequest

    const generation = reviewFlowGeneration
    const request = (async () => {
      const page = chronologicalPage.value
      if (page === null) return
      const batch = await fetchChronologicalBatch(page)
      if (generation !== reviewFlowGeneration) return
      chronologicalPage.value = batch.nextPage
      chronologicalQueue.value.push(...batch.items.filter(isReviewable))
    })().finally(() => {
      if (chronologicalRequest === request) {
        chronologicalRequest = null
      }
    })
    chronologicalRequest = request
    return request
  }

  async function fetchNextAsset(): Promise<ImmichAsset | null> {
    while (pendingAssets.value.length > 0) {
      const pending = pendingAssets.value.shift()
      if (pending && !reviewedStore.isReviewed(pending.id)) {
        return pending
      }
    }
    if (preferencesStore.reviewOrder !== 'random') {
      return fetchNextChronologicalAsset()
    }
    return fetchRandomAsset()
  }

  // Load initial and preload next
  async function loadInitialAsset(resetFlow: boolean = true): Promise<void> {
    try {
      uiStore.setLoading(true, 'Loading photo...')
      error.value = null

      if (resetFlow) {
        resetReviewFlow()
      }
      currentAsset.value = await fetchNextAsset()

      if (currentAsset.value) {
        preloadNextAsset()
      } else {
        if (preferencesStore.albumFilter.type !== 'all') {
          error.value = 'No photos match the album filter. Change it in the settings.'
        } else if (preferencesStore.reviewOrder !== 'random') {
          error.value = uiStore.skipVideos
            ? 'No photos found in chronological mode after skipping videos.'
            : 'No photos found in chronological mode.'
        } else {
          error.value = uiStore.skipVideos
            ? 'No photos were found after skipping videos. Try turning off Skip Videos mode.'
            : 'No photos found in your library'
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load photo'
    } finally {
      uiStore.setLoading(false)
    }
  }

  // Preload next
  async function preloadNextAsset(): Promise<void> {
    try {
      nextAsset.value = await fetchNextAsset()

      if (nextAsset.value) {
        const url = getAssetThumbnailUrl(nextAsset.value.id, 'preview')
        if (!url) return
        fetch(url, {
          headers: getAuthHeaders(),
        }).catch(() => {})
      }
    } catch (e) {
      console.error('Failed to preload next asset:', e)
    }
  }

  // Re-useable helper to show an asset and ensure we have a sensible "next" lined up
  function setCurrentAssetWithFallback(asset: ImmichAsset, resumeAsset: ImmichAsset | null): void {
    currentAsset.value = asset

    if (resumeAsset && resumeAsset.id !== asset.id) {
      nextAsset.value = resumeAsset
    } else if (!nextAsset.value) {
      preloadNextAsset()
    }
  }

  function enqueuePendingAsset(asset: ImmichAsset | null): void {
    if (!asset || reviewedStore.isReviewed(asset.id)) return
    pendingAssets.value = [
      asset,
      ...pendingAssets.value.filter((item) => item.id !== asset.id),
    ]
  }

  // Move to the next asset
  function moveToNextAsset(): void {
    const next = nextAsset.value
    nextAsset.value = null
    if (next && !reviewedStore.isReviewed(next.id)) {
      currentAsset.value = next
      preloadNextAsset()
    } else {
      loadInitialAsset(false)
    }
  }

  // Get asset thumbnail URL
  function getAssetThumbnailUrl(assetId: string, size: 'thumbnail' | 'preview' = 'preview'): string {
    if (!authStore.immichBaseUrl) {
      return ''
    }
    return `${authStore.apiBaseUrl}/assets/${assetId}/thumbnail?size=${size}`
  }

  function getAssetOriginalUrl(assetId: string): string {
    if (!authStore.immichBaseUrl) {
      return ''
    }
    return `${authStore.apiBaseUrl}/assets/${assetId}/original`
  }

  // Get headers for image requests
  function getAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': authStore.apiKey,
    }
  }

  async function fetchAlbums(force: boolean = false): Promise<ImmichAlbum[]> {
    if (albumsCache.value && !force) {
      return albumsCache.value
    }

    // Fetch owned + shared albums
    const [ownedAlbums, sharedAlbums] = await Promise.all([
      apiRequest<ImmichAlbum[]>('/albums'),
      apiRequest<ImmichAlbum[]>('/albums?shared=true'),
    ])

    // Merge & deduplicate (by id)
    const albumMap = new Map<string, ImmichAlbum>()
    for (const album of ownedAlbums) {
      albumMap.set(album.id, album)
    }
    for (const album of sharedAlbums) {
      if (!albumMap.has(album.id)) {
        albumMap.set(album.id, album)
      }
    }

    const albums = Array.from(albumMap.values())
    albumsCache.value = albums
    return albums
  }

  // Albums containing the asset; null if they could not be loaded (e.g. no album.read permission)
  function fetchAssetAlbums(assetId: string): Promise<ImmichAlbum[] | null> {
    const cached = assetAlbums.value[assetId]
    if (cached) return Promise.resolve(cached)
    const inFlight = assetAlbumRequests.get(assetId)
    if (inFlight) return inFlight

    const request = apiRequest<ImmichAlbum[]>(`/albums?assetId=${encodeURIComponent(assetId)}`)
      .then((albums) => {
        const list = Array.isArray(albums) ? albums : []
        assetAlbums.value = { ...assetAlbums.value, [assetId]: list }
        return list
      })
      .catch((e) => {
        console.warn('Failed to load albums of asset:', e)
        return null
      })
      .finally(() => assetAlbumRequests.delete(assetId))
    assetAlbumRequests.set(assetId, request)
    return request
  }

  const currentAssetAlbums = computed(() =>
    currentAsset.value ? assetAlbums.value[currentAsset.value.id] ?? null : null
  )

  // Load album membership for the visible asset and the preloaded one
  watch(
    () => [currentAsset.value?.id, nextAsset.value?.id],
    (ids) => {
      for (const id of ids) {
        if (id) fetchAssetAlbums(id)
      }
    }
  )

  async function addAssetToAlbum(albumId: string, assetId: string): Promise<void> {
    await apiRequest(`/albums/${albumId}/assets`, {
      method: 'PUT',
      body: JSON.stringify({
        ids: [assetId],
      }),
    })
  }

  // Delete asset (move to trash)
  async function deleteAsset(assetId: string, force: boolean = false): Promise<boolean> {
    try {
      await apiRequest('/assets', {
        method: 'DELETE',
        body: JSON.stringify({
          ids: [assetId],
          force,
        }),
      })
      return true
    } catch (e) {
      console.error('Failed to delete asset:', e)
      error.value = e instanceof Error ? e.message : 'Failed to delete photo'
      return false
    }
  }

  // Restore asset from trash
  async function restoreAsset(assetId: string): Promise<boolean> {
    try {
      await apiRequest('/trash/restore/assets', {
        method: 'POST',
        body: JSON.stringify({
          ids: [assetId],
        }),
      })
      return true
    } catch (e) {
      console.error('Failed to restore asset:', e)
      error.value = e instanceof Error ? e.message : 'Failed to restore photo'
      return false
    }
  }

  // Keep
  async function keepPhoto(): Promise<void> {
    if (!currentAsset.value) return
    const assetToKeep = currentAsset.value
    actionHistory.value.push({ asset: assetToKeep, type: 'keep' })
    reviewedStore.markReviewed(assetToKeep.id, 'keep')
    uiStore.incrementKept()
    uiStore.toast('Photo kept ✓', 'success', 1500)
    moveToNextAsset()
  }

  async function keepPhotoToAlbum(album: ImmichAlbum): Promise<void> {
    if (!currentAsset.value) return

    const assetToKeep = currentAsset.value
    try {
      await addAssetToAlbum(album.id, assetToKeep.id)
      const known = assetAlbums.value[assetToKeep.id]
      if (known && !known.some((item) => item.id === album.id)) {
        assetAlbums.value = { ...assetAlbums.value, [assetToKeep.id]: [...known, album] }
      }
      preferencesStore.setLastUsedAlbumId(album.id)
      actionHistory.value.push({
        asset: assetToKeep,
        type: 'keepToAlbum',
        albumName: album.albumName,
      })
      reviewedStore.markReviewed(assetToKeep.id, 'keep')
      uiStore.incrementKept()
      uiStore.toast(`Added to ${album.albumName}`, 'success', 1800)
      moveToNextAsset()
    } catch (e) {
      console.error('Failed to add asset to album:', e)
      uiStore.toast('Failed to add to album', 'error')
    }
  }

  async function toggleFavorite(): Promise<void> {
    if (!currentAsset.value) return

    const assetToUpdate = currentAsset.value
    const nextFavorite = !assetToUpdate.isFavorite

    try {
      const updatedAsset = { ...assetToUpdate, isFavorite: nextFavorite }

      await apiRequest(`/assets/${assetToUpdate.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isFavorite: nextFavorite }),
      })

      currentAsset.value = updatedAsset

      if (nextFavorite) {
        actionHistory.value.push({ asset: updatedAsset, type: 'keep' })
        reviewedStore.markReviewed(updatedAsset.id, 'keep')
        uiStore.incrementKept()
        uiStore.toast('Favorited ✓', 'success', 1500)
        moveToNextAsset()
      } else {
        uiStore.toast('Removed from favorites', 'info', 1500)
      }
    } catch (e) {
      console.error('Failed to update favorite:', e)
      uiStore.toast('Failed to update favorite', 'error')
    }
  }

  // Delete; assets that are in an album need a confirmation first (#20)
  let deletingAssetId: string | null = null
  async function deletePhoto(): Promise<void> {
    if (!currentAsset.value) return

    const assetToDelete = currentAsset.value
    // A second swipe/keypress while this one is running would delete twice and skip an asset
    if (deletingAssetId === assetToDelete.id) return
    deletingAssetId = assetToDelete.id
    try {
      const albums = await fetchAssetAlbums(assetToDelete.id)
      if (currentAsset.value?.id !== assetToDelete.id) return
      if (albums && albums.length > 0) {
        deleteConfirmation.value = { asset: assetToDelete, albums }
        return
      }
      await trashAsset(assetToDelete)
    } finally {
      deletingAssetId = null
    }
  }

  async function confirmDelete(): Promise<void> {
    const confirmation = deleteConfirmation.value
    deleteConfirmation.value = null
    if (confirmation && currentAsset.value?.id === confirmation.asset.id) {
      await trashAsset(confirmation.asset)
    }
  }

  function cancelDelete(): void {
    deleteConfirmation.value = null
  }

  async function trashAsset(assetToDelete: ImmichAsset): Promise<void> {
    const success = await deleteAsset(assetToDelete.id)

    if (success) {
      actionHistory.value.push({ asset: assetToDelete, type: 'delete' })
      reviewedStore.markReviewed(assetToDelete.id, 'delete')
      uiStore.incrementDeleted()
      uiStore.toast('Photo deleted', 'info', 1500)
      moveToNextAsset()
    } else {
      uiStore.toast('Failed to delete photo', 'error')
    }
  }

  // Undo last action (keep/delete/album)
  async function undoLastAction(): Promise<void> {
    const lastAction = actionHistory.value.pop()
    if (!lastAction) {
      uiStore.toast('Nothing to undo', 'info', 1500)
      return
    }

    const assetToResumeAfterUndo = currentAsset.value
    const preloadedAfterResume = nextAsset.value

    if (lastAction.type === 'delete') {
      const success = await restoreAsset(lastAction.asset.id)
      if (!success) {
        actionHistory.value.push(lastAction)
        uiStore.toast('Failed to restore photo', 'error')
        return
      }

      reviewedStore.unmarkReviewed(lastAction.asset.id)
      uiStore.decrementDeleted()
      uiStore.toast(`${lastAction.asset.originalFileName} was restored`, 'success', 2500)
      if (preloadedAfterResume?.id !== assetToResumeAfterUndo?.id) {
        enqueuePendingAsset(preloadedAfterResume)
      }
      setCurrentAssetWithFallback(lastAction.asset, assetToResumeAfterUndo)
      return
    }

    reviewedStore.unmarkReviewed(lastAction.asset.id)
    uiStore.decrementKept()
    if (lastAction.type === 'keepToAlbum' && lastAction.albumName) {
      uiStore.toast(`Back to photo (in ${lastAction.albumName})`, 'info', 2000)
    } else {
      uiStore.toast('Back to previous photo', 'info', 1500)
    }
    if (preloadedAfterResume?.id !== assetToResumeAfterUndo?.id) {
      enqueuePendingAsset(preloadedAfterResume)
    }
    setCurrentAssetWithFallback(lastAction.asset, assetToResumeAfterUndo)
  }

  const canUndo = computed(() => actionHistory.value.length > 0)

  return {
    currentAsset,
    nextAsset,
    error,
    testConnection,
    loadInitialAsset,
    keepPhoto,
    keepPhotoToAlbum,
    toggleFavorite,
    deletePhoto,
    confirmDelete,
    cancelDelete,
    deleteConfirmation,
    currentAssetAlbums,
    undoLastAction,
    canUndo,
    getAssetThumbnailUrl,
    getAssetOriginalUrl,
    getAuthHeaders,
    fetchAlbums,
    addAssetToAlbum,
  }
}
