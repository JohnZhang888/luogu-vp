import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  BatchRecordsResponse,
  ContestConfig,
  ContestScore,
  ContestState,
  Submission,
} from '@vp/core';
import {
  CONTEST_FORMAT_LABELS,
  computeContestScore,
  createRuntime,
  finishContest,
  pauseContest,
  phaseAt,
  remainingMs as remainingMsOf,
  resumeContest,
  usedActiveMs,
} from '@vp/core';
import { api } from '@/lib/api';
import {
  clearContest,
  clearDrafts,
  loadContest,
  saveContest,
} from '@/lib/storage';

const TICK_MS = 500;
const FINALIZE_TIMEOUT_MS = 3 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const useContestStore = defineStore('contest', () => {
  const state = ref<ContestState | null>(null);
  const now = ref(Date.now());
  const loadError = ref<string | null>(null);
  const storageError = ref<string | null>(null);
  const finalizing = ref(false);
  const finalizeError = ref<string | null>(null);

  let clockTimer: number | null = null;
  let saveTimer: number | null = null;
  let listenersBound = false;

  const phase = computed(() =>
    state.value === null
      ? null
      : phaseAt(state.value.config, state.value.runtime, now.value),
  );

  const remainingMs = computed(() =>
    state.value === null
      ? 0
      : remainingMsOf(state.value.config, state.value.runtime, now.value),
  );

  const usedMs = computed(() =>
    state.value === null
      ? 0
      : usedActiveMs(state.value.config, state.value.runtime, now.value),
  );

  const allowPause = computed(() => state.value?.config.allowPause ?? false);
  const formatLabel = computed(() =>
    state.value === null ? '' : CONTEST_FORMAT_LABELS[state.value.config.format],
  );
  const isPaused = computed(() => phase.value === 'paused');
  const problems = computed(() => state.value?.config.problems ?? []);
  const submissions = computed(() => state.value?.submissions ?? []);

  const judgedSubmissions = computed(() =>
    submissions.value.filter(
      (submission) =>
        submission.judge !== null && !submission.judge.pending,
    ),
  );

  const score = computed<ContestScore | null>(() => {
    const current = state.value;
    if (current === null) return null;
    if (
      current.config.format === 'oi' &&
      (current.runtime.finishedAt === null ||
        current.resultsFetchedAt === null)
    ) {
      return null;
    }
    return computeContestScore(
      current.config,
      current.runtime,
      judgedSubmissions.value,
    );
  });

  const resultsReady = computed(() => {
    const current = state.value;
    if (current === null) return false;
    return !current.submissions.some(
      (submission) =>
        submission.rid !== null &&
        (submission.judge === null || submission.judge.pending),
    );
  });

  const pendingResultCount = computed(
    () =>
      submissions.value.filter(
        (submission) =>
          submission.rid !== null &&
          (submission.judge === null || submission.judge.pending),
      ).length,
  );

  function startClock(): void {
    if (clockTimer !== null) return;
    clockTimer = window.setInterval(() => {
      now.value = Date.now();
      const current = state.value;
      if (current === null || current.runtime.finishedAt !== null) return;
      if (phaseAt(current.config, current.runtime, now.value) === 'finished') {
        finish(now.value);
      }
    }, TICK_MS);
  }

  function stopClock(): void {
    if (clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function persistNow(): void {
    if (state.value === null) return;
    try {
      saveContest(state.value);
      storageError.value = null;
    } catch {
      storageError.value = '无法保存比赛状态，浏览器存储空间可能不足。';
    }
  }

  function schedulePersist(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, 200);
  }

  function flush(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persistNow();
  }

  function bindLifecycle(): void {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('pagehide', flush);
  }

  function load(): void {
    bindLifecycle();
    const result = loadContest();
    loadError.value = result.error;
    if (result.state === null) return;
    state.value = result.state;
    now.value = Date.now();
    startClock();
    const current = state.value;
    if (
      current.runtime.finishedAt === null &&
      phaseAt(current.config, current.runtime, now.value) === 'finished'
    ) {
      finish(now.value);
    }
  }

  function create(config: ContestConfig): void {
    clearDrafts();
    state.value = {
      schemaVersion: 1,
      config,
      runtime: createRuntime(),
      submissions: [],
      resultsFetchedAt: null,
    };
    loadError.value = null;
    finalizeError.value = null;
    finalizing.value = false;
    now.value = Date.now();
    startClock();
    if (phaseAt(config, state.value.runtime, now.value) === 'finished') {
      finish(now.value);
    }
    persistNow();
  }

  function pause(): void {
    const current = state.value;
    if (current === null || !current.config.allowPause) return;
    if (phaseAt(current.config, current.runtime, Date.now()) !== 'running') return;
    now.value = Date.now();
    current.runtime = pauseContest(current.runtime, now.value);
    persistNow();
  }

  function resume(): void {
    const current = state.value;
    if (current === null) return;
    if (phaseAt(current.config, current.runtime, Date.now()) !== 'paused') return;
    now.value = Date.now();
    current.runtime = resumeContest(current.runtime, now.value);
    persistNow();
  }

  function finish(at = Date.now()): void {
    const current = state.value;
    if (current === null || current.runtime.finishedAt !== null) return;
    current.runtime = finishContest(current.runtime, at);
    current.resultsFetchedAt = null;
    now.value = Date.now();
    persistNow();
  }

  function clear(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    stopClock();
    state.value = null;
    loadError.value = null;
    finalizeError.value = null;
    finalizing.value = false;
    clearContest();
    clearDrafts();
  }

  function addSubmission(submission: Submission): void {
    const current = state.value;
    if (current === null) return;
    current.submissions.push(submission);
    schedulePersist();
  }

  function updateSubmission(
    clientId: string,
    patch: Partial<Submission>,
  ): void {
    const current = state.value;
    if (current === null) return;
    const submission = current.submissions.find(
      (item) => item.clientId === clientId,
    );
    if (submission === undefined) return;
    Object.assign(submission, patch);
    schedulePersist();
  }

  function submissionForProblem(pid: string): Submission | null {
    let latest: Submission | null = null;
    for (const submission of submissions.value) {
      if (submission.pid !== pid) continue;
      if (latest === null || submission.createdAt > latest.createdAt) {
        latest = submission;
      }
    }
    return latest;
  }

  async function finalizeResults(): Promise<void> {
    const current = state.value;
    if (current === null || current.runtime.finishedAt === null) return;
    if (finalizing.value) return;
    if (resultsReady.value) {
      if (current.resultsFetchedAt === null) {
        current.resultsFetchedAt = Date.now();
        persistNow();
      }
      return;
    }

    finalizing.value = true;
    finalizeError.value = null;
    try {
      const rids = [
        ...new Set(
          current.submissions
            .map((submission) => submission.rid)
            .filter((rid): rid is number => typeof rid === 'number' && rid > 0),
        ),
      ];

      if (rids.length === 0) {
        current.resultsFetchedAt = Date.now();
        persistNow();
        return;
      }

      const deadline = Date.now() + FINALIZE_TIMEOUT_MS;
      while (true) {
        const response = await api.post<BatchRecordsResponse>(
          '/api/records/batch',
          { rids, format: current.config.format },
        );

        let authError: string | null = null;
        for (const item of response.records) {
          if (item.error?.code === 'AUTH_REQUIRED') {
            authError = item.error.message;
            continue;
          }
          if (item.judge === null) continue;
          const submission = current.submissions.find(
            (entry) => entry.rid === item.rid,
          );
          if (submission === undefined) continue;
          submission.judge = item.judge;
          submission.state = item.judge.pending ? 'judging' : 'done';
          if (!item.judge.pending) submission.error = null;
        }

        if (authError !== null) {
          finalizeError.value = authError;
          break;
        }

        const pending = current.submissions.some(
          (submission) =>
            submission.rid !== null &&
            (submission.judge === null || submission.judge.pending),
        );
        if (!pending) {
          current.resultsFetchedAt = Date.now();
          break;
        }
        if (Date.now() > deadline) {
          finalizeError.value = '部分提交仍在评测中，请稍后刷新。';
          break;
        }
        await sleep(2000);
      }
      persistNow();
    } catch (error) {
      finalizeError.value =
        error instanceof Error ? error.message : '获取评测结果失败。';
    } finally {
      finalizing.value = false;
    }
  }

  return {
    state,
    now,
    loadError,
    storageError,
    finalizing,
    finalizeError,
    phase,
    remainingMs,
    usedMs,
    allowPause,
    formatLabel,
    isPaused,
    problems,
    submissions,
    score,
    resultsReady,
    pendingResultCount,
    load,
    create,
    pause,
    resume,
    finish,
    clear,
    addSubmission,
    updateSubmission,
    submissionForProblem,
    finalizeResults,
    flush,
  };
});
