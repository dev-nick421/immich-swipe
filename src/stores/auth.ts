import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ImmichConfig, EnvUser, EnvConfig } from '@/types/immich'

const STORAGE_KEY = 'immich-swipe-config'
// Per-user data keys of the ui, reviewed and preferences stores
const USER_DATA_PREFIXES = ['immich-swipe-stats', 'immich-swipe-reviewed', 'immich-swipe-preferences']
const LEGACY_USER_NAME = 'default-user'

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

// Parse .env at module load time
export function parseEnvConfig(env: Record<string, string | boolean | undefined>): EnvConfig | null {
  // Values can carry stray whitespace (e.g. CRLF line endings in .env); a trailing \r in the
  // API key makes fetch() reject the header.
  const read = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '')
  const serverUrl = read('VITE_SERVER_URL')

  // Debug
  console.log('[Auth] Parsing env config...')
  console.log('[Auth] VITE_SERVER_URL:', serverUrl)
  
  if (!serverUrl) {
    console.log('[Auth] No VITE_SERVER_URL found, skipping env config')
    return null
  }

  const users: EnvUser[] = []

  // Parse users from .env: every VITE_USER_<N>_API_KEY in ascending order, gaps allowed
  const slots = Object.keys(env)
    .map((key) => /^VITE_USER_(\d+)_API_KEY$/.exec(key)?.[1])
    .filter((slot): slot is string => slot !== undefined)
    .sort((a, b) => Number(a) - Number(b))

  for (const slot of slots) {
    const apiKey = read(`VITE_USER_${slot}_API_KEY`)
    if (!apiKey) continue
    users.push({ name: read(`VITE_USER_${slot}_NAME`) || `User ${slot}`, apiKey })
  }

  if (users.length === 0) {
    console.log('[Auth] No users found in env config')
    return null
  }

  console.log(`[Auth] Found ${users.length} users:`, users.map(u => u.name))
  return { serverUrl, users }
}

const envConfig = parseEnvConfig(import.meta.env)

// Until the selected .env user was restored on reload (#8), per-user data of .env users ended
// up under "default-user". With a single .env user that data is unambiguous, so merge it in.
function migrateLegacyUserData(server: string, userName: string) {
  if (!envConfig || envConfig.users.length !== 1 || !userName || userName === LEGACY_USER_NAME) return

  for (const prefix of USER_DATA_PREFIXES) {
    const legacyKey = `${prefix}:${server}:${LEGACY_USER_NAME}`
    const userKey = `${prefix}:${server}:${userName}`
    const legacyRaw = localStorage.getItem(legacyKey)
    if (!legacyRaw) continue

    try {
      const legacy = JSON.parse(legacyRaw)
      const current = JSON.parse(localStorage.getItem(userKey) || 'null')
      localStorage.setItem(userKey, JSON.stringify(current ? mergeUserData(prefix, current, legacy) : legacy))
      localStorage.removeItem(legacyKey)
      console.log(`[Auth] Migrated ${legacyKey} to ${userKey}`)
    } catch (e) {
      console.error(`[Auth] Failed to migrate ${legacyKey}`, e)
    }
  }
}

function mergeUserData(prefix: string, current: Record<string, any>, legacy: Record<string, any>): unknown {
  const list = (value: unknown) => (Array.isArray(value) ? value : [])
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

  if (prefix === 'immich-swipe-reviewed') {
    return {
      ...current,
      kept: Array.from(new Set([...list(current.kept), ...list(legacy.kept)])),
      deleted: Array.from(new Set([...list(current.deleted), ...list(legacy.deleted)])),
    }
  }
  if (prefix === 'immich-swipe-stats') {
    return {
      keptCount: count(current.keptCount) + count(legacy.keptCount),
      deletedCount: count(current.deletedCount) + count(legacy.deletedCount),
    }
  }
  // Preferences: the legacy entry is what the user worked with after reloads
  return {
    ...current,
    ...legacy,
    albumHotkeys: { ...(current.albumHotkeys ?? {}), ...(legacy.albumHotkeys ?? {}) },
  }
}

export const useAuthStore = defineStore('auth', () => {
  const serverUrl = ref<string>('')
  const apiKey = ref<string>('')
  const currentUserName = ref<string>('')
  const hasStoredConfig = ref<boolean>(false)
  // Docker image with IMMICH_URL: the Immich API is reachable on this app's own origin
  const useBuiltInProxy = window.__IMMICH_SWIPE__?.proxy === true

  // .env state
  const hasEnvConfig = computed(() => envConfig !== null && envConfig.users.length > 0)
  const envUsers = computed(() => envConfig?.users || [])
  const needsUserSelection = computed(() => hasEnvConfig.value && envConfig!.users.length > 1 && !isLoggedIn.value)
  const hasSingleEnvUser = computed(() => hasEnvConfig.value && envConfig!.users.length === 1)

  function readStoredConfig(): ImmichConfig | null {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const config: ImmichConfig = JSON.parse(stored)
        return {
          serverUrl: config.serverUrl || '',
          apiKey: config.apiKey || '',
          userName: config.userName || '',
          source: config.source,
        }
      } catch {
        console.error('Failed to parse stored config')
      }
    }
    return null
  }

  // A stored login is only valid if it still matches how this build is configured
  function resolveStoredConfig(config: ImmichConfig): ImmichConfig | null {
    if (!config.serverUrl || !config.apiKey) return null

    if (envConfig) {
      // .env is the source of truth; drop logins from an older build (e.g. changed VITE_SERVER_URL)
      if (normalizeServerUrl(config.serverUrl) !== normalizeServerUrl(envConfig.serverUrl)) return null
      const matches = envConfig.users.filter((user) => user.apiKey === config.apiKey)
      const user = matches.find((match) => match.name === config.userName) ?? matches[0]
      return user ? { ...config, userName: user.name, source: 'env' } : null
    }

    // Without .env users only manual logins are valid
    return config.source === 'env' ? null : config
  }

  // Load from localStorage on init or when requested
  function loadConfig() {
    const stored = readStoredConfig()
    const config = stored ? resolveStoredConfig(stored) : null
    if (stored && !config) {
      console.warn('[Auth] Ignoring stored login that does not match the current configuration')
      localStorage.removeItem(STORAGE_KEY)
    }

    if (config) {
      if (config.source === 'env') {
        migrateLegacyUserData(normalizeServerUrl(config.serverUrl), config.userName || '')
      }
      serverUrl.value = config.serverUrl
      apiKey.value = config.apiKey
      currentUserName.value = config.userName || ''
      hasStoredConfig.value = true
    } else {
      serverUrl.value = ''
      apiKey.value = ''
      currentUserName.value = ''
      hasStoredConfig.value = false
    }
  }

  // Save to localStorage
  function saveConfig(source: 'env' | 'manual') {
    const config: ImmichConfig = {
      serverUrl: serverUrl.value,
      apiKey: apiKey.value,
      userName: currentUserName.value,
      source,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    hasStoredConfig.value = true
  }

  // Set config
  function setConfig(url: string, key: string, userName: string = '', source: 'env' | 'manual' = 'manual') {
    // Normalize URL - remove trailing slash
    serverUrl.value = normalizeServerUrl(url)
    apiKey.value = key
    currentUserName.value = userName
    saveConfig(source)
  }

  // Get user from .env
  function selectEnvUser(user: EnvUser) {
    if (!envConfig) return
    migrateLegacyUserData(normalizeServerUrl(envConfig.serverUrl), user.name)
    setConfig(envConfig.serverUrl, user.apiKey, user.name, 'env')
  }

  // Auto-login if single .env user
  function autoLoginSingleUser() {
    if (hasSingleEnvUser.value && envConfig) {
      selectEnvUser(envConfig.users[0])
      return true
    }
    return false
  }

  // Clear config (logout)
  function clearConfig() {
    serverUrl.value = ''
    apiKey.value = ''
    currentUserName.value = ''
    localStorage.removeItem(STORAGE_KEY)
    hasStoredConfig.value = false
  }

  function getStoredConfig(): ImmichConfig | null {
    return readStoredConfig()
  }

  // Check if logged in
  const isLoggedIn = computed(() => {
    return serverUrl.value.length > 0 && apiKey.value.length > 0
  })

  // Immich server base URL without /api suffix
  const immichBaseUrl = computed(() => {
    if (!serverUrl.value) return ''
    return serverUrl.value.replace(/\/api\/?$/, '')
  })

  // Base URL for Immich API calls (always ends with /api). With the built-in proxy the browser
  // stays on its own origin (no CORS); the server URL is then only used for "Open in Immich".
  const apiBaseUrl = computed(() => {
    if (!serverUrl.value) return ''
    if (useBuiltInProxy) {
      return new URL(`${import.meta.env.BASE_URL}api`, window.location.origin).toString()
    }
    return `${immichBaseUrl.value}/api`
  })

  // Initialize
  loadConfig()

  return {
    serverUrl,
    apiKey,
    currentUserName,
    isLoggedIn,
    hasStoredConfig,
    immichBaseUrl,
    apiBaseUrl,
    useBuiltInProxy,
    hasEnvConfig,
    envUsers,
    needsUserSelection,
    hasSingleEnvUser,
    setConfig,
    clearConfig,
    loadConfig,
    getStoredConfig,
    selectEnvUser,
    autoLoginSingleUser,
  }
})
