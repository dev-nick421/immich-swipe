<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useSwipe } from '@/composables/useSwipe'
import { useAuthStore } from '@/stores/auth'
import type { ImmichAlbum, ImmichAsset } from '@/types/immich'

const props = defineProps<{
  asset: ImmichAsset
  // Albums that contain the asset (#20), null while unknown
  albums?: ImmichAlbum[] | null
}>()

const albumNames = computed(() => (props.albums ?? []).map((album) => album.albumName).join(', '))

const emit = defineEmits<{
  keep: []
  delete: []
}>()

const authStore = useAuthStore()

const cardRef = ref<HTMLElement | null>(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const imageBlobUrl = ref<string | null>(null)
const videoBlobUrl = ref<string | null>(null)
const videoError = ref(false)
const videoLoading = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const videoAbortController = ref<AbortController | null>(null)
let autoplayCleanup: (() => void) | null = null
const assetApiBaseUrl = computed(() => authStore.apiBaseUrl)
const assetPageUrl = computed(() => {
  if (!authStore.immichBaseUrl) return ''
  try {
    const base = authStore.immichBaseUrl.endsWith('/')
      ? authStore.immichBaseUrl
      : `${authStore.immichBaseUrl}/`
    return new URL(`photos/${encodeURIComponent(props.asset.id)}`, base).toString()
  } catch {
    return ''
  }
})
const canOpenInImmich = computed(() => assetPageUrl.value.length > 0)

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

const isVideo = computed(() => props.asset.type === 'VIDEO')

function cleanupAutoplay() {
  if (autoplayCleanup) {
    autoplayCleanup()
    autoplayCleanup = null
  }
}

function configureInlinePlayback(video: HTMLVideoElement) {
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
}

function buildAssetApiUrl(path: string): string {
  if (!assetApiBaseUrl.value) {
    throw new Error('Immich server URL missing')
  }
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${assetApiBaseUrl.value}/assets/${props.asset.id}/${normalizedPath}`
}

function getAuthHeaders(): Record<string, string> {
  return {
    'x-api-key': authStore.apiKey,
  }
}

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
    const url = buildAssetApiUrl('thumbnail?size=preview')
    const response = await fetch(url, {
      headers: getAuthHeaders(),
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

function cleanupVideo() {
  cleanupAutoplay()
  if (videoAbortController.value) {
    videoAbortController.value.abort()
    videoAbortController.value = null
  }
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }
  if (videoBlobUrl.value) {
    URL.revokeObjectURL(videoBlobUrl.value)
    videoBlobUrl.value = null
  }
  videoError.value = false
  videoLoading.value = false
}

async function fetchVideo() {
  // Revoke old blob URL and cancel previous request
  cleanupVideo()

  videoLoading.value = true
  videoError.value = false

  const controller = new AbortController()
  videoAbortController.value = controller

  try {
    const url = buildAssetApiUrl('original')
    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    videoBlobUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    if (controller.signal.aborted) {
      return
    }
    console.error('Failed to load video:', e)
    videoError.value = true
  } finally {
    videoLoading.value = false
    videoAbortController.value = null
  }
}

function cleanupAllMedia() {
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
    imageBlobUrl.value = null
  }
  cleanupVideo()
}

// Watch asset changes
watch(() => props.asset.id, () => {
  cleanupAllMedia()
  if (isVideo.value) {
    fetchVideo()
  } else {
    fetchImage()
  }
}, { immediate: true })

watch([videoBlobUrl, () => videoRef.value], async ([newUrl, video]) => {
  cleanupAutoplay()
  if (!newUrl || !isVideo.value || !video) return
  await nextTick()
  if (videoRef.value !== video || videoBlobUrl.value !== newUrl) return
  configureInlinePlayback(video)
  video.muted = true
  video.defaultMuted = true

  const unmuteVideo = () => {
    if (videoRef.value !== video || videoBlobUrl.value !== newUrl) return
    video.muted = false
    video.defaultMuted = false
  }

  const attemptAutoplay = () => {
    if (videoRef.value !== video || videoBlobUrl.value !== newUrl) return
    video.play()
      .then(() => {
        unmuteVideo()
      })
      .catch(() => {
        // Autoplay can be blocked; keep unmuted for manual play.
        // unmuteVideo()
      })
  }

  const onReady = () => attemptAutoplay()
  video.addEventListener('loadeddata', onReady, { once: true })
  video.addEventListener('canplay', onReady, { once: true })
  autoplayCleanup = () => {
    video.removeEventListener('loadeddata', onReady)
    video.removeEventListener('canplay', onReady)
  }

  attemptAutoplay()
})

onBeforeUnmount(() => {
  cleanupAllMedia()
})

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
    class="relative h-full w-full select-none cursor-grab active:cursor-grabbing"
    :style="cardStyle"
  >
    <div class="relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-xl shadow-black/10 ring-1 ring-line dark:shadow-none">
      <!-- Media: contained in the card, never covered by captions or controls -->
      <div class="relative flex min-h-0 flex-1 items-center justify-center">
        <!-- Loading placeholder -->
        <div
          v-if="(isVideo && (videoLoading || (!videoBlobUrl && !videoError))) || (!isVideo && !imageLoaded && !imageError)"
          class="absolute inset-0 flex items-center justify-center"
        >
          <div class="size-8 animate-spin rounded-full border-4 border-fg/15 border-t-fg/60"></div>
        </div>

        <!-- Error state -->
        <div
          v-if="(isVideo && videoError) || (!isVideo && imageError)"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"
        >
          <svg class="size-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">Failed to load media</p>
        </div>

        <!-- Actual image -->
        <img
          v-if="!isVideo && imageBlobUrl"
          :src="imageBlobUrl"
          :alt="asset.originalFileName"
          class="h-full w-full object-contain"
          draggable="false"
        />

        <!-- Actual video -->
        <video
          v-else-if="isVideo && videoBlobUrl && !videoError"
          ref="videoRef"
          :src="videoBlobUrl"
          class="h-full w-full object-contain"
          playsinline
          webkit-playsinline
          loop
          controls
        />
      </div>

      <!-- Media info -->
      <div class="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 text-sm font-medium">
            <svg v-if="isVideo" class="size-4 shrink-0 text-muted" fill="currentColor" viewBox="0 0 24 24" aria-label="Video">
              <path d="M8 5.14v13.72a1 1 0 001.52.85l10.6-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" />
            </svg>
            <span class="truncate">{{ asset.originalFileName }}</span>
          </p>
          <p class="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span class="shrink-0">{{ formattedDate }}</span>
            <template v-if="albumNames">
              <span aria-hidden="true">·</span>
              <svg class="size-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="In albums">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span class="truncate" :title="`In ${albumNames}`">{{ albumNames }}</span>
            </template>
          </p>
        </div>
        <!-- A plain link: opens exactly one new tab, and an installed PWA hands it to the browser
             instead of navigating itself away (#16, #34) -->
        <a
          v-if="canOpenInImmich"
          :href="assetPageUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-field text-fg transition-colors hover:bg-field-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40"
          aria-label="Open in Immich"
          title="Open in Immich"
          draggable="false"
          @click.stop
          @pointerdown.stop
          @touchstart.stop
          @mousedown.stop
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17L17 7M10 7h7v7" />
          </svg>
        </a>
      </div>
    </div>

    <!-- KEEP (right swipe) -->
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-keep/25 transition-opacity"
      :style="{ opacity: keepIndicatorOpacity }"
    >
      <div class="-rotate-12 rounded-2xl border-4 border-white bg-keep px-6 py-2.5 text-2xl font-black tracking-widest text-white shadow-xl">
        KEEP
      </div>
    </div>

    <!-- DELETE (left swipe) -->
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-delete/25 transition-opacity"
      :style="{ opacity: deleteIndicatorOpacity }"
    >
      <div class="rotate-12 rounded-2xl border-4 border-white bg-delete px-6 py-2.5 text-2xl font-black tracking-widest text-white shadow-xl">
        DELETE
      </div>
    </div>
  </div>
</template>

<style scoped>
img {
  -webkit-user-drag: none;
  user-select: none;
}
</style>
