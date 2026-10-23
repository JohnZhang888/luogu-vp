import { createHash } from 'node:crypto';
import type { BrowserContext, Page } from 'playwright-core';
import type {
  CaptchaChallenge,
  ContestFormat,
  JudgeResult,
  SubmissionJobView,
  SubmissionState,
} from '@vp/core';
import { appConfig } from '../config';
import {
  AppError,
  AuthRequiredError,
  asJobError,
} from '../errors';
import { sleep } from '../util/fs';
import { asNumber, asRecord, asString } from '../util/guards';
import type { BrowserLauncher } from '../browser/launcher';
import type { ProblemService } from '../luogu/problem';
import type { RecordService } from '../luogu/record';
import { luoguThrottle } from '../luogu/throttle';
import type { SessionStore, StorageState } from '../session/store';

const CAPTCHA_TIMEOUT_MS = 5 * 60 * 1000;
const RECORD_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000;

export interface StartSubmissionInput {
  clientId: string;
  pid: string;
  code: string;
  languageId: number;
  enableO2: boolean;
  format: ContestFormat;
}

interface SubmissionJob {
  clientId: string;
  pid: string;
  code: string;
  languageId: number;
  enableO2: boolean;
  format: ContestFormat;
  state: SubmissionState;
  rid: number | null;
  captcha: CaptchaChallenge | null;
  judge: JudgeResult | null;
  error: { code: string; message: string } | null;
  createdAt: number;
  updatedAt: number;
  cancelled: boolean;
  context: BrowserContext | null;
  page: Page | null;
  captchaResolve: ((answer: string) => void) | null;
  captchaReject: ((error: Error) => void) | null;
  captchaTimer: NodeJS.Timeout | null;
}

interface SubmitEvalResult {
  status: number;
  data: unknown;
}

interface SubmitAttempt {
  rid?: number;
  auth?: boolean;
  captcha?: boolean;
  interactiveType?: string;
  message?: string;
}

export class SubmissionService {
  private readonly jobs = new Map<string, SubmissionJob>();
  private queue: Promise<void> = Promise.resolve();
  private cleanupTimer: NodeJS.Timeout;

  constructor(
    private readonly session: SessionStore,
    private readonly launcher: BrowserLauncher,
    private readonly problems: ProblemService,
    private readonly records: RecordService,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.cleanupTimer.unref();
  }

  start(input: StartSubmissionInput): SubmissionJobView {
    const existing = this.jobs.get(input.clientId);
    if (existing !== undefined) return this.view(existing);

    const now = Date.now();
    const job: SubmissionJob = {
      ...input,
      state: 'queued',
      rid: null,
      captcha: null,
      judge: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      cancelled: false,
      context: null,
      page: null,
      captchaResolve: null,
      captchaReject: null,
      captchaTimer: null,
    };
    this.jobs.set(job.clientId, job);
    this.queue = this.queue
      .then(() => this.run(job))
      .catch(() => undefined);
    return this.view(job);
  }

  get(clientId: string): SubmissionJobView | null {
    const job = this.jobs.get(clientId);
    return job === undefined ? null : this.view(job);
  }

  async answerCaptcha(clientId: string, answer: string): Promise<SubmissionJobView> {
    const job = this.jobs.get(clientId);
    if (job === undefined) {
      throw new AppError('SUBMISSION_NOT_FOUND', '找不到这次提交。', 404);
    }
    if (job.state !== 'awaiting-captcha' || job.captchaResolve === null) {
      throw new AppError('CAPTCHA_NOT_EXPECTED', '当前没有待输入的验证码。', 409);
    }
    const resolve = job.captchaResolve;
    job.captchaResolve = null;
    job.captchaReject = null;
    if (job.captchaTimer !== null) {
      clearTimeout(job.captchaTimer);
      job.captchaTimer = null;
    }
    job.captcha = null;
    job.state = 'preparing';
    this.touch(job);
    resolve(answer);
    return this.view(job);
  }

  async cancel(clientId: string): Promise<SubmissionJobView> {
    const job = this.jobs.get(clientId);
    if (job === undefined) {
      throw new AppError('SUBMISSION_NOT_FOUND', '找不到这次提交。', 404);
    }
    job.cancelled = true;
    const reject = job.captchaReject;
    job.captchaResolve = null;
    job.captchaReject = null;
    if (job.captchaTimer !== null) {
      clearTimeout(job.captchaTimer);
      job.captchaTimer = null;
    }
    if (reject !== null) {
      reject(new AppError('CANCELLED', '提交已取消。', 400));
    }
    if (job.state !== 'done' && job.state !== 'failed') {
      job.state = 'failed';
      job.error = { code: 'CANCELLED', message: '提交已取消。' };
      this.touch(job);
    }
    await this.closeJobBrowser(job);
    return this.view(job);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
    for (const job of this.jobs.values()) {
      job.cancelled = true;
      if (job.captchaReject !== null) {
        job.captchaReject(new AppError('CANCELLED', '服务正在关闭。', 500));
      }
      await this.closeJobBrowser(job);
    }
    this.jobs.clear();
  }

  private async run(job: SubmissionJob): Promise<void> {
    try {
      if (job.cancelled) throw new AppError('CANCELLED', '提交已取消。', 400);
      job.state = 'preparing';
      this.touch(job);

      const problem = await this.problems.get(job.pid);
      const language = problem.languages.find((item) => item.id === job.languageId);
      if (language === undefined) {
        throw new AppError(
          'INVALID_LANGUAGE',
          '所选语言不在该题支持的语言列表中。',
          400,
        );
      }
      if (job.enableO2 && !language.canO2) job.enableO2 = false;

      const storageState = await this.session.loadState();
      if (storageState === null) throw new AuthRequiredError();

      const context = await this.launcher.newContext(storageState);
      job.context = context;
      const page = await context.newPage();
      job.page = page;
      await page.route('**/*', async (route) => {
        const type = route.request().resourceType();
        if (type === 'image' || type === 'font' || type === 'media') {
          await route.abort();
          return;
        }
        await route.continue();
      });

      const problemUrl = `${appConfig.luoguBase}/problem/${encodeURIComponent(job.pid)}`;
      await luoguThrottle.wait();
      await page.goto(problemUrl, { waitUntil: 'domcontentloaded' });
      if (job.cancelled) throw new AppError('CANCELLED', '提交已取消。', 400);

      const token = await page
        .locator('meta[name="csrf-token"]')
        .getAttribute('content', { timeout: 10_000 });
      if (token === null || token === '') {
        throw new AppError(
          'SUBMIT_FAILED',
          '无法读取提交令牌，洛谷页面可能已改版。',
          502,
        );
      }

      const rid = await this.submitWithCaptcha(job, context, page, token);
      job.rid = rid;
      job.state = job.format === 'oi' ? 'submitted' : 'judging';
      job.error = null;
      this.touch(job);

      await this.persistSession(context);
      await this.closeJobBrowser(job);

      if (job.format !== 'oi') {
        await this.pollRecord(job);
      }
    } catch (error) {
      job.error = asJobError(error);
      job.state = 'failed';
      job.captcha = null;
      this.touch(job);
    } finally {
      job.code = '';
      await this.closeJobBrowser(job);
    }
  }

  private async submitWithCaptcha(
    job: SubmissionJob,
    context: BrowserContext,
    page: Page,
    token: string,
  ): Promise<number> {
    let captcha: string | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (job.cancelled) throw new AppError('CANCELLED', '提交已取消。', 400);
      const result = await this.postSubmit(page, token, job, captcha);
      if (result.rid !== undefined) return result.rid;
      if (result.auth === true) throw new AuthRequiredError();
      if (result.captcha === true) {
        const type = result.interactiveType ?? 'IMAGE';
        if (type !== 'IMAGE') {
          throw new AppError(
            'CAPTCHA_UNSUPPORTED',
            `洛谷要求交互式验证码（${type}），当前版本只支持图片验证码。`,
            400,
          );
        }
        const challenge = await this.fetchCaptcha(context);
        job.captcha = challenge;
        job.state = 'awaiting-captcha';
        this.touch(job);
        captcha = await this.waitForCaptcha(job);
        job.captcha = null;
        job.state = 'preparing';
        this.touch(job);
        continue;
      }
      throw new AppError(
        'SUBMIT_FAILED',
        result.message ?? '提交失败，请稍后重试。',
        502,
      );
    }
    throw new AppError('CAPTCHA_FAILED', '验证码尝试次数过多。', 400);
  }

  private async postSubmit(
    page: Page,
    token: string,
    job: SubmissionJob,
    captcha: string | null,
  ): Promise<SubmitAttempt> {
    const payload: Record<string, unknown> = {
      lang: job.languageId,
      code: job.code,
      enableO2: job.enableO2 ? 1 : 0,
    };
    if (captcha !== null) payload.captcha = captcha;

    const url = `/fe/api/problem/submit/${encodeURIComponent(job.pid)}`;
    await luoguThrottle.wait();
    const result = await page.evaluate(
      async (args: {
        url: string;
        token: string;
        payload: Record<string, unknown>;
      }): Promise<SubmitEvalResult> => {
        const response = await fetch(args.url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': args.token,
          },
          body: JSON.stringify(args.payload),
        });
        const text = await response.text();
        let data: unknown = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        return { status: response.status, data };
      },
      { url, token, payload },
    );

    const data = asRecord(result.data);
    if (result.status === 200) {
      const rid = asNumber(data.rid, 0);
      if (rid > 0) return { rid };
    }

    const errorType = asString(data.errorType);
    const errorData = asRecord(data.errorData);
    const interactive = asRecord(errorData.interactive);
    const interactiveType = asString(
      interactive.type,
      asString(errorData.type, ''),
    );

    if (result.status === 401 || /UserNotLoggedIn|UserUnlogin|needLogin/i.test(errorType)) {
      return { auth: true };
    }
    if (/captcha/i.test(errorType)) {
      return {
        captcha: true,
        interactiveType: interactiveType === '' ? 'IMAGE' : interactiveType,
      };
    }

    const message =
      asString(data.errorMessage) ||
      asString(data.data) ||
      asString(data.raw) ||
      `洛谷返回 HTTP ${result.status}`;
    return { message };
  }

  private async fetchCaptcha(context: BrowserContext): Promise<CaptchaChallenge> {
    await luoguThrottle.wait();
    const response = await context.request.get(
      `${appConfig.luoguBase}/api/verify/captcha`,
      {
        headers: { referer: `${appConfig.luoguBase}/` },
        timeout: 10_000,
      },
    );
    const contentType = response.headers()['content-type'] ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new AppError('CAPTCHA_FAILED', '无法获取验证码图片。', 502);
    }
    const buffer = await response.body();
    if (buffer.length === 0) {
      throw new AppError('CAPTCHA_FAILED', '验证码图片为空。', 502);
    }
    const id = createHash('sha1').update(buffer).digest('hex');
    return {
      id,
      imageDataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    };
  }

  private waitForCaptcha(job: SubmissionJob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      job.captchaResolve = resolve;
      job.captchaReject = reject;
      job.captchaTimer = setTimeout(() => {
        job.captchaResolve = null;
        job.captchaReject = null;
        job.captchaTimer = null;
        reject(new AppError('CAPTCHA_TIMEOUT', '验证码已过期，请重试。', 400));
      }, CAPTCHA_TIMEOUT_MS);
      job.captchaTimer.unref();
    });
  }

  private async pollRecord(job: SubmissionJob): Promise<void> {
    if (job.rid === null) return;
    const deadline = Date.now() + RECORD_POLL_TIMEOUT_MS;
    let consecutiveErrors = 0;

    while (!job.cancelled && Date.now() < deadline) {
      try {
        const judge = await this.records.fetchRecord(job.rid);
        consecutiveErrors = 0;
        if (!judge.pending) {
          job.judge = judge;
          job.state = 'done';
          this.touch(job);
          return;
        }
        job.state = 'judging';
        this.touch(job);
      } catch (error) {
        if (error instanceof AuthRequiredError) {
          job.error = asJobError(error);
          job.state = 'failed';
          this.touch(job);
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= 6) {
          job.error = asJobError(error);
          job.state = 'failed';
          this.touch(job);
          return;
        }
      }
      await sleep(1500);
    }

    if (!job.cancelled) {
      job.state = 'failed';
      job.error = {
        code: 'JUDGE_TIMEOUT',
        message: '评测结果获取超时，可以稍后在结果页重试。',
      };
      this.touch(job);
    }
  }

  private async persistSession(context: BrowserContext): Promise<void> {
    try {
      const state = await context.storageState();
      await this.session.saveStorageState(state as unknown as StorageState);
    } catch {
      // 会话刷新失败不影响本次提交。
    }
  }

  private async closeJobBrowser(job: SubmissionJob): Promise<void> {
    const page = job.page;
    const context = job.context;
    job.page = null;
    job.context = null;
    if (page !== null) {
      try {
        await page.close();
      } catch {
        // 忽略关闭异常。
      }
    }
    if (context !== null) {
      try {
        await context.close();
      } catch {
        // 忽略关闭异常。
      }
    }
  }

  private touch(job: SubmissionJob): void {
    job.updatedAt = Date.now();
  }

  private view(job: SubmissionJob): SubmissionJobView {
    return {
      clientId: job.clientId,
      state: job.state,
      rid: job.rid,
      captcha: job.captcha,
      judge: job.format === 'oi' ? null : job.judge,
      error: job.error,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, job] of this.jobs) {
      const finished = job.state === 'done' || job.state === 'failed';
      const expired = now - job.updatedAt > JOB_TTL_MS;
      if (finished && expired) {
        if (job.captchaTimer !== null) clearTimeout(job.captchaTimer);
        this.jobs.delete(clientId);
      }
    }
  }
}
