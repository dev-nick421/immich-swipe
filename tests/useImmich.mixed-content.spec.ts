// @vitest-environment-options { "url": "https://swipe.example.com/" }
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { useImmich } from '@/composables/useImmich'
import { useAuthStore } from '@/stores/auth'

it('explains mixed content when an HTTPS page talks to an HTTP Immich', async () => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  }))
  useAuthStore().setConfig('http://192.168.1.10:2283', 'api-key')

  const immich = useImmich()
  await immich.testConnection()

  expect(window.location.protocol).toBe('https:')
  expect(immich.error.value).toContain('this page uses HTTPS, the Immich server URL uses HTTP')
  vi.unstubAllGlobals()
})
