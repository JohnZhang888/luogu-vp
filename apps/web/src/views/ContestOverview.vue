<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';
import type { ContestProblem } from '@vp/core';
import { useContestStore } from '@/stores/contest';
import { formatPenalty, formatScore } from '@/lib/format';
import FormatBadge from '@/components/ui/FormatBadge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import Spinner from '@/components/ui/Spinner.vue';

interface ProblemRow {
  problem: ContestProblem;
  status: string | null;
  pending: boolean;
}

const router = useRouter();
const contest = useContestStore();
const confirmOpen = ref(false);

const format = computed(() => contest.state?.config.format ?? 'oi');

const rows = computed<ProblemRow[]>(() => {
  const score = contest.score;
  return contest.problems.map((problem) => {
    const pending = contest.submissions.some(
      (submission) =>
        submission.pid === problem.pid &&
        submission.rid !== null &&
        (submission.judge === null || submission.judge.pending),
    );
    const problemScore = score?.problems.find(
      (item) => item.problem.pid === problem.pid,
    );

    if (format.value === 'icpc') {
      if (pending) return { problem, status: null, pending: true };
      if (problemScore === undefined || problemScore.attempts === 0) {
        return { problem, status: null, pending: false };
      }
      if (problemScore.solved) {
        return {
          problem,
          status: `AC · 尝试 ${problemScore.attempts} 次`,
          pending: false,
        };
      }
      return {
        problem,
        status: `尝试 ${problemScore.attempts} 次`,
        pending: false,
      };
    }

    if (format.value === 'oi') {
      const submitted = contest.submissions.some(
        (submission) => submission.pid === problem.pid && submission.rid !== null,
      );
      return {
        problem,
        status: submitted ? '已提交' : null,
        pending: false,
      };
    }

    if (pending) return { problem, status: null, pending: true };
    if (problemScore === undefined || problemScore.attempts === 0) {
      return { problem, status: null, pending: false };
    }
    return {
      problem,
      status: `${formatScore(problemScore.score)} / ${problemScore.fullScore}`,
      pending: false,
    };
  });
});

const summary = computed(() => {
  const score = contest.score;
  if (format.value === 'icpc') {
    return score === null
      ? '—'
      : `通过 ${score.solvedCount} 题 · 罚时 ${formatPenalty(score.penaltyMs)}`;
  }
  if (format.value === 'oi') {
    return `共 ${contest.problems.length} 题`;
  }
  return score === null
    ? '—'
    : `总分 ${formatScore(score.totalScore)} / ${score.maxScore}`;
});

function endContest(): void {
  confirmOpen.value = false;
  contest.finish();
  void router.push({ name: 'results' });
}
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <FormatBadge v-if="contest.state" :format="contest.state.config.format" />
        <span class="text-sm text-zinc-500 dark:text-zinc-400">{{ summary }}</span>
      </div>
      <button type="button" class="btn btn-secondary" @click="confirmOpen = true">
        结束比赛
      </button>
    </div>

    <div class="card overflow-hidden">
      <ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
        <li v-for="row in rows" :key="row.problem.pid">
          <RouterLink
            :to="{ name: 'problem', params: { pid: row.problem.pid } }"
            class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded border border-zinc-200 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {{ row.problem.letter }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
              {{ row.problem.title }}
            </span>
            <span
              v-if="row.pending"
              class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
            >
              <Spinner :size="13" />
              评测中
            </span>
            <span
              v-else-if="row.status"
              class="text-xs text-zinc-500 dark:text-zinc-400"
            >
              {{ row.status }}
            </span>
            <ChevronRight
              :size="16"
              class="shrink-0 text-zinc-400 dark:text-zinc-600"
            />
          </RouterLink>
        </li>
      </ul>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="结束比赛"
      message="结束后不能继续提交，确认结束本场比赛？"
      confirm-text="结束比赛"
      cancel-text="继续比赛"
      @confirm="endContest"
      @cancel="confirmOpen = false"
    />
  </main>
</template>
