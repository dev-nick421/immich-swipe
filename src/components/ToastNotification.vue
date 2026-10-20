<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { computed } from 'vue'

const uiStore = useUiStore()

const colorClass = computed(() => {
  switch (uiStore.toastType) {
    case 'success':
      return 'bg-keep text-white'
    case 'error':
      return 'bg-delete text-white'
    default:
      return 'bg-fg text-app'
  }
})
</script>

<template>
  <!-- Below the header, clear of the notch / status bar -->
  <div
    class="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4rem)] z-[80] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-2.5 text-center text-sm font-medium shadow-lg transition-all duration-300"
    :class="[colorClass, uiStore.showToast ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0']"
    role="status"
    aria-live="polite"
  >
    {{ uiStore.toastMessage }}
  </div>
</template>
