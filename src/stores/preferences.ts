import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

type ReviewOrder = 'random' | 'chronological' | 'chronological-desc'

// Which assets to review: everything, only assets in no album, or one album (#20)
export type AlbumFilter =
  | { type: 'all' }
  | { type: 'not-in-album' }
  | { type: 'album'; albumId: string; albumName: string }

interface StoredPreferences {
  reviewOrder: ReviewOrder
  albumHotkeys: Record<string, string>
  lastUsedAlbumId: string | null
  albumFilter?: AlbumFilter
}

function parseAlbumFilter(value: unknown): AlbumFilter {
  const filter = value as Partial<{ type: string; albumId: string; albumName: string }> | null
  if (filter?.type === 'not-in-album') return { type: 'not-in-album' }
  if (filter?.type === 'album' && typeof filter.albumId === 'string' && filter.albumId) {
    return { type: 'album', albumId: filter.albumId, albumName: filter.albumName || 'Album' }
  }
  return { type: 'all' }
}

const STORAGE_PREFIX = 'immich-swipe-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  const authStore = useAuthStore()

  const reviewOrder = ref<ReviewOrder>('random')
  const albumHotkeys = ref<Record<string, string>>({})
  const lastUsedAlbumId = ref<string | null>(null)
  const albumFilter = ref<AlbumFilter>({ type: 'all' })

  const initialized = ref(false)

  const storageKey = computed(() => {
    const server = authStore.serverUrl || 'unknown-server'
    const user = authStore.currentUserName || 'default-user'
    return `${STORAGE_PREFIX}:${server}:${user}`
  })

  function loadFromStorage() {
    initialized.value = false
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) {
      reviewOrder.value = 'random'
      albumHotkeys.value = {}
      lastUsedAlbumId.value = null
      albumFilter.value = { type: 'all' }
      initialized.value = true
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredPreferences>
      reviewOrder.value = parsed.reviewOrder ?? 'random'
      albumHotkeys.value = parsed.albumHotkeys ?? {}
      lastUsedAlbumId.value = parsed.lastUsedAlbumId ?? null
      albumFilter.value = parseAlbumFilter(parsed.albumFilter)
    } catch (e) {
      console.error('Failed to parse preferences from localStorage', e)
    } finally {
      initialized.value = true
    }
  }

  function persist() {
    if (!initialized.value) return
    const payload: StoredPreferences = {
      reviewOrder: reviewOrder.value,
      albumHotkeys: albumHotkeys.value,
      lastUsedAlbumId: lastUsedAlbumId.value,
      albumFilter: albumFilter.value,
    }
    localStorage.setItem(storageKey.value, JSON.stringify(payload))
  }

  function setReviewOrder(order: ReviewOrder) {
    reviewOrder.value = order
  }

  function setHotkey(key: string, albumId: string) {
    albumHotkeys.value = {
      ...albumHotkeys.value,
      [key]: albumId,
    }
  }

  function clearHotkey(key: string) {
    const { [key]: _, ...rest } = albumHotkeys.value
    albumHotkeys.value = rest
  }

  function setLastUsedAlbumId(albumId: string | null) {
    lastUsedAlbumId.value = albumId
  }

  function setAlbumFilter(filter: AlbumFilter) {
    albumFilter.value = filter
  }

  // Load on init and whenever user/server changes
  watch(storageKey, () => loadFromStorage(), { immediate: true })

  // Persist on changes
  watch(
    [reviewOrder, albumHotkeys, lastUsedAlbumId, albumFilter, storageKey],
    () => persist(),
    { deep: true }
  )

  return {
    reviewOrder,
    albumHotkeys,
    lastUsedAlbumId,
    albumFilter,
    setReviewOrder,
    setHotkey,
    clearHotkey,
    setLastUsedAlbumId,
    setAlbumFilter,
  }
})
