import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

export const useUiStore = defineStore('ui', () => {
  const authStore = useAuthStore()
  // Dark mode state - persisted to localStorage
  const isDarkMode = ref<boolean>(true)
  const skipVideos = ref<boolean>(false)

  // Initialize from localStorage
  const storedTheme = localStorage.getItem('immich-swipe-theme')
  if (storedTheme !== null) {
    isDarkMode.value = storedTheme === 'dark'
  } else {
    // Default to system preference
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const storedSkipVideos = localStorage.getItem('immich-swipe-skip-videos')
  if (storedSkipVideos !== null) {
    skipVideos.value = storedSkipVideos === 'true'
  }

  // Watch and persist changes
  watch(isDarkMode, (newValue) => {
    localStorage.setItem('immich-swipe-theme', newValue ? 'dark' : 'light')
  })

  watch(skipVideos, (newValue) => {
    localStorage.setItem('immich-swipe-skip-videos', newValue ? 'true' : 'false')
  })

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
  }

  function toggleSkipVideos() {
    skipVideos.value = !skipVideos.value
  }

  // Loading state
  const isLoading = ref<boolean>(false)
  const loadingMessage = ref<string>('')

  function setLoading(loading: boolean, message: string = '') {
    isLoading.value = loading
    loadingMessage.value = message
  }

  // Toast notifications
  const toastMessage = ref<string>('')
  const toastType = ref<'success' | 'error' | 'info'>('info')
  const showToast = ref<boolean>(false)

  function toast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
    toastMessage.value = message
    toastType.value = type
    showToast.value = true

    setTimeout(() => {
      showToast.value = false
    }, duration)
  }

  // Stats (persisted per user/server)
  const keptCount = ref<number>(0)
  const deletedCount = ref<number>(0)
  const statsInitialized = ref(false)
  const statsStorageKey = computed(() => {
    const server = authStore.serverUrl || 'unknown-server'
    const user = authStore.currentUserName || 'default-user'
    return `immich-swipe-stats:${server}:${user}`
  })

  function loadStats() {
    statsInitialized.value = false
    const raw = localStorage.getItem(statsStorageKey.value)
    if (!raw) {
      keptCount.value = 0
      deletedCount.value = 0
      statsInitialized.value = true
      return
    }

    try {
      const parsed = JSON.parse(raw) as { keptCount?: number; deletedCount?: number }
      const kept = typeof parsed.keptCount === 'number' && Number.isFinite(parsed.keptCount) ? parsed.keptCount : 0
      const deleted =
        typeof parsed.deletedCount === 'number' && Number.isFinite(parsed.deletedCount) ? parsed.deletedCount : 0
      keptCount.value = kept
      deletedCount.value = deleted
    } catch (e) {
      console.error('Failed to parse stats from localStorage', e)
      keptCount.value = 0
      deletedCount.value = 0
    } finally {
      statsInitialized.value = true
    }
  }

  function persistStats() {
    if (!statsInitialized.value) return
    localStorage.setItem(
      statsStorageKey.value,
      JSON.stringify({ keptCount: keptCount.value, deletedCount: deletedCount.value })
    )
  }

  watch(statsStorageKey, () => loadStats(), { immediate: true })
  watch([keptCount, deletedCount, statsStorageKey], () => persistStats())

  function incrementKept() {
    keptCount.value++
  }

  function decrementKept() {
    if (keptCount.value > 0) {
      keptCount.value--
    }
  }

  function incrementDeleted() {
    deletedCount.value++
  }

  function decrementDeleted() {
    if (deletedCount.value > 0) {
      deletedCount.value--
    }
  }

  function resetStats() {
    keptCount.value = 0
    deletedCount.value = 0
  }

  return {
    isDarkMode,
    toggleDarkMode,
    isLoading,
    loadingMessage,
    setLoading,
    toastMessage,
    toastType,
    showToast,
    toast,
    keptCount,
    deletedCount,
    incrementKept,
    decrementKept,
    incrementDeleted,
    decrementDeleted,
    resetStats,
    skipVideos,
    toggleSkipVideos,
  }
})
