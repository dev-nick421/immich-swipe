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

  const chronologicalQueue = ref<ImmichAsset[]>([])
  const chronologicalSkip = ref(0)
  const chronologicalPage = ref<number | null>(1)
  const chronologicalPagingMode = ref<'skip' | 'page' | null>(null)
  const chronologicalHasMore = ref(true)
  const isFetchingChronological = ref(false)

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
    chronologicalQueue.value = []
    chronologicalSkip.value = 0
    chronologicalPage.value = 1
    chronologicalPagingMode.value = null
    chronologicalHasMore.value = true
    nextAsset.value = null
    pendingAssets.value = []
    actionHistory.value = []
  }

  watch(
    () => [authStore.serverUrl, authStore.currentUserName],
    () => {
      albumsCache.value = null
      resetReviewFlow()
    }
  )

  // Generic Immich API request helper
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!authStore.immichBaseUrl) {
      throw new Error('Immich server URL is not configured')
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${authStore.immichBaseUrl}${authStore.proxyBaseUrl}${normalizedEndpoint}`
    const headers: HeadersInit = {
      'x-api-key': authStore.apiKey,
      'Accept': 'application/json',
      ...options.headers,
    }

    // Add Content-Type for non-GET requests with body
    if (options.body && typeof options.body === 'string') {
      (headers as Record<string, string>)['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage: string
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || `API error: ${response.status}`
      } catch {
        errorMessage = `API error: ${response.status} - ${errorText}`
      }
      throw new Error(errorMessage)
    }

    // Handle empty
    const text = await response.text()
    if (!text) return {} as T
    return JSON.parse(text)
  }

  // Test connection
  async function testConnection(): Promise<boolean> {
    try {
      uiStore.setLoading(true, 'Testing connection...')
      await apiRequest('/users/me')
      return true
    } catch (e) {
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
        const count = uiStore.skipVideos ? SKIP_VIDEOS_BATCH_SIZE : RANDOM_BATCH_SIZE
        const assets = await apiRequest<ImmichAsset[]>(`/assets/random?count=${count}`)
        if (!assets || assets.length === 0) {
          continue
        }

        const candidate = assets.find(isReviewable)
        if (candidate) return candidate
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

  async function fetchChronologicalBatch(): Promise<{ items: ImmichAsset[]; hasMore: boolean; nextPage: number | null }> {
    const order = preferencesStore.reviewOrder === 'chronological-desc' ? 'desc' : 'asc'
    const usePagePagination = chronologicalPagingMode.value === 'page'
    const body: MetadataSearchRequest = {
      order,
      assetType: ['IMAGE', 'VIDEO'],
    }
    if (usePagePagination && chronologicalPage.value !== null) {
      body.page = chronologicalPage.value
      body.size = CHRONO_PAGE_SIZE
    } else {
      body.take = CHRONO_PAGE_SIZE
      body.skip = chronologicalSkip.value
    }

    const response = await apiRequest<MetadataSearchResponse | ImmichAsset[]>('/search/metadata', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (chronologicalPagingMode.value === null) {
      if (!Array.isArray(response) && (response?.nextPage !== undefined || response?.hasNextPage !== undefined)) {
        chronologicalPagingMode.value = 'page'
      } else {
        chronologicalPagingMode.value = 'skip'
        chronologicalPage.value = null
      }
    }

    if (Array.isArray(response)) {
      return { items: response, hasMore: response.length === CHRONO_PAGE_SIZE, nextPage: null }
    }

    if (response?.assets?.items) {
      const items = response.assets.items
      const nextPage = response.nextPage
      if (nextPage !== null && nextPage !== undefined) {
        return { items, hasMore: true, nextPage: Number(nextPage) }
      }
      if (typeof response.assets.total === 'number' && typeof response.assets.count === 'number') {
        return { items, hasMore: response.assets.total > response.assets.count, nextPage: null }
      }
      return { items, hasMore: items.length === CHRONO_PAGE_SIZE, nextPage: null }
    }

    const items = response?.items ?? []
    return {
      items,
      hasMore: response?.hasNextPage ?? (items.length === CHRONO_PAGE_SIZE),
      nextPage: null,
    }
  }

  async function fetchNextChronologicalAsset(): Promise<ImmichAsset | null> {
    while (chronologicalQueue.value.length === 0 && chronologicalHasMore.value) {
      await loadChronologicalBatch()
    }

    if (chronologicalQueue.value.length === 0) {
      return null
    }

    return chronologicalQueue.value.shift() || null
  }

  async function loadChronologicalBatch(): Promise<void> {
    if (isFetchingChronological.value || !chronologicalHasMore.value) return
    isFetchingChronological.value = true

    try {
      const batch = await fetchChronologicalBatch()
      if (chronologicalPagingMode.value !== 'page') {
        chronologicalSkip.value += batch.items.length
      }
      chronologicalHasMore.value = batch.hasMore
      if (batch.nextPage !== null && !Number.isNaN(batch.nextPage)) {
        chronologicalPage.value = batch.nextPage
      } else if (chronologicalPage.value !== null && batch.hasMore) {
        chronologicalPage.value += 1
      }

      const filtered = batch.items.filter(isReviewable)
      chronologicalQueue.value.push(...filtered)
    } catch (e) {
      console.error('Failed to fetch chronological assets:', e)
      chronologicalHasMore.value = false
      error.value = e instanceof Error ? e.message : 'Failed to load chronological assets'
    } finally {
      isFetchingChronological.value = false
    }
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
        if (preferencesStore.reviewOrder !== 'random') {
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
          headers: {
            'x-api-key': authStore.apiKey,
            'X-Target-Host': authStore.immichBaseUrl,
          },
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
    if (nextAsset.value) {
      currentAsset.value = nextAsset.value
      nextAsset.value = null
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
    return `${authStore.immichBaseUrl}${authStore.proxyBaseUrl}/assets/${assetId}/thumbnail?size=${size}`
  }

  function getAssetOriginalUrl(assetId: string): string {
    if (!authStore.immichBaseUrl) {
      return ''
    }
    return `${authStore.immichBaseUrl}${authStore.proxyBaseUrl}/assets/${assetId}/original`
  }

  // Get headers for image requests
  function getAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': authStore.apiKey,
      'X-Target-Host': authStore.immichBaseUrl,
    }
  }

  async function fetchAlbums(force: boolean = false): Promise<ImmichAlbum[]> {
    if (albumsCache.value && !force) {
      return albumsCache.value
    }

    const albums = await apiRequest<ImmichAlbum[]>('/albums')
    albumsCache.value = albums
    return albums
  }

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

  // Delete
  async function deletePhoto(): Promise<void> {
    if (!currentAsset.value) return

    const assetToDelete = currentAsset.value
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
    undoLastAction,
    canUndo,
    getAssetThumbnailUrl,
    getAssetOriginalUrl,
    getAuthHeaders,
    fetchAlbums,
    addAssetToAlbum,
  }
}
