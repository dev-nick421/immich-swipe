<script setup lang="ts">
defineProps<{
  canUndo: boolean
  isAlbumDragActive?: boolean
  isFavorite?: boolean
}>()

const emit = defineEmits<{
  keep: []
  delete: []
  undo: []
  toggleFavorite: []
  openAlbumPicker: []
  albumDrop: []
}>()

function handleAlbumDrop(e: DragEvent) {
  e.preventDefault()
  emit('albumDrop')
}

// Sizes scale with the screen width but have px bounds, so they never get squashed by large text
const base = 'inline-flex shrink-0 items-center justify-center rounded-full bg-raised ring-1 ring-line shadow-lg shadow-black/5 transition active:scale-90 dark:bg-surface dark:shadow-none'
const primary = `${base} size-[clamp(52px,17vw,68px)]`
const secondary = `${base} size-[clamp(44px,13vw,52px)]`
</script>

<template>
  <div class="flex w-full items-center justify-center gap-[clamp(10px,3.5vw,20px)] py-3">
    <!-- Album -->
    <button
      type="button"
      :class="[secondary, 'text-fg hover:bg-field', isAlbumDragActive ? 'ring-4 ring-fg/30' : '']"
      aria-label="Add to album"
      title="Add to album"
      @click="emit('openAlbumPicker')"
      @dragover.prevent
      @dragenter.prevent
      @drop="handleAlbumDrop"
    >
      <svg class="w-[44%]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </button>

    <!-- Delete -->
    <button
      type="button"
      :class="[primary, 'text-delete hover:bg-delete hover:text-white hover:ring-delete']"
      aria-label="Delete photo"
      title="Delete (←)"
      @click="emit('delete')"
    >
      <svg class="w-[46%]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Favorite -->
    <button
      type="button"
      :class="[secondary, isFavorite ? 'bg-favorite text-white ring-favorite dark:bg-favorite' : 'text-favorite hover:bg-favorite/10']"
      aria-label="Toggle favorite"
      :aria-pressed="isFavorite ? 'true' : 'false'"
      :title="isFavorite ? 'Remove from favorites (F)' : 'Add to favorites (F)'"
      @click="emit('toggleFavorite')"
    >
      <svg class="w-[46%]" :class="isFavorite ? 'fill-current' : 'fill-none'" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 10-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>

    <!-- Keep -->
    <button
      type="button"
      :class="[primary, 'text-keep hover:bg-keep hover:text-white hover:ring-keep']"
      aria-label="Keep photo"
      title="Keep (→)"
      @click="emit('keep')"
    >
      <svg class="w-[48%]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Undo -->
    <button
      type="button"
      :disabled="!canUndo"
      :class="[secondary, 'text-fg hover:bg-field disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-raised dark:disabled:hover:bg-surface']"
      aria-label="Undo last action"
      :title="canUndo ? 'Undo (↑)' : 'Nothing to undo'"
      @click="emit('undo')"
    >
      <svg class="w-[44%]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6 6M3 10l6-6" />
      </svg>
    </button>
  </div>
</template>
