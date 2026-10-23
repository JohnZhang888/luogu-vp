<script setup lang="ts">
import { computed } from 'vue';
import type { JudgeResult, JudgeSubtask, JudgeTestCase } from '@vp/core';
import { formatMemory, formatRecordTime } from '@/lib/format';
import TestCaseCard from './TestCaseCard.vue';

const props = defineProps<{
  judge: JudgeResult;
  /** 非计分赛制（ICPC）下不展示测试点得分。 */
  scored?: boolean;
}>();

function idOrder(id: string): number {
  const parsed = Number.parseInt(id, 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => idOrder(a.id) - idOrder(b.id) || a.id.localeCompare(b.id),
  );
}

const sortedCases = computed(() => sortById(props.judge.testCases));

const sortedSubtasks = computed<JudgeSubtask[]>(() =>
  sortById(props.judge.subtasks).map((subtask) => ({
    ...subtask,
    testCases: sortById(subtask.testCases),
  })),
);

const hasSummary = computed(
  () => props.judge.timeMs !== null || props.judge.memoryKb !== null,
);

const hasDetails = computed(
  () => sortedSubtasks.value.length > 0 || sortedCases.value.length > 0,
);

const showCompileMessage = computed(
  () =>
    props.judge.compileMessage !== null &&
    props.judge.compileMessage.trim() !== '',
);

const cardGridClass =
  'grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2';
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="hasSummary"
      class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400"
    >
      <span>总用时 {{ formatRecordTime(judge.timeMs) }}</span>
      <span>最大空间 {{ formatMemory(judge.memoryKb ?? 0) }}</span>
    </div>

    <div v-if="showCompileMessage" class="space-y-1.5">
      <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        编译信息
      </p>
      <pre class="max-h-60 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">{{ judge.compileMessage }}</pre>
    </div>

    <details v-if="hasDetails" class="rounded-md border border-zinc-200 dark:border-zinc-800">
      <summary class="cursor-pointer list-none px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        评测详情
      </summary>
      <div class="space-y-4 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div v-if="sortedCases.length > 0" :class="cardGridClass">
          <TestCaseCard
            v-for="testCase in sortedCases"
            :key="testCase.id"
            :test-case="testCase"
            :show-score="scored"
          />
        </div>

        <div
          v-for="subtask in sortedSubtasks"
          :key="subtask.id"
          class="space-y-2"
        >
          <p class="text-xs text-zinc-600 dark:text-zinc-400">
            子任务 #{{ subtask.id }} · {{ subtask.statusName }} ·
            {{ subtask.score }} 分
          </p>
          <div
            v-if="subtask.testCases.length > 0"
            :class="cardGridClass"
          >
            <TestCaseCard
              v-for="testCase in subtask.testCases"
              :key="testCase.id"
              :test-case="testCase"
              :show-score="scored"
            />
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
