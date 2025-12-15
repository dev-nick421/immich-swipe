import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  // Dark mode state - persisted to localStorage
  const isDarkMode = ref<boolean>(true)

  // Initialize from localStorage
  const storedTheme = localStorage.getItem('immich-swipe-theme')
  if (storedTheme !== null) {
    isDarkMode.value = storedTheme === 'dark'
  } else {
    // Default to system preference
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // Watch and persist changes
  watch(isDarkMode, (newValue) => {
    localStorage.setItem('immich-swipe-theme', newValue ? 'dark' : 'light')
  })

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
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

  // Stats
  const keptCount = ref<number>(0)
  const deletedCount = ref<number>(0)

  function incrementKept() {
    keptCount.value++
  }

  function incrementDeleted() {
    deletedCount.value++
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
    incrementDeleted,
    resetStats,
  }
})
