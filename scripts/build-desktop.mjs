import { execFileSync, execSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(import.meta.url);
const desktopDir = path.join(root, 'apps', 'desktop');
const stageRoot = path.join(root, 'build', 'desktop', 'server');
// electron-builder 的复制过滤器会跳过源目录根部的 node_modules，
// 所以把服务端放进 runtime/ 子目录，依赖放在 runtime/node_modules。
const runtimeRoot = path.join(stageRoot, 'runtime');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const readOption = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

// GitHub 在部分网络下会被 hosts 指向 127.0.0.1（Watt Toolkit 未启动时 ECONNREFUSED），
// 本地构建默认改用 npmmirror；CI 与显式 --no-mirror 时保持官方源。
const usingMirror = applyMirrorDefaults();

function applyMirrorDefaults() {
  if (process.env.CI || hasFlag('--no-mirror')) return false;
  let applied = false;
  if (process.env.ELECTRON_MIRROR === undefined) {
    process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
    applied = true;
  }
  if (process.env.ELECTRON_BUILDER_BINARIES_MIRROR === undefined) {
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
      'https://npmmirror.com/mirrors/electron-builder-binaries/';
    applied = true;
  }
  return applied;
}

function log(message) {
  console.log(`\n[desktop] ${message}`);
}

function checkVersions() {
  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  const desktopPackage = JSON.parse(
    fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'),
  );
  if (rootPackage.version !== desktopPackage.version) {
    throw new Error(
      `版本号不一致：根 package.json 是 ${rootPackage.version}，apps/desktop/package.json 是 ${desktopPackage.version}。`,
    );
  }
}

function run(command, commandArgs, options = {}) {
  log(`$ ${command} ${commandArgs.join(' ')}`);
  execFileSync(command, commandArgs, { stdio: 'inherit', ...options });
}

function buildProject() {
  if (hasFlag('--skip-build')) {
    log('跳过前端/服务端构建');
    return;
  }
  log('构建前端与服务端');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

function writeStageServer() {
  log('准备服务端运行时目录');
  fs.rmSync(stageRoot, { recursive: true, force: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const serverPackage = JSON.parse(
    fs.readFileSync(path.join(root, 'apps', 'server', 'package.json'), 'utf8'),
  );
  const dependencies = { ...serverPackage.dependencies };
  // @vp/core 已经被 tsup 打进 dist，不需要单独安装。
  delete dependencies['@vp/core'];

  fs.writeFileSync(
    path.join(runtimeRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'luogu-vp-server-runtime',
        version: serverPackage.version,
        private: true,
        type: 'module',
        dependencies,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  log('安装服务端生产依赖');
  execSync(
    'npm install --omit=dev --no-audit --no-fund --ignore-scripts --loglevel=error',
    {
      cwd: runtimeRoot,
      stdio: 'inherit',
    },
  );

  const distDir = path.join(root, 'apps', 'server', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.js'))) {
    throw new Error('未找到 apps/server/dist/index.js，请先构建服务端。');
  }
  fs.cpSync(distDir, runtimeRoot, { recursive: true });
}

function electronBinary() {
  try {
    return require('electron');
  } catch {
    throw new Error('未安装 electron，请先在仓库根目录执行 npm install。');
  }
}

function runApp() {
  const electronPath = electronBinary();
  const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' };
  // 某些终端（例如 DSH）会设置该变量，Electron 会退化成纯 Node。
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, ['.'], {
    cwd: desktopDir,
    stdio: 'inherit',
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function packageApp() {
  const builderCli = path.join(
    root,
    'node_modules',
    'electron-builder',
    'cli.js',
  );
  if (!fs.existsSync(builderCli)) {
    throw new Error(
      '未安装 electron-builder，请先在仓库根目录执行 npm install。',
    );
  }
  const extra = [];
  if (hasFlag('--dir')) extra.push('--dir');
  // 可同时指定多个平台（如 --win --linux），electron-builder 一次产出全部目标。
  if (hasFlag('--win')) extra.push('--win');
  if (hasFlag('--linux')) extra.push('--linux');
  const publish = readOption('--publish') ?? 'never';
  extra.push('--publish', publish);
  run(
    process.execPath,
    [builderCli, '--config', 'electron-builder.yml', ...extra],
    {
      cwd: desktopDir,
    },
  );
}

try {
  checkVersions();
  if (usingMirror) {
    log(
      '已启用 npmmirror 加速下载 Electron/NSIS/AppImage（可用 --no-mirror 关闭）',
    );
  }
  buildProject();
  writeStageServer();
  if (hasFlag('--run')) runApp();
  else packageApp();
} catch (error) {
  console.error(
    `\n[desktop] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
