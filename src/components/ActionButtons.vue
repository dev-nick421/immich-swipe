<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()

defineProps<{
  canUndo: boolean
  isAlbumDragActive?: boolean
}>()

const emit = defineEmits<{
  keep: []
  delete: []
  undo: []
  openAlbumPicker: []
  albumDrop: []
}>()

function handleAlbumDrop(e: DragEvent) {
  e.preventDefault()
  emit('albumDrop')
}
</script>

<template>
  <div class="flex items-center justify-center gap-4 py-4">
    <!-- Delete (desktop) -->
    <button
      @click="emit('delete')"
      class="hidden sm:flex w-16 h-16 rounded-full items-center justify-center transition-all active:scale-90 shadow-lg"
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

    <!-- Keep (desktop) -->
    <button
      @click="emit('keep')"
      class="hidden sm:flex w-16 h-16 rounded-full items-center justify-center transition-all active:scale-90 shadow-lg"
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

    <!-- Album -->
    <button
      @click="emit('openAlbumPicker')"
      @dragover.prevent
      @dragenter.prevent
      @drop="handleAlbumDrop"
      class="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
      :class="[
        uiStore.isDarkMode
          ? ['bg-gray-800 hover:bg-blue-600 text-white', isAlbumDragActive ? 'ring-4 ring-blue-500' : '']
          : ['bg-white hover:bg-blue-500 hover:text-white text-blue-600 border border-blue-200', isAlbumDragActive ? 'ring-4 ring-blue-400' : '']
      ]"
      aria-label="Add to album"
      title="Add to album"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h10M16 18h4M8 6v12" />
      </svg>
    </button>

    <!-- Separator (desktop) -->
    <div
      class="hidden sm:block w-px h-12"
      :class="uiStore.isDarkMode ? 'bg-gray-700' : 'bg-gray-300'"
    ></div>

    <!-- Undo -->
    <button
      @click="emit('undo')"
      :disabled="!canUndo"
      class="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
      :class="[
        uiStore.isDarkMode
          ? 'bg-gray-800 hover:bg-yellow-600 text-white disabled:hover:bg-gray-800'
          : 'bg-white hover:bg-yellow-500 hover:text-white text-yellow-600 border border-yellow-200 disabled:hover:bg-white disabled:hover:text-yellow-600'
      ]"
      aria-label="Undo last deletion"
      :title="canUndo ? 'Undo last deletion' : 'Nothing to undo'"
    >
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6 6M3 10l6-6" />
      </svg>
    </button>
  </div>
</template>
