<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronDown, CircleAlert } from 'lucide-vue-next';
import type { ProblemScore } from '@vp/core';
import { useContestStore } from '@/stores/contest';
import { useSubmissionStore } from '@/stores/submission';
import { useSessionStore } from '@/stores/session';
import {
  formatClock,
  formatPenalty,
  formatScore,
} from '@/lib/format';
import FormatBadge from '@/components/ui/FormatBadge.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import JudgeDetails from '@/components/submit/JudgeDetails.vue';

const router = useRouter();
const contest = useContestStore();
const submissions = useSubmissionStore();
const session = useSessionStore();
const confirmNew = ref(false);

const format = computed(() => contest.state?.config.format ?? 'oi');
const score = computed(() => contest.score);

const summary = computed(() => {
  const current = score.value;
  if (current === null) {
    return [
      { label: '状态', value: '正在获取' },
      { label: '用时', value: formatClock(contest.usedMs) },
    ];
  }
  if (format.value === 'icpc') {
    return [
      { label: '通过题数', value: `${current.solvedCount} 题` },
      { label: '罚时', value: formatPenalty(current.penaltyMs) },
      { label: '用时', value: formatClock(contest.usedMs) },
    ];
  }
  return [
    { label: '总分', value: `${formatScore(current.totalScore)} / ${current.maxScore}` },
    { label: '用时', value: formatClock(contest.usedMs) },
  ];
});

const rows = computed(() =>
  contest.problems.map((problem) => {
    const problemScore =
      score.value?.problems.find(
        (item) => item.problem.pid === problem.pid,
      ) ?? null;
    return { problem, problemScore };
  }),
);

function resultLabel(problemScore: ProblemScore | null): string {
  if (problemScore === null) return '—';
  if (format.value === 'icpc') {
    if (problemScore.solved) return 'AC';
    if (problemScore.attempts > 0) return '未通过';
    return '—';
  }
  if (problemScore.attempts === 0) return '—';
  return `${formatScore(problemScore.score)} / ${problemScore.fullScore}`;
}

function resultTone(problemScore: ProblemScore | null): string {
  if (problemScore === null) return 'text-zinc-500 dark:text-zinc-400';
  if (format.value === 'icpc') {
    return problemScore.solved
      ? 'text-teal-600 dark:text-teal-400'
      : 'text-zinc-500 dark:text-zinc-400';
  }
  return 'text-zinc-700 dark:text-zinc-300';
}

function startNewContest(): void {
  confirmNew.value = false;
  submissions.reset();
  contest.clear();
  void router.push({ name: 'create' });
}

async function retryFinalize(): Promise<void> {
  await contest.finalizeResults();
}

onMounted(() => {
  void contest.finalizeResults();
});
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <FormatBadge v-if="contest.state" :format="contest.state.config.format" />
          <span class="text-xs text-zinc-500 dark:text-zinc-400">已结束</span>
        </div>
        <h1 class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {{ contest.state?.config.name }}
        </h1>
      </div>
      <button type="button" class="btn btn-secondary" @click="confirmNew = true">
        开始新的比赛
      </button>
    </div>

    <div
      v-if="contest.finalizing || contest.pendingResultCount > 0"
      class="mb-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      <Spinner :size="16" />
      正在获取评测结果…
    </div>

    <div
      v-if="contest.finalizeError"
      class="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <p class="flex items-start gap-2">
        <CircleAlert :size="16" class="mt-0.5 shrink-0" />
        <span>{{ contest.finalizeError }}</span>
      </p>
      <button
        type="button"
        class="btn btn-secondary mt-3 h-8 px-3 text-xs"
        :disabled="contest.finalizing"
        @click="retryFinalize"
      >
        重试
      </button>
      <button
        v-if="contest.finalizeError.includes('登录')"
        type="button"
        class="btn btn-secondary mt-3 ml-2 h-8 px-3 text-xs"
        @click="session.openLogin(true)"
      >
        重新登录
      </button>
    </div>

    <div
      class="card grid grid-cols-1 divide-y divide-zinc-200 sm:divide-x sm:divide-y-0 dark:divide-zinc-800"
      :class="summary.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
    >
      <div v-for="item in summary" :key="item.label" class="p-4">
        <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ item.label }}</p>
        <p class="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {{ item.value }}
        </p>
      </div>
    </div>

    <div class="mt-5 space-y-2">
      <details
        v-for="row in rows"
        :key="row.problem.pid"
        class="card group overflow-hidden"
      >
        <summary
          class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded border border-zinc-200 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {{ row.problem.letter }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
            {{ row.problem.title }}
          </span>
          <span :class="['text-sm', resultTone(row.problemScore)]">
            {{ resultLabel(row.problemScore) }}
          </span>
          <ChevronDown
            :size="16"
            class="shrink-0 text-zinc-400 transition-transform group-open:rotate-180 dark:text-zinc-600"
          />
        </summary>

        <div class="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p
            v-if="row.problemScore === null || row.problemScore.submissions.length === 0"
            class="text-xs text-zinc-500 dark:text-zinc-400"
          >
            没有提交记录
          </p>
          <ul v-else class="space-y-3">
            <li
              v-for="item in row.problemScore.submissions"
              :key="item.submission.clientId"
              class="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  #{{ item.attemptNumber }}
                </span>
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ formatClock(item.activeElapsedMs) }}
                </span>
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ item.submission.languageName }}<template v-if="item.submission.enableO2"> · O2</template>
                </span>
                <StatusBadge
                  :status-key="item.judge.statusKey"
                  :status-name="item.judge.statusName"
                  :short-name="item.judge.statusShortName"
                  :score="format === 'icpc' ? null : item.judge.score"
                />
                <span
                  v-if="item.counted"
                  class="badge border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
                >
                  计入
                </span>
                <span
                  v-if="format === 'icpc' && !item.accepted && item.penaltyMs > 0"
                  class="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  罚时 +20 分钟
                </span>
                <span
                  v-if="format === 'rakuta'"
                  class="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  原始 {{ item.rawScore }} 分 · 计分 {{ item.score }} 分
                </span>
              </div>
              <JudgeDetails
                class="mt-3"
                :judge="item.judge"
                :scored="format !== 'icpc'"
              />
            </li>
          </ul>
        </div>
      </details>
    </div>

    <ConfirmDialog
      :open="confirmNew"
      title="开始新的比赛"
      message="当前比赛的结果会被清除，确认开始新的比赛？"
      confirm-text="开始新的比赛"
      cancel-text="返回"
      danger
      @confirm="startNewContest"
      @cancel="confirmNew = false"
    />
  </main>
</template>
