# AGENTS.md

## 项目

本地运行的洛谷虚拟参赛（VP）工具。前端 `apps/web`（Vue 3 + Vite + Tailwind CSS 4 + Lucide），本地服务 `apps/server`（Fastify + Playwright），桌面外壳 `apps/desktop`（Electron），共用逻辑 `packages/core`。不是洛谷官方项目，不使用洛谷 Logo。

## 命令

```bash
npm install
npm run dev        # Fastify :3000 + Vite :5173
npm run build      # 构建前端到 dist/client，服务端到 apps/server/dist
npm start          # 生产模式，http://127.0.0.1:3000
npm test           # Vitest
npm run typecheck  # vue-tsc + tsc
npm run desktop:run   # 构建前后端并启动 Electron 桌面端
npm run desktop:dir   # 生成免安装目录 release/win-unpacked
npm run desktop       # 生成当前平台安装包（需要先构建，脚本内部会构建）
npm run desktop:win   # Windows 一键打包安装版 + 便携版（默认 npmmirror）
```

本机 npm 不是 pnpm；不要引入 pnpm workspace 假设。Node 需 >= 22.12。

## 工作流

所有新功能开发与 bug 修复一律使用 GitHub Flow：从 `main` 拉出独立分支开发，完成后发 Pull Request 合并回 `main`。一个分支只做一件事，不混合无关改动。

## 目录

- `packages/core/src`：类型、绝对时间/暂停算法、ICPC/IOI/OI/乐多计分、状态映射、API DTO。
- `apps/server/src/luogu`：洛谷读取、提交、验证码、记录解析、配置缓存。
- `apps/server/src/session`：登录会话存储、可见窗口登录。
- `apps/server/src/browser`：Playwright 启动器。
- `apps/server/src/submissions`：提交队列、验证码等待、记录轮询。
- `apps/web/src/stores`：contest（localStorage、计时、结果）、submission（任务轮询）、session、problem。
- `apps/web/src/views`：Create / Contest（Waiting + Overview）/ Problem / Submit / Results。
- `apps/web/src/components`：layout、contest、problem、submit、results、ui。
- `apps/desktop`：Electron 主进程（`main.cjs`）与打包配置（`electron-builder.yml`、`build/icon.*`）。桌面端启动时用 `ELECTRON_RUN_AS_NODE=1` 起一个 Node 子进程跑服务端，开发时路径为 `build/desktop/server/runtime`。
- `scripts/build-desktop.mjs`：构建前端/服务端、生成服务端运行时目录、调用 electron-builder。`scripts/make-icons.py` 生成图标。
- `scripts/build-windows.mjs` / `build-windows.cmd`：Windows 一键打包（nsis + portable），默认走 npmmirror，避免 hosts 劫持导致下载失败。
- `.github/workflows/release.yml`：推送 `v*` 标签后三平台构建并发布 Release。
- `.data/`：运行时数据（session.json、browser-profile、cache），已 gitignore，绝不提交。桌面版用户数据在系统 userData 目录下的 `data/`。

## 硬约束

- **计时只由绝对时间推导**：`startAt + duration + 暂停区间`；不要把“剩余秒数”写进 localStorage。暂停期间剩余时间冻结，截止时间顺延；关闭标签页期间时间照常流逝。
- **提交必须在无头上下文里完成**。可见浏览器窗口只用于登录；登录完成后关闭，不打开记录页。OI 赛制下，服务端任务视图不得返回 `judge`，前端任何页面不得展示分数/状态/测试点；只在比赛结束后批量拉取记录。
- **不展示剧透字段**：题目 DTO 不得包含难度、标签、通过率、推荐、讨论、题解。不要为了调试把它加到前端。
- **赛制/时长/暂停设置创建后不可改**。ICPC 的 CE 罚时模式也只在创建时选择。
- **乐多计分**：每次提交折算 `max(0.7, 0.95^(本题第几次提交-1))`，按题取最高折算分；最低 70% 折扣。修改公式先改 `packages/core/src/scoring.ts` 和测试。
- **ICPC 罚时**：首次 AC 的有效用时 + 20 分钟 × AC 前未通过提交数；`icpcPenaltyCompileError` 决定 CE 是否计入。暂停时间不计入用时/罚时。
- **无 OI 泄露**：`SubmissionJobView.judge` 对 `format === 'oi'` 永远为 null（`apps/server/src/submissions/service.ts` 的 `view()`）。
- **UI**：Teal 强调色 + Zinc 中性色；图标只用 Lucide；不用 Emoji/特殊 Unicode 代替图标；除浮层/弹窗/下拉外不用阴影；三种颜色模式；不写“基于绝对时间”这类实现说明。
- **禁用按钮要有原因提示**：按钮因输入为空而禁用时，鼠标悬停要显示说明（例如自选题目的「添加」悬停提示“请先输入题号”），不能用“死按钮”让人迷惑。
- 不保存密码；不记录代码/ Cookie；不在日志里输出会话。
- **桌面端固定端口 3000**：前端比赛状态存在 localStorage，按 origin（协议 + 主机 + 端口）隔离；不要为了“避免冲突”改成随机端口，否则用户会以为比赛丢了。
- **桌面端数据目录**：用户数据放 `app.getPath('userData')/data`，不要写安装目录（安装目录只读且会被卸载清理）。
- **服务端优雅退出**：桌面端通过带随机令牌的 `POST /api/system/shutdown` 关闭服务（未设置 `VP_SHUTDOWN_TOKEN` 时不注册该路由），以便 Playwright 关闭浏览器；不要改成无鉴权接口。
- **electron-builder 的 node_modules 坑**：`extraResources` 复制源根目录下的 `node_modules` 会被 electron-builder 跳过，服务端运行时必须放在 `server/runtime/` 子目录（见 `scripts/build-desktop.mjs`），否则打包后启动报 `ERR_MODULE_NOT_FOUND`。
- **Electron 版本固定**：`apps/desktop/package.json` 的 `electron` 必须是精确版本，且与 `electron-builder.yml` 的 `electronVersion` 一致；electron-builder 不接受范围版本。
- **桌面端浏览器探测**：Playwright 只带 channel，不下载 Chromium；`launcher.ts` 按平台补了 macOS/Linux 常见 Chrome/Chromium 路径，改动时保持 Windows 优先 Edge、macOS 优先 Chrome。
- **本地打包默认走 npmmirror**：GitHub 在部分网络被 hosts 指向 127.0.0.1，未启动 Watt Toolkit 时 electron-builder 直连会 ECONNREFUSED；`build-desktop.mjs` 在非 CI 环境默认设置 `ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR`，`--no-mirror` 可关闭，CI 不受影响。

## 洛谷接口要点（实现依据，2026-10 实测）

- 读取：`GET /problem/:pid`、`/contest/:id`、`/record/:rid` 加请求头 `x-lentille-request: content-only` 返回 JSON；`?_contentOnly=1` 单独不够。
- **全局 500ms 最小间隔**：所有服务端发起的洛谷请求都必须先 `await luoguThrottle.wait()`（`apps/server/src/luogu/throttle.ts`，仅此一个节流器）。已接入：`luogu/http.ts` 的每次 fetch（含重定向每一跳和重试）、提交前的题目页跳转、提交 POST、验证码请求、登录页跳转与登录探测。新增直连洛谷的代码时不得绕过；页面自身加载的 JS/CSS 等子资源由浏览器发起，不受此约束。
- 部分 UA 会触发 `C3VK` Cookie + 302 同地址循环；`luogu/http.ts` 有轻量 Cookie 罐并手动跟随重定向。带会话的请求中，`C3VK` 以 jar 最新值为准，`__client_id` / `_uid` 以保存的会话为准（不要让匿名 Cookie 覆盖登录态）。
- 提交：`POST /fe/api/problem/submit/:pid`，JSON `{ lang: <数字 ID>, code, enableO2: 0|1, captcha? }`，请求头 `x-csrf-token` 来自题目页 `<meta name="csrf-token">`。语言 ID 用 `/_lfe/config` 的 `CodeLanguage`，例如 C++14 (GCC 9) = 28。
- 验证码：`GET /api/verify/captcha` 返回图片；提交接口错误 `errorType` 含 `Captcha` 时进入等待输入流程。仅支持 `IMAGE`；Turnstile/易盾报 `CAPTCHA_UNSUPPORTED`。
- 记录：`data.record`；编译信息在 `record.detail.compileResult`，测试点在 `record.detail.judgeResult.subtasks[].testCases[]`；`memory` 单位 KB；`submitTime` 为秒。`normalizeRecord` 有对应测试。
- 登录：可见 `launchPersistentContext` 打开 `/auth/login`；检测时**优先在可见页内执行同源 fetch** `/problem/P1001`，读取响应的**顶层 `user`** 字段（兼容旧的 `data.user`），再回退到 `context.request`。成功后保存 `storageState` 到 `.data/session.json`。
- **重新登录必须走 force**：`POST /api/auth/login` 传 `{ force: true }` 时跳过“已保存会话直接成功”的快捷路径、一定打开浏览器窗口；点右上角昵称走的正是这条路（旧实现只在前端绕过，后端仍会快捷成功，导致对话框闪一下关闭、无法切换账号）。未登录时的普通登录（`force` 缺省）仍先复用已保存会话，避免多余开窗。
- **登录状态不自动轮询**：打开窗口后只等待用户点击「我已完成登录」，才由 `POST /api/auth/login/check` 发一次探测请求（每次点击一次，进行中时重复点击被忽略）。这是为了避免登录窗口停留期间每秒请求一次洛谷、被风控视为异常访问。前端只轮询本地 `/api/auth/login`（127.0.0.1）同步“窗口已关闭”等状态，不访问洛谷。
- 登录检测的常见错误：只看 `data.user` 会永远得到 null；新版洛谷把登录用户放在顶层 `user`。不要再用 `context.request` 的 `data.user` 作为唯一依据。

## 修改后

- 每次改项目后更新本文件（功能/结构/约束变化时）。
- 文件工具写入会保留原 mtime，Vite / tsx 的 watcher 可能收不到变更；改完源码后 `touch` 对应文件或重启 dev，否则浏览器/服务端会跑旧代码。
- 至少跑 `npm test`、`npm run typecheck`、`npm run build`。真实提交/评测链路需要登录后手工验证；不要为了测试向洛谷刷提交。
- 改动桌面端后至少跑一次 `npm run desktop:dir`，启动 `release/win-unpacked` 并确认 `/api/health`、静态页面、登录窗口都正常；发布前再用 `npm run desktop` 检查安装包。
- 前端视觉改动用 mock 路由或已结束比赛截图检查，避免依赖真实账号。
