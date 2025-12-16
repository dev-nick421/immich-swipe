import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { ImmichAsset } from '@/types/immich'

export function useImmich() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()

  const currentAsset = ref<ImmichAsset | null>(null)
  const nextAsset = ref<ImmichAsset | null>(null)
  const lastDeletedAsset = ref<ImmichAsset | null>(null)
  const error = ref<string | null>(null)
  const SKIP_VIDEOS_BATCH_SIZE = 10
  const SKIP_VIDEOS_MAX_ATTEMPTS = 5

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

  // Load initial and preload next
  async function loadInitialAsset(): Promise<void> {
    try {
      uiStore.setLoading(true, 'Loading photo...')
      error.value = null

      currentAsset.value = await fetchRandomAsset()

      if (currentAsset.value) {
        preloadNextAsset()
      } else {
        error.value = uiStore.skipVideos
          ? 'No photos were found after skipping videos. Try turning off Skip Videos mode.'
          : 'No photos found in your library'
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
      nextAsset.value = await fetchRandomAsset()

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
    deletePhoto,
    undoDelete,
    canUndo,
    getAssetThumbnailUrl,
    getAssetOriginalUrl,
    getAuthHeaders,
  }
}
