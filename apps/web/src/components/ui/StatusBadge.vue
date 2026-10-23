<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  statusKey: string;
  statusName: string;
  shortName?: string | null;
  score?: number | null;
  pending?: boolean;
}>();

const styleClass = computed(() => {
  if (props.pending) {
    return 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
  }
  switch (props.statusKey) {
    case 'AC':
      return 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300';
    case 'WA':
    case 'RE':
    case 'NAC':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
    case 'TLE':
    case 'MLE':
    case 'OLE':
    case 'CE':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
  }
});

const label = computed(() => {
  if (props.pending) return '评测中';
  const short = props.shortName ?? props.statusKey;
  if (props.score !== null && props.score !== undefined && props.statusKey !== 'AC') {
    return `${short} · ${props.score}`;
  }
  return short;
});
</script>

<template>
  <span :class="['badge', styleClass]" :title="statusName">
    <Loader2
      v-if="pending"
      :size="12"
      class="animate-spin"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
