<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ImmichAlbum } from '@/types/immich'
import BottomSheet from '@/components/BottomSheet.vue'

const props = defineProps<{
  open: boolean
  albums: ImmichAlbum[]
  loading: boolean
  error: string | null
  hotkeys: Record<string, string>
  // Albums that already contain the current asset (#20)
  memberAlbumIds?: string[]
}>()

const emit = defineEmits<{
  close: []
  select: [ImmichAlbum]
  assignHotkey: [string, string | null]
}>()

const search = ref('')

const filteredAlbums = computed(() => {
  if (!search.value) return props.albums
  return props.albums.filter((album) =>
    album.albumName.toLowerCase().includes(search.value.toLowerCase())
  )
})

const hotkeyOptions = computed(() => props.albums.map((album) => ({
  label: album.albumName,
  value: album.id,
})))

const hotkeyByAlbum = computed(() => {
  const map: Record<string, string> = {}
  for (const [key, albumId] of Object.entries(props.hotkeys)) {
    map[albumId] = key
  }
  return map
})

function isMember(album: ImmichAlbum): boolean {
  return props.memberAlbumIds?.includes(album.id) ?? false
}

function handleSelect(album: ImmichAlbum) {
  emit('select', album)
}

function handleHotkeyChange(key: string, value: string) {
  emit('assignHotkey', key, value || null)
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      search.value = ''
    }
  }
)
</script>

<template>
  <BottomSheet :open="open" title="Add to album" subtitle="Keeps the photo and adds it to the album" size="lg" tall @close="emit('close')">
    <div class="flex min-h-0 flex-1 flex-col gap-4">
      <div class="relative">
        <svg class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search albums"
          class="h-11 w-full rounded-xl border border-transparent bg-field pl-10 pr-4 text-fg transition placeholder:text-muted focus:border-fg/20 focus:outline-none focus:ring-4 focus:ring-fg/10"
        />
      </div>

      <div v-if="loading" class="flex items-center justify-center py-10">
        <div class="size-8 animate-spin rounded-full border-4 border-fg/15 border-t-fg/60"></div>
      </div>

      <div v-else-if="error" class="rounded-xl bg-delete/10 px-4 py-3 text-sm text-delete">
        {{ error }}
      </div>

      <div v-else class="-mx-2 grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-1 overflow-y-auto px-2 sm:max-h-[22rem] sm:flex-none sm:grid-cols-2">
        <button
          v-for="album in filteredAlbums"
          :key="album.id"
          type="button"
          class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-field active:bg-field-strong"
          @click="handleSelect(album)"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-field text-muted">
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ album.albumName }}</span>
            <span class="block text-xs text-muted">
              <template v-if="isMember(album)">Already in this album</template>
              <template v-else-if="album.assetCount !== undefined">{{ album.assetCount }} items</template>
            </span>
          </span>
          <kbd
            v-if="hotkeyByAlbum[album.id]"
            class="hidden min-w-6 rounded-md bg-field px-1.5 py-0.5 text-center text-xs font-medium text-muted pointer-fine:inline-block"
          >{{ hotkeyByAlbum[album.id] }}</kbd>
          <svg v-if="isMember(album)" class="size-5 shrink-0 text-keep" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Already in this album">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
        <p v-if="filteredAlbums.length === 0" class="col-span-full py-6 text-center text-sm text-muted">
          No albums found.
        </p>
      </div>

      <!-- Hotkeys only matter with a keyboard -->
      <div class="hidden border-t border-line pt-4 pointer-fine:block">
        <p class="mb-3 text-sm font-medium">Keyboard shortcuts <span class="font-normal text-muted">· press 0–9 to add the photo</span></p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            v-for="key in ['1','2','3','4','5','6','7','8','9','0']"
            :key="key"
            class="flex items-center gap-2.5"
          >
            <kbd class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-field text-sm font-semibold">{{ key }}</kbd>
            <select
              class="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-field px-2.5 text-sm text-fg focus:border-fg/20 focus:outline-none focus:ring-4 focus:ring-fg/10"
              :value="hotkeys[key] || ''"
              @change="handleHotkeyChange(key, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Not set</option>
              <option
                v-for="option in hotkeyOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
