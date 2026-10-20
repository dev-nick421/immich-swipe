<script setup lang="ts">
const src = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<template>
  <img :src="src" alt="" draggable="false" />
</template>
