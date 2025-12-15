<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useImmich } from '@/composables/useImmich'
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/AppHeader.vue'
import SwipeCard from '@/components/SwipeCard.vue'
import ActionButtons from '@/components/ActionButtons.vue'

const { currentAsset, error, loadInitialAsset, keepPhoto, deletePhoto } = useImmich()
const uiStore = useUiStore()

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (!currentAsset.value) return

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    keepPhoto()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    deletePhoto()
  }
}

onMounted(() => {
  loadInitialAsset()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen flex flex-col"
    :class="uiStore.isDarkMode ? 'bg-black text-white' : 'bg-white text-black'"
  >
    <AppHeader />

    <!-- Main content -->
    <main class="flex-1 flex flex-col px-4 pb-4">
      <!-- Error state -->
      <div v-if="error && !currentAsset" class="flex-1 flex flex-col items-center justify-center gap-4">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4"
            :class="uiStore.isDarkMode ? 'text-gray-600' : 'text-gray-400'"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-lg"
            :class="uiStore.isDarkMode ? 'text-gray-400' : 'text-gray-600'"
          >
            {{ error }}
          </p>
        </div>
        <button
          @click="loadInitialAsset"
          class="px-6 py-2 rounded-lg transition-colors"
          :class="uiStore.isDarkMode
            ? 'bg-white text-black hover:bg-gray-200'
            : 'bg-black text-white hover:bg-gray-800'"
        >
          Try Again
        </button>
      </div>

      <!-- Swipe area -->
      <div v-else class="flex-1 flex flex-col">
        <!-- Card container -->
        <div class="flex-1 flex items-center justify-center p-2">
          <div v-if="currentAsset" class="w-full h-full max-w-lg max-h-[70vh]">
            <SwipeCard
              :asset="currentAsset"
              @keep="keepPhoto"
              @delete="deletePhoto"
            />
          </div>

          <!-- Empty state while loading -->
          <div v-else class="flex items-center justify-center"
            :class="uiStore.isDarkMode ? 'text-gray-600' : 'text-gray-400'"
          >
            <svg class="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- Action buttons -->
        <ActionButtons
          v-if="currentAsset"
          @keep="keepPhoto"
          @delete="deletePhoto"
        />

        <!-- Instructions -->
        <p class="text-center text-sm py-2"
          :class="uiStore.isDarkMode ? 'text-gray-500' : 'text-gray-400'"
        >
          Swipe right to keep • Swipe left to delete
        </p>
      </div>
    </main>
  </div>
</template>
