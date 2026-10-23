import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import type { AuthUser, LoginStatus } from '@vp/core';
import { appConfig } from '../config';
import { AppError } from '../errors';
import { asRecord } from '../util/guards';
import { ensureDir, sleep } from '../util/fs';
import type { BrowserLauncher } from '../browser/launcher';
import type { SessionStore, StorageState } from './store';

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;
const PROBE_URL = `${appConfig.luoguBase}/problem/P1001`;

export class LoginManager {
  private status: LoginStatus = { state: 'idle', user: null, error: null };
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cancelled = false;
  private generation = 0;

  constructor(
    private readonly session: SessionStore,
    private readonly launcher: BrowserLauncher,
  ) {}

  getStatus(): LoginStatus {
    return { ...this.status };
  }

  async start(): Promise<LoginStatus> {
    if (this.status.state === 'waiting') return this.getStatus();

    this.cancelled = false;
    this.generation += 1;
    const generation = this.generation;
    this.status = { state: 'waiting', user: null, error: null };

    try {
      const existing = await this.session.currentUser(true);
      if (existing !== null) {
        this.status = { state: 'success', user: existing, error: null };
        return this.getStatus();
      }
    } catch {
      // 网络暂时不可用时仍然允许打开登录窗口。
    }

    try {
      const profileDir = path.join(appConfig.dataDir, 'browser-profile');
      await ensureDir(profileDir);
      const context = await this.launcher.launchPersistentContext(profileDir);
      this.context = context;
      context.on('close', () => {
        if (this.status.state === 'waiting') {
          this.status = {
            state: 'cancelled',
            user: null,
            error: '登录窗口已关闭。',
          };
        }
        this.context = null;
        this.page = null;
      });

      const page = context.pages()[0] ?? (await context.newPage());
      this.page = page;
      await page.goto(`${appConfig.luoguBase}/auth/login`, {
        waitUntil: 'domcontentloaded',
      });
      void this.poll(generation);
    } catch (error) {
      this.status = {
        state: 'error',
        user: null,
        error:
          error instanceof AppError
            ? error.message
            : '无法打开登录窗口，请检查浏览器是否可用。',
      };
      await this.closeContext();
    }

    return this.getStatus();
  }

  /**
   * 手动复核。自动轮询会持续运行，这个入口用于用户点击“我已完成登录”时立即检查一次。
   */
  async checkNow(): Promise<LoginStatus> {
    if (this.status.state === 'success') return this.getStatus();
    if (this.context === null) {
      this.status = {
        state: 'error',
        user: null,
        error: '登录窗口未打开，请重新点击“连接洛谷”。',
      };
      return this.getStatus();
    }

    const user = await this.detectUser();
    if (user === null) {
      this.status = {
        state: 'waiting',
        user: null,
        error: '尚未检测到登录，请确认浏览器窗口中已经登录洛谷。',
      };
      return this.getStatus();
    }

    await this.acceptUser(user);
    return this.getStatus();
  }

  async cancel(): Promise<LoginStatus> {
    this.cancelled = true;
    this.generation += 1;
    this.status = {
      state: 'cancelled',
      user: null,
      error: null,
    };
    await this.closeContext();
    return this.getStatus();
  }

  async shutdown(): Promise<void> {
    this.cancelled = true;
    await this.closeContext();
  }

  private async poll(generation: number): Promise<void> {
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (!this.cancelled && generation === this.generation) {
      if (this.context === null) return;

      const user = await this.detectUser();
      if (user !== null) {
        if (generation !== this.generation) return;
        await this.acceptUser(user);
        return;
      }

      if (Date.now() > deadline) {
        this.status = {
          state: 'error',
          user: null,
          error: '登录超时，请重试。',
        };
        await this.closeContext();
        return;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  /**
   * 优先在可见登录页里执行同源 fetch：它使用页面自己的 Cookie/运行环境，
   * 比 BrowserContext.request 更可靠（后者在部分持久化上下文中拿不到已登录身份）。
   */
  private async detectUser(): Promise<AuthUser | null> {
    const context = this.context;
    if (context === null) return null;

    const page = this.currentPage(context);
    if (page !== null) {
      const fromPage = await this.readUserFromPage(page);
      if (fromPage !== null) return fromPage;
    }

    return this.readUserFromRequest(context);
  }

  private currentPage(context: BrowserContext): Page | null {
    if (this.page !== null && !this.page.isClosed()) return this.page;
    const page = context.pages().find((item) => !item.isClosed()) ?? null;
    this.page = page;
    return page;
  }

  private async readUserFromPage(page: Page): Promise<AuthUser | null> {
    try {
      if (!page.url().startsWith(appConfig.luoguBase)) return null;
      return await page.evaluate(async (probeUrl: string) => {
        try {
          const response = await fetch(probeUrl, {
            headers: { 'x-lentille-request': 'content-only' },
            credentials: 'include',
          });
          if (!response.ok) return null;
          const json = (await response.json()) as {
            user?: { uid?: number; name?: string } | null;
            data?: { user?: { uid?: number; name?: string } | null };
          };
          // 新版洛谷把登录用户放在响应的顶层 user 字段；兼容旧的 data.user。
          const raw = json.user ?? json.data?.user;
          if (raw === undefined || raw === null) return null;
          if (typeof raw.uid !== 'number' || raw.uid <= 0) return null;
          return { uid: raw.uid, name: String(raw.name ?? raw.uid) };
        } catch {
          return null;
        }
      }, PROBE_URL);
    } catch {
      return null;
    }
  }

  private async readUserFromRequest(
    context: BrowserContext,
  ): Promise<AuthUser | null> {
    try {
      const response = await context.request.get(PROBE_URL, {
        headers: { 'x-lentille-request': 'content-only' },
        timeout: 10_000,
      });
      if (!response.ok()) return null;
      const json = (await response.json()) as Record<string, unknown>;
      const raw = asRecord(json.user ?? asRecord(json.data).user);
      const uid = Number(raw.uid);
      if (!Number.isFinite(uid) || uid <= 0) return null;
      return { uid, name: String(raw.name ?? uid) };
    } catch {
      return null;
    }
  }

  private async acceptUser(user: AuthUser): Promise<void> {
    const context = this.context;
    if (context === null) return;

    this.status = { state: 'success', user, error: null };
    try {
      const state = await context.storageState();
      await this.session.saveStorageState(state as unknown as StorageState);
      await this.session.writeMeta(user);
      this.session.rememberUser(user);
    } catch {
      // 登录本身已经成功；会话保存失败时仍允许继续，提交阶段会再次校验。
    }
    await this.closeContext();
  }

  private async closeContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.page = null;
    if (context !== null) {
      try {
        await context.close();
      } catch {
        // 忽略关闭异常。
      }
    }
  }
}
