<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="uiStore.isLoading"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-app/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="size-10 animate-spin rounded-full border-4 border-fg/15 border-t-fg"></div>
        <p v-if="uiStore.loadingMessage" class="text-fg">
          {{ uiStore.loadingMessage }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
