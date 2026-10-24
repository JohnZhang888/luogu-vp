<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeft, CircleAlert, Send } from 'lucide-vue-next';
import type { LanguageOption } from '@vp/core';
import { useContestStore } from '@/stores/contest';
import { useProblemStore } from '@/stores/problem';
import { useSessionStore } from '@/stores/session';
import { useSubmissionStore } from '@/stores/submission';
import { useDraft } from '@/composables/useDraft';
import Spinner from '@/components/ui/Spinner.vue';
import CaptchaDialog from '@/components/submit/CaptchaDialog.vue';
import SubmissionResult from '@/components/submit/SubmissionResult.vue';

interface LanguageGroup {
  label: string;
  options: LanguageOption[];
}

const route = useRoute();
const contest = useContestStore();
const problems = useProblemStore();
const session = useSessionStore();
const submissions = useSubmissionStore();

const pid = computed(() => String(route.params.pid ?? ''));
const problem = computed(() => problems.get(pid.value));
const loading = computed(() => problems.loading[pid.value] === true);
const loadError = computed(() => problems.errors[pid.value] ?? null);
const contestProblem = computed(() =>
  contest.problems.find((item) => item.pid === pid.value),
);
const format = computed(() => contest.state?.config.format ?? 'oi');
const isMockSource = computed(
  () => contest.state?.config.source.kind === 'mock',
);
/**
 * 测试比赛的免登录与提示只在开发构建生效：生产构建中
 * import.meta.env.DEV 被替换为 false，提示文案不会进入产物。
 */
const mockHint = computed(() =>
  import.meta.env.DEV && isMockSource.value
    ? '测试比赛：无需连接洛谷，提交后返回虚构的评测结果。'
    : null,
);

const { text: code } = useDraft(pid.value);

const languageId = ref<number | null>(null);
const enableO2 = ref(false);
const posting = ref(false);
const captchaSubmitting = ref(false);

const languages = computed<LanguageOption[]>(() => problem.value?.languages ?? []);
const selectedLanguage = computed(
  () => languages.value.find((item) => item.id === languageId.value) ?? null,
);

const languageGroups = computed<LanguageGroup[]>(() => {
  const groups = new Map<string, LanguageGroup>();
  const labelFor = (family: string | null): string => {
    if (family === 'c') return 'C / C++';
    if (family === 'python') return 'Python';
    if (family === 'java') return 'Java';
    return '其他';
  };
  for (const language of languages.value) {
    const label = labelFor(language.family);
    let group = groups.get(label);
    if (group === undefined) {
      group = { label, options: [] };
      groups.set(label, group);
    }
    group.options.push(language);
  }
  const order = ['C / C++', 'Python', 'Java', '其他'];
  return [...groups.values()].sort(
    (left, right) => order.indexOf(left.label) - order.indexOf(right.label),
  );
});

const latestSubmission = computed(() => contest.submissionForProblem(pid.value));
const latestJob = computed(() =>
  submissions.jobFor(latestSubmission.value?.clientId ?? null),
);
const captchaOpen = computed(
  () =>
    latestSubmission.value?.state === 'awaiting-captcha' &&
    latestJob.value?.captcha !== null &&
    latestJob.value?.captcha !== undefined,
);
const captchaImage = computed(
  () => latestJob.value?.captcha?.imageDataUrl ?? '',
);

const submissionBusy = computed(() => {
  const state = latestSubmission.value?.state;
  return (
    state === 'submitting' ||
    state === 'queued' ||
    state === 'preparing' ||
    state === 'awaiting-captcha'
  );
});

const progressLabel = computed(() => {
  const state = latestSubmission.value?.state;
  switch (state) {
    case 'submitting':
      return '正在提交';
    case 'queued':
      return '排队中';
    case 'preparing':
      return '正在提交';
    case 'awaiting-captcha':
      return '等待验证码';
    case 'judging':
      return '评测中';
    case 'submitted':
      return '已提交';
    default:
      return '';
  }
});

function selectDefaultLanguage(): void {
  const detail = problem.value;
  if (detail === null || languageId.value !== null) return;
  const preferred = detail.lastLanguageId;
  const selected =
    (preferred !== null
      ? detail.languages.find((item) => item.id === preferred)
      : undefined) ??
    detail.languages.find((item) => item.id === 28) ??
    detail.languages.find((item) => item.id === 11) ??
    detail.languages[0];
  if (selected !== undefined) {
    languageId.value = selected.id;
    enableO2.value = selected.canO2;
  }
}

async function loadProblem(): Promise<void> {
  if (pid.value === '') return;
  try {
    await problems.load(pid.value);
    selectDefaultLanguage();
  } catch {
    // 错误信息已经由 store 保存。
  }
}

watch(pid, () => void loadProblem(), { immediate: true });
watch(problem, () => selectDefaultLanguage());

watch(languageId, () => {
  if (selectedLanguage.value === null || !selectedLanguage.value.canO2) {
    enableO2.value = false;
  }
});

async function submit(): Promise<void> {
  if (posting.value || contest.phase !== 'running') return;
  if (session.user === null && !(import.meta.env.DEV && isMockSource.value)) {
    await session.openLogin();
    return;
  }
  const detail = problem.value;
  const language = selectedLanguage.value;
  if (detail === null || language === null) return;
  if (code.value.trim() === '') return;

  posting.value = true;
  try {
    await submissions.submit({
      pid: pid.value,
      code: code.value,
      languageId: language.id,
      languageName: language.name,
      enableO2: enableO2.value && language.canO2,
    });
  } finally {
    posting.value = false;
  }
}

async function submitCaptcha(answer: string): Promise<void> {
  const submission = latestSubmission.value;
  if (submission === null) return;
  captchaSubmitting.value = true;
  try {
    await submissions.answerCaptcha(submission.clientId, answer);
  } finally {
    captchaSubmitting.value = false;
  }
}

async function cancelCaptcha(): Promise<void> {
  const submission = latestSubmission.value;
  if (submission === null) return;
  await submissions.cancel(submission.clientId);
}
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <RouterLink
        :to="{ name: 'problem', params: { pid } }"
        class="btn btn-ghost h-8 px-2 text-xs"
      >
        <ArrowLeft :size="15" />
        返回题目
      </RouterLink>
      <p v-if="contestProblem" class="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">
        {{ contestProblem.letter }} · {{ contestProblem.title }}
      </p>
    </div>

    <div
      v-if="loading && problem === null"
      class="card flex items-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-400"
    >
      <Spinner :size="16" />
      正在读取题目…
    </div>

    <div
      v-else-if="loadError !== null && problem === null"
      class="card space-y-3 p-6"
    >
      <p class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
        <CircleAlert :size="16" class="mt-0.5 shrink-0" />
        <span>{{ loadError }}</span>
      </p>
      <button type="button" class="btn btn-secondary h-8 px-3 text-xs" @click="loadProblem">
        重试
      </button>
    </div>

    <div v-else-if="problem" class="space-y-5">
      <div class="card p-4 sm:p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span class="text-zinc-500 dark:text-zinc-400">语言</span>
              <select
                v-model.number="languageId"
                class="input h-9 w-auto min-w-56 py-1.5"
              >
                <optgroup
                  v-for="group in languageGroups"
                  :key="group.label"
                  :label="group.label"
                >
                  <option
                    v-for="language in group.options"
                    :key="language.id"
                    :value="language.id"
                  >
                    {{ language.name }}
                  </option>
                </optgroup>
              </select>
            </label>
            <label
              v-if="selectedLanguage?.canO2"
              class="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input v-model="enableO2" type="checkbox" class="accent-teal-600" />
              开启 O2 优化
            </label>
          </div>
        </div>

        <textarea
          v-model="code"
          class="block min-h-96 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 text-zinc-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          spellcheck="false"
          autocomplete="off"
          aria-label="代码"
        />

        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p v-if="mockHint !== null" class="text-xs text-zinc-500 dark:text-zinc-400">
            {{ mockHint }}
          </p>
          <p v-else-if="session.user === null" class="text-xs text-zinc-500 dark:text-zinc-400">
            提交前需要连接洛谷。
          </p>
          <p v-else class="text-xs text-zinc-500 dark:text-zinc-400">
            已连接 @{{ session.user.name }}
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="posting || submissionBusy || code.trim() === '' || languageId === null || contest.phase !== 'running'"
              @click="submit"
            >
              <Spinner v-if="posting" :size="16" />
              <Send v-else :size="16" />
              提交
            </button>
          </div>
        </div>

        <p
          v-if="languages.length === 0"
          class="mt-3 text-xs text-amber-700 dark:text-amber-300"
        >
          该题暂不支持代码提交。
        </p>
      </div>

      <div v-if="latestSubmission">
        <div
          v-if="latestSubmission.state === 'failed'"
          class="card space-y-3 p-4"
        >
          <p class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <CircleAlert :size="16" class="mt-0.5 shrink-0" />
            <span>{{ latestSubmission.error ?? '提交失败。' }}</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-secondary h-8 px-3 text-xs" @click="submit">
              重新提交
            </button>
            <button
              v-if="latestSubmission.error?.includes('登录')"
              type="button"
              class="btn btn-secondary h-8 px-3 text-xs"
              @click="session.openLogin(true)"
            >
              重新登录
            </button>
          </div>
        </div>

        <div
          v-else-if="latestSubmission.state === 'done' && latestSubmission.judge && format !== 'oi'"
        >
          <SubmissionResult
            :judge="latestSubmission.judge"
            :format="format"
          />
        </div>

        <div
          v-else-if="format === 'oi' && latestSubmission.rid !== null"
          class="card p-4 text-sm text-zinc-700 dark:text-zinc-300"
        >
          已提交
        </div>

        <div
          v-else
          class="card flex items-center gap-2 p-4 text-sm text-zinc-600 dark:text-zinc-400"
        >
          <Spinner :size="15" />
          {{ progressLabel }}
        </div>
      </div>
    </div>

    <CaptchaDialog
      :open="captchaOpen"
      :image-data-url="captchaImage"
      :submitting="captchaSubmitting"
      @submit="submitCaptcha"
      @cancel="cancelCaptcha"
    />
  </main>
</template>
