<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import BottomSheet from '@/components/BottomSheet.vue'

const uiStore = useUiStore()
</script>

<template>
  <BottomSheet :open="uiStore.showTutorial" title="How it works" size="md" @close="uiStore.closeTutorial()">
    <ul class="space-y-4">
      <li class="flex items-start gap-3.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-keep/15 text-keep">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span>
          <span class="block font-medium">Swipe right to keep</span>
          <span class="block text-sm text-muted">The photo stays where it is. <span class="hidden pointer-fine:inline">Or press →</span></span>
        </span>
      </li>
      <li class="flex items-start gap-3.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-delete/15 text-delete">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <span>
          <span class="block font-medium">Swipe left to delete</span>
          <span class="block text-sm text-muted">It goes to the Immich trash, so you can still restore it. <span class="hidden pointer-fine:inline">Or press ←</span></span>
        </span>
      </li>
      <li class="flex items-start gap-3.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-field text-fg">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6 6M3 10l6-6" />
          </svg>
        </span>
        <span>
          <span class="block font-medium">Changed your mind?</span>
          <span class="block text-sm text-muted">Undo brings the last photo back. <span class="hidden pointer-fine:inline">Or press ↑ / Ctrl+Z</span></span>
        </span>
      </li>
      <li class="flex items-start gap-3.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-favorite/15 text-favorite">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 10-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </span>
        <span>
          <span class="block font-medium">Favorites and albums</span>
          <span class="block text-sm text-muted">Both keep the photo and move on. <span class="hidden pointer-fine:inline">Press F, or 0–9 for album shortcuts.</span></span>
        </span>
      </li>
      <li class="flex items-start gap-3.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-field text-fg">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
        <span>
          <span class="block font-medium">Choose what to review</span>
          <span class="block text-sm text-muted">Order, albums and videos are in the settings.</span>
        </span>
      </li>
    </ul>
    <button
      type="button"
      class="mt-6 h-12 w-full rounded-xl bg-primary font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99]"
      @click="uiStore.closeTutorial()"
    >
      Start swiping
    </button>
  </BottomSheet>
</template>
