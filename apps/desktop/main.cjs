'use strict';

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

if (app === undefined) {
  console.error(
    'Luogu VP 需要以桌面模式启动；当前环境设置了 ELECTRON_RUN_AS_NODE，请取消该变量后重试。',
  );
  process.exit(1);
}

const HOST = '127.0.0.1';
const PORT = Number(process.env.VP_PORT || 3000);
const ORIGIN = `http://${HOST}:${PORT}`;
// 首次运行时 Windows Defender 会扫描解包出来的 node_modules，启动可能偏慢。
const HEALTH_TIMEOUT_MS = 90_000;

app.setName('luogu-vp-tools');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.johnzhang888.luogu-vp-tools');
}

let mainWindow = null;
let serverProcess = null;
let serverReady = false;
let ownsServer = false;
let quitting = false;
let serverStopped = false;
let shutdownToken = '';
let logStream = null;
let currentPaths = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app
    .whenReady()
    .then(bootstrap)
    .catch((error) => {
      void reportFatal(
        '启动失败',
        String(error && error.stack ? error.stack : error),
      );
    });

  app.on('activate', () => {
    if (mainWindow !== null) return;
    createWindow();
    if (serverReady) loadApp();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', (event) => {
    quitting = true;
    if (ownsServer && serverProcess !== null && !serverStopped) {
      event.preventDefault();
      void stopServer().finally(() => {
        serverStopped = true;
        app.quit();
      });
    }
  });

  app.on('will-quit', () => {
    if (logStream !== null) {
      try {
        logStream.end();
      } catch {
        // 忽略日志关闭失败。
      }
      logStream = null;
    }
  });
}

function resolvePaths() {
  const packaged = app.isPackaged;
  const resources = process.resourcesPath;
  const repoRoot = path.resolve(__dirname, '..', '..');
  return {
    serverDir: packaged
      ? path.join(resources, 'server', 'runtime')
      : path.join(repoRoot, 'build', 'desktop', 'server', 'runtime'),
    serverEntry: packaged
      ? path.join(resources, 'server', 'runtime', 'index.js')
      : path.join(
          repoRoot,
          'build',
          'desktop',
          'server',
          'runtime',
          'index.js',
        ),
    clientDir: packaged
      ? path.join(resources, 'client')
      : path.join(repoRoot, 'dist', 'client'),
    dataDir: path.join(app.getPath('userData'), 'data'),
    logDir: path.join(app.getPath('userData'), 'logs'),
  };
}

function openLog(paths) {
  fs.mkdirSync(paths.logDir, { recursive: true });
  const logFile = path.join(paths.logDir, 'server.log');
  logStream = fs.createWriteStream(logFile, { flags: 'w' });
  appendLog(
    `[desktop] 启动，Electron ${process.versions.electron}，Node ${process.versions.node}`,
  );
  appendLog(
    `[desktop] data=${paths.dataDir} client=${paths.clientDir} server=${paths.serverEntry}`,
  );
}

function appendLog(line) {
  if (logStream === null) return;
  logStream.write(`${new Date().toISOString()} ${line}\n`);
}

function requestJson(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: HOST,
        port: PORT,
        path: urlPath,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 3000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode, body }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error('请求超时')));
    request.on('error', reject);
    request.end();
  });
}

async function isServerUp() {
  try {
    const response = await requestJson('/api/health', { timeout: 1200 });
    return response.status === 200 && response.body.includes('"ok"');
  } catch {
    return false;
  }
}

function isPortFree() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(PORT, HOST);
  });
}

function waitForProcessExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serverProcess === null)
      throw new Error('本地服务进程已退出，请查看日志。');
    if (await isServerUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('等待本地服务启动超时，请查看日志。');
}

function startServer(paths) {
  shutdownToken = crypto.randomUUID();
  const child = spawn(process.execPath, [paths.serverEntry], {
    cwd: paths.serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      VP_PORT: String(PORT),
      VP_HOST: HOST,
      VP_DATA_DIR: paths.dataDir,
      VP_CLIENT_DIST: paths.clientDir,
      VP_SHUTDOWN_TOKEN: shutdownToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) =>
    appendLog(`[server] ${String(chunk).trimEnd()}`),
  );
  child.stderr.on('data', (chunk) =>
    appendLog(`[server:err] ${String(chunk).trimEnd()}`),
  );
  child.on('error', (error) =>
    appendLog(`[server] 启动失败：${error.message}`),
  );
  child.on('exit', (code, signal) => {
    appendLog(`[server] 退出 code=${code} signal=${signal}`);
    const wasRunning = serverProcess === child;
    const wasReady = serverReady;
    if (wasRunning) serverProcess = null;
    serverReady = false;
    if (wasRunning && wasReady && !quitting && mainWindow !== null) {
      void handleServerCrash();
    }
  });

  serverProcess = child;
  return waitForHealth().then(() => {
    serverReady = true;
  });
}

async function stopServer() {
  const child = serverProcess;
  if (child === null) return;
  try {
    await requestJson('/api/system/shutdown', {
      method: 'POST',
      headers: { 'x-vp-token': shutdownToken },
      timeout: 2000,
    });
  } catch {
    // 服务已经不可达时直接走强杀。
  }
  await waitForProcessExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      child.kill('SIGKILL');
    } catch {
      // 忽略强杀失败。
    }
    await waitForProcessExit(child, 2000);
  }
  serverProcess = null;
  serverReady = false;
}

const SPLASH_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  html, body { height: 100%; margin: 0; background: #18181b; color: #e4e4e7;
    font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    display: flex; align-items: center; justify-content: center; }
  .box { display: flex; flex-direction: column; align-items: center; gap: 18px; }
  .spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #3f3f46;
    border-top-color: #14b8a6; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .title { font-size: 15px; letter-spacing: 0.02em; }
  .hint { font-size: 12px; color: #a1a1aa; }
</style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <div class="title">Luogu VP</div>
    <div class="hint">正在启动本地服务…</div>
  </div>
</body>
</html>`;

function loadSplash() {
  if (mainWindow === null) return;
  void mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`,
  );
}

function loadApp() {
  if (mainWindow === null) return;
  void mainWindow.loadURL(ORIGIN);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Luogu VP',
    backgroundColor: '#18181b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow !== null) mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription) => {
      if (errorCode === -3) return; // 用户主动中断加载。
      appendLog(`[desktop] 页面加载失败：${errorCode} ${errorDescription}`);
      void dialog
        .showMessageBox(mainWindow, {
          type: 'error',
          title: '页面加载失败',
          message: '无法打开 Luogu VP 界面。',
          detail: `本地服务可能已经退出。\n\n${errorDescription}\n\n日志：${path.join(currentPaths.logDir, 'server.log')}`,
          buttons: ['重试', '退出'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0 && mainWindow !== null) loadApp();
          else app.quit();
        });
    },
  );

  loadSplash();
}

function installMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
}

async function reportFatal(title, detail) {
  const logHint =
    currentPaths === null
      ? ''
      : `\n\n日志：${path.join(currentPaths.logDir, 'server.log')}`;
  await dialog.showMessageBox({
    type: 'error',
    title,
    message: title,
    detail: detail + logHint,
    buttons: ['退出'],
  });
  quitting = true;
  app.quit();
}

async function handleServerCrash() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: '本地服务已退出',
    message: '本地服务意外退出，界面无法继续使用。',
    detail: `日志：${path.join(currentPaths.logDir, 'server.log')}`,
    buttons: ['重启', '退出'],
    defaultId: 0,
    cancelId: 1,
  });
  if (result.response === 0) {
    app.relaunch();
    app.exit(0);
  } else {
    app.quit();
  }
}

async function bootstrap() {
  currentPaths = resolvePaths();
  openLog(currentPaths);
  fs.mkdirSync(currentPaths.dataDir, { recursive: true });
  installMenu();
  if (mainWindow === null) createWindow();

  if (await isServerUp()) {
    // 端口上已经有一份兼容的服务（例如开发时的 npm start），直接复用。
    ownsServer = false;
    serverReady = true;
    appendLog('[desktop] 复用已在运行的服务');
    loadApp();
    return;
  }

  if (!(await isPortFree())) {
    await reportFatal(
      '端口被占用',
      `本地端口 ${PORT} 已被其他程序占用，Luogu VP 无法启动。\n请关闭占用该端口的程序后重试。`,
    );
    return;
  }

  try {
    await startServer(currentPaths);
    loadApp();
  } catch (error) {
    appendLog(`[desktop] 启动失败：${error.message}`);
    await reportFatal('本地服务启动失败', String(error.message || error));
  }
}
