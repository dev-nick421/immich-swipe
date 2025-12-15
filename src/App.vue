<script setup lang="ts">
import { RouterView } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ToastNotification from '@/components/ToastNotification.vue'
</script>

<template>
  <RouterView />
  <LoadingOverlay />
  <ToastNotification />
</template>
