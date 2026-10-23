<script setup lang="ts">
import type { JudgeResult } from '@vp/core';
import { formatMemory, formatRecordTime } from '@/lib/format';

const props = defineProps<{ judge: JudgeResult }>();
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="judge.compileMessage !== null && judge.compileMessage.trim() !== ''"
      class="space-y-1.5"
    >
      <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        编译信息
      </p>
      <pre class="max-h-60 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">{{ judge.compileMessage }}</pre>
    </div>

    <details
      v-if="judge.subtasks.length > 0 || judge.testCases.length > 0"
      class="rounded-md border border-zinc-200 dark:border-zinc-800"
    >
      <summary class="cursor-pointer list-none px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        评测详情
      </summary>
      <div class="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <table
          v-if="judge.testCases.length > 0"
          class="w-full border-collapse text-xs"
        >
          <thead>
            <tr class="text-left text-zinc-500 dark:text-zinc-400">
              <th class="border-b border-zinc-200 py-1 pr-2 font-medium dark:border-zinc-800">测试点</th>
              <th class="border-b border-zinc-200 py-1 pr-2 font-medium dark:border-zinc-800">结果</th>
              <th class="border-b border-zinc-200 py-1 pr-2 font-medium dark:border-zinc-800">得分</th>
              <th class="border-b border-zinc-200 py-1 font-medium dark:border-zinc-800">用时 / 内存</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="testCase in judge.testCases" :key="testCase.id">
              <td class="border-b border-zinc-100 py-1 pr-2 dark:border-zinc-800/60">#{{ testCase.id }}</td>
              <td class="border-b border-zinc-100 py-1 pr-2 dark:border-zinc-800/60">{{ testCase.statusName }}</td>
              <td class="border-b border-zinc-100 py-1 pr-2 dark:border-zinc-800/60">{{ testCase.score }}</td>
              <td class="border-b border-zinc-100 py-1 dark:border-zinc-800/60">
                {{ formatRecordTime(testCase.timeMs) }} / {{ formatMemory(testCase.memoryKb ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="judge.subtasks.length > 0" class="space-y-2">
          <div
            v-for="subtask in judge.subtasks"
            :key="subtask.id"
            class="space-y-1.5"
          >
            <p class="text-xs text-zinc-600 dark:text-zinc-400">
              子任务 #{{ subtask.id }} · {{ subtask.statusName }} ·
              {{ subtask.score }} 分
            </p>
            <div v-if="subtask.testCases.length > 0" class="flex flex-wrap gap-1">
              <span
                v-for="testCase in subtask.testCases"
                :key="testCase.id"
                class="badge border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              >
                #{{ testCase.id }} {{ testCase.statusName }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
