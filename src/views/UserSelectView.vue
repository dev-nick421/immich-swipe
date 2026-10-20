<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useImmich } from '@/composables/useImmich'
import type { EnvUser } from '@/types/immich'
import AuthLayout from '@/components/AuthLayout.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { testConnection } = useImmich()

async function selectUser(user: EnvUser) {
  authStore.selectEnvUser(user)
  
  // Test connection
  const success = await testConnection()
  
  if (success) {
    uiStore.toast(`Welcome, ${user.name}!`, 'success')
    router.push('/')
  } else {
    uiStore.toast('Connection failed. Please check the configuration.', 'error')
    authStore.clearConfig()
  }
}
</script>

<template>
  <AuthLayout subtitle="Who's swiping?">
    <div class="space-y-3">
      <button
        v-for="user in authStore.envUsers"
        :key="user.name"
        type="button"
        class="flex w-full items-center gap-3 rounded-2xl bg-field p-3 text-left transition hover:bg-field-strong active:scale-[0.99]"
        @click="selectUser(user)"
      >
        <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-fg">
          {{ user.name.charAt(0).toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1 truncate text-lg font-medium">{{ user.name }}</span>
        <svg class="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </AuthLayout>
</template>
