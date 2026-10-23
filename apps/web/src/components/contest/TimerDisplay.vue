<script setup lang="ts">
import { computed } from 'vue';
import { useContestStore } from '@/stores/contest';
import { formatClock } from '@/lib/format';

const contest = useContestStore();
const urgent = computed(
  () => contest.phase === 'running' && contest.remainingMs <= 5 * 60 * 1000,
);
</script>

<template>
  <span
    class="font-mono text-sm tabular-nums"
    :class="
      urgent
        ? 'text-red-600 dark:text-red-400'
        : 'text-zinc-700 dark:text-zinc-300'
    "
    aria-label="剩余时间"
  >
    {{ formatClock(contest.remainingMs) }}
  </span>
</template>
