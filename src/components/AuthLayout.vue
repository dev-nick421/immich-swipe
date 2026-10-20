<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineProps<{
  subtitle: string
}>()
</script>

<template>
  <!-- Scrolls when the content doesn't fit (small phones, large text, on-screen keyboard) -->
  <div class="flex min-h-dvh flex-col items-center bg-app px-safe pt-safe pb-safe text-fg">
    <div class="flex w-full max-w-sm flex-1 flex-col justify-center py-10">
      <header class="mb-8 text-center">
        <AppLogo class="mx-auto mb-4 size-16 rounded-2xl shadow-lg shadow-black/10" />
        <h1 class="text-2xl font-semibold tracking-tight">Immich Swipe</h1>
        <p class="mt-1 text-muted">{{ subtitle }}</p>
      </header>
      <slot />
    </div>
    <div class="pb-6">
      <ThemeToggle />
    </div>
  </div>
</template>
