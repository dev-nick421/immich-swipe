import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useUiStore } from '@/stores/ui'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    setActivePinia(createPinia())
  })

  it('applies the theme to <html> and the theme-color meta', async () => {
    localStorage.setItem('immich-swipe-theme', 'dark')
    const ui = useUiStore()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    ui.toggleDarkMode()
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#ffffff')
    expect(localStorage.getItem('immich-swipe-theme')).toBe('light')
  })

  it('shows the tutorial once', () => {
    const ui = useUiStore()
    expect(ui.showTutorial).toBe(true)
    ui.closeTutorial()
    expect(ui.showTutorial).toBe(false)

    setActivePinia(createPinia())
    expect(useUiStore().showTutorial).toBe(false)
  })
})
