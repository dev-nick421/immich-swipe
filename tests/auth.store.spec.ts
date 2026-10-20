import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { parseEnvConfig } from '@/stores/auth'

const CONFIG_KEY = 'immich-swipe-config'

// envConfig is parsed when the module loads, so every scenario re-imports the store
async function loadAuthStore(env: Record<string, string> = {}) {
  vi.unstubAllEnvs()
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value)
  }
  vi.resetModules()
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  return useAuthStore()
}

const twoUsers = {
  VITE_SERVER_URL: 'https://immich.example.com',
  VITE_USER_1_NAME: 'Alice',
  VITE_USER_1_API_KEY: 'key-alice',
  VITE_USER_2_NAME: 'Bob',
  VITE_USER_2_API_KEY: 'key-bob',
}

describe('parseEnvConfig', () => {
  it('trims values, allows gaps and defaults missing names', () => {
    const config = parseEnvConfig({
      VITE_SERVER_URL: ' https://immich.example.com\r',
      VITE_USER_1_NAME: 'Alice',
      VITE_USER_1_API_KEY: 'key-1\r',
      VITE_USER_2_NAME: '',
      VITE_USER_2_API_KEY: '',
      VITE_USER_3_API_KEY: 'key-3',
    })
    expect(config).toEqual({
      serverUrl: 'https://immich.example.com',
      users: [
        { name: 'Alice', apiKey: 'key-1' },
        { name: 'User 3', apiKey: 'key-3' },
      ],
    })
  })

  it('returns null without server URL or users', () => {
    expect(parseEnvConfig({ VITE_USER_1_NAME: 'A', VITE_USER_1_API_KEY: 'k' })).toBeNull()
    expect(parseEnvConfig({ VITE_SERVER_URL: 'https://x', VITE_USER_1_NAME: 'A' })).toBeNull()
  })
})

describe('auth store stored login', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('restores the selected .env user after a reload (#8)', async () => {
    const auth = await loadAuthStore(twoUsers)
    auth.selectEnvUser({ name: 'Bob', apiKey: 'key-bob' })

    const reloaded = await loadAuthStore(twoUsers)
    expect(reloaded.isLoggedIn).toBe(true)
    expect(reloaded.currentUserName).toBe('Bob')
  })

  it('restores the user name of logins stored by older versions', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ serverUrl: 'https://immich.example.com', apiKey: 'key-alice' }))
    const auth = await loadAuthStore(twoUsers)
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.currentUserName).toBe('Alice')
  })

  it('drops a stored login when VITE_SERVER_URL changed', async () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ serverUrl: 'http://old-immich.local', apiKey: 'key-alice', userName: 'Alice', source: 'env' })
    )
    const auth = await loadAuthStore(twoUsers)
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.needsUserSelection).toBe(true)
    expect(localStorage.getItem(CONFIG_KEY)).toBeNull()
  })

  it('drops a stored login whose API key is no longer configured', async () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ serverUrl: 'https://immich.example.com', apiKey: 'old-key', userName: 'Alice', source: 'env' })
    )
    const auth = await loadAuthStore(twoUsers)
    expect(auth.isLoggedIn).toBe(false)
  })

  it('drops an .env login once the build has no .env users, keeps manual logins', async () => {
    const envLogin = { serverUrl: 'https://immich.example.com', apiKey: 'key-alice', userName: 'Alice', source: 'env' }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(envLogin))
    expect((await loadAuthStore()).isLoggedIn).toBe(false)

    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...envLogin, userName: '', source: 'manual' }))
    const auth = await loadAuthStore()
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.serverUrl).toBe('https://immich.example.com')
  })

  it('merges data stored under "default-user" into the single .env user', async () => {
    const server = 'https://immich.example.com'
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ serverUrl: server, apiKey: 'key-alice' }))
    localStorage.setItem(`immich-swipe-reviewed:${server}:default-user`, JSON.stringify({ v: 1, kept: ['a'], deleted: ['b'] }))
    localStorage.setItem(`immich-swipe-reviewed:${server}:Alice`, JSON.stringify({ v: 1, kept: ['c'], deleted: [] }))
    localStorage.setItem(`immich-swipe-stats:${server}:default-user`, JSON.stringify({ keptCount: 3, deletedCount: 1 }))
    localStorage.setItem(`immich-swipe-stats:${server}:Alice`, JSON.stringify({ keptCount: 1, deletedCount: 0 }))
    localStorage.setItem(
      `immich-swipe-preferences:${server}:default-user`,
      JSON.stringify({ reviewOrder: 'chronological', albumHotkeys: { '1': 'album-1' }, lastUsedAlbumId: 'album-1' })
    )

    const auth = await loadAuthStore({
      VITE_SERVER_URL: server,
      VITE_USER_1_NAME: 'Alice',
      VITE_USER_1_API_KEY: 'key-alice',
    })
    expect(auth.currentUserName).toBe('Alice')

    const reviewed = JSON.parse(localStorage.getItem(`immich-swipe-reviewed:${server}:Alice`) || '{}')
    expect(reviewed.kept.sort()).toEqual(['a', 'c'])
    expect(reviewed.deleted).toEqual(['b'])
    expect(JSON.parse(localStorage.getItem(`immich-swipe-stats:${server}:Alice`) || '{}')).toEqual({
      keptCount: 4,
      deletedCount: 1,
    })
    expect(JSON.parse(localStorage.getItem(`immich-swipe-preferences:${server}:Alice`) || '{}').reviewOrder).toBe(
      'chronological'
    )
    expect(Object.keys(localStorage).filter((key) => key.endsWith(':default-user'))).toEqual([])
  })

  it('does not attribute "default-user" data to one of several .env users', async () => {
    const server = 'https://immich.example.com'
    localStorage.setItem(`immich-swipe-reviewed:${server}:default-user`, JSON.stringify({ v: 1, kept: ['a'], deleted: [] }))
    const auth = await loadAuthStore(twoUsers)
    auth.selectEnvUser({ name: 'Alice', apiKey: 'key-alice' })
    expect(localStorage.getItem(`immich-swipe-reviewed:${server}:default-user`)).not.toBeNull()
    expect(localStorage.getItem(`immich-swipe-reviewed:${server}:Alice`)).toBeNull()
  })
})
