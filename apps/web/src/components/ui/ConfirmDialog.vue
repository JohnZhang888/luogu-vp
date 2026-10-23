<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }>(),
  {
    confirmText: '确认',
    cancelText: '取消',
    danger: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <BaseDialog
    :open="open"
    :title="title"
    @close="emit('cancel')"
  >
    <p class="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      {{ message }}
    </p>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">
        {{ cancelText }}
      </button>
      <button
        type="button"
        class="btn"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </template>
  </BaseDialog>
</template>
