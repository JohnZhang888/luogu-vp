import { describe, expect, it } from 'vitest';
import {
  buildBrowserPlans,
  parseBrowserName,
  parseDesktopId,
  parseMacBundleId,
  parseMacHandlers,
  parseRegQueryProgId,
  parseUserChoiceProgId,
  resolveBrowserPlans,
} from './detect';

const onlySystemFirefox = (file: string): boolean =>
  file === '/usr/bin/firefox';

describe('parseDesktopId', () => {
  it.each([
    ['firefox.desktop', 'firefox'],
    ['firefox_firefox.desktop', 'firefox'],
    ['google-chrome.desktop', 'chrome'],
    ['chromium-browser.desktop', 'chromium'],
    ['microsoft-edge.desktop', 'msedge'],
    ['brave-browser.desktop', 'brave'],
    ['vivaldi-stable.desktop', 'vivaldi'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(parseDesktopId(input)).toBe(expected);
  });

  it('忽略不支持的桌面环境', () => {
    expect(parseDesktopId('safari.desktop')).toBeNull();
    expect(parseDesktopId('')).toBeNull();
    expect(parseDesktopId('\n')).toBeNull();
  });
});

describe('parseUserChoiceProgId', () => {
  it.each([
    ['MSEdgeHTM', 'msedge'],
    ['ChromeHTML', 'chrome'],
    ['FirefoxURL-308046B0AF4A39CB', 'firefox'],
    ['BraveHTML', 'brave'],
    ['VivaldiHTM.x', 'vivaldi'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(parseUserChoiceProgId(input)).toBe(expected);
  });

  it('忽略未知的 ProgId', () => {
    expect(parseUserChoiceProgId('SomeRandomHandler')).toBeNull();
    expect(parseUserChoiceProgId('')).toBeNull();
  });
});

describe('parseRegQueryProgId', () => {
  it('从 reg query 输出里取 ProgId', () => {
    const output = [
      '',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice',
      '    ProgId    REG_SZ    MSEdgeHTM',
      '',
    ].join('\r\n');
    expect(parseRegQueryProgId(output)).toBe('msedge');
  });

  it('没有 ProgId 时返回 null', () => {
    expect(parseRegQueryProgId('ERROR: 找不到指定的注册表项或值。')).toBeNull();
  });
});

describe('macOS 默认浏览器', () => {
  it('识别 bundle id', () => {
    expect(parseMacBundleId('org.mozilla.firefox')).toBe('firefox');
    expect(parseMacBundleId('com.google.chrome')).toBe('chrome');
    expect(parseMacBundleId('com.microsoft.edgemac')).toBe('msedge');
    expect(parseMacBundleId('com.brave.browser')).toBe('brave');
    expect(parseMacBundleId('com.vivaldi.vivaldi')).toBe('vivaldi');
    expect(parseMacBundleId('com.apple.safari')).toBeNull();
  });

  it('优先取 https 的默认处理程序', () => {
    const output = `(
    {
        LSHandlerContentType = "public.html";
        LSHandlerRoleAll = "com.apple.safari";
    },
    {
        LSHandlerRoleAll = "org.mozilla.firefox";
        LSHandlerURLScheme = https;
    }
)`;
    expect(parseMacHandlers(output)).toBe('firefox');
  });

  it('只有 Safari 时返回 null', () => {
    const output = `(
    {
        LSHandlerRoleAll = "com.apple.safari";
        LSHandlerURLScheme = https;
    }
)`;
    expect(parseMacHandlers(output)).toBeNull();
  });
});

describe('buildBrowserPlans', () => {
  it('Linux 只装了 Firefox：登录先用它，提交也回退到它', () => {
    const plans = buildBrowserPlans({
      platform: 'linux',
      defaultId: 'firefox',
      exists: onlySystemFirefox,
    });

    expect(plans.login[0]).toMatchObject({
      id: 'firefox',
      engine: 'firefox',
      channel: 'moz-firefox',
      executablePath: '/usr/bin/firefox',
    });
    expect(plans.headless[0]?.engine).toBe('chromium');
    expect(plans.headless.some((candidate) => candidate.id === 'firefox')).toBe(
      true,
    );
    expect(plans.headless.at(-1)?.id).toBe('bundled');
  });

  it('默认浏览器优先只影响登录窗口，提交仍优先 Chromium', () => {
    const plans = buildBrowserPlans({
      platform: 'win32',
      defaultId: 'firefox',
      exists: () => false,
    });

    expect(plans.login[0]).toMatchObject({
      id: 'firefox',
      channel: 'moz-firefox',
    });
    expect(plans.headless[0]).toMatchObject({
      id: 'msedge',
      channel: 'msedge',
    });
  });

  it('Linux 没装 Firefox 时不生成 Firefox 候选', () => {
    const plans = buildBrowserPlans({
      platform: 'linux',
      defaultId: 'firefox',
      exists: () => false,
    });

    expect(
      plans.login.some((candidate) => candidate.engine === 'firefox'),
    ).toBe(false);
    expect(
      plans.headless.some((candidate) => candidate.engine === 'firefox'),
    ).toBe(false);
  });

  it('同一候选不重复出现', () => {
    const plans = buildBrowserPlans({
      platform: 'win32',
      defaultId: 'chrome',
      exists: () => false,
    });

    const keys = plans.login.map(
      (candidate) =>
        `${candidate.engine}|${candidate.channel ?? ''}|${candidate.executablePath ?? ''}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('parseBrowserName', () => {
  it.each([
    ['firefox', 'firefox'],
    ['Edge', 'msedge'],
    ['msedge', 'msedge'],
    ['google-chrome', 'chrome'],
    ['brave', 'brave'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(parseBrowserName(input)).toBe(expected);
  });

  it('未知名字返回 null', () => {
    expect(parseBrowserName('netscape')).toBeNull();
  });
});

describe('resolveBrowserPlans', () => {
  const settings = { preference: 'auto', channel: '', executable: '' };

  it('VP_BROWSER_EXECUTABLE 指向 Firefox 时走 moz-firefox channel', async () => {
    const plans = await resolveBrowserPlans(
      { ...settings, executable: '/usr/bin/firefox' },
      'linux',
    );

    expect(plans.login).toHaveLength(1);
    expect(plans.headless[0]).toMatchObject({
      id: 'firefox',
      engine: 'firefox',
      channel: 'moz-firefox',
      executablePath: '/usr/bin/firefox',
    });
  });

  it('VP_BROWSER_CHANNEL=moz-firefox 时使用 Firefox', async () => {
    const plans = await resolveBrowserPlans(
      { ...settings, channel: 'moz-firefox' },
      'linux',
    );

    expect(plans.headless[0]).toMatchObject({
      engine: 'firefox',
      channel: 'moz-firefox',
    });
  });

  it('VP_BROWSER=chrome 时只返回 Chromium 候选', async () => {
    const plans = await resolveBrowserPlans(
      { ...settings, preference: 'chrome' },
      'linux',
    );

    expect(plans.login.length).toBeGreaterThan(0);
    expect(
      plans.login.every((candidate) => candidate.engine === 'chromium'),
    ).toBe(true);
    expect(plans.headless).toEqual(plans.login);
  });
});
