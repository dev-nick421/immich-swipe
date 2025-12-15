import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ImmichConfig } from '@/types/immich'

const STORAGE_KEY = 'immich-swipe-config'

export const useAuthStore = defineStore('auth', () => {
  const serverUrl = ref<string>('')
  const apiKey = ref<string>('')

  // Load from localStorage on init
  function loadConfig() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const config: ImmichConfig = JSON.parse(stored)
        serverUrl.value = config.serverUrl || ''
        apiKey.value = config.apiKey || ''
      } catch {
        console.error('Failed to parse stored config')
      }
    }
  }

  // Save to localStorage
  function saveConfig() {
    const config: ImmichConfig = {
      serverUrl: serverUrl.value,
      apiKey: apiKey.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }

  // Set config
  function setConfig(url: string, key: string) {
    // Normalize URL - remove trailing slash
    serverUrl.value = url.replace(/\/+$/, '')
    apiKey.value = key
    saveConfig()
  }

  // Clear config (logout)
  function clearConfig() {
    serverUrl.value = ''
    apiKey.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  // Check if logged in
  const isLoggedIn = computed(() => {
    return serverUrl.value.length > 0 && apiKey.value.length > 0
  })

  // Immich server base URL (ohne /api)
  const immichBaseUrl = computed(() => {
    if (!serverUrl.value) return ''
    return serverUrl.value.replace(/\/api\/?$/, '')
  })

  // Proxy base URL - requests go here
  const proxyBaseUrl = '/immich-api'

  // Initialize
  loadConfig()

  return {
    serverUrl,
    apiKey,
    isLoggedIn,
    immichBaseUrl,
    proxyBaseUrl,
    setConfig,
    clearConfig,
    loadConfig,
  }
})