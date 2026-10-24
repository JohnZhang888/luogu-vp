# 更新日志

本项目所有值得注意的变更都记录在本文件中。

格式基于 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 未发布

> 打 `v0.2.0` 标签时把「未发布」替换为发布日期（YYYY-MM-DD）。

### 新增

- 浏览器：新增对系统 Firefox 129 及以上版本的支持（Playwright WebDriver BiDi，`moz-firefox`），登录与提交都可使用 Firefox；此前仅支持 Chromium 系浏览器。
- 浏览器：登录窗口优先使用系统默认浏览器，支持 Firefox / Chrome / Edge / Chromium / Brave / Vivaldi。Linux 读 `xdg-settings`（回退 `xdg-mime`），Windows 读注册表 `UrlAssociations\https\UserChoice`，macOS 读 `LaunchServices`；探测失败时回退到平台内置顺序。
- 浏览器：无头提交继续优先 Chromium 系（Windows 优先 Edge，macOS/Linux 优先 Chrome），没有 Chromium 系浏览器时才用系统 Firefox。
- 配置：新增 `VP_BROWSER`（`auto` 默认跟随系统默认浏览器，也可填 `firefox` / `chrome` / `edge` / `chromium` / `brave` / `vivaldi`）；`VP_BROWSER_CHANNEL` 与 `VP_BROWSER_EXECUTABLE` 保留，优先级更高，显式指定时不再自动回退到其他浏览器。
- 登录：Chromium 与 Firefox 使用各自独立的配置档（`browser-profile/` 与 `browser-profile-firefox/`），保存的会话（`storageState`）跨引擎复用。
- 打包：新增 `npm run desktop:linux`，在 Linux 上一条命令产出 Windows 安装版、Windows 便携版与 AppImage；`scripts/build-desktop.mjs` 支持 `--win --linux` 同时打包。
- 开发：新增虚构「测试比赛」（仅开发构建）。内置虚构题目 `VPTEST1`，不访问洛谷、不需要登录即可走通提交与评测；七个测试点覆盖 AC / WA / TLE / MLE / RE / OLE / UKE，OI 赛制下同样不返回结果。生产构建中入口、文案与接口均不可用。

### 变更

- 评测结果：测试点由表格改为自适应卡片（状态、编号、得分、用时、内存），测试点与子任务按编号升序排列，卡片最小宽度 11rem → 9rem。
- 评测结果：详情顶部新增总用时与最大空间；ICPC 赛制下测试点卡片不显示得分。
- 评测结果：新增 `apps/web/src/lib/verdict.ts` 统一状态配色（AC 绿、WA 红、RE 紫、TLE/MLE/OLE/UKE 天蓝、CE 琥珀），`StatusBadge` 与测试点卡片共用；题目导航的 AC 指示点由 teal 改为 green。
- 发布：Release 构建矩阵改为 Windows + Linux 两个平台。
- 打包：Linux 产物显式指定 `executableName: luogu-vp`，避免包名 `@vp/desktop` 中的 `@` 影响可执行文件名。
- 登录：登录窗口改由 `BrowserLauncher.launchLoginWindow()` 决定引擎与配置档目录（原先在 `session/login.ts` 中硬编码 Chromium profile 路径）。
- 文档：README 标题改为「Luogu VP」，重写使用风险声明，补充 Firefox 要求、默认浏览器跟随、Linux 出包与独立配置档说明，删除 macOS 与 deb 相关文档；`.env.example` 改用 `VP_BROWSER`；AGENTS.md 补充浏览器探测、Linux 交叉打包与测试比赛等约束。

### 修复

- 打包：在没有 wine 的 Linux 上交叉打 Windows NSIS 包时，`scripts/build-linux.mjs` 会临时改用 electron-builder 自带的纯 JS 卸载器提取实现，构建结束或中断后自动还原，不再因 `spawn wine` 失败（装了 wine 仍走官方路径，`--require-wine` 可强制）。

### 移除

- 不再发布 macOS 产物（dmg / zip）：缺少 macOS 环境验证；`electron-builder.yml` 的 `mac:` 段与发布流水线的 macOS runner 一并删除。
- 不再发布 deb 产物，Linux 仅保留 AppImage。

## [0.1.0] - 2026-10-23

首个公开发布。

### 新增

- 赛制：ICPC（可设置编译错误是否计罚时）、IOI、OI、乐多四种，创建时选择且创建后不可更改。
- 创建比赛：导入已结束的洛谷公开比赛，或从公开题目自选组题；可指定开始时间或立即开始，可设置时长与是否允许暂停。
- 计时：只由绝对时间推导（`startAt + duration + 暂停区间`），关闭标签页或浏览器后按真实时间继续，暂停期间剩余时间冻结、截止时间顺延。
- 题面：Markdown + KaTeX + 代码高亮；不展示难度、标签、通过率、推荐题目、讨论与题解。
- 提交：通过系统 Chromium 系浏览器（Edge / Chrome / Chromium）在无头上下文中自动提交；可见窗口只用于登录，登录完成后关闭。
- 会话：登录成功后保存 `storageState` 供后续复用；支持强制重新登录以切换账号；登录状态不自动轮询，仅在点击「我已完成登录」时探测一次。
- 验证码：图片验证码在程序内弹窗输入；Turnstile/易盾滑块报「不支持」。
- OI 隔离：OI 赛制赛中不返回、不展示任何评测信息，比赛结束后才批量拉取；ICPC / IOI / 乐多赛中展示结果。
- 结果：汇总成绩，可展开每道题的全部提交与评测详情（编译信息、子任务、测试点）。
- 界面：Teal 强调色 + Zinc 中性色，跟随系统 / 浅色 / 深色三种颜色模式。
- 桌面端：Windows 安装版与便携版、macOS dmg/zip（x64、arm64）、Linux AppImage/deb；固定 `127.0.0.1:3000`，数据保存在系统 userData 目录。
- 打包：`build-desktop.mjs` / `build-windows.mjs` 与一键脚本，默认使用 npmmirror 镜像；推送 `v*` 标签后由 GitHub Actions 构建并发布 Release。
- 稳定性：所有服务端发起的洛谷请求共享 500ms 最小间隔节流；题目与比赛结果带本地缓存。
- 隐私：服务只监听 127.0.0.1；不保存密码，不记录代码与 Cookie，`.data/` 已加入 `.gitignore`。

[0.2.0]: https://github.com/JohnZhang888/luogu-vp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JohnZhang888/luogu-vp/releases/tag/v0.1.0
