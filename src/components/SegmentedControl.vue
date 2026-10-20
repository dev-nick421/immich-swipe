<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T
  options: { value: T; label: string }[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [T]
}>()
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-field p-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      class="min-h-9 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
      :class="option.value === modelValue
        ? 'bg-raised text-fg shadow-sm dark:bg-field-strong'
        : 'text-muted hover:text-fg'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
