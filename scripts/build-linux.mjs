/**
 * 在 Linux 上一键打出全部发布产物：
 *   - Windows 安装版（NSIS，x64）
 *   - Windows 便携版（portable，x64）
 *   - Linux AppImage（x64）
 *
 * 用法：
 *   node scripts/build-linux.mjs               # 完整构建
 *   node scripts/build-linux.mjs --skip-build  # 复用已有前端/服务端产物
 *   node scripts/build-linux.mjs --open        # 完成后打开 release 目录
 *   node scripts/build-linux.mjs --no-mirror   # 不使用 npmmirror 加速
 *   node scripts/build-linux.mjs --require-wine # 不用补丁，强制调用系统 wine
 *
 * 关于 wine：electron-builder 在非 Windows 平台打 NSIS 时，会执行安装包来取出
 * 卸载器，因此硬性依赖 wine。本脚本在没有 wine 时，临时把这一步换成
 * electron-builder 自带的纯 JS 提取实现（macOS Catalina 分支使用的
 * UninstallerReader），构建结束（含 Ctrl+C）后自动还原 app-builder-lib。
 * 装了 wine 的机器仍走官方路径，不做任何改动。
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

// electron-builder 把“执行安装包取出卸载器”写死成 wine，
// 但同一段代码里已有纯 JS 分支（macOS Catalina 用）。
const nsisTargetFile = path.join(
  root,
  'node_modules',
  'app-builder-lib',
  'out',
  'targets',
  'nsis',
  'NsisTarget.js',
);
const upstreamGuard = 'if ((0, macosVersion_1.isMacOsCatalina)()) {';
const portableGuard = 'if (process.platform !== "win32") {';

function log(message) {
  console.log(`\n[linux] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function assertEnvironment() {
  if (process.platform !== 'linux') {
    fail('这个脚本只能在 Linux 上运行；Windows 请用 npm run desktop:win。');
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

function ensureDependencies() {
  const required = [
    path.join(root, 'node_modules', 'electron', 'package.json'),
    path.join(root, 'node_modules', 'electron-builder', 'cli.js'),
  ];
  if (required.every((file) => fs.existsSync(file))) return;

  log('未检测到 electron / electron-builder，先执行 npm install');
  execSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit' });
}

function hasSystemWine() {
  const result = spawnSync('wine', ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

/** 临时把 NSIS 的卸载器提取改成纯 JS，返回还原函数。 */
function patchNsisToSkipWine() {
  if (!fs.existsSync(nsisTargetFile)) {
    fail('未找到 app-builder-lib，请先在仓库根目录执行 npm install。');
  }

  const original = fs.readFileSync(nsisTargetFile, 'utf8');
  if (original.includes(portableGuard)) {
    log('app-builder-lib 已是无 wine 版本，跳过补丁');
    return null;
  }
  if (!original.includes(upstreamGuard)) {
    fail(
      '无法在 app-builder-lib 中定位 wine 调用处，electron-builder 可能改了实现；' +
        '请安装 wine 后加 --require-wine 重试。',
    );
  }

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    fs.writeFileSync(nsisTargetFile, original);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      restore();
      process.exit(130);
    });
  }
  process.on('exit', restore);

  fs.writeFileSync(
    nsisTargetFile,
    original.replace(upstreamGuard, portableGuard),
  );
  log(
    '未检测到 wine，已临时启用纯 JS 卸载器提取（结束后自动还原 app-builder-lib）',
  );
  return restore;
}

function cleanPreviousArtifacts() {
  if (!fs.existsSync(releaseDir)) return;
  const patterns = [
    /^luogu-vp-setup-.*\.exe$/,
    /^luogu-vp-setup-.*\.exe\.blockmap$/,
    /^luogu-vp-.*-portable\.exe$/,
    /\.AppImage$/,
    /\.AppImage\.blockmap$/,
    /\.nsis\.7z$/,
  ];
  let removed = 0;
  for (const name of fs.readdirSync(releaseDir)) {
    if (!patterns.some((pattern) => pattern.test(name))) continue;
    try {
      fs.rmSync(path.join(releaseDir, name), { force: true });
      removed += 1;
    } catch {
      log(`旧文件被占用，跳过删除：${name}`);
    }
  }
  if (removed > 0) log(`已清理 ${removed} 个旧的发布产物`);
}

function runBuild() {
  const childArgs = [path.join(root, 'scripts', 'build-desktop.mjs')];
  childArgs.push('--win', '--linux');
  if (hasFlag('--skip-build')) childArgs.push('--skip-build');
  if (hasFlag('--no-mirror')) childArgs.push('--no-mirror');

  log('开始打包 Windows 安装版 + 便携版 + Linux AppImage');
  log('首次运行需要下载 Electron、NSIS、AppImage 运行时，可能较慢');
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
      label: 'Windows 安装版',
      file: path.join(releaseDir, `luogu-vp-setup-${version}.exe`),
    },
    {
      label: 'Windows 便携版',
      file: path.join(releaseDir, `luogu-vp-${version}-portable.exe`),
    },
  ];

  const appImages = fs
    .readdirSync(releaseDir)
    .filter((name) => name.endsWith('.AppImage'));
  if (appImages.length !== 1) {
    fail(
      `release 目录里应有且只有一个 AppImage，实际找到 ${appImages.length} 个。`,
    );
  }
  expected.push({
    label: 'Linux AppImage',
    file: path.join(releaseDir, appImages[0]),
  });

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
  spawn('xdg-open', [releaseDir], { detached: true, stdio: 'ignore' }).unref();
}

function printHelp() {
  console.log(`用法：node scripts/build-linux.mjs [选项]

  --skip-build   跳过前端/服务端重新构建（复用 dist）
  --open         打包完成后打开 release 目录
  --no-mirror    不使用 npmmirror 加速 Electron/NSIS/AppImage 下载
  --require-wine 强制使用系统 wine，不对 app-builder-lib 打补丁
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
  console.log(
    `\n[linux] Luogu VP ${version} · Windows 安装版 + 便携版 + AppImage`,
  );

  ensureDependencies();
  cleanPreviousArtifacts();

  const usePatch = !hasFlag('--require-wine') && !hasSystemWine();
  const restore = usePatch ? patchNsisToSkipWine() : null;

  const startedAt = Date.now();
  try {
    runBuild();
  } finally {
    if (restore) {
      restore();
      log('已还原 app-builder-lib');
    }
  }

  const artifacts = collectArtifacts(version);
  printArtifacts(artifacts);
  log(`全部完成，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)} 秒`);
  openReleaseDir();
} catch (error) {
  console.error(
    `\n[linux] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
