import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { ImmichAsset } from '@/types/immich'

export function useImmich() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()

  const currentAsset = ref<ImmichAsset | null>(null)
  const nextAsset = ref<ImmichAsset | null>(null)
  const error = ref<string | null>(null)

  // API requests through proxy
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Proxy URL: /immich-api/api/endpoint
    const url = `${authStore.proxyBaseUrl}/api${endpoint}`
    
    console.log('API Request:', url, 'Target:', authStore.immichBaseUrl)

    const headers: HeadersInit = {
      'x-api-key': authStore.apiKey,
      'X-Target-Host': authStore.immichBaseUrl,
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
      const assets = await apiRequest<ImmichAsset[]>('/assets/random?count=1')
      if (assets && assets.length > 0) {
        return assets[0]
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
        error.value = 'No photos found in your library'
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

  // Get asset thumbnail URL (proxy)
  function getAssetThumbnailUrl(assetId: string, size: 'thumbnail' | 'preview' = 'preview'): string {
    return `${authStore.proxyBaseUrl}/api/assets/${assetId}/thumbnail?size=${size}`
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

    const assetId = currentAsset.value.id
    const success = await deleteAsset(assetId)

    if (success) {
      uiStore.incrementDeleted()
      uiStore.toast('Photo deleted', 'info', 1500)
      moveToNextAsset()
    } else {
      uiStore.toast('Failed to delete photo', 'error')
    }
  }

  return {
    currentAsset,
    nextAsset,
    error,
    testConnection,
    loadInitialAsset,
    keepPhoto,
    deletePhoto,
    getAssetThumbnailUrl,
    getAuthHeaders,
  }
}