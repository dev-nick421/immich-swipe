<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useImmich } from '@/composables/useImmich'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { testConnection, error: connectionError } = useImmich()

const serverUrl = ref(authStore.serverUrl || '')
const apiKey = ref(authStore.apiKey || '')
const error = ref('')
const isSubmitting = ref(false)
const showEnvHint = ref(false)

const envExample = `# .env file in project root
VITE_SERVER_URL=<your-server-proxy e.g. http://immich.local>

# User 1
VITE_USER_1_NAME=<your-user1>
VITE_USER_1_API_KEY=<your-api-key-here>

# User 2 (optional)
VITE_USER_2_NAME=<another-user2>
VITE_USER_2_API_KEY=<another-api-key-here>`

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
    error.value = connectionError.value
      ? `Failed to connect: ${connectionError.value}`
      : 'Failed to connect. Please check your URL and API key.'
    authStore.clearConfig()
  }

  isSubmitting.value = false
}

function insertStoredConfig() {
  const stored = authStore.getStoredConfig()
  if (!stored) {
    uiStore.toast('No saved config found', 'error', 2000)
    return
  }

  error.value = ''
  serverUrl.value = stored.serverUrl || ''
  apiKey.value = stored.apiKey || ''
}

function copyEnvExample() {
  navigator.clipboard.writeText(envExample)
  uiStore.toast('Copied to clipboard!', 'success', 1500)
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

      <!-- Env Hint Collapsible -->
      <div class="mb-6">
        <button
          @click="showEnvHint = !showEnvHint"
          class="w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-sm"
          :class="uiStore.isDarkMode
            ? 'border-gray-700 hover:bg-gray-900 text-gray-400'
            : 'border-gray-200 hover:bg-gray-50 text-gray-500'"
        >
          <span class="flex items-center gap-2">
            <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Skip this step by using a .env file !
          </span>
          <svg 
            class="w-4 h-4 transition-transform" 
            :class="{ 'rotate-180': showEnvHint }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <!-- Expandable content -->
        <div 
          v-show="showEnvHint"
          class="mt-2 p-4 rounded-lg border text-sm"
          :class="uiStore.isDarkMode
            ? 'border-gray-700 bg-gray-900'
            : 'border-gray-200 bg-gray-50'"
        >
          <p class="mb-3" :class="uiStore.isDarkMode ? 'text-gray-300' : 'text-gray-600'">
            Create a <code class="px-1.5 py-0.5 rounded" :class="uiStore.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'">.env</code> file in your project root to auto-login or show a user selection screen:
          </p>
          
          <div class="relative">
            <pre 
              class="p-3 rounded-lg overflow-x-auto text-xs"
              :class="uiStore.isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'"
            ><code>{{ envExample }}</code></pre>
            
            <button
              @click="copyEnvExample"
              class="absolute top-2 right-2 p-1.5 rounded transition-colors"
              :class="uiStore.isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400' 
                : 'hover:bg-gray-300 text-gray-500'"
              title="Copy to clipboard"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          
          <p class="mt-3 text-xs" :class="uiStore.isDarkMode ? 'text-gray-500' : 'text-gray-500'">
            💡 Single User will auto-login • Multiple users will redirect to a user selection
          </p>
        </div>
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

        <!-- Insert from localStorage -->
        <button
          v-if="authStore.hasStoredConfig"
          type="button"
          @click="insertStoredConfig"
          class="w-full py-3 px-4 rounded-lg font-medium border transition-colors"
          :class="uiStore.isDarkMode
            ? 'border-gray-700 text-white hover:bg-gray-900'
            : 'border-gray-300 text-black hover:bg-gray-100'"
        >
          Use saved Immich settings
        </button>

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
        </button>
      </div>
    </div>
  </div>
</template>
