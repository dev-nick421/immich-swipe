<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()

const emit = defineEmits<{
  keep: []
  delete: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-8 py-4">
    <!-- Delete -->
    <button
      @click="emit('delete')"
      class="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
      :class="[
        uiStore.isDarkMode
          ? 'bg-gray-800 hover:bg-red-600 text-white'
          : 'bg-white hover:bg-red-500 hover:text-white text-red-500 border border-red-200'
      ]"
      aria-label="Delete photo"
    >
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Keep -->
    <button
      @click="emit('keep')"
      class="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
      :class="[
        uiStore.isDarkMode
          ? 'bg-gray-800 hover:bg-green-600 text-white'
          : 'bg-white hover:bg-green-500 hover:text-white text-green-500 border border-green-200'
      ]"
      aria-label="Keep photo"
    >
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  </div>
</template>
