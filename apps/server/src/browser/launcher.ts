import path from 'node:path';
import {
  chromium,
  firefox,
  type Browser,
  type BrowserContext,
} from 'playwright-core';
import { appConfig } from '../config';
import { AppError } from '../errors';
import { ensureDir } from '../util/fs';
import type { StorageState } from '../session/store';
import {
  resolveBrowserPlans,
  type BrowserCandidate,
  type BrowserPlans,
} from './detect';

function browserUnavailableError(
  tried: BrowserCandidate[],
  loginWindow: boolean,
): AppError {
  const labels = [...new Set(tried.map((candidate) => candidate.label))];
  const prefix = loginWindow ? '无法打开登录窗口' : '未找到可用的浏览器';
  const detail =
    labels.length === 0
      ? '。'
      : `（已尝试：${labels.join('、')}）。如果通过 VP_BROWSER 指定了浏览器，请确认它已正确安装。`;
  return new AppError(
    'BROWSER_UNAVAILABLE',
    `${prefix}${detail}请安装 Firefox（129 及以上）、Google Chrome、Microsoft Edge 或 Chromium；也可以用 VP_BROWSER / VP_BROWSER_CHANNEL / VP_BROWSER_EXECUTABLE 指定浏览器。`,
    503,
  );
}

export class BrowserLauncher {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private plans: BrowserPlans | null = null;
  private plansLoading: Promise<BrowserPlans> | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser !== null && this.browser.isConnected()) {
      return this.browser;
    }
    if (this.launching !== null) return this.launching;

    this.launching = this.launchHeadless();
    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  async newContext(storageState: StorageState): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      storageState: storageState as never,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { 'accept-language': 'zh-CN,zh;q=0.9' },
    });
    context.setDefaultTimeout(20_000);
    context.setDefaultNavigationTimeout(30_000);
    return context;
  }

  /**
   * 打开可见登录窗口：候选顺序由 detect.ts 决定，默认浏览器优先。
   * 两种引擎使用不同 profile 目录，避免把 Firefox 的配置档交给 Chromium。
   */
  async launchLoginWindow(
    dataDir: string,
  ): Promise<{ context: BrowserContext; label: string }> {
    const plans = await this.getPlans();
    const tried: BrowserCandidate[] = [];

    for (const candidate of plans.login) {
      tried.push(candidate);
      const profileDir = this.profileDirFor(candidate, dataDir);
      try {
        await ensureDir(profileDir);
        const context = await this.launchPersistent(candidate, profileDir);
        return { context, label: candidate.label };
      } catch {
        // 换下一个候选继续尝试。
      }
    }

    throw browserUnavailableError(tried, true);
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser !== null) {
      try {
        await browser.close();
      } catch {
        // 关闭失败不影响退出。
      }
    }
  }

  private getPlans(): Promise<BrowserPlans> {
    if (this.plans !== null) return Promise.resolve(this.plans);
    if (this.plansLoading === null) {
      this.plansLoading = resolveBrowserPlans({
        preference: appConfig.browserPreference,
        channel: appConfig.browserChannel,
        executable: appConfig.browserExecutable,
      })
        .then((plans) => {
          this.plans = plans;
          return plans;
        })
        .finally(() => {
          this.plansLoading = null;
        });
    }
    return this.plansLoading;
  }

  private profileDirFor(candidate: BrowserCandidate, dataDir: string): string {
    return candidate.engine === 'firefox'
      ? path.join(dataDir, 'browser-profile-firefox')
      : path.join(dataDir, 'browser-profile');
  }

  private async launchHeadless(): Promise<Browser> {
    const plans = await this.getPlans();
    const tried: BrowserCandidate[] = [];

    for (const candidate of plans.headless) {
      tried.push(candidate);
      try {
        const browser = await this.launchBrowser(candidate, true);
        return browser;
      } catch {
        // 换下一个候选继续尝试。
      }
    }

    throw browserUnavailableError(tried, false);
  }

  private launchBrowser(
    candidate: BrowserCandidate,
    headless: boolean,
  ): Promise<Browser> {
    if (candidate.engine === 'firefox') {
      return firefox.launch({
        headless,
        // moz-* channel 让 Playwright 走 WebDriver BiDi，直接用系统安装的 Firefox。
        channel: candidate.channel ?? 'moz-firefox',
        ...(candidate.executablePath !== undefined
          ? { executablePath: candidate.executablePath }
          : {}),
      });
    }

    return chromium.launch({
      headless,
      ...(candidate.channel !== undefined
        ? { channel: candidate.channel }
        : {}),
      ...(candidate.executablePath !== undefined
        ? { executablePath: candidate.executablePath }
        : {}),
      ...(headless
        ? { args: ['--disable-blink-features=AutomationControlled'] }
        : {}),
    });
  }

  private launchPersistent(
    candidate: BrowserCandidate,
    profileDir: string,
  ): Promise<BrowserContext> {
    if (candidate.engine === 'firefox') {
      return firefox.launchPersistentContext(profileDir, {
        channel: candidate.channel ?? 'moz-firefox',
        ...(candidate.executablePath !== undefined
          ? { executablePath: candidate.executablePath }
          : {}),
        headless: false,
        viewport: { width: 1024, height: 800 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        extraHTTPHeaders: { 'accept-language': 'zh-CN,zh;q=0.9' },
      });
    }

    return chromium.launchPersistentContext(profileDir, {
      ...(candidate.channel !== undefined
        ? { channel: candidate.channel }
        : {}),
      ...(candidate.executablePath !== undefined
        ? { executablePath: candidate.executablePath }
        : {}),
      headless: false,
      viewport: { width: 1024, height: 800 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      extraHTTPHeaders: { 'accept-language': 'zh-CN,zh;q=0.9' },
      args: ['--start-maximized'],
    });
  }
}
