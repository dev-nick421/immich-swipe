import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { useImmich } from '@/composables/useImmich'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import type { ImmichAlbum, ImmichAsset } from '@/types/immich'

function makeAsset(id: string): ImmichAsset {
  const now = new Date().toISOString()
  return {
    id,
    deviceAssetId: id,
    ownerId: 'owner-1',
    deviceId: 'device-1',
    type: 'IMAGE',
    originalPath: `/tmp/${id}.jpg`,
    originalFileName: `${id}.jpg`,
    fileCreatedAt: now,
    fileModifiedAt: now,
    localDateTime: now,
    updatedAt: now,
    isFavorite: false,
    isArchived: false,
    isTrashed: false,
    isOffline: false,
    hasMetadata: false,
  }
}

const family: ImmichAlbum = { id: 'album-family', albumName: 'Family' }

function mockFetch(albumsByAsset: Record<string, ImmichAlbum[] | 'error'>): Mock {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/albums' && url.searchParams.has('assetId')) {
      const albums = albumsByAsset[url.searchParams.get('assetId')!] ?? []
      return albums === 'error'
        ? new Response(JSON.stringify({ message: 'Missing required permission: album.read' }), { status: 403 })
        : new Response(JSON.stringify(albums))
    }
    if (url.pathname === '/api/search/random') {
      return new Response(JSON.stringify([makeAsset('a1'), makeAsset('a2')]))
    }
    if (url.pathname === '/api/search/metadata') {
      return new Response(JSON.stringify({ assets: { items: [makeAsset('a1')], nextPage: null } }))
    }
    if (init?.method === 'DELETE') return new Response(null, { status: 204 })
    return new Response('{}')
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const bodiesOf = (fetchMock: Mock, path: string) =>
  fetchMock.mock.calls
    .filter(([input]) => String(input).includes(path))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))

const deleteCalls = (fetchMock: Mock) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')

describe('useImmich album features (#20)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useAuthStore().setConfig('http://immich.example.com', 'api-key', 'Alice')
  })

  afterEach(async () => {
    // Let preloads started by the test finish against the mock
    await new Promise((resolve) => setTimeout(resolve, 10))
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the album filter to random and metadata search', async () => {
    const fetchMock = mockFetch({})
    const prefs = usePreferencesStore()
    const immich = useImmich()

    prefs.setAlbumFilter({ type: 'not-in-album' })
    await immich.loadInitialAsset()
    expect(bodiesOf(fetchMock, '/search/random')[0]).toMatchObject({ isNotInAlbum: true })

    prefs.setAlbumFilter({ type: 'album', albumId: 'album-family', albumName: 'Family' })
    prefs.setReviewOrder('chronological')
    await immich.loadInitialAsset()
    const metadata = bodiesOf(fetchMock, '/search/metadata')[0]
    expect(metadata).toMatchObject({ albumIds: ['album-family'] })
    expect(metadata).not.toHaveProperty('isNotInAlbum')
  })

  it('does not filter by album by default', async () => {
    const fetchMock = mockFetch({})
    await useImmich().loadInitialAsset()
    const body = bodiesOf(fetchMock, '/search/random')[0]
    expect(body).not.toHaveProperty('isNotInAlbum')
    expect(body).not.toHaveProperty('albumIds')
  })

  it('loads the albums of the current asset', async () => {
    const fetchMock = mockFetch({ a1: [family] })
    const immich = useImmich()
    await immich.loadInitialAsset()

    await vi.waitFor(() => expect(immich.currentAssetAlbums.value).toEqual([family]))
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/albums?assetId=a1'))).toBe(true)
  })

  it('asks before deleting an asset that is in an album', async () => {
    const fetchMock = mockFetch({ a1: [family] })
    const immich = useImmich()
    await immich.loadInitialAsset()

    await immich.deletePhoto()
    expect(immich.deleteConfirmation.value?.albums).toEqual([family])
    expect(deleteCalls(fetchMock)).toHaveLength(0)

    immich.cancelDelete()
    expect(immich.deleteConfirmation.value).toBeNull()
    expect(immich.currentAsset.value?.id).toBe('a1')

    await immich.deletePhoto()
    await immich.confirmDelete()
    expect(deleteCalls(fetchMock)).toHaveLength(1)
    await nextTick()
    expect(immich.currentAsset.value?.id).toBe('a2')
  })

  it('deletes right away when the asset is in no album, or albums cannot be loaded', async () => {
    const fetchMock = mockFetch({ a1: [], a2: 'error' })
    const immich = useImmich()
    await immich.loadInitialAsset()

    await immich.deletePhoto()
    expect(immich.deleteConfirmation.value).toBeNull()
    expect(deleteCalls(fetchMock)).toHaveLength(1)

    await vi.waitFor(() => expect(immich.currentAsset.value?.id).toBe('a2'))
    await immich.deletePhoto()
    expect(deleteCalls(fetchMock)).toHaveLength(2)
  })

  it('ignores a second delete of the same asset while the first is running', async () => {
    const fetchMock = mockFetch({ a1: [] })
    const immich = useImmich()
    await immich.loadInitialAsset()

    await Promise.all([immich.deletePhoto(), immich.deletePhoto()])
    expect(deleteCalls(fetchMock)).toHaveLength(1)
  })
})
