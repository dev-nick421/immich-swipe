<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useImmich } from '@/composables/useImmich'
import AuthLayout from '@/components/AuthLayout.vue'

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
  <AuthLayout subtitle="Quickly review your photo library">
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div>
        <label for="serverUrl" class="mb-1.5 block text-sm font-medium">Immich Server URL</label>
        <input
          id="serverUrl"
          v-model="serverUrl"
          type="url"
          inputmode="url"
          autocomplete="url"
          autocapitalize="off"
          placeholder="https://immich.example.com"
          class="h-12 w-full rounded-xl border border-transparent bg-field px-4 text-fg transition placeholder:text-muted focus:border-fg/20 focus:outline-none focus:ring-4 focus:ring-fg/10"
        />
      </div>

      <div>
        <label for="apiKey" class="mb-1.5 block text-sm font-medium">API Key</label>
        <input
          id="apiKey"
          v-model="apiKey"
          type="password"
          autocomplete="current-password"
          placeholder="Your Immich API key"
          class="h-12 w-full rounded-xl border border-transparent bg-field px-4 text-fg transition placeholder:text-muted focus:border-fg/20 focus:outline-none focus:ring-4 focus:ring-fg/10"
        />
        <p class="mt-2 text-xs text-muted">Find your API key in Immich: Account Settings → API Keys</p>
      </div>

      <div v-if="error" role="alert" class="rounded-xl bg-delete/10 px-4 py-3 text-sm text-delete">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="isSubmitting"
        class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
      >
        <svg v-if="isSubmitting" class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isSubmitting ? 'Connecting…' : 'Connect' }}
      </button>

      <!-- Insert from localStorage -->
      <button
        v-if="authStore.hasStoredConfig"
        type="button"
        class="h-12 w-full rounded-xl bg-field font-medium transition hover:bg-field-strong"
        @click="insertStoredConfig"
      >
        Use saved Immich settings
      </button>
    </form>

    <!-- Env hint -->
    <div class="mt-8">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        :aria-expanded="showEnvHint"
        @click="showEnvHint = !showEnvHint"
      >
        Skip this step by using a .env file
        <svg class="size-4 transition-transform" :class="{ 'rotate-180': showEnvHint }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-show="showEnvHint" class="mt-3 rounded-2xl bg-field p-4 text-sm">
        <p class="mb-3 text-muted">
          Create a <code class="rounded bg-field-strong px-1.5 py-0.5 text-fg">.env</code> file in your project root to auto-login or show a user selection screen:
        </p>
        <div class="relative">
          <pre class="overflow-x-auto rounded-xl bg-app p-3 pr-10 text-xs text-fg"><code>{{ envExample }}</code></pre>
          <button
            type="button"
            class="absolute right-2 top-2 rounded-lg p-1.5 text-muted transition-colors hover:bg-field hover:text-fg"
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
            @click="copyEnvExample"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <p class="mt-3 text-xs text-muted">
          A single user logs in automatically · multiple users get a user selection
        </p>
      </div>
    </div>
  </AuthLayout>
</template>
