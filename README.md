# Luogu VP

本地运行的洛谷虚拟参赛（VP）工具。由作者指挥 DeepSeek、GLM 等模型制作。用于按 ICPC / IOI / OI / 乐多赛制重打一场已经结束的洛谷比赛，或者从已公开的题目中自组一场比赛。

不是洛谷官方项目，与洛谷无关；不使用洛谷 Logo。按照正常使用节奏登录洛谷、抓取题目、提交代码，被洛谷封号的风险极低；若使用本工具时被洛谷封号或施以其他惩罚，大概率出自过于频繁地提交代码、抓取题目等非正常使用行为，工具作者不承担任何责任。

## 功能

- 导入已结束的洛谷公开比赛，或自选题目组题。
- ICPC、IOI、OI、乐多四种赛制；创建时选择。
- ICPC 可选择编译错误是否计入罚时。
- 指定开始时间或立即开始，指定时长；可开启暂停（创建后不可更改）。
- 计时基于绝对时间；关闭标签页/浏览器后仍按真实时间继续，暂停状态也会保留。
- 题面渲染 Markdown + KaTeX + 代码高亮；不展示难度、标签、通过率、推荐题目或讨论。
- 通过本地无头浏览器提交：手动登录一次后复用会话；图片验证码在程序内弹窗输入。
- OI 赛制赛中完全不展示评测结果；结束后统一拉取。
- ICPC/IOI/乐多赛中展示结果；结果页可展开每题所有提交与评测详情。
- 跟随系统 / 浅色 / 深色三种颜色模式。

## 桌面版（Windows / macOS / Linux）

普通用户不需要安装 Node，从 [GitHub Releases](https://github.com/JohnZhang888/luogu-vp-tools/releases) 下载对应文件即可：

| 平台    | 文件                                        | 说明                                             |
| ------- | ------------------------------------------- | ------------------------------------------------ |
| Windows | `luogu-vp-setup-<版本>.exe`                 | 安装版，创建开始菜单与桌面快捷方式               |
| Windows | `luogu-vp-<版本>-portable.exe`              | 免安装，双击即用；机房或无管理员权限时推荐       |
| macOS   | `luogu-vp-<版本>-mac-x64.dmg`、`-arm64.dmg` | Intel 芯片选 x64，Apple 芯片选 arm64             |
| Linux   | `luogu-vp-<版本>-linux-x64.AppImage`        | 免安装，`chmod +x` 后直接运行                    |
| Linux   | `luogu-vp-<版本>-linux-x64.deb`             | Debian/Ubuntu，`sudo apt install ./<文件名>.deb` |

首次使用仍需要系统里装有 **Google Chrome、Microsoft Edge 或 Chromium**（Windows 自带 Edge；macOS 通常需要自行安装 Chrome）。登录与提交都通过系统浏览器完成。

安装包未做代码签名，首次运行会有系统提示：

- Windows 的 SmartScreen：点“更多信息 → 仍要运行”。
- macOS 提示无法验证开发者：右键 App →“打开”，或执行 `xattr -dr com.apple.quarantine "/Applications/Luogu VP.app"`。
- Linux 的 AppImage 需要 FUSE；若无法运行，可加 `--appimage-extract-and-run`。
- Linux 上若报 SUID sandbox 相关错误（Ubuntu 23.10+ 的 AppArmor 限制），用 `./luogu-vp-<版本>-linux-x64.AppImage --no-sandbox` 启动。

桌面版把数据保存在系统用户目录：Windows 为 `%APPDATA%\luogu-vp-tools`，macOS 为 `~/Library/Application Support/luogu-vp-tools`，Linux 为 `~/.config/luogu-vp-tools`。想沿用源码版的登录状态，把仓库的 `.data/` 复制成该目录下的 `data/`。

桌面版固定使用 `127.0.0.1:3000`。界面里的比赛状态保存在浏览器 localStorage，按“协议 + 主机 + 端口”隔离，换端口会看不到原来的比赛。

## 源码运行要求

- Node.js >= 22.12（开发时使用 Node 24）。
- Google Chrome、Microsoft Edge 或 Chromium。默认依次尝试系统浏览器（Windows 上优先 Edge，macOS 上优先 Chrome），不额外下载 Chromium。
- 能访问 `www.luogu.com.cn`。

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。开发模式会同时启动本地服务（`127.0.0.1:3000`）和 Vite。

生产模式：

```bash
npm run build
npm start
```

打开 `http://127.0.0.1:3000`。构建后若重新构建了前端，需要重启服务以加载新的静态资源清单。

可选配置见 `.env.example`（端口、数据目录、浏览器 channel 等）。服务不会自动读取 `.env` 文件，请在启动前通过环境变量设置。

## 使用

1. 右上角点击“连接洛谷”，在弹出的浏览器窗口中完成登录，然后回到本页点击「我已完成登录」（点击前不要关闭浏览器窗口，关闭会被当作取消登录）。为避免频繁请求洛谷，登录状态不会自动检测；确认后窗口自动关闭。服务端只保存会话 Cookie，不保存密码。
2. 创建比赛：输入已结束的比赛 ID/链接，或切到“自选题目”添加题目 ID。
3. 选择赛制、开始时间、时长、是否允许暂停，创建比赛。
4. 概览页打开题目，阅读题面；进入提交页粘贴代码、选择语言和 O2，提交。
5. 如遇到图片验证码，程序会弹窗显示图片并要求输入。
6. 结束后在结果页查看成绩；OI 赛制只在结束后展示。

## 赛制说明

- **ICPC**：按通过题数排名；首次 AC 的有效用时 + 每次未通过提交 20 分钟。创建时选择编译错误（CE）是否计罚时。
- **IOI**：每题取所有提交中的最高分，求和。
- **OI**：赛中不显示结果；每题以最后一次提交计分，求和。
- **乐多**：赛中显示结果；单题每次提交的折算分为 `原始分 × max(0.7, 0.95^(本题第几次提交-1))`，取最高折算分求和。这是按洛谷帮助中心说明实现的；若洛谷规则调整，修改 `packages/core/src/scoring.ts` 与测试即可。

只有通过本工具发起的提交计入成绩；直接在洛谷页面提交的记录不会进入本场比赛。

## 数据与隐私

- `.data/` 保存洛谷会话、浏览器 profile 和题目/比赛缓存，已加入 `.gitignore`。不要把 `.data/` 分享给他人。
- 服务默认只监听 `127.0.0.1`，不要将端口暴露到公网。
- 代码只发送给洛谷；服务端日志不记录代码或 Cookie。
- 仓库不包含账号、密码、Cookie 或真实提交数据。

## 常见问题

- **“未找到可用的浏览器”**：安装 Edge/Chrome；或设置 `VP_BROWSER_CHANNEL=chrome`、`VP_BROWSER_EXECUTABLE=<浏览器路径>`。
- **登录窗口没有出现**：确认本机有图形界面；查看服务端日志。登录窗口只在登录时使用，提交始终无头。
- **提交返回“需要先登录洛谷”**：会话过期。点击“连接洛谷”重新登录后再提交。
- **无法读取比赛/题目**：确认网络能访问洛谷；部分未结束比赛或未公开题目无法导入。清理 `.data/cache` 可强制刷新缓存。
- **端口占用**：设置 `VP_PORT` 启动服务；Vite 代理默认指向 `127.0.0.1:3000`，如改端口需同步修改 `apps/web/vite.config.ts`。桌面版固定使用 3000，提示被占用时请关闭占用该端口的程序。
- **macOS/Linux 提示“未找到可用的浏览器”**：安装 Google Chrome 或 Chromium。程序会按平台探测常见安装路径，也会尝试 `VP_BROWSER_EXECUTABLE`。
- **桌面版首次启动较慢**：Windows Defender 会扫描解压出来的服务端运行时，首次可能十几秒，之后会明显加快。
- **打包时连接 `127.0.0.1:443` 失败**：Watt Toolkit 把 GitHub 写进了 hosts，但代理没运行。`npm run desktop` / `npm run desktop:win` 现在默认走 npmmirror；也可以启动 Watt Toolkit，或手动设置 `ELECTRON_MIRROR`、`ELECTRON_BUILDER_BINARIES_MIRROR`。

## 限制

- 只支持已经结束的洛谷公开比赛；未结束比赛的题目通常不可见。
- 验证码目前只自动处理图片验证码；Turnstile/易盾滑块会报“不支持”。
- 提交串行排队，一次只处理一个提交任务。
- 不保存历史比赛成绩；开始新比赛会清除当前结果。
- 不保证对洛谷页面/接口变更的长期兼容；接口或页面改版后可能需要更新 `apps/server/src/luogu`。
- 真实提交与评测链路的最终验证需要你的洛谷账号登录；本地开发不附带测试账号。

## 打包桌面版

```bash
npm run desktop:run   # 构建前端/服务端并启动 Electron（开发调试）
npm run desktop:dir   # 只生成免安装目录 release/win-unpacked
npm run desktop       # 生成当前平台的安装包（Windows: nsis/portable；macOS: dmg/zip；Linux: AppImage/deb）
```

- 版本号同时写在根 `package.json` 和 `apps/desktop/package.json`，构建脚本会校验两者一致。
- Windows 的安装包在 Windows 上构建；macOS 的 dmg 必须在 macOS 上构建；Linux 的 AppImage/deb 在 Linux 上构建。
- 仓库自带 `.github/workflows/release.yml`：推送 `v*` 标签后，GitHub Actions 会在三个平台分别构建安装包并创建 Release。
- 发布新版本：改好两个 `package.json` 的版本号，提交后执行 `git tag v0.1.0 && git push origin v0.1.0`。
- 图标由 `scripts/make-icons.py` 生成（需要 Pillow），产物是 `apps/desktop/build/icon.{png,ico,icns}`。

### 一键打 Windows 安装包

双击仓库根目录的 `build-windows.cmd`，或在终端执行：

```bash
npm run desktop:win
```

脚本会：

1. 校验 Node.js 版本和两个 `package.json` 的版本号；
2. 默认通过 npmmirror 下载 Electron / NSIS（避免 GitHub 被 hosts 指向 127.0.0.1 后连接失败）；
3. 清理旧的 Windows 安装包，重新构建前端/服务端并打包；
4. 输出 `release/luogu-vp-setup-<版本>.exe` 和 `release/luogu-vp-<版本>-portable.exe`。

可用参数：`--skip-build`（复用已有 dist）、`--no-mirror`（改用官方源）、`--open`（完成后打开 `release`；`.cmd` 默认带上）。

## 结构

```text
apps/desktop    Electron 外壳：主进程、打包配置、图标
apps/web        Vue 3 + Vite + Tailwind 前端
apps/server     Fastify 本地服务 + Playwright 无头提交
packages/core   前后端共用类型、计时/暂停、计分
scripts         build-desktop.mjs / build-windows.mjs（桌面端构建/打包）、make-icons.py
build-windows.cmd  Windows 一键打包入口（双击运行）
.github         release.yml 三平台发布流水线
AGENTS.md       项目约定与接口要点
```

## 许可证

GNU General Public License v3.0，见 `LICENSE`。洛谷及相关名称、内容归其权利人所有；本项目仅作个人练习用途。
