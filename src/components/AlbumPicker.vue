<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ImmichAlbum } from '@/types/immich'

const props = defineProps<{
  open: boolean
  albums: ImmichAlbum[]
  loading: boolean
  error: string | null
  hotkeys: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  select: [ImmichAlbum]
  assignHotkey: [string, string | null]
}>()

const search = ref('')
const touchStart = ref<{ x: number; y: number } | null>(null)
const touchDelta = ref({ x: 0, y: 0 })

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

function handleSelect(album: ImmichAlbum) {
  emit('select', album)
}

function handleHotkeyChange(key: string, value: string) {
  emit('assignHotkey', key, value || null)
}

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]
  touchStart.value = { x: touch.clientX, y: touch.clientY }
  touchDelta.value = { x: 0, y: 0 }
}

function handleTouchMove(event: TouchEvent) {
  if (!touchStart.value || event.touches.length !== 1) return
  const touch = event.touches[0]
  touchDelta.value = {
    x: touch.clientX - touchStart.value.x,
    y: touch.clientY - touchStart.value.y,
  }
}

function handleTouchEnd() {
  if (!touchStart.value) return
  const { x, y } = touchDelta.value
  const isSwipeDown = y > 80 && Math.abs(y) > Math.abs(x)
  const isSwipeRight = x > 80 && Math.abs(x) > Math.abs(y)
  if (isSwipeDown || isSwipeRight) {
    emit('close')
  }
  touchStart.value = null
  touchDelta.value = { x: 0, y: 0 }
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
  <transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 px-4"
      style="padding-bottom: env(safe-area-inset-bottom);"
      @click="emit('close')"
    >
      <transition name="sheet">
        <div
          v-if="open"
          class="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] max-h-[95dvh] min-h-[85vh] min-h-[85dvh] sm:max-h-none sm:min-h-0"
          @click.stop
        >
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <div class="flex flex-col leading-tight">
            <p class="text-sm text-gray-500 dark:text-gray-400">Add to album</p>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-50">Choose an album</h2>
          </div>
        </div>

        <div class="px-4 py-3 safe-area-bottom flex flex-col gap-4 flex-1 min-h-0">
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              v-model="search"
              type="text"
              placeholder="Search album"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div class="hidden sm:flex text-sm text-gray-500 dark:text-gray-400 items-center">
              0–9 Hotkeys configurable below
            </div>
          </div>

          <div v-if="loading" class="flex items-center justify-center py-10">
            <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="error" class="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {{ error }}
          </div>

          <div v-else class="grid sm:grid-cols-2 gap-3 flex-1 min-h-0 overflow-y-auto pr-1 sm:max-h-[340px] sm:flex-none">
            <div
              v-for="album in filteredAlbums"
              :key="album.id"
              class="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-3 hover:border-blue-400 transition-colors"
            >
              <div>
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ album.albumName }}</p>
                <p v-if="album.assetCount !== undefined" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ album.assetCount }} items
                </p>
              </div>
              <button
                class="px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                @click="handleSelect(album)"
              >
                Add
              </button>
            </div>
            <p v-if="filteredAlbums.length === 0" class="col-span-2 text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              No albums found.
            </p>
          </div>

          <div class="hidden sm:block border-t border-gray-200 dark:border-gray-800 pt-4">
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Hotkey mapping</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="key in ['0','1','2','3','4','5','6','7','8','9']"
                :key="key"
                class="flex items-center gap-3"
              >
                <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex items-center justify-center font-semibold border border-gray-200 dark:border-gray-700">
                  {{ key }}
                </span>
                <select
                  class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </div>
            </div>
          </div>
          <div class="pt-2">
            <button
              class="w-full h-10 rounded-lg text-sm font-semibold transition-colors"
              :class="[
                'bg-blue-600 text-white hover:bg-blue-700'
              ]"
              @click="emit('close')"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      </transition>
    </div>
  </transition>
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

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.3s ease, opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
