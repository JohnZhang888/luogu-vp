import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile) as (
  file: string,
  args: string[],
  options?: { timeout?: number; windowsHide?: boolean },
) => Promise<{ stdout: string; stderr: string }>;

export type BrowserId =
  'firefox' | 'chrome' | 'msedge' | 'chromium' | 'brave' | 'vivaldi';

export type BrowserEngine = 'chromium' | 'firefox';

export interface BrowserCandidate {
  id: BrowserId | 'bundled';
  label: string;
  engine: BrowserEngine;
  /** Chromium 的 Playwright channel（chrome / msedge），Firefox 固定为 moz-firefox。 */
  channel?: string;
  /** 系统浏览器可执行文件；channel 覆盖不到的安装路径靠它。 */
  executablePath?: string;
}

export interface BrowserPlans {
  /** 可见登录窗口的候选顺序：系统默认浏览器优先。 */
  login: BrowserCandidate[];
  /** 无头提交的候选顺序：优先 Chromium，没有时用系统 Firefox。 */
  headless: BrowserCandidate[];
}

export interface BrowserSettings {
  /** VP_BROWSER：auto / default / firefox / chrome / edge / chromium / brave / vivaldi */
  preference: string;
  /** VP_BROWSER_CHANNEL：Playwright channel，优先级高于 preference。 */
  channel: string;
  /** VP_BROWSER_EXECUTABLE：浏览器可执行文件，优先级最高。 */
  executable: string;
}

export const BROWSER_LABELS: Record<BrowserId, string> = {
  firefox: 'Firefox',
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  chromium: 'Chromium',
  brave: 'Brave',
  vivaldi: 'Vivaldi',
};

const FIREFOX_CHANNEL = 'moz-firefox';

/** Playwright 自带 channel 的 Chromium 系浏览器；Brave/Vivaldi/Chromium 只能按路径启动。 */
const CHROMIUM_CHANNELS: Partial<Record<BrowserId, string>> = {
  chrome: 'chrome',
  msedge: 'msedge',
};

/** 回退顺序保持既有习惯：Windows 优先 Edge，macOS/Linux 优先 Chrome。 */
const FALLBACK_ORDER: Record<string, BrowserId[]> = {
  win32: ['msedge', 'chrome'],
  darwin: ['chrome', 'msedge', 'chromium', 'brave', 'vivaldi'],
  linux: ['chrome', 'msedge', 'chromium', 'brave', 'vivaldi'],
};

const LINUX_PATHS: Partial<Record<BrowserId, string[]>> = {
  firefox: [
    '/usr/lib/firefox/firefox',
    '/usr/bin/firefox',
    '/snap/bin/firefox',
    '/var/lib/flatpak/exports/bin/org.mozilla.firefox',
  ],
  chrome: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
  ],
  msedge: [
    '/opt/microsoft/msedge/msedge',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ],
  chromium: [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  brave: ['/usr/bin/brave-browser', '/opt/brave.com/brave/brave'],
  vivaldi: ['/usr/bin/vivaldi-stable', '/opt/vivaldi/vivaldi'],
};

const MAC_PATHS: Partial<Record<BrowserId, string[]>> = {
  chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  msedge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
  brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
  vivaldi: ['/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'],
};

function windowsPaths(id: BrowserId): string[] {
  // Chrome/Edge 由 Playwright 的 channel 读取注册表定位，这里只补 channel 覆盖不到的浏览器。
  const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
  const join = path.win32.join;
  switch (id) {
    case 'brave':
      return [
        join(
          programFiles,
          'BraveSoftware',
          'Brave-Browser',
          'Application',
          'brave.exe',
        ),
      ];
    case 'vivaldi':
      return [join(programFiles, 'Vivaldi', 'Application', 'vivaldi.exe')];
    default:
      return [];
  }
}

function executablePaths(id: BrowserId, platform: NodeJS.Platform): string[] {
  if (platform === 'linux') return LINUX_PATHS[id] ?? [];
  if (platform === 'darwin') return MAC_PATHS[id] ?? [];
  if (platform === 'win32') return windowsPaths(id);
  return [];
}

/** 某一款浏览器在当前平台上的候选（channel 与可执行文件路径二选一或多个）。 */
export function browserCandidates(
  id: BrowserId,
  platform: NodeJS.Platform,
  exists: (file: string) => boolean = existsSync,
): BrowserCandidate[] {
  const label = BROWSER_LABELS[id];
  // 同一款浏览器在 Linux 上常有多个等价路径（如 /usr/bin/google-chrome 与
  // /opt/google/chrome/chrome），只取第一个存在的，避免登录窗口重复尝试。
  const executable = executablePaths(id, platform).find((file) => exists(file));

  if (id === 'firefox') {
    if (executable !== undefined) {
      return [
        {
          id,
          label,
          engine: 'firefox',
          channel: FIREFOX_CHANNEL,
          executablePath: executable,
        },
      ];
    }
    // Windows/macOS 的 moz-firefox channel 会自己找标准安装路径；
    // Linux 上它只认 /snap/bin/firefox，普通安装必须靠上面的可执行文件。
    return platform === 'linux'
      ? []
      : [{ id, label, engine: 'firefox', channel: FIREFOX_CHANNEL }];
  }

  const candidates: BrowserCandidate[] = [];
  const channel = CHROMIUM_CHANNELS[id];
  if (channel !== undefined) {
    candidates.push({ id, label, engine: 'chromium', channel });
  }
  if (executable !== undefined) {
    candidates.push({
      id,
      label,
      engine: 'chromium',
      executablePath: executable,
    });
  }
  return candidates;
}

function candidateKey(candidate: BrowserCandidate): string {
  return [
    candidate.engine,
    candidate.channel ?? '',
    candidate.executablePath ?? '',
  ].join('|');
}

export function dedupeCandidates(
  candidates: BrowserCandidate[],
): BrowserCandidate[] {
  const seen = new Set<string>();
  const result: BrowserCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

/**
 * 登录窗口优先用系统默认浏览器；提交优先 Chromium，没有 Chromium 系浏览器时
 * 才用系统 Firefox。storageState 与引擎无关，所以两者可以不是同一款浏览器。
 */
export function buildBrowserPlans(options: {
  platform: NodeJS.Platform;
  defaultId: BrowserId | null;
  exists?: (file: string) => boolean;
}): BrowserPlans {
  const exists = options.exists ?? existsSync;
  const { platform } = options;
  const order = FALLBACK_ORDER[platform] ?? FALLBACK_ORDER.linux;

  const chromiumFallbacks: BrowserCandidate[] = [];
  for (const id of order) {
    chromiumFallbacks.push(...browserCandidates(id, platform, exists));
  }

  const firefox = browserCandidates('firefox', platform, exists);
  const bundled: BrowserCandidate = {
    id: 'bundled',
    label: 'Playwright 内置 Chromium',
    engine: 'chromium',
  };
  const headless = dedupeCandidates([
    ...chromiumFallbacks,
    ...firefox,
    bundled,
  ]);

  const preferred =
    options.defaultId === null
      ? []
      : browserCandidates(options.defaultId, platform, exists);
  const login = dedupeCandidates([...preferred, ...headless]);

  return { login, headless };
}

/** 解析 `xdg-settings get default-web-browser` 的 .desktop 名称。 */
export function parseDesktopId(raw: string): BrowserId | null {
  const text = raw.trim().toLowerCase();
  if (text === '') return null;
  const first = text.split(/\s+/)[0] ?? '';
  const id = first.replace(/\.desktop$/, '');
  if (id === '') return null;
  if (id.includes('firefox')) return 'firefox';
  if (id.includes('brave')) return 'brave';
  if (id.includes('vivaldi')) return 'vivaldi';
  if (id.includes('edge')) return 'msedge';
  if (id.includes('chromium')) return 'chromium';
  if (id.includes('chrome')) return 'chrome';
  return null;
}

/** 解析 Windows `UserChoice\ProgId`，例如 MSEdgeHTM / ChromeHTML / FirefoxURL-...。 */
export function parseUserChoiceProgId(progId: string): BrowserId | null {
  const value = progId.trim().toLowerCase();
  if (value === '') return null;
  if (value.includes('firefox')) return 'firefox';
  if (value.includes('brave')) return 'brave';
  if (value.includes('vivaldi')) return 'vivaldi';
  if (value.includes('edge')) return 'msedge';
  if (value.includes('chromium')) return 'chromium';
  if (value.includes('chrome')) return 'chrome';
  return null;
}

export function parseRegQueryProgId(raw: string): BrowserId | null {
  const match = raw.match(/ProgId\s+REG_SZ\s+(\S+)/i);
  if (match === null) return null;
  return parseUserChoiceProgId(match[1] ?? '');
}

/** 解析 macOS 默认浏览器的 bundle id；Safari 等 Playwright 不支持的返回 null。 */
export function parseMacBundleId(bundleId: string): BrowserId | null {
  const value = bundleId.trim().toLowerCase();
  if (value === '') return null;
  if (value.includes('firefox')) return 'firefox';
  if (value.includes('brave')) return 'brave';
  if (value.includes('vivaldi')) return 'vivaldi';
  if (value.includes('edgemac') || value.includes('microsoft.edge')) {
    return 'msedge';
  }
  if (value.includes('chromium')) return 'chromium';
  if (value.includes('google.chrome') || value === 'chrome') return 'chrome';
  return null;
}

/** 解析 `defaults read ... LSHandlers`，找出 https 的默认处理程序。 */
export function parseMacHandlers(raw: string): BrowserId | null {
  const blocks = raw.split(/\n\s*\},?\s*\n/);
  for (const block of blocks) {
    if (!/LSHandlerURLScheme\s*=\s*"?https"?\s*;?/.test(block)) continue;
    const role = block.match(
      /LSHandlerRole(?:All|Viewer)\s*=\s*"?([\w.\-]+)"?\s*;?/,
    );
    if (role === null) continue;
    const id = parseMacBundleId(role[1] ?? '');
    if (id !== null) return id;
  }
  return null;
}

export async function detectDefaultBrowser(
  platform: NodeJS.Platform = process.platform,
): Promise<BrowserId | null> {
  try {
    if (platform === 'linux') return await detectLinuxDefault();
    if (platform === 'win32') return await detectWindowsDefault();
    if (platform === 'darwin') return await detectMacDefault();
  } catch {
    // 探测失败（没有 xdg-settings、注册表读不到等）时回退到内置顺序。
  }
  return null;
}

async function detectLinuxDefault(): Promise<BrowserId | null> {
  const commands: Array<[string, string[]]> = [
    ['xdg-settings', ['get', 'default-web-browser']],
    ['xdg-mime', ['query', 'default', 'x-scheme-handler/https']],
  ];
  for (const [command, args] of commands) {
    try {
      const { stdout } = await run(command, args, {
        timeout: 3000,
        windowsHide: true,
      });
      const id = parseDesktopId(stdout);
      if (id !== null) return id;
    } catch {
      // 命令不存在或没有默认值，尝试下一个。
    }
  }
  return null;
}

async function detectWindowsDefault(): Promise<BrowserId | null> {
  const key =
    'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice';
  const { stdout } = await run('reg', ['query', key, '/v', 'ProgId'], {
    timeout: 3000,
    windowsHide: true,
  });
  return parseRegQueryProgId(stdout);
}

async function detectMacDefault(): Promise<BrowserId | null> {
  const { stdout } = await run(
    'defaults',
    [
      'read',
      'com.apple.LaunchServices/com.apple.launchservices.secure',
      'LSHandlers',
    ],
    { timeout: 3000, windowsHide: true },
  );
  return parseMacHandlers(stdout);
}

const NAME_ALIASES: Record<string, BrowserId> = {
  firefox: 'firefox',
  moz: 'firefox',
  mozilla: 'firefox',
  chrome: 'chrome',
  'google-chrome': 'chrome',
  edge: 'msedge',
  msedge: 'msedge',
  'microsoft-edge': 'msedge',
  chromium: 'chromium',
  brave: 'brave',
  vivaldi: 'vivaldi',
};

export function parseBrowserName(name: string): BrowserId | null {
  return NAME_ALIASES[name.trim().toLowerCase()] ?? null;
}

function executableCandidate(executablePath: string): BrowserCandidate {
  const base = path.basename(executablePath) || executablePath;
  if (/firefox/i.test(base)) {
    return {
      id: 'firefox',
      label: BROWSER_LABELS.firefox,
      engine: 'firefox',
      channel: FIREFOX_CHANNEL,
      executablePath,
    };
  }
  return {
    id: 'chromium',
    label: `自定义浏览器（${base}）`,
    engine: 'chromium',
    executablePath,
  };
}

function channelCandidate(
  channel: string,
  platform: NodeJS.Platform,
): BrowserCandidate {
  if (channel.startsWith('moz-')) {
    // Linux 上 Playwright 只认 /snap/bin/firefox，这里补上系统 Firefox 的路径。
    const resolved = browserCandidates('firefox', platform)[0];
    if (resolved !== undefined && resolved.channel === channel) return resolved;
    return {
      id: 'firefox',
      label: BROWSER_LABELS.firefox,
      engine: 'firefox',
      channel,
    };
  }
  const known = Object.entries(CHROMIUM_CHANNELS).find(
    ([, value]) => value === channel,
  );
  const id = (known?.[0] ?? 'chromium') as BrowserId;
  return {
    id,
    label: BROWSER_LABELS[id] ?? `Chromium（${channel}）`,
    engine: 'chromium',
    channel,
  };
}

/**
 * 把环境变量与系统探测结果换算成登录/提交的候选顺序。
 * 显式指定（可执行文件 > channel > VP_BROWSER）时不再自动回退，避免“我明明指定了”却悄悄换浏览器。
 */
export async function resolveBrowserPlans(
  settings: BrowserSettings,
  platform: NodeJS.Platform = process.platform,
): Promise<BrowserPlans> {
  const executable = settings.executable.trim();
  if (executable !== '') {
    const candidate = executableCandidate(executable);
    return { login: [candidate], headless: [candidate] };
  }

  const channel = settings.channel.trim();
  if (channel !== '') {
    const candidate = channelCandidate(channel, platform);
    return { login: [candidate], headless: [candidate] };
  }

  const preference = settings.preference.trim().toLowerCase();
  if (preference !== '' && preference !== 'auto' && preference !== 'default') {
    const id = parseBrowserName(preference);
    const candidates = id === null ? [] : browserCandidates(id, platform);
    return { login: candidates, headless: candidates };
  }

  const defaultId = await detectDefaultBrowser(platform);
  return buildBrowserPlans({ platform, defaultId });
}
