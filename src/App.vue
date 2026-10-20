<script setup lang="ts">
import { RouterView } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ToastNotification from '@/components/ToastNotification.vue'
</script>

<template>
  <!-- Keeps the white iOS status bar of the installed app readable in light mode -->
  <div class="status-bar-scrim dark:hidden" aria-hidden="true"></div>
  <RouterView />
  <LoadingOverlay />
  <ToastNotification />
</template>
