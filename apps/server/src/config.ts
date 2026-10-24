import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverDir, '..', '..');

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

function resolveProjectPath(name: string, fallback: string): string {
  const value = readEnv(name, fallback);
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

export const appConfig = {
  port: Number(readEnv('VP_PORT', '3000')),
  host: readEnv('VP_HOST', '127.0.0.1'),
  dataDir: resolveProjectPath('VP_DATA_DIR', path.join(repoRoot, '.data')),
  clientDist: resolveProjectPath(
    'VP_CLIENT_DIST',
    path.join(repoRoot, 'dist', 'client'),
  ),
  luoguBase: readEnv('VP_LUOGU_BASE', 'https://www.luogu.com.cn').replace(/\/+$/, ''),
  /** auto 表示跟随系统默认浏览器；也可填 firefox / chrome / edge / chromium 等。 */
  browserPreference: readEnv('VP_BROWSER', 'auto'),
  browserChannel: readEnv('VP_BROWSER_CHANNEL', ''),
  browserExecutable: readEnv('VP_BROWSER_EXECUTABLE', ''),
  requestTimeoutMs: Number(readEnv('VP_REQUEST_TIMEOUT', '15000')),
  userAgent: readEnv(
    'VP_USER_AGENT',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ),
  logLevel: readEnv('VP_LOG_LEVEL', 'info'),
  /**
   * 虚构测试比赛开关，默认开启；生产构建由 tsup 的 define 把
   * process.env.VP_DEV_MOCK 固定为 "0"，因此产物中恒为 false。
   */
  mockEnabled: process.env.VP_DEV_MOCK !== '0',
} as const;
