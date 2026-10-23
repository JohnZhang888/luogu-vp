import { ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  BatchRecordsResponse,
  Submission,
  SubmissionJobView,
  SubmissionState,
} from '@vp/core';
import { ApiError, api } from '@/lib/api';
import { useContestStore } from './contest';

const POLL_INTERVAL_MS = 1200;

function isActiveState(state: SubmissionState, format: string | undefined): boolean {
  if (state === 'done' || state === 'failed') return false;
  if (state === 'submitted') return format !== 'oi';
  return true;
}

export const useSubmissionStore = defineStore('submission', () => {
  const contest = useContestStore();
  const jobs = ref<Record<string, SubmissionJobView>>({});
  const inFlight = new Set<string>();
  const polling = new Set<string>();
  let timer: number | null = null;

  function jobFor(clientId: string | null): SubmissionJobView | null {
    if (clientId === null) return null;
    return jobs.value[clientId] ?? null;
  }

  function latestJobForProblem(pid: string): SubmissionJobView | null {
    const submission = contest.submissionForProblem(pid);
    if (submission === null) return null;
    return jobFor(submission.clientId);
  }

  function isActive(submission: Submission): boolean {
    return isActiveState(
      submission.state,
      contest.state?.config.format,
    );
  }

  function applyJob(job: SubmissionJobView): void {
    jobs.value = { ...jobs.value, [job.clientId]: job };
    const submission = contest.submissions.find(
      (item) => item.clientId === job.clientId,
    );
    if (submission === undefined) return;

    const patch: Partial<Submission> = {
      state: job.state,
      rid: job.rid,
      error: job.error === null ? null : job.error.message,
    };
    if (job.judge !== null) patch.judge = job.judge;
    contest.updateSubmission(job.clientId, patch);
  }

  async function recoverFromRecord(submission: Submission): Promise<void> {
    if (submission.rid === null || contest.state === null) return;
    try {
      const response = await api.post<BatchRecordsResponse>(
        '/api/records/batch',
        {
          rids: [submission.rid],
          format: contest.state.config.format,
        },
      );
      const item = response.records[0];
      if (item === undefined) return;
      if (item.judge !== null) {
        contest.updateSubmission(submission.clientId, {
          judge: item.judge,
          state: item.judge.pending ? 'judging' : 'done',
          error: null,
        });
      } else if (item.error !== null) {
        contest.updateSubmission(submission.clientId, {
          error: item.error.message,
        });
      }
    } catch {
      // 留待下一次轮询重试。
    }
  }

  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function pollOnce(): Promise<void> {
    if (contest.state === null) {
      stopPolling();
      return;
    }
    const active = contest.submissions.filter(
      (submission) =>
        isActive(submission) &&
        !inFlight.has(submission.clientId) &&
        !polling.has(submission.clientId),
    );
    if (active.length === 0) {
      stopPolling();
      return;
    }

    await Promise.allSettled(
      active.map(async (submission) => {
        polling.add(submission.clientId);
        try {
          const job = await api.get<SubmissionJobView>(
            `/api/submissions/${submission.clientId}`,
          );
          applyJob(job);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            if (submission.rid !== null) {
              await recoverFromRecord(submission);
            } else {
              contest.updateSubmission(submission.clientId, {
                state: 'failed',
                error: '提交状态未知，服务可能已经重启。可以重新提交。',
              });
            }
          }
        } finally {
          polling.delete(submission.clientId);
        }
      }),
    );

    if (!contest.submissions.some((submission) => isActive(submission))) {
      stopPolling();
    }
  }

  function startPolling(): void {
    if (timer !== null) return;
    timer = window.setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    void pollOnce();
  }

  async function submit(input: {
    pid: string;
    code: string;
    languageId: number;
    languageName: string;
    enableO2: boolean;
  }): Promise<string | null> {
    if (contest.state === null || contest.phase !== 'running') return null;
    const clientId = crypto.randomUUID();
    const submission: Submission = {
      clientId,
      rid: null,
      pid: input.pid,
      languageId: input.languageId,
      languageName: input.languageName,
      enableO2: input.enableO2,
      createdAt: Date.now(),
      state: 'submitting',
      error: null,
      judge: null,
    };
    contest.addSubmission(submission);
    inFlight.add(clientId);

    try {
      const job = await api.post<SubmissionJobView>('/api/submissions', {
        clientId,
        pid: input.pid,
        code: input.code,
        languageId: input.languageId,
        enableO2: input.enableO2,
        format: contest.state.config.format,
      });
      applyJob(job);
    } catch (error) {
      contest.updateSubmission(clientId, {
        state: 'failed',
        error:
          error instanceof Error ? error.message : '提交失败，请稍后重试。',
      });
    } finally {
      inFlight.delete(clientId);
      startPolling();
    }

    return clientId;
  }

  async function answerCaptcha(
    clientId: string,
    answer: string,
  ): Promise<void> {
    try {
      const job = await api.post<SubmissionJobView>(
        `/api/submissions/${clientId}/captcha`,
        { answer },
      );
      applyJob(job);
      startPolling();
    } catch (error) {
      const job = jobs.value[clientId];
      if (job !== undefined) {
        jobs.value = {
          ...jobs.value,
          [clientId]: {
            ...job,
            error: {
              code: 'CAPTCHA_FAILED',
              message:
                error instanceof Error ? error.message : '验证码提交失败。',
            },
          },
        };
      }
    }
  }

  async function cancel(clientId: string): Promise<void> {
    try {
      const job = await api.post<SubmissionJobView>(
        `/api/submissions/${clientId}/cancel`,
      );
      applyJob(job);
    } catch {
      contest.updateSubmission(clientId, {
        state: 'failed',
        error: '已取消提交。',
      });
    }
    if (!contest.submissions.some((submission) => isActive(submission))) {
      stopPolling();
    }
  }

  function resumePolling(): void {
    if (contest.state === null) return;
    if (contest.submissions.some((submission) => isActive(submission))) {
      startPolling();
    }
  }

  function reset(): void {
    stopPolling();
    jobs.value = {};
    inFlight.clear();
    polling.clear();
  }

  return {
    jobs,
    jobFor,
    latestJobForProblem,
    submit,
    answerCaptcha,
    cancel,
    resumePolling,
    reset,
  };
});
