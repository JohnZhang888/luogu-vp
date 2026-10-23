<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T;
  options: Array<{ value: T; label: string }>;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
</script>

<template>
  <div
    class="inline-flex rounded-md border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
    role="group"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none"
      :class="
        option.value === modelValue
          ? 'bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      "
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
