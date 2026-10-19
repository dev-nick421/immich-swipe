import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { useImmich } from '@/composables/useImmich'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
import type { ImmichAsset } from '@/types/immich'

function makeAsset(id: string, type: ImmichAsset['type'] = 'IMAGE'): ImmichAsset {
  const now = new Date().toISOString()
  return {
    id,
    deviceAssetId: `da-${id}`,
    ownerId: 'owner-1',
    deviceId: 'device-1',
    type,
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

type Route = (body: Record<string, unknown>) => Response | Promise<Response>

function mockFetch(routes: Record<string, Route>): Mock {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    for (const [path, handler] of Object.entries(routes)) {
      if (url.includes(path)) return handler(body)
    }
    return new Response('{}', { status: 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function callsTo(fetchMock: Mock, path: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes(path))
}

describe('useImmich search requests', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useAuthStore().setConfig('http://immich.example.com', 'api-key', 'Alice')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('random mode uses POST /search/random with timeline visibility', async () => {
    const fetchMock = mockFetch({
      '/search/random': () => new Response(JSON.stringify([makeAsset('a1'), makeAsset('a2')])),
    })

    const immich = useImmich()
    await immich.loadInitialAsset()

    expect(immich.error.value).toBeNull()
    expect(immich.currentAsset.value?.id).toBe('a1')
    const [url, init] = callsTo(fetchMock, '/search/random')[0]
    expect(url).toBe('http://immich.example.com/api/search/random')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ size: 5, visibility: 'timeline' })
    expect(callsTo(fetchMock, '/assets/random')).toHaveLength(0)
  })

  it('random mode asks the server for images only when skipping videos', async () => {
    const fetchMock = mockFetch({
      '/search/random': () => new Response(JSON.stringify([makeAsset('a1')])),
    })
    useUiStore().toggleSkipVideos()

    const immich = useImmich()
    await immich.loadInitialAsset()

    const body = JSON.parse(callsTo(fetchMock, '/search/random')[0][1].body)
    expect(body).toEqual({ size: 10, visibility: 'timeline', type: 'IMAGE' })
  })

  it('chronological mode pages with page/size and follows nextPage until null', async () => {
    const pages: Record<number, { items: ImmichAsset[]; nextPage: string | null }> = {
      1: { items: [makeAsset('p1')], nextPage: '2' },
      2: { items: [makeAsset('p2')], nextPage: null },
    }
    const fetchMock = mockFetch({
      '/search/metadata': (body) => {
        const page = pages[body.page as number]
        return new Response(JSON.stringify({ assets: { ...page, total: 1, count: 1 } }))
      },
    })
    usePreferencesStore().setReviewOrder('chronological')

    const immich = useImmich()
    await immich.loadInitialAsset()
    await vi.waitFor(() => expect(immich.nextAsset.value?.id).toBe('p2'))

    expect(immich.currentAsset.value?.id).toBe('p1')
    const bodies = callsTo(fetchMock, '/search/metadata').map(([, init]) => JSON.parse(init.body))
    expect(bodies).toEqual([
      { order: 'asc', page: 1, size: 50, visibility: 'timeline' },
      { order: 'asc', page: 2, size: 50, visibility: 'timeline' },
    ])

    // Last page reached: no further requests, nothing left to show
    await immich.keepPhoto()
    await vi.waitFor(() => expect(immich.currentAsset.value?.id).toBe('p2'))
    expect(callsTo(fetchMock, '/search/metadata')).toHaveLength(2)
  })

  it('chronological mode shares one in-flight request between concurrent callers', async () => {
    let resolveRequest: (r: Response) => void = () => {}
    const fetchMock = mockFetch({
      '/search/metadata': () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    })
    usePreferencesStore().setReviewOrder('chronological-desc')

    const immich = useImmich()
    const first = immich.loadInitialAsset()
    const second = immich.loadInitialAsset(false)
    await vi.waitFor(() => expect(callsTo(fetchMock, '/search/metadata')).toHaveLength(1))
    resolveRequest(
      new Response(JSON.stringify({ assets: { items: [makeAsset('d1'), makeAsset('d2')], nextPage: null } }))
    )
    await Promise.all([first, second])

    expect(callsTo(fetchMock, '/search/metadata')).toHaveLength(1)
    expect(JSON.parse(callsTo(fetchMock, '/search/metadata')[0][1].body).order).toBe('desc')
  })

  it('chronological mode reports the real error instead of "No photos found"', async () => {
    mockFetch({
      '/search/metadata': () => new Response(JSON.stringify({ message: 'Missing required permission: asset.read' }), { status: 403 }),
    })
    usePreferencesStore().setReviewOrder('chronological')

    const immich = useImmich()
    await immich.loadInitialAsset()

    expect(immich.currentAsset.value).toBeNull()
    expect(immich.error.value).toContain('Missing required permission: asset.read')
  })
})
