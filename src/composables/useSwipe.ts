import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface SwipeOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function useSwipe(elementRef: Ref<HTMLElement | null>, options: SwipeOptions = {}) {
  const { threshold = 80, onSwipeLeft, onSwipeRight } = options

  const startX = ref(0)
  const startY = ref(0)
  const currentX = ref(0)
  const isSwiping = ref(false)
  const swipeOffset = ref(0)
  const swipeDirection = ref<'left' | 'right' | null>(null)

  let element: HTMLElement | null = null

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    startX.value = touch.clientX
    startY.value = touch.clientY
    currentX.value = touch.clientX
    isSwiping.value = true
    swipeDirection.value = null
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping.value) return

    const touch = e.touches[0]
    currentX.value = touch.clientX

    const deltaX = currentX.value - startX.value
    const deltaY = touch.clientY - startY.value

    // Only track horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault()
      swipeOffset.value = deltaX
      swipeDirection.value = deltaX > 0 ? 'right' : 'left'
    }
  }

  function handleTouchEnd() {
    if (!isSwiping.value) return

    const deltaX = currentX.value - startX.value

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    // Reset
    isSwiping.value = false
    swipeOffset.value = 0
    swipeDirection.value = null
  }

  function handleMouseDown(e: MouseEvent) {
    startX.value = e.clientX
    currentX.value = e.clientX
    isSwiping.value = true
    swipeDirection.value = null
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSwiping.value) return

    currentX.value = e.clientX
    const deltaX = currentX.value - startX.value
    swipeOffset.value = deltaX
    swipeDirection.value = deltaX > 0 ? 'right' : 'left'
  }

  function handleMouseUp() {
    if (!isSwiping.value) return

    const deltaX = currentX.value - startX.value

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    // Reset
    isSwiping.value = false
    swipeOffset.value = 0
    swipeDirection.value = null
  }

  function handleMouseLeave() {
    if (isSwiping.value) {
      isSwiping.value = false
      swipeOffset.value = 0
      swipeDirection.value = null
    }
  }

  onMounted(() => {
    element = elementRef.value
    if (element) {
      // Touch events
      element.addEventListener('touchstart', handleTouchStart, { passive: true })
      element.addEventListener('touchmove', handleTouchMove, { passive: false })
      element.addEventListener('touchend', handleTouchEnd)
      element.addEventListener('touchcancel', handleTouchEnd)

      // Mouse events (for desktop)
      element.addEventListener('mousedown', handleMouseDown)
      element.addEventListener('mousemove', handleMouseMove)
      element.addEventListener('mouseup', handleMouseUp)
      element.addEventListener('mouseleave', handleMouseLeave)
    }
  })

  onUnmounted(() => {
    if (element) {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)

      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  })

  return {
    isSwiping,
    swipeOffset,
    swipeDirection,
  }
}
