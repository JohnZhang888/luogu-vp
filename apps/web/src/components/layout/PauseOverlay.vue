<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next';
import { useContestStore } from '@/stores/contest';
import { formatClock } from '@/lib/format';

const contest = useContestStore();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950"
    role="dialog"
    aria-modal="true"
    aria-label="比赛已暂停"
  >
    <div
      class="flex size-12 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
    >
      <Pause :size="22" />
    </div>
    <h1 class="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
      比赛已暂停
    </h1>
    <p class="mt-2 font-mono text-3xl tabular-nums text-zinc-700 dark:text-zinc-300">
      {{ formatClock(contest.remainingMs) }}
    </p>
    <button type="button" class="btn btn-primary mt-8" @click="contest.resume()">
      <Play :size="16" />
      继续比赛
    </button>
  </div>
</template>
