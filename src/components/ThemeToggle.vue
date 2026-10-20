<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
</script>

<template>
  <button
    type="button"
    class="inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-field hover:text-fg"
    :aria-label="uiStore.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="uiStore.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="uiStore.toggleDarkMode()"
  >
    <!-- Sun (dark mode) -->
    <svg v-if="uiStore.isDarkMode" class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <!-- Moon (light mode) -->
    <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  </button>
</template>
