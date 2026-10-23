/**
 * 一键打包 Windows 安装包（NSIS）与便携版（portable）。
 *
 * 用法：
 *   node scripts/build-windows.mjs            # 完整构建
 *   node scripts/build-windows.mjs --skip-build  # 复用已有前端/服务端产物
 *   node scripts/build-windows.mjs --open     # 完成后打开 release 目录
 *   node scripts/build-windows.mjs --no-mirror # 不使用 npmmirror 加速
 */

import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const desktopDir = path.join(root, 'apps', 'desktop');
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);

function log(message) {
  console.log(`\n[win] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function assertEnvironment() {
  if (process.platform !== 'win32') {
    fail(
      '这个脚本只能在 Windows 上打包 Windows 安装包；macOS/Linux 产物请用 GitHub Actions。',
    );
  }

  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    fail(`需要 Node.js >= 22.12，当前是 ${process.versions.node}。`);
  }
}

function readVersion() {
  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  const desktopPackage = JSON.parse(
    fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'),
  );
  if (rootPackage.version !== desktopPackage.version) {
    fail(
      `版本号不一致：根 package.json 是 ${rootPackage.version}，apps/desktop/package.json 是 ${desktopPackage.version}。`,
    );
  }
  return desktopPackage.version;
}

function applyMirrors() {
  if (hasFlag('--no-mirror')) {
    log('已关闭镜像加速，使用官方源');
    return;
  }
  const mirrors = {
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR:
      'https://npmmirror.com/mirrors/electron-builder-binaries/',
  };
  const applied = [];
  for (const [key, value] of Object.entries(mirrors)) {
    if (process.env[key]) continue;
    process.env[key] = value;
    applied.push(key);
  }
  if (applied.length > 0) {
    log(
      `已启用 npmmirror 加速（${applied.join('、')}）；网络允许时可加 --no-mirror 关闭`,
    );
  }
}

function ensureDependencies() {
  const required = [
    path.join(root, 'node_modules', 'electron', 'package.json'),
    path.join(root, 'node_modules', 'electron-builder', 'cli.js'),
  ];
  if (required.every((file) => fs.existsSync(file))) return;

  log('未检测到 electron / electron-builder，先执行 npm install');
  execSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit' });
}

function cleanPreviousArtifacts() {
  if (!fs.existsSync(releaseDir)) return;
  const patterns = [
    /^luogu-vp-setup-.*\.exe$/,
    /^luogu-vp-setup-.*\.exe\.blockmap$/,
    /^luogu-vp-.*-portable\.exe$/,
  ];
  for (const name of fs.readdirSync(releaseDir)) {
    if (!patterns.some((pattern) => pattern.test(name))) continue;
    try {
      fs.rmSync(path.join(releaseDir, name), { force: true });
    } catch {
      log(`旧文件被占用，跳过删除：${name}`);
    }
  }
  log('已清理旧的 Windows 安装包');
}

function runBuild() {
  const childArgs = [path.join(root, 'scripts', 'build-desktop.mjs'), '--win'];
  if (hasFlag('--skip-build')) childArgs.push('--skip-build');
  if (hasFlag('--no-mirror')) childArgs.push('--no-mirror');

  log(
    '开始打包 Windows 安装版 + 便携版（首次运行需要下载 Electron/NSIS，可能较慢）',
  );
  const result = spawnSync(process.execPath, childArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    fail(`无法启动打包进程：${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`打包失败（退出码 ${result.status}），请查看上方日志。`);
  }
}

function collectArtifacts(version) {
  const expected = [
    {
      label: '安装版',
      file: path.join(releaseDir, `luogu-vp-setup-${version}.exe`),
    },
    {
      label: '便携版',
      file: path.join(releaseDir, `luogu-vp-${version}-portable.exe`),
    },
  ];
  const missing = expected.filter((item) => !fs.existsSync(item.file));
  if (missing.length > 0) {
    fail(
      `打包结束但缺少产物：${missing.map((item) => path.basename(item.file)).join('、')}`,
    );
  }
  return expected;
}

function printArtifacts(artifacts) {
  log('打包完成：');
  for (const item of artifacts) {
    const sizeMb = fs.statSync(item.file).size / 1024 / 1024;
    console.log(
      `  ${item.label}  ${sizeMb.toFixed(1).padStart(6)} MB  ${item.file}`,
    );
  }
}

function openReleaseDir() {
  if (!hasFlag('--open')) return;
  spawn('explorer.exe', [releaseDir], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function printHelp() {
  console.log(`用法：node scripts/build-windows.mjs [选项]

  --skip-build   跳过前端/服务端重新构建（复用 dist）
  --open         打包完成后打开 release 目录
  --no-mirror    不使用 npmmirror 加速 Electron/NSIS 下载
  -h, --help     显示帮助
`);
}

try {
  if (hasFlag('--help') || hasFlag('-h')) {
    printHelp();
    process.exit(0);
  }

  assertEnvironment();
  const version = readVersion();
  console.log(`\n[win] Luogu VP ${version} · Windows 安装版 + 便携版`);
  applyMirrors();
  ensureDependencies();
  cleanPreviousArtifacts();

  const startedAt = Date.now();
  runBuild();
  const artifacts = collectArtifacts(version);
  printArtifacts(artifacts);
  log(`全部完成，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)} 秒`);
  openReleaseDir();
} catch (error) {
  console.error(
    `\n[win] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
