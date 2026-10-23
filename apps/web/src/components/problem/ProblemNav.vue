<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { ContestProblem } from '@vp/core';
import { useContestStore } from '@/stores/contest';

const props = defineProps<{
  problems: ContestProblem[];
  currentPid: string;
}>();

const contest = useContestStore();

interface NavItem {
  problem: ContestProblem;
  submitted: boolean;
  accepted: boolean;
}

const items = computed<NavItem[]>(() =>
  props.problems.map((problem) => {
    const submissions = contest.submissions.filter(
      (submission) => submission.pid === problem.pid && submission.rid !== null,
    );
    const accepted = submissions.some(
      (submission) => submission.judge?.statusKey === 'AC',
    );
    return {
      problem,
      submitted: submissions.length > 0,
      accepted,
    };
  }),
);
</script>

<template>
  <nav class="flex gap-1.5 overflow-x-auto pb-1" aria-label="题目跳转">
    <RouterLink
      v-for="item in items"
      :key="item.problem.pid"
      :to="{ name: 'problem', params: { pid: item.problem.pid } }"
      class="relative flex h-8 min-w-8 shrink-0 items-center justify-center rounded border px-2 text-xs font-semibold transition-colors"
      :class="
        item.problem.pid === currentPid
          ? 'border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-500/60 dark:bg-teal-500/10 dark:text-teal-300'
          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
      "
      :aria-current="item.problem.pid === currentPid ? 'page' : undefined"
    >
      {{ item.problem.letter }}
      <span
        v-if="item.submitted"
        class="absolute right-1 top-1 size-1.5 rounded-full"
        :class="item.accepted ? 'bg-teal-500' : 'bg-zinc-400 dark:bg-zinc-600'"
      />
    </RouterLink>
  </nav>
</template>
