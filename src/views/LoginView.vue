<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useImmich } from '@/composables/useImmich'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { testConnection } = useImmich()

const serverUrl = ref(authStore.serverUrl || '')
const apiKey = ref(authStore.apiKey || '')
const error = ref('')
const isSubmitting = ref(false)

async function handleSubmit() {
  error.value = ''

  if (!serverUrl.value.trim()) {
    error.value = 'Please enter your Immich server URL'
    return
  }

  if (!apiKey.value.trim()) {
    error.value = 'Please enter your API key'
    return
  }

  isSubmitting.value = true

  // Save config temporarily for test
  authStore.setConfig(serverUrl.value.trim(), apiKey.value.trim())

  // Test connection
  const success = await testConnection()

  if (success) {
    uiStore.toast('Connected successfully!', 'success')
    router.push('/')
  } else {
    error.value = 'Failed to connect. Please check your URL and API key.'
    authStore.clearConfig()
  }

  isSubmitting.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6"
    :class="uiStore.isDarkMode ? 'bg-black text-white' : 'bg-white text-black'"
  >
    <div class="w-full max-w-md">
      <!-- Logo/Title -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">Immich Swipe</h1>
        <p :class="uiStore.isDarkMode ? 'text-gray-400' : 'text-gray-600'">
          Quickly review your photo library
        </p>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Server URL -->
        <div>
          <label for="serverUrl" class="block text-sm font-medium mb-2"
            :class="uiStore.isDarkMode ? 'text-gray-300' : 'text-gray-700'"
          >
            Immich Server URL
          </label>
          <input
            id="serverUrl"
            v-model="serverUrl"
            type="url"
            placeholder="https://immich.example.com"
            class="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-colors"
            :class="uiStore.isDarkMode
              ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
              : 'bg-white border-gray-300 text-black placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'"
          />
        </div>

        <!-- API Key -->
        <div>
          <label for="apiKey" class="block text-sm font-medium mb-2"
            :class="uiStore.isDarkMode ? 'text-gray-300' : 'text-gray-700'"
          >
            API Key
          </label>
          <input
            id="apiKey"
            v-model="apiKey"
            type="password"
            placeholder="Your Immich API key"
            class="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-colors"
            :class="uiStore.isDarkMode
              ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
              : 'bg-white border-gray-300 text-black placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'"
          />
          <p class="mt-2 text-xs"
            :class="uiStore.isDarkMode ? 'text-gray-500' : 'text-gray-500'"
          >
            Find your API key in Immich: Account Settings → API Keys
          </p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
          :class="uiStore.isDarkMode
            ? 'bg-white text-black hover:bg-gray-200'
            : 'bg-black text-white hover:bg-gray-800'"
        >
          <span v-if="isSubmitting" class="flex items-center justify-center gap-2">
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </span>
          <span v-else>Connect</span>
        </button>
      </form>

      <!-- Theme toggle -->
      <div class="mt-8 flex justify-center">
        <button
          @click="uiStore.toggleDarkMode"
          class="flex items-center gap-2 text-sm transition-colors"
          :class="uiStore.isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'"
        >
          <svg v-if="uiStore.isDarkMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          {{ uiStore.isDarkMode ? 'Light mode' : 'Dark mode' }}
        </button>
      </div>
    </div>
  </div>
</template>
