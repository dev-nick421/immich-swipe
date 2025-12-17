import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
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

  const currentAsset = ref<ImmichAsset | null>(null)
  const nextAsset = ref<ImmichAsset | null>(null)
  const lastDeletedAsset = ref<ImmichAsset | null>(null)
  const error = ref<string | null>(null)
  const SKIP_VIDEOS_BATCH_SIZE = 10
  const SKIP_VIDEOS_MAX_ATTEMPTS = 5
  const CHRONO_PAGE_SIZE = 50

  const albumsCache = ref<ImmichAlbum[] | null>(null)

  const chronologicalQueue = ref<ImmichAsset[]>([])
  const chronologicalSkip = ref(0)
  const chronologicalPage = ref<number | null>(1)
  const chronologicalHasMore = ref(true)
  const isFetchingChronological = ref(false)

  function resetReviewFlow() {
    chronologicalQueue.value = []
    chronologicalSkip.value = 0
    chronologicalPage.value = 1
    chronologicalHasMore.value = true
    nextAsset.value = null
    lastDeletedAsset.value = null
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
      const attempts = uiStore.skipVideos ? SKIP_VIDEOS_MAX_ATTEMPTS : 1
      for (let attempt = 0; attempt < attempts; attempt++) {
        const count = uiStore.skipVideos ? SKIP_VIDEOS_BATCH_SIZE : 1
        const assets = await apiRequest<ImmichAsset[]>(`/assets/random?count=${count}`)
        if (!assets || assets.length === 0) {
          continue
        }

        if (!uiStore.skipVideos) {
          return assets[0]
        }

        const photoAsset = assets.find((asset) => asset.type !== 'VIDEO')
        if (photoAsset) {
          return photoAsset
        }
      }

      if (uiStore.skipVideos) {
        throw new Error('Only video assets were returned. Disable Skip Videos mode to review them.')
      }
      return null
    } catch (e) {
      console.error('Failed to fetch random asset:', e)
      throw e
    }
  }

  async function fetchChronologicalBatch(): Promise<{ items: ImmichAsset[]; hasMore: boolean; nextPage: number | null }> {
    const order = preferencesStore.reviewOrder === 'chronological-desc' ? 'desc' : 'asc'
    const body: MetadataSearchRequest = {
      take: CHRONO_PAGE_SIZE,
      size: CHRONO_PAGE_SIZE,
      skip: chronologicalSkip.value,
      order,
      assetType: ['IMAGE', 'VIDEO'],
    }
    if (chronologicalPage.value !== null) {
      body.page = chronologicalPage.value
    }

    const response = await apiRequest<MetadataSearchResponse | ImmichAsset[]>('/search/metadata', {
      method: 'POST',
      body: JSON.stringify(body),
    })

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
    let attempts = 0

    while (chronologicalQueue.value.length === 0 && chronologicalHasMore.value && attempts < 5) {
      attempts++
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
      chronologicalSkip.value += batch.items.length
      chronologicalHasMore.value = batch.hasMore
      if (batch.nextPage !== null && !Number.isNaN(batch.nextPage)) {
        chronologicalPage.value = batch.nextPage
      } else if (chronologicalPage.value !== null && batch.hasMore) {
        chronologicalPage.value += 1
      }

      const filtered = uiStore.skipVideos
        ? batch.items.filter((asset) => asset.type !== 'VIDEO')
        : batch.items
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
    if (preferencesStore.reviewOrder !== 'random') {
      return fetchNextChronologicalAsset()
    }
    return fetchRandomAsset()
  }

  // Load initial and preload next
  async function loadInitialAsset(): Promise<void> {
    try {
      uiStore.setLoading(true, 'Loading photo...')
      error.value = null

      resetReviewFlow()
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

  // Move to the next asset
  function moveToNextAsset(): void {
    if (nextAsset.value) {
      currentAsset.value = nextAsset.value
      nextAsset.value = null
      preloadNextAsset()
    } else {
      loadInitialAsset()
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
      uiStore.incrementKept()
      uiStore.toast(`Added to ${album.albumName}`, 'success', 1800)
      moveToNextAsset()
    } catch (e) {
      console.error('Failed to add asset to album:', e)
      uiStore.toast('Failed to add to album', 'error')
    }
  }

  // Delete
  async function deletePhoto(): Promise<void> {
    if (!currentAsset.value) return

    const assetToDelete = currentAsset.value
    const success = await deleteAsset(assetToDelete.id)

    if (success) {
      lastDeletedAsset.value = assetToDelete
      uiStore.incrementDeleted()
      uiStore.toast('Photo deleted', 'info', 1500)
      moveToNextAsset()
    } else {
      uiStore.toast('Failed to delete photo', 'error')
    }
  }

  // Undo last deletion
  async function undoDelete(): Promise<void> {
    if (!lastDeletedAsset.value) {
      uiStore.toast('Nothing to undo', 'info', 1500)
      return
    }

    const assetToRestore = lastDeletedAsset.value
    const assetToResumeAfterUndo = currentAsset.value
    const success = await restoreAsset(assetToRestore.id)

    if (success) {
      uiStore.decrementDeleted()
      uiStore.toast(`${assetToRestore.originalFileName} was restored`, 'success', 2500)
      lastDeletedAsset.value = null

      setCurrentAssetWithFallback(assetToRestore, assetToResumeAfterUndo)
    } else {
      uiStore.toast('Failed to restore photo', 'error')
    }
  }

  // Check if undo is available
  function canUndo(): boolean {
    return lastDeletedAsset.value !== null
  }

  return {
    currentAsset,
    nextAsset,
    lastDeletedAsset,
    error,
    testConnection,
    loadInitialAsset,
    keepPhoto,
    keepPhotoToAlbum,
    deletePhoto,
    undoDelete,
    canUndo,
    getAssetThumbnailUrl,
    getAssetOriginalUrl,
    getAuthHeaders,
    fetchAlbums,
    addAssetToAlbum,
  }
}
