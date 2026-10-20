<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

// Bottom sheet on phones, centered dialog from the sm breakpoint on
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  subtitle?: string
  // sm: confirmations, md: settings, lg: lists
  size?: 'sm' | 'md' | 'lg'
  // Take most of the screen height on phones (long lists)
  tall?: boolean
}>(), {
  size: 'md',
  tall: false,
})

const emit = defineEmits<{
  close: []
}>()

const dragStartY = ref<number | null>(null)
const dragOffset = ref(0)

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  dragStartY.value = event.touches[0].clientY
  dragOffset.value = 0
}

function onTouchMove(event: TouchEvent) {
  if (dragStartY.value === null || event.touches.length !== 1) return
  dragOffset.value = Math.max(0, event.touches[0].clientY - dragStartY.value)
}

function onTouchEnd() {
  if (dragStartY.value === null) return
  if (dragOffset.value > 80) emit('close')
  dragStartY.value = null
  dragOffset.value = 0
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKeydown, true)
    else window.removeEventListener('keydown', onKeydown, true)
  },
  { immediate: true }
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-backdrop">
      <div v-if="open" class="fixed inset-0 z-40 bg-black/60" @click="emit('close')" />
    </Transition>
    <Transition name="sheet">
      <div
        v-if="open"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-3xl border-t border-line bg-raised text-fg shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:rounded-3xl sm:border"
        :class="[
          size === 'sm' ? 'sm:max-w-sm' : size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
          tall ? 'h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)]' : 'max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)]',
        ]"
        :style="dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined"
      >
        <div
          class="shrink-0 touch-none"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <div class="flex justify-center pt-2.5 sm:hidden">
            <span class="h-1.5 w-10 rounded-full bg-field-strong" />
          </div>
          <div class="flex items-start justify-between gap-4 px-5 pb-3 pt-3 sm:pt-5">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold leading-tight">{{ title }}</h2>
              <p v-if="subtitle" class="mt-0.5 text-sm text-muted">{{ subtitle }}</p>
            </div>
            <button
              type="button"
              class="-mr-1.5 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-field hover:text-fg"
              aria-label="Close"
              @click="emit('close')"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
@media (min-width: 40rem) {
  .sheet-enter-from,
  .sheet-leave-to {
    transform: scale(0.96);
    opacity: 0;
  }
}
</style>
