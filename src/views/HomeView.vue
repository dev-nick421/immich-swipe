<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useImmich } from '@/composables/useImmich'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
import type { ImmichAlbum } from '@/types/immich'
import AppHeader from '@/components/AppHeader.vue'
import SwipeCard from '@/components/SwipeCard.vue'
import ActionButtons from '@/components/ActionButtons.vue'
import AlbumPicker from '@/components/AlbumPicker.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import TutorialSheet from '@/components/TutorialSheet.vue'

const {
  currentAsset,
  error,
  loadInitialAsset,
  keepPhoto,
  keepPhotoToAlbum,
  toggleFavorite,
  deletePhoto,
  confirmDelete,
  cancelDelete,
  deleteConfirmation,
  currentAssetAlbums,
  undoLastAction,
  fetchAlbums,
  canUndo,
} = useImmich()
const uiStore = useUiStore()
const preferencesStore = usePreferencesStore()

const showAlbumPicker = ref(false)
const isLoadingAlbums = ref(false)
const albumsError = ref<string | null>(null)
const albums = ref<ImmichAlbum[]>([])

const memberAlbumIds = computed(() => (currentAssetAlbums.value ?? []).map((album) => album.id))
const deleteConfirmationText = computed(() => {
  const names = deleteConfirmation.value?.albums.map((album) => album.albumName) ?? []
  if (names.length <= 1) return `It is in the album ${names[0] ?? ''}.`
  return `It is in ${names.length} albums: ${names.join(', ')}.`
})

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (deleteConfirmation.value) {
    // Enter confirms, unless a control inside the dialog (e.g. Cancel) has focus and handles it
    const active = document.activeElement
    const focusInDialog = active instanceof HTMLElement && active.closest('[role="dialog"]')
    if (e.key === 'Enter' && !focusInDialog) {
      e.preventDefault()
      confirmDelete()
    }
    return
  }
  // Sheets (settings, album picker, tutorial, ...) own the keyboard while open, not while closing
  if (document.querySelector('[role="dialog"]:not(.sheet-leave-active)')) return

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    undoLastAction()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undoLastAction()
    return
  }

  if (!currentAsset.value) return

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    keepPhoto()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    deletePhoto()
  } else if (e.key.toLowerCase() === 'f') {
    if (shouldIgnoreHotkeys()) return
    e.preventDefault()
    toggleFavorite()
  } else if (/^[0-9]$/.test(e.key)) {
    if (shouldIgnoreHotkeys()) return
    const albumId = preferencesStore.albumHotkeys[e.key]
    if (!albumId) {
      uiStore.toast(`No album configured for key ${e.key}`, 'info', 2000)
      return
    }
    const album = albums.value.find((item) => item.id === albumId)
    keepPhotoToAlbum(album || { id: albumId, albumName: `Album ${e.key}` })
  }
}

function shouldIgnoreHotkeys(): boolean {
  const active = document.activeElement as HTMLElement | null
  const isTyping = active && ['INPUT', 'TEXTAREA'].includes(active.tagName)
  return !!isTyping || showAlbumPicker.value
}

async function ensureAlbumsLoaded() {
  if (albums.value.length > 0 || isLoadingAlbums.value) return
  try {
    isLoadingAlbums.value = true
    albumsError.value = null
    albums.value = await fetchAlbums()
  } catch (e) {
    console.error(e)
    albumsError.value = e instanceof Error ? e.message : 'Failed to load albums'
  } finally {
    isLoadingAlbums.value = false
  }
}

async function openAlbumPicker() {
  await ensureAlbumsLoaded()
  showAlbumPicker.value = true
}

function closeAlbumPicker() {
  showAlbumPicker.value = false
}

async function handleAlbumSelected(album: ImmichAlbum) {
  await keepPhotoToAlbum(album)
  showAlbumPicker.value = false
}

function handleAssignHotkey(key: string, albumId: string | null) {
  if (albumId) {
    preferencesStore.setHotkey(key, albumId)
  } else {
    preferencesStore.clearHotkey(key)
  }
}

watch(
  () => [preferencesStore.reviewOrder, preferencesStore.albumFilter],
  async () => {
    await loadInitialAsset()
  },
  { deep: true }
)

onMounted(() => {
  loadInitialAsset()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="viewport-fit flex flex-col bg-app pt-safe text-fg">
    <AppHeader
      :albums="albums"
      :albums-loading="isLoadingAlbums"
      :albums-error="albumsError"
      @load-albums="ensureAlbumsLoaded"
    />

    <!-- Main content -->
    <main class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-safe pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <!-- Error state -->
      <div v-if="error && !currentAsset" class="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
        <span class="flex size-14 items-center justify-center rounded-full bg-field text-muted">
          <svg class="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <p class="max-w-md text-balance text-muted">
          {{ error }}
        </p>
        <button
          type="button"
          class="h-11 rounded-full bg-primary px-6 font-semibold text-primary-fg transition hover:opacity-90 active:scale-95"
          @click="() => loadInitialAsset()"
        >
          Try again
        </button>
      </div>

      <!-- Swipe area -->
      <template v-else>
        <div class="flex min-h-0 flex-1 items-center justify-center pt-1">
          <SwipeCard
            v-if="currentAsset"
            :asset="currentAsset"
            :albums="currentAssetAlbums"
            @keep="keepPhoto"
            @delete="deletePhoto"
          />

          <!-- Placeholder while loading -->
          <div v-else class="h-full w-full animate-pulse rounded-3xl bg-surface"></div>
        </div>

        <ActionButtons
          :class="currentAsset ? '' : 'pointer-events-none opacity-40'"
          :can-undo="canUndo"
          :is-favorite="currentAsset?.isFavorite ?? false"
          @keep="keepPhoto"
          @delete="deletePhoto"
          @undo="undoLastAction"
          @toggle-favorite="toggleFavorite"
          @open-album-picker="openAlbumPicker"
          @album-drop="openAlbumPicker"
        />

        <!-- Keyboard shortcuts, only on devices with a keyboard -->
        <p class="hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2 text-xs text-muted pointer-fine:flex">
          <span><kbd class="rounded bg-field px-1.5 py-0.5 font-sans">←</kbd> Delete</span>
          <span><kbd class="rounded bg-field px-1.5 py-0.5 font-sans">→</kbd> Keep</span>
          <span><kbd class="rounded bg-field px-1.5 py-0.5 font-sans">↑</kbd> Undo</span>
          <span><kbd class="rounded bg-field px-1.5 py-0.5 font-sans">F</kbd> Favorite</span>
          <span><kbd class="rounded bg-field px-1.5 py-0.5 font-sans">0–9</kbd> Album</span>
        </p>
      </template>
    </main>

    <AlbumPicker
      :open="showAlbumPicker"
      :albums="albums"
      :loading="isLoadingAlbums"
      :error="albumsError"
      :hotkeys="preferencesStore.albumHotkeys"
      :member-album-ids="memberAlbumIds"
      @close="closeAlbumPicker"
      @select="handleAlbumSelected"
      @assign-hotkey="handleAssignHotkey"
    />

    <!-- Deleting an asset that is in an album needs a confirmation (#20) -->
    <BottomSheet :open="!!deleteConfirmation" title="Delete this photo?" size="sm" @close="cancelDelete">
      <p class="text-sm text-muted">
        {{ deleteConfirmationText }} In the trash it is hidden from the album too, until you restore it.
      </p>
      <div class="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="h-11 rounded-xl bg-field font-medium transition-colors hover:bg-field-strong"
          @click="cancelDelete"
        >
          Cancel
        </button>
        <button
          type="button"
          class="h-11 rounded-xl bg-delete font-semibold text-white transition hover:opacity-90"
          @click="confirmDelete"
        >
          Delete
        </button>
      </div>
    </BottomSheet>

    <TutorialSheet />
  </div>
</template>
