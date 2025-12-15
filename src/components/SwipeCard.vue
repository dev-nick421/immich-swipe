<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSwipe } from '@/composables/useSwipe'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import type { ImmichAsset } from '@/types/immich'

const props = defineProps<{
  asset: ImmichAsset
}>()

const emit = defineEmits<{
  keep: []
  delete: []
}>()

const uiStore = useUiStore()
const authStore = useAuthStore()

const cardRef = ref<HTMLElement | null>(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const imageBlobUrl = ref<string | null>(null)

// composable
const { isSwiping, swipeOffset, swipeDirection } = useSwipe(cardRef, {
  threshold: 100,
  onSwipeRight: () => emit('keep'),
  onSwipeLeft: () => emit('delete'),
})

// transform based on swipe
const cardStyle = computed(() => {
  if (!isSwiping.value) {
    return {
      transform: 'translateX(0) rotate(0deg)',
      transition: 'transform 0.3s ease-out',
    }
  }

  const rotation = swipeOffset.value * 0.05
  return {
    transform: `translateX(${swipeOffset.value}px) rotate(${rotation}deg)`,
    transition: 'none',
  }
})

// Overlay indicator opacity
const keepIndicatorOpacity = computed(() => {
  if (swipeDirection.value === 'right') {
    return Math.min(Math.abs(swipeOffset.value) / 100, 1)
  }
  return 0
})

const deleteIndicatorOpacity = computed(() => {
  if (swipeDirection.value === 'left') {
    return Math.min(Math.abs(swipeOffset.value) / 100, 1)
  }
  return 0
})

// Fetch image with auth headers
async function fetchImage() {
  imageLoaded.value = false
  imageError.value = false

  // Revoke old blob URL
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
    imageBlobUrl.value = null
  }

  try {
    const url = `${authStore.proxyBaseUrl}/api/assets/${props.asset.id}/thumbnail?size=preview`
    const response = await fetch(url, {
      headers: {
        'x-api-key': authStore.apiKey,
        'X-Target-Host': authStore.immichBaseUrl,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    imageBlobUrl.value = URL.createObjectURL(blob)
    imageLoaded.value = true
  } catch (e) {
    console.error('Failed to load image:', e)
    imageError.value = true
  }
}

// Watch asset changes
watch(() => props.asset.id, () => {
  fetchImage()
}, { immediate: true })

// obvious things are obvious
const formattedDate = computed(() => {
  const date = new Date(props.asset.localDateTime || props.asset.fileCreatedAt)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})
</script>

<template>
  <div
    ref="cardRef"
    class="relative w-full h-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
    :style="cardStyle"
  >
    <!-- Image container -->
    <div class="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
      <!-- Loading placeholder -->
      <div
        v-if="!imageLoaded && !imageError"
        class="absolute inset-0 flex items-center justify-center"
        :class="uiStore.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'"
      >
        <div class="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          :class="uiStore.isDarkMode ? 'border-white/50' : 'border-gray-500'"
        ></div>
      </div>

      <!-- Error state -->
      <div
        v-if="imageError"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2"
        :class="uiStore.isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'"
      >
        <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>Failed to load image</p>
      </div>

      <!-- Actual image -->
      <img
        v-if="imageBlobUrl"
        :src="imageBlobUrl"
        :alt="asset.originalFileName"
        class="max-w-full max-h-full object-contain"
        draggable="false"
      />

      <!-- KEEP (right swipe) -->
      <div
        class="absolute inset-0 bg-green-500/30 flex items-center justify-center pointer-events-none transition-opacity"
        :style="{ opacity: keepIndicatorOpacity }"
      >
        <div class="bg-green-500 text-white px-8 py-4 rounded-xl text-2xl font-bold transform -rotate-12 border-4 border-white">
          KEEP
        </div>
      </div>

      <!-- DELETE (left swipe) -->
      <div
        class="absolute inset-0 bg-red-500/30 flex items-center justify-center pointer-events-none transition-opacity"
        :style="{ opacity: deleteIndicatorOpacity }"
      >
        <div class="bg-red-500 text-white px-8 py-4 rounded-xl text-2xl font-bold transform rotate-12 border-4 border-white">
          DELETE
        </div>
      </div>
    </div>

    <!-- media info -->
    <div
      class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl"
    >
      <p class="text-white text-sm truncate">{{ asset.originalFileName }}</p>
      <p class="text-white/70 text-xs">{{ formattedDate }}</p>
    </div>
  </div>
</template>

<style scoped>
img {
  -webkit-user-drag: none;
  user-select: none;
}
</style>