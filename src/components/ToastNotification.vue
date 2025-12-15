<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { computed } from 'vue'

const uiStore = useUiStore()

const toastClasses = computed(() => {
  const base = 'fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg transition-all duration-300 z-50'
  const visibility = uiStore.showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'

  let color = ''
  switch (uiStore.toastType) {
    case 'success':
      color = 'bg-green-600 text-white'
      break
    case 'error':
      color = 'bg-red-600 text-white'
      break
    default:
      color = uiStore.isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
  }

  return `${base} ${visibility} ${color}`
})
</script>

<template>
  <div :class="toastClasses">
    {{ uiStore.toastMessage }}
  </div>
</template>
