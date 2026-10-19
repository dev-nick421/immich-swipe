import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { useImmich } from '@/composables/useImmich'
import { useAuthStore } from '@/stores/auth'

async function connectionError(serverUrl: string, respond: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async () => respond()))
  useAuthStore().setConfig(serverUrl, 'api-key')
  const immich = useImmich()
  expect(await immich.testConnection()).toBe(false)
  return immich.error.value
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('useImmich error messages', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('explains network/CORS failures instead of "Failed to fetch"', async () => {
    const message = await connectionError('http://immich.example.com', () => {
      throw new TypeError('Failed to fetch')
    })
    expect(message).toContain('Could not reach Immich at http://immich.example.com')
    expect(message).toContain(`CORS requests from ${window.location.origin}`)
    expect(message).toContain('IMMICH_URL')
  })

  it('passes Immich error messages through', async () => {
    expect(await connectionError('http://immich', () => json({ message: 'Invalid API key', statusCode: 401 }, 401))).toBe(
      'Invalid API key'
    )
  })

  it('formats v2 and v3 validation errors', async () => {
    expect(await connectionError('http://immich', () => json({ message: ['size must not be less than 1'] }, 400))).toBe(
      'size must not be less than 1'
    )
    expect(
      await connectionError('http://immich', () =>
        json({ message: 'Validation failed', errors: [{ path: ['size'], message: 'Too small' }] }, 400)
      )
    ).toBe('Validation failed (size: Too small)')
  })

  it('does not dump HTML error pages', async () => {
    const message = await connectionError('http://immich', () => new Response('<html>Bad Gateway</html>', { status: 502 }))
    expect(message).toBe('API error: 502')
  })

  it('flags non-JSON success responses (server URL is not Immich)', async () => {
    const message = await connectionError('http://swipe.local', () => new Response('<!doctype html><html></html>'))
    expect(message).toContain('not JSON')
    expect(message).toContain('Does the server URL point to Immich?')
  })

  it('rejects server URLs without http(s) scheme', async () => {
    const message = await connectionError('immich.local:2283', () => json({}, 200))
    expect(message).toContain('must start with http:// or https://')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('points at IMMICH_URL when the built-in proxy cannot reach Immich', async () => {
    window.__IMMICH_SWIPE__ = { proxy: true }
    try {
      const message = await connectionError('http://immich', () => new Response('<html>502</html>', { status: 502 }))
      expect(message).toContain('built-in proxy could not reach Immich (HTTP 502)')
    } finally {
      delete window.__IMMICH_SWIPE__
    }
  })
})
