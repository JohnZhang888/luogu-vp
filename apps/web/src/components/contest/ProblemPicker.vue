<script setup lang="ts">
import { ref } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Plus,
  Trash2,
} from 'lucide-vue-next';
import type { ResolveProblemsResponse } from '@vp/core';
import { api } from '@/lib/api';
import { letterFor, MAX_PROBLEMS, type PickerProblem } from '@/lib/contest-create';
import Spinner from '@/components/ui/Spinner.vue';

const props = defineProps<{ modelValue: PickerProblem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: PickerProblem[]] }>();

const input = ref('');
const adding = ref(false);
const error = ref<string | null>(null);

function update(next: PickerProblem[]): void {
  emit('update:modelValue', next);
}

async function add(): Promise<void> {
  error.value = null;
  const tokens = [
    ...new Set(
      input.value
        .split(/[\s,，、]+/)
        .map((token) => token.trim())
        .filter((token) => token !== ''),
    ),
  ];
  if (tokens.length === 0) return;
  if (props.modelValue.length + tokens.length > MAX_PROBLEMS) {
    error.value = `一场比赛最多 ${MAX_PROBLEMS} 道题。`;
    return;
  }

  adding.value = true;
  try {
    const response = await api.post<ResolveProblemsResponse>(
      '/api/luogu/problems/resolve',
      { pids: tokens },
    );
    const next = [...props.modelValue];
    const failures: string[] = [];
    for (const result of response.results) {
      if (!result.ok) {
        failures.push(`${result.pid}：${result.error}`);
        continue;
      }
      if (next.some((problem) => problem.pid === result.pid)) continue;
      next.push({
        pid: result.pid,
        title: result.title,
        fullScore: result.fullScore,
      });
    }
    update(next);
    if (failures.length > 0) {
      error.value = failures.join('；');
    } else {
      input.value = '';
    }
  } catch (requestError) {
    error.value =
      requestError instanceof Error ? requestError.message : '读取题目失败。';
  } finally {
    adding.value = false;
  }
}

function remove(index: number): void {
  update(props.modelValue.filter((_problem, current) => current !== index));
}

function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  const [item] = next.splice(index, 1);
  if (item === undefined) return;
  next.splice(target, 0, item);
  update(next);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-2 sm:flex-row">
      <input
        v-model="input"
        class="input"
        type="text"
        placeholder="题目 ID，可一次粘贴多个，用空格或逗号分隔"
        spellcheck="false"
        @keydown.enter.prevent="add"
      />
      <div class="group relative shrink-0">
        <button
          type="button"
          class="btn btn-secondary w-full"
          :disabled="adding || input.trim() === ''"
          :aria-describedby="input.trim() === '' ? 'problem-picker-hint' : undefined"
          @click="add"
        >
          <Spinner v-if="adding" :size="16" />
          <Plus v-else :size="16" />
          添加
        </button>
        <span
          v-if="input.trim() === ''"
          id="problem-picker-hint"
          role="tooltip"
          class="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          请先输入题号
        </span>
      </div>
    </div>

    <p v-if="error" class="flex items-start gap-1.5 field-error">
      <CircleAlert :size="14" class="mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </p>

    <div v-if="modelValue.length === 0" class="hint py-2">
      尚未添加题目
    </div>
    <ul v-else class="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      <li
        v-for="(problem, index) in modelValue"
        :key="problem.pid"
        class="flex items-center gap-3 px-3 py-2"
      >
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded border border-zinc-200 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
        >
          {{ letterFor(index) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-zinc-900 dark:text-zinc-100">
            {{ problem.title }}
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            {{ problem.pid }}
          </p>
        </div>
        <div class="flex shrink-0 items-center">
          <button
            type="button"
            class="btn btn-ghost size-8 p-0"
            title="上移"
            aria-label="上移"
            :disabled="index === 0"
            @click="move(index, -1)"
          >
            <ArrowUp :size="15" />
          </button>
          <button
            type="button"
            class="btn btn-ghost size-8 p-0"
            title="下移"
            aria-label="下移"
            :disabled="index === modelValue.length - 1"
            @click="move(index, 1)"
          >
            <ArrowDown :size="15" />
          </button>
          <button
            type="button"
            class="btn btn-ghost size-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
            title="移除"
            aria-label="移除"
            @click="remove(index)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
