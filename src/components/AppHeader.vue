<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { usePreferencesStore } from '@/stores/preferences'
import { useReviewedStore } from '@/stores/reviewed'
import { ref } from 'vue'

const uiStore = useUiStore()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const reviewedStore = useReviewedStore()
const router = useRouter()
const showResetModal = ref(false)

function logout() {
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

function toggleReviewOrder() {
  const current = preferencesStore.reviewOrder
  const next =
    current === 'random'
      ? 'chronological'
      : current === 'chronological'
        ? 'chronological-desc'
        : 'random'
  preferencesStore.setReviewOrder(next)
}

function openResetModal() {
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
  <header class="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
    <div class="flex items-center gap-2 sm:gap-4">
      <h1 class="text-xl font-bold sm:inline hidden"
        :class="uiStore.isDarkMode ? 'text-white' : 'text-gray-900'"
      >
        Immich Swipe
      </h1>
      <!-- User badge -->
      <span 
        v-if="authStore.currentUserName"
        class="px-2 py-0.5 text-xs rounded-full"
        :class="uiStore.isDarkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'"
      >
        {{ authStore.currentUserName }}
      </span>
    </div>

    <div class="flex items-center gap-3">
      <!-- Theme toggle -->
      <button
        @click="uiStore.toggleDarkMode()"
        class="pl-2 rounded-full transition-colors"
        :class="uiStore.isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-gray-700'"
        aria-label="Toggle theme"
      >
        <!-- Sun (dark mode) -->
        <svg v-if="uiStore.isDarkMode" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <!-- Moon (!dark mode) -->
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <!-- Stats -->
      <button
        type="button"
        class="flex items-center gap-3 text-sm px-3 py-1 rounded-full border transition-colors"
        :class="uiStore.isDarkMode
          ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
          : 'border-gray-200 text-gray-600 hover:bg-gray-100'"
        aria-label="Reset reviewed items"
        title="Reset reviewed items"
        @click="openResetModal"
      >
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ uiStore.keptCount }}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {{ uiStore.deletedCount }}
        </span>
      </button>

      <!-- Skip videos toggle -->
      <button
        @click="uiStore.toggleSkipVideos()"
        class="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="uiStore.skipVideos
          ? 'bg-green-600 border-green-500 text-white'
          : uiStore.isDarkMode
            ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
            : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
        :aria-pressed="uiStore.skipVideos"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-3 4h7a2 2 0 002-2V8a2 2 0 00-2-2h-7M9 18H6a2 2 0 01-2-2V8a2 2 0 012-2h3m0 12V6"
          />
        </svg>
        <span>
          Skip videos
        </span>
      </button>

      <!-- Review order toggle -->
      <button
        @click="toggleReviewOrder"
        class="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="preferencesStore.reviewOrder !== 'random'
          ? 'bg-blue-600 border-blue-500 text-white'
          : uiStore.isDarkMode
            ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
            : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
        :aria-pressed="preferencesStore.reviewOrder !== 'random'"
        :aria-label="preferencesStore.reviewOrder === 'chronological'
          ? 'Order: Oldest first'
          : preferencesStore.reviewOrder === 'chronological-desc'
            ? 'Order: Newest first'
            : 'Order: Random'"
        :title="preferencesStore.reviewOrder === 'chronological'
          ? 'Order: Oldest first'
          : preferencesStore.reviewOrder === 'chronological-desc'
            ? 'Order: Newest first'
            : 'Order: Random'"
      >
        <span>Order:</span>
        <svg
          v-if="preferencesStore.reviewOrder === 'random'"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 3h5v5" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 20L21 3" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 16v5h-5" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l6 6" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4l5 5" />
        </svg>
        <svg
          v-else-if="preferencesStore.reviewOrder === 'chronological'"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h10M4 12h7M4 16h4M18 18V6m0 0-3 3m3-3 3 3" />
        </svg>
        <svg
          v-else
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h4M4 12h7M4 16h10M18 6v12m0 0-3-3m3 3 3-3" />
        </svg>
      </button>
      <!-- Logout / Switch User -->
      <button
        @click="logout"
        class="pr-2 rounded-full transition-colors"
        :class="uiStore.isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-gray-700'"
        :aria-label="authStore.hasEnvConfig && !authStore.hasSingleEnvUser ? 'Switch user' : 'Logout'"
        :title="authStore.hasEnvConfig && !authStore.hasSingleEnvUser ? 'Switch user' : 'Logout'"
      >
        <!-- Switch user icon for multi-user env -->
        <svg v-if="authStore.hasEnvConfig && !authStore.hasSingleEnvUser" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <!-- Logout icon for manual login -->
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  </header>

  <div
    v-if="showResetModal"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
    @click="closeResetModal"
  >
    <div
      class="w-full max-w-md rounded-2xl shadow-2xl border p-5 text-left"
      :class="uiStore.isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'"
      @click.stop
    >
      <h2
        class="text-lg font-semibold"
        :class="uiStore.isDarkMode ? 'text-gray-100' : 'text-gray-900'"
      >
        Reset reviewed history?
      </h2>
      <p
        class="mt-2 text-sm"
        :class="uiStore.isDarkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        This clears the counters and removes all already visited image and video IDs.
      </p>
      <div
        class="mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
        :class="uiStore.isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-700'"
      >
        <span>Kept: {{ uiStore.keptCount }}</span>
        <span>Deleted: {{ uiStore.deletedCount }}</span>
      </div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
          :class="uiStore.isDarkMode
            ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
            : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
          @click="closeResetModal"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-full text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          @click="confirmResetReviewed"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>
