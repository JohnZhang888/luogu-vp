<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ContestDetail, ContestFormat } from '@vp/core';
import {
  CONTEST_FORMAT_LABELS,
  MOCK_PROBLEM_FULL_SCORE,
  MOCK_PROBLEM_PID,
  MOCK_PROBLEM_TITLE,
} from '@vp/core';
import { api } from '@/lib/api';
import {
  formatDateTimeLocalValue,
  formatDuration,
  parseDateTimeLocalValue,
} from '@/lib/format';
import { letterFor, type PickerProblem } from '@/lib/contest-create';
import { useContestStore } from '@/stores/contest';
import { useProblemStore } from '@/stores/problem';
import { useSubmissionStore } from '@/stores/submission';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import Spinner from '@/components/ui/Spinner.vue';
import ProblemPicker from '@/components/contest/ProblemPicker.vue';
import { CircleAlert, RefreshCw, Search } from 'lucide-vue-next';

type SourceKind = 'luogu' | 'custom' | 'mock';
type StartMode = 'now' | 'scheduled';

const router = useRouter();
const contest = useContestStore();
const problems = useProblemStore();
const submissions = useSubmissionStore();

const source = ref<SourceKind>('luogu');
/**
 * 虚构测试比赛的说明卡片。只在开发构建引入：生产构建中 import.meta.env.DEV
 * 被替换为 false，Rollup 会把动态导入连同组件一起从产物中移除。
 */
const mockCard = import.meta.env.DEV
  ? defineAsyncComponent(
      () => import('@/components/contest/MockContestCard.vue'),
    )
  : null;
const sourceOptions: Array<{ value: SourceKind; label: string }> = [
  { value: 'luogu', label: '洛谷比赛' },
  { value: 'custom', label: '自选题目' },
  ...(import.meta.env.DEV
    ? [{ value: 'mock' as const, label: '测试比赛' }]
    : []),
];

const contestIdInput = ref('');
const importing = ref(false);
const importError = ref<string | null>(null);
const imported = ref<ContestDetail | null>(null);

const customProblems = ref<PickerProblem[]>([]);

const name = ref('自建比赛');
const format = ref<ContestFormat>('ioi');
const icpcPenaltyCompileError = ref(true);
const startMode = ref<StartMode>('now');
const startAtLocal = ref(formatDateTimeLocalValue(Date.now() + 5 * 60 * 1000));
const durationMinutes = ref(120);
const allowPause = ref(false);
const formError = ref<string | null>(null);
const creating = ref(false);

const formatOptions: Array<{
  value: ContestFormat;
  label: string;
  description: string;
}> = [
  {
    value: 'icpc',
    label: 'ICPC',
    description: '通过题数优先，按罚时排名。',
  },
  {
    value: 'ioi',
    label: 'IOI',
    description: '实时反馈，每题取最高分。',
  },
  {
    value: 'oi',
    label: 'OI',
    description: '赛中不显示评测结果，每题以最后一次提交计分。',
  },
  {
    value: 'rakuta',
    label: '乐多',
    description: '实时反馈，成绩随提交次数折扣，取最高分。',
  },
];

const durationPresets = [60, 120, 180, 240, 300];
const startOptions: Array<{ value: StartMode; label: string }> = [
  { value: 'now', label: '立即开始' },
  { value: 'scheduled', label: '指定时间' },
];
const minStart = computed(() =>
  formatDateTimeLocalValue(Date.now() - 60 * 1000),
);
const durationLabel = computed(() =>
  formatDuration(durationMinutes.value * 60 * 1000),
);

const selectedProblems = computed<PickerProblem[]>(() => {
  if (source.value === 'luogu') {
    return (
      imported.value?.problems.map((problem) => ({
        pid: problem.pid,
        title: problem.title,
        fullScore: problem.fullScore,
      })) ?? []
    );
  }
  if (import.meta.env.DEV && source.value === 'mock') {
    return [
      {
        pid: MOCK_PROBLEM_PID,
        title: MOCK_PROBLEM_TITLE,
        fullScore: MOCK_PROBLEM_FULL_SCORE,
      },
    ];
  }
  return customProblems.value;
});

const canCreate = computed(() => {
  if (creating.value) return false;
  if (source.value === 'luogu' && imported.value === null) return false;
  if (selectedProblems.value.length === 0) return false;
  return true;
});

function parseContestId(value: string): number | null {
  const trimmed = value.trim();
  const match = /contest\/(\d+)/.exec(trimmed) ?? /^(\d+)$/.exec(trimmed);
  if (match === null) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function importContest(): Promise<void> {
  importError.value = null;
  const id = parseContestId(contestIdInput.value);
  if (id === null) {
    importError.value = '请输入比赛 ID 或比赛链接。';
    return;
  }
  importing.value = true;
  try {
    const detail = await api.get<ContestDetail>(`/api/luogu/contest/${id}`);
    imported.value = detail;
    name.value = detail.name;
    format.value = detail.format;
    durationMinutes.value = Math.max(
      1,
      Math.min(1440, Math.round(detail.durationMs / 60000) || 120),
    );
  } catch (requestError) {
    imported.value = null;
    importError.value =
      requestError instanceof Error ? requestError.message : '读取比赛失败。';
  } finally {
    importing.value = false;
  }
}

async function create(): Promise<void> {
  formError.value = null;
  if (source.value === 'luogu' && imported.value === null) {
    formError.value = '请先读取一场已结束的洛谷比赛。';
    return;
  }
  if (selectedProblems.value.length === 0) {
    formError.value = '至少添加一道题目。';
    return;
  }

  let startAt = Date.now();
  if (startMode.value === 'scheduled') {
    const parsed = parseDateTimeLocalValue(startAtLocal.value);
    if (parsed === null) {
      formError.value = '请选择有效的开始时间。';
      return;
    }
    if (parsed < Date.now() - 60 * 1000) {
      formError.value = '开始时间不能早于现在。';
      return;
    }
    startAt = parsed;
  }

  if (durationMinutes.value < 1 || durationMinutes.value > 1440) {
    formError.value = '比赛时长应在 1 到 1440 分钟之间。';
    return;
  }
  const minutes = Math.round(Number(durationMinutes.value));
  if (!Number.isFinite(minutes) || minutes < 1) {
    formError.value = '比赛时长应在 1 到 1440 分钟之间。';
    return;
  }

  const contestProblems = selectedProblems.value.map((problem, index) => {
    const original =
      source.value === 'luogu' && imported.value !== null
        ? imported.value.problems[index]
        : undefined;
    return {
      pid: problem.pid,
      letter: original?.letter ?? letterFor(index),
      title: problem.title,
      fullScore: problem.fullScore,
    };
  });

  creating.value = true;
  try {
    problems.clear();
    submissions.reset();
    contest.create({
      id: crypto.randomUUID(),
      name: name.value.trim() === '' ? '自建比赛' : name.value.trim(),
      source:
        source.value === 'luogu' && imported.value !== null
          ? { kind: 'luogu', contestId: imported.value.id }
          : source.value === 'mock'
            ? { kind: 'mock' }
            : { kind: 'custom' },
      format: format.value,
      icpcPenaltyCompileError: icpcPenaltyCompileError.value,
      startAt,
      durationMs: minutes * 60 * 1000,
      allowPause: allowPause.value,
      problems: contestProblems,
      createdAt: Date.now(),
    });
    await router.push({ name: 'contest' });
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : '创建比赛失败。';
  } finally {
    creating.value = false;
  }
}

function resetCorruptData(): void {
  contest.clear();
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        创建比赛
      </h1>
    </div>

    <div
      v-if="contest.loadError"
      class="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <p class="flex items-start gap-2">
        <CircleAlert :size="16" class="mt-0.5 shrink-0" />
        <span>{{ contest.loadError }}</span>
      </p>
      <button
        type="button"
        class="btn btn-secondary mt-3 h-8 px-3 text-xs"
        @click="resetCorruptData"
      >
        <RefreshCw :size="14" />
        清除本地数据
      </button>
    </div>

    <div
      v-if="contest.storageError"
      class="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    >
      {{ contest.storageError }}
    </div>

    <form class="space-y-5" @submit.prevent="create">
      <section class="card space-y-4 p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            比赛来源
          </h2>
          <SegmentedControl v-model="source" :options="sourceOptions" />
        </div>

        <template v-if="source === 'luogu'">
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              v-model="contestIdInput"
              class="input"
              type="text"
              placeholder="比赛 ID 或链接"
              spellcheck="false"
              @keydown.enter.prevent="importContest"
            />
            <button
              type="button"
              class="btn btn-secondary shrink-0"
              :disabled="importing || contestIdInput.trim() === ''"
              @click="importContest"
            >
              <Spinner v-if="importing" :size="16" />
              <Search v-else :size="16" />
              读取比赛
            </button>
          </div>

          <p v-if="importError" class="flex items-start gap-1.5 field-error">
            <CircleAlert :size="14" class="mt-0.5 shrink-0" />
            <span>{{ importError }}</span>
          </p>

          <div
            v-if="imported"
            class="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {{ imported.name }}
            </p>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              原赛制 {{ imported.originalFormatName }} · 共
              {{ imported.problems.length }} 题
            </p>
            <ul class="mt-3 space-y-1.5">
              <li
                v-for="problem in imported.problems"
                :key="problem.pid"
                class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <span class="w-5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {{ problem.letter }}
                </span>
                <span class="truncate">{{ problem.title }}</span>
              </li>
            </ul>
          </div>
          <p v-else class="hint">
            只支持已经结束的比赛。
          </p>
        </template>

        <ProblemPicker v-else-if="source === 'custom'" v-model="customProblems" />

        <component :is="mockCard" v-else-if="source === 'mock' && mockCard" />
      </section>

      <section class="card space-y-4 p-5 sm:p-6">
        <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          基本设置
        </h2>

        <div class="space-y-1.5">
          <label class="label" for="contest-name">比赛名称</label>
          <input
            id="contest-name"
            v-model="name"
            class="input"
            type="text"
            maxlength="80"
          />
        </div>

        <div class="space-y-2">
          <span class="label">赛制</span>
          <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="赛制">
            <button
              v-for="option in formatOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="format === option.value"
              class="rounded-md border p-3 text-left transition-colors motion-reduce:transition-none"
              :class="
                format === option.value
                  ? 'border-teal-500 bg-teal-50 dark:border-teal-500/60 dark:bg-teal-500/10'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
              "
              @click="format = option.value"
            >
              <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {{ option.label }}
              </span>
              <span class="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {{ option.description }}
              </span>
            </button>
          </div>
          <p v-if="imported" class="hint">
            原比赛赛制为 {{ imported.originalFormatName }}，可以按需要调整。
          </p>
        </div>

        <fieldset v-if="format === 'icpc'" class="space-y-2">
          <legend class="label">罚时规则</legend>
          <label class="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              v-model="icpcPenaltyCompileError"
              type="radio"
              :value="true"
              class="mt-1 accent-teal-600"
            />
            <span>编译错误计入罚时</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              v-model="icpcPenaltyCompileError"
              type="radio"
              :value="false"
              class="mt-1 accent-teal-600"
            />
            <span>编译错误不计罚时</span>
          </label>
        </fieldset>
      </section>

      <section class="card space-y-4 p-5 sm:p-6">
        <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          时间与规则
        </h2>

        <div class="space-y-2">
          <span class="label">开始时间</span>
          <div class="flex flex-wrap items-center gap-3">
            <SegmentedControl v-model="startMode" :options="startOptions" />
            <input
              v-if="startMode === 'scheduled'"
              v-model="startAtLocal"
              class="input max-w-60"
              type="datetime-local"
              :min="minStart"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="label" for="contest-duration">比赛时长</label>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-2">
              <input
                id="contest-duration"
                v-model.number="durationMinutes"
                class="input w-24"
                type="number"
                min="1"
                max="1440"
                step="1"
              />
              <span class="text-sm text-zinc-500 dark:text-zinc-400">分钟</span>
            </div>
            <button
              v-for="preset in durationPresets"
              :key="preset"
              type="button"
              class="btn btn-secondary h-8 px-2.5 text-xs"
              :class="durationMinutes === preset ? 'border-teal-500 text-teal-700 dark:border-teal-500/60 dark:text-teal-300' : ''"
              @click="durationMinutes = preset"
            >
              {{ preset / 60 }} 小时
            </button>
          </div>
          <p class="hint">{{ durationLabel }}</p>
        </div>

        <label class="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            v-model="allowPause"
            type="checkbox"
            class="mt-1 accent-teal-600"
          />
          <span>
            允许暂停
            <span class="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              暂停期间隐藏题面、停止计时，创建后不可更改。
            </span>
          </span>
        </label>
      </section>

      <p v-if="formError" class="flex items-start gap-1.5 field-error">
        <CircleAlert :size="14" class="mt-0.5 shrink-0" />
        <span>{{ formError }}</span>
      </p>

      <div class="flex items-center justify-between gap-3">
        <p class="hint">
          已选择 {{ selectedProblems.length }} 题
        </p>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!canCreate"
        >
          <Spinner v-if="creating" :size="16" />
          创建比赛
        </button>
      </div>
    </form>
  </main>
</template>
