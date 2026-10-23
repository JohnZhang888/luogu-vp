import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { appConfig } from '../config';
import { AppError } from '../errors';
import type { StorageState } from '../session/store';

interface LaunchAttempt {
  label: string;
  run: () => Promise<Browser>;
}

export class BrowserLauncher {
  private browser: Browser | null = null;
  private channel: string | null = null;
  private launching: Promise<Browser> | null = null;

  getChannel(): string | null {
    return this.channel;
  }

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

  private candidateChannels(): string[] {
    if (appConfig.browserChannel !== '') return [appConfig.browserChannel];
    // macOS 默认没有 Edge，先试 Chrome；Windows 上 Edge 一定存在。
    return process.platform === 'win32'
      ? ['msedge', 'chrome']
      : ['chrome', 'msedge'];
  }

  /** Playwright 的 channel 覆盖不到系统 Chromium，按平台补一遍常见安装路径。 */
  private candidateExecutables(): string[] {
    if (appConfig.browserExecutable !== '')
      return [appConfig.browserExecutable];
    if (process.platform === 'darwin') {
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
    }
    if (process.platform === 'linux') {
      return [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
      ];
    }
    return [];
  }

  private async launchHeadless(): Promise<Browser> {
    const failures: string[] = [];
    for (const channel of this.candidateChannels()) {
      try {
        const browser = await chromium.launch({
          channel,
          headless: true,
          args: ['--disable-blink-features=AutomationControlled'],
        });
        this.channel = channel;
        return browser;
      } catch (error) {
        failures.push(
          `${channel}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const executablePath of this.candidateExecutables()) {
      if (!existsSync(executablePath)) continue;
      try {
        const browser = await chromium.launch({
          executablePath,
          headless: true,
          args: ['--disable-blink-features=AutomationControlled'],
        });
        this.channel = executablePath;
        return browser;
      } catch (error) {
        failures.push(
          `${executablePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      });
      this.channel = 'bundled-chromium';
      return browser;
    } catch (error) {
      failures.push(
        `bundled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    throw new AppError(
      'BROWSER_UNAVAILABLE',
      '未找到可用的浏览器。请安装 Microsoft Edge 或 Google Chrome；也可以通过 VP_BROWSER_CHANNEL / VP_BROWSER_EXECUTABLE 指定浏览器。',
      503,
    );
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

  async launchPersistentContext(userDataDir: string): Promise<BrowserContext> {
    const failures: string[] = [];
    for (const channel of this.candidateChannels()) {
      try {
        return await chromium.launchPersistentContext(userDataDir, {
          channel,
          headless: false,
          viewport: { width: 1024, height: 800 },
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
          extraHTTPHeaders: { 'accept-language': 'zh-CN,zh;q=0.9' },
          args: ['--start-maximized'],
        });
      } catch (error) {
        failures.push(
          `${channel}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const executablePath of this.candidateExecutables()) {
      if (!existsSync(executablePath)) continue;
      try {
        return await chromium.launchPersistentContext(userDataDir, {
          executablePath,
          headless: false,
          viewport: { width: 1024, height: 800 },
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
          args: ['--start-maximized'],
        });
      } catch (error) {
        failures.push(
          `${executablePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw new AppError(
      'BROWSER_UNAVAILABLE',
      '无法打开登录窗口。请确认已安装 Microsoft Edge 或 Google Chrome。',
      503,
    );
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    this.channel = null;
    if (browser !== null) {
      try {
        await browser.close();
      } catch {
        // 关闭失败不影响退出。
      }
    }
  }
}
