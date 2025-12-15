<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="uiStore.isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center"
      :class="uiStore.isDarkMode ? 'bg-black/80' : 'bg-white/80'"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
          :class="uiStore.isDarkMode ? 'border-white' : 'border-gray-800'"
        ></div>
        <p v-if="uiStore.loadingMessage" class="text-lg"
          :class="uiStore.isDarkMode ? 'text-white' : 'text-gray-800'"
        >
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
