<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import type { AlbumFilter } from '@/stores/preferences'
import type { ImmichAlbum } from '@/types/immich'
import BottomSheet from '@/components/BottomSheet.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

const props = defineProps<{
  open: boolean
  albums: ImmichAlbum[]
  albumsLoading: boolean
  albumsError: string | null
}>()

const emit = defineEmits<{
  close: []
  reset: []
  logout: []
  loadAlbums: []
}>()

const uiStore = useUiStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const orderOptions = [
  { value: 'random' as const, label: 'Random' },
  { value: 'chronological' as const, label: 'Oldest' },
  { value: 'chronological-desc' as const, label: 'Newest' },
]
const filterOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'not-in-album' as const, label: 'No album' },
  { value: 'album' as const, label: 'In album' },
]
const themeOptions = [
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
]

const theme = computed({
  get: () => (uiStore.isDarkMode ? 'dark' : 'light'),
  set: (value) => {
    if ((value === 'dark') !== uiStore.isDarkMode) uiStore.toggleDarkMode()
  },
})

// Album filter (#20): "In album" only applies once an album is picked
const filterMode = ref<AlbumFilter['type']>(preferencesStore.albumFilter.type)
watch(
  () => props.open,
  (open) => {
    if (!open) return
    filterMode.value = preferencesStore.albumFilter.type
    if (filterMode.value === 'album') emit('loadAlbums')
  }
)

function setFilterMode(mode: AlbumFilter['type']) {
  filterMode.value = mode
  if (mode === 'album') {
    emit('loadAlbums')
  } else {
    preferencesStore.setAlbumFilter({ type: mode })
  }
}

const selectedAlbumId = computed(() => {
  const filter = preferencesStore.albumFilter
  return filter.type === 'album' ? filter.albumId : ''
})
const selectedAlbumMissing = computed(
  () => selectedAlbumId.value !== '' && !props.albums.some((album) => album.id === selectedAlbumId.value)
)
const selectedAlbumName = computed(() => {
  const filter = preferencesStore.albumFilter
  return filter.type === 'album' ? filter.albumName : ''
})

function selectAlbum(albumId: string) {
  const album = props.albums.find((item) => item.id === albumId)
  if (album) {
    preferencesStore.setAlbumFilter({ type: 'album', albumId: album.id, albumName: album.albumName })
  }
}

const filterDescription = computed(() => {
  if (filterMode.value === 'not-in-album') return 'Only photos that are in no album'
  if (filterMode.value === 'album') return 'Only photos from one album'
  return 'Your whole library'
})

function showTutorial() {
  emit('close')
  uiStore.openTutorial()
}

const isSwitchUser = computed(() => authStore.hasEnvConfig && !authStore.hasSingleEnvUser)
const serverHost = computed(() => {
  try {
    return new URL(authStore.immichBaseUrl).host
  } catch {
    return authStore.immichBaseUrl
  }
})
</script>

<template>
  <BottomSheet :open="open" title="Settings" @close="emit('close')">
    <div class="-mx-5 flex-1 space-y-6 overflow-y-auto px-5 pb-1">
      <section>
        <h3 class="mb-2 text-sm font-medium text-muted">Order</h3>
        <SegmentedControl
          label="Review order"
          :options="orderOptions"
          :model-value="preferencesStore.reviewOrder"
          @update:model-value="preferencesStore.setReviewOrder"
        />
      </section>

      <section>
        <h3 class="mb-2 text-sm font-medium text-muted">Photos</h3>
        <SegmentedControl
          label="Album filter"
          :options="filterOptions"
          :model-value="filterMode"
          @update:model-value="setFilterMode"
        />
        <div v-if="filterMode === 'album'" class="mt-2">
          <p v-if="albumsError" class="rounded-xl bg-delete/10 px-4 py-3 text-sm text-delete">{{ albumsError }}</p>
          <select
            v-else
            aria-label="Album"
            class="h-11 w-full rounded-xl border border-transparent bg-field px-3 text-fg focus:border-fg/20 focus:outline-none focus:ring-4 focus:ring-fg/10"
            :value="selectedAlbumId"
            :disabled="albumsLoading && albums.length === 0"
            @change="selectAlbum(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>{{ albumsLoading ? 'Loading albums…' : 'Choose an album…' }}</option>
            <option v-if="selectedAlbumMissing" :value="selectedAlbumId">{{ selectedAlbumName }}</option>
            <option v-for="album in albums" :key="album.id" :value="album.id">{{ album.albumName }}</option>
          </select>
        </div>
        <p class="mt-2 text-sm text-muted">{{ filterDescription }}</p>
      </section>

      <button
        type="button"
        role="switch"
        :aria-checked="uiStore.skipVideos"
        class="flex w-full items-center justify-between gap-4 rounded-2xl bg-field px-4 py-3 text-left"
        @click="uiStore.toggleSkipVideos()"
      >
        <span>
          <span class="block font-medium">Skip videos</span>
          <span class="block text-sm text-muted">Only show photos</span>
        </span>
        <span
          class="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          :class="uiStore.skipVideos ? 'bg-primary' : 'bg-field-strong'"
        >
          <span
            class="absolute top-0.5 size-6 rounded-full shadow transition-all"
            :class="uiStore.skipVideos ? 'left-[1.375rem] bg-primary-fg' : 'left-0.5 bg-white'"
          />
        </span>
      </button>

      <section>
        <h3 class="mb-2 text-sm font-medium text-muted">Appearance</h3>
        <SegmentedControl v-model="theme" label="Appearance" :options="themeOptions" />
      </section>

      <section>
        <h3 class="mb-2 text-sm font-medium text-muted">Review history</h3>
        <div class="flex items-center justify-between gap-4 rounded-2xl bg-field px-4 py-3">
          <span class="flex items-center gap-4 text-sm tabular-nums">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-keep" />
              {{ uiStore.keptCount }} kept
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-delete" />
              {{ uiStore.deletedCount }} deleted
            </span>
          </span>
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-sm font-medium text-delete transition-colors hover:bg-delete/10"
            @click="emit('reset')"
          >
            Reset
          </button>
        </div>
      </section>

      <button
        type="button"
        class="flex w-full items-center justify-between rounded-2xl bg-field px-4 py-3 text-left font-medium transition-colors hover:bg-field-strong"
        @click="showTutorial"
      >
        How it works
        <svg class="size-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <section class="flex items-center justify-between gap-4 border-t border-line pt-5">
        <div class="min-w-0">
          <p class="truncate font-medium">{{ authStore.currentUserName || 'Signed in' }}</p>
          <p class="truncate text-sm text-muted">{{ serverHost }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full bg-field px-4 py-2 text-sm font-medium transition-colors hover:bg-field-strong"
          @click="emit('logout')"
        >
          {{ isSwitchUser ? 'Switch user' : 'Log out' }}
        </button>
      </section>
    </div>
  </BottomSheet>
</template>
