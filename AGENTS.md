# AGENTS.md

## 项目

本地运行的洛谷虚拟参赛（VP）工具。前端 `apps/web`（Vue 3 + Vite + Tailwind CSS 4 + Lucide），本地服务 `apps/server`（Fastify + Playwright），共用逻辑 `packages/core`。不是洛谷官方项目，不使用洛谷 Logo。

## 命令

```bash
npm install
npm run dev        # Fastify :3000 + Vite :5173
npm run build      # 构建前端到 dist/client，服务端到 apps/server/dist
npm start          # 生产模式，http://127.0.0.1:3000
npm test           # Vitest
npm run typecheck  # vue-tsc + tsc
```

本机 npm 不是 pnpm；不要引入 pnpm workspace 假设。Node 需 >= 22.12。

## 目录

- `packages/core/src`：类型、绝对时间/暂停算法、ICPC/IOI/OI/乐多计分、状态映射、API DTO。
- `apps/server/src/luogu`：洛谷读取、提交、验证码、记录解析、配置缓存。
- `apps/server/src/session`：登录会话存储、可见窗口登录。
- `apps/server/src/browser`：Playwright 启动器。
- `apps/server/src/submissions`：提交队列、验证码等待、记录轮询。
- `apps/web/src/stores`：contest（localStorage、计时、结果）、submission（任务轮询）、session、problem。
- `apps/web/src/views`：Create / Contest（Waiting + Overview）/ Problem / Submit / Results。
- `apps/web/src/components`：layout、contest、problem、submit、results、ui。
- `.data/`：运行时数据（session.json、browser-profile、cache），已 gitignore，绝不提交。

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

## 洛谷接口要点（实现依据，2026-10 实测）

- 读取：`GET /problem/:pid`、`/contest/:id`、`/record/:rid` 加请求头 `x-lentille-request: content-only` 返回 JSON；`?_contentOnly=1` 单独不够。
- 部分 UA 会触发 `C3VK` Cookie + 302 同地址循环；`luogu/http.ts` 有轻量 Cookie 罐并手动跟随重定向。带会话的请求中，`C3VK` 以 jar 最新值为准，`__client_id` / `_uid` 以保存的会话为准（不要让匿名 Cookie 覆盖登录态）。
- 提交：`POST /fe/api/problem/submit/:pid`，JSON `{ lang: <数字 ID>, code, enableO2: 0|1, captcha? }`，请求头 `x-csrf-token` 来自题目页 `<meta name="csrf-token">`。语言 ID 用 `/_lfe/config` 的 `CodeLanguage`，例如 C++14 (GCC 9) = 28。
- 验证码：`GET /api/verify/captcha` 返回图片；提交接口错误 `errorType` 含 `Captcha` 时进入等待输入流程。仅支持 `IMAGE`；Turnstile/易盾报 `CAPTCHA_UNSUPPORTED`。
- 记录：`data.record`；编译信息在 `record.detail.compileResult`，测试点在 `record.detail.judgeResult.subtasks[].testCases[]`；`memory` 单位 KB；`submitTime` 为秒。`normalizeRecord` 有对应测试。
- 登录：可见 `launchPersistentContext` 打开 `/auth/login`；检测时**优先在可见页内执行同源 fetch** `/problem/P1001`，读取响应的**顶层 `user`** 字段（兼容旧的 `data.user`），再回退到 `context.request`。成功后保存 `storageState` 到 `.data/session.json`。手动复核入口为 `POST /api/auth/login/check`。
- 登录检测的常见错误：只看 `data.user` 会永远得到 null；新版洛谷把登录用户放在顶层 `user`。不要再用 `context.request` 的 `data.user` 作为唯一依据。


## 修改后

- 每次改项目后更新本文件（功能/结构/约束变化时）。
- 文件工具写入会保留原 mtime，Vite / tsx 的 watcher 可能收不到变更；改完源码后 `touch` 对应文件或重启 dev，否则浏览器/服务端会跑旧代码。
- 至少跑 `npm test`、`npm run typecheck`、`npm run build`。真实提交/评测链路需要登录后手工验证；不要为了测试向洛谷刷提交。
- 前端视觉改动用 mock 路由或已结束比赛截图检查，避免依赖真实账号。
