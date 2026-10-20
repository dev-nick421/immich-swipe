<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { usePreferencesStore } from '@/stores/preferences'
import { useReviewedStore } from '@/stores/reviewed'
import { computed, ref } from 'vue'
import AppLogo from '@/components/AppLogo.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import SettingsSheet from '@/components/SettingsSheet.vue'
import type { ImmichAlbum } from '@/types/immich'

defineProps<{
  albums: ImmichAlbum[]
  albumsLoading: boolean
  albumsError: string | null
}>()

const emit = defineEmits<{
  loadAlbums: []
}>()

const uiStore = useUiStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const reviewedStore = useReviewedStore()
const router = useRouter()
const showSettings = ref(false)
const showResetModal = ref(false)

// Non-default filters are easy to forget once they're behind the settings button
const hasActiveFilters = computed(
  () => uiStore.skipVideos || preferencesStore.reviewOrder !== 'random' || preferencesStore.albumFilter.type !== 'all'
)

function logout() {
  showSettings.value = false
  authStore.clearConfig()
  uiStore.resetStats()

  // If .env with multiple users -> user selection
  // else -> login
  if (authStore.hasEnvConfig && !authStore.hasSingleEnvUser) {
    router.push('/select-user')
  } else if (authStore.hasEnvConfig && authStore.hasSingleEnvUser) {
    // Single user .env -> reset to auto-login
    router.push('/')
  } else {
    router.push('/login')
  }
}

function openResetModal() {
  showSettings.value = false
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
}

function confirmResetReviewed() {
  uiStore.resetStats()
  reviewedStore.resetReviewed()
  uiStore.toast('Review history cleared', 'info', 1500)
  closeResetModal()
}
</script>

<template>
  <header class="mx-auto flex h-14 w-full max-w-4xl shrink-0 items-center gap-2 px-safe">
    <div class="flex min-w-0 flex-1 items-center gap-2.5">
      <AppLogo class="size-7 shrink-0 rounded-lg" />
      <h1 class="truncate text-base font-semibold tracking-tight">Immich Swipe</h1>
      <!-- User badge -->
      <span
        v-if="authStore.currentUserName"
        class="max-w-[7rem] shrink-0 truncate rounded-full bg-field px-2.5 py-0.5 text-xs font-medium text-muted"
      >
        {{ authStore.currentUserName }}
      </span>
    </div>

    <!-- Stats -->
    <button
      type="button"
      class="flex h-9 shrink-0 items-center gap-3 rounded-full bg-field px-3 text-sm font-medium tabular-nums transition-colors hover:bg-field-strong"
      aria-label="Reset reviewed items"
      title="Reset reviewed items"
      @click="openResetModal"
    >
      <span class="flex items-center gap-1">
        <svg class="size-4 text-keep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        {{ uiStore.keptCount }}
      </span>
      <span class="flex items-center gap-1">
        <svg class="size-4 text-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {{ uiStore.deletedCount }}
      </span>
    </button>

    <!-- Settings -->
    <button
      type="button"
      class="relative -mr-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-field"
      aria-label="Settings"
      title="Settings"
      @click="showSettings = true"
    >
      <svg class="size-[1.375rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span v-if="hasActiveFilters" class="absolute right-1.5 top-1.5 size-2 rounded-full bg-fg ring-2 ring-app" />
    </button>
  </header>

  <SettingsSheet
    :open="showSettings"
    :albums="albums"
    :albums-loading="albumsLoading"
    :albums-error="albumsError"
    @close="showSettings = false"
    @reset="openResetModal"
    @logout="logout"
    @load-albums="emit('loadAlbums')"
  />

  <BottomSheet :open="showResetModal" title="Reset review history?" size="sm" @close="closeResetModal">
    <p class="text-sm text-muted">
      This clears the counters and forgets which photos and videos you have already reviewed. Nothing is deleted in Immich.
    </p>
    <div class="mt-4 flex items-center justify-between rounded-2xl bg-field px-4 py-3 text-sm tabular-nums">
      <span>Kept: {{ uiStore.keptCount }}</span>
      <span>Deleted: {{ uiStore.deletedCount }}</span>
    </div>
    <div class="mt-5 grid grid-cols-2 gap-2">
      <button
        type="button"
        class="h-11 rounded-xl bg-field font-medium transition-colors hover:bg-field-strong"
        @click="closeResetModal"
      >
        Cancel
      </button>
      <button
        type="button"
        class="h-11 rounded-xl bg-delete font-semibold text-white transition hover:opacity-90"
        @click="confirmResetReviewed"
      >
        Reset
      </button>
    </div>
  </BottomSheet>
</template>
