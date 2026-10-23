<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeft, CircleAlert, Code2 } from 'lucide-vue-next';
import { useContestStore } from '@/stores/contest';
import { useProblemStore } from '@/stores/problem';
import ProblemNav from '@/components/problem/ProblemNav.vue';
import ProblemStatement from '@/components/problem/ProblemStatement.vue';
import Spinner from '@/components/ui/Spinner.vue';

const route = useRoute();
const contest = useContestStore();
const problems = useProblemStore();

const pid = computed(() => String(route.params.pid ?? ''));
const problem = computed(() => problems.get(pid.value));
const loading = computed(() => problems.loading[pid.value] === true);
const error = computed(() => problems.errors[pid.value] ?? null);
const contestProblem = computed(() =>
  contest.problems.find((item) => item.pid === pid.value),
);
const canSubmit = computed(() => contest.phase === 'running');

async function loadProblem(): Promise<void> {
  if (pid.value === '') return;
  try {
    await problems.load(pid.value);
  } catch {
    // 错误信息已经由 store 保存。
  }
}

watch(pid, () => void loadProblem(), { immediate: true });
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        :to="{ name: 'contest' }"
        class="btn btn-ghost h-8 px-2 text-xs"
      >
        <ArrowLeft :size="15" />
        返回概览
      </RouterLink>
      <RouterLink
        v-if="canSubmit"
        :to="{ name: 'submit', params: { pid } }"
        class="btn btn-primary h-9"
      >
        <Code2 :size="16" />
        提交
      </RouterLink>
    </div>

    <ProblemNav
      v-if="contest.problems.length > 0"
      class="mb-5"
      :problems="contest.problems"
      :current-pid="pid"
    />

    <div v-if="loading && problem === null" class="card flex items-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-400">
      <Spinner :size="16" />
      正在读取题面…
    </div>

    <div
      v-else-if="error !== null && problem === null"
      class="card space-y-3 p-6"
    >
      <p class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
        <CircleAlert :size="16" class="mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </p>
      <button type="button" class="btn btn-secondary h-8 px-3 text-xs" @click="loadProblem">
        重试
      </button>
    </div>

    <div
      v-else-if="problem"
      class="card p-5 sm:p-7"
    >
      <ProblemStatement
        :problem="problem"
        :letter="contestProblem?.letter ?? '?'"
      />
    </div>

    <div
      v-else
      class="card p-6 text-sm text-zinc-500 dark:text-zinc-400"
    >
      无法读取题目。
    </div>
  </main>
</template>
