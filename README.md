# 🐋 DeepSeek Harness Desktop

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`@deepseek-ai/dsh`）打包成 macOS 桌面端 App。基于 Electron，启动后：

1. 用 **系统 Node** 启动 `dsh web`（监听 127.0.0.1，端口由系统自动分配，避免冲突）；
2. 等待 Web GUI 就绪后，把它装进一个原生 macOS 窗口；
3. 关闭窗口 / 退出 App 时，自动停掉后台的 harness 进程。

> 为什么用系统 Node 而不是 Electron 内置 Node：harness 依赖若干原生 addon（`node-addon-require-builtin`、`node-pty`、`koffi`），它们的 ABI 绑定在安装时的 Node 上；Electron 内置的是另一个 Node 大版本/ABI，跑不起来。详见「实现要点」。

## 前置要求

- macOS（Apple Silicon 或 Intel）
- Node.js 22+（本机为 Node 26）。App 会按 `DSH_NODE → /opt/homebrew/bin/node → /usr/local/bin/node → …` 顺序自动探测 node；找不到会弹窗提示。

## 目录结构

```
DeepSeekDesktop/
├── src/
│   ├── main.js        # Electron 主进程：窗口、菜单、生命周期
│   └── harness.js     # 纯 Node 的 dsh 启动器（可脱离 Electron 单独测试）
├── scripts/
│   ├── smoke.js       # 无界面冒烟测试：启动 dsh → 等 URL → 关停
│   ├── gen_icon.py    # 生成 App 图标 PNG（官方鲸鱼标）
│   ├── build_icon.sh  # PNG → .icns
│   ├── common.sh      # 共享环境变量（缓存目录、Electron 镜像）
│   └── install.sh     # 安装依赖
├── build/             # 图标资源（含官方 deepseek-whale.png）
├── package.json
├── make_app.sh        # 构建 .app
└── make_dmg.sh        # 构建 .app + .dmg
```

## 快速开始

```bash
cd DeepSeekDesktop

# 1. 安装依赖（首次，需联网）
./scripts/install.sh

# 2. 开发模式运行（窗口直接打开）
npm start

# 3. 打包 .app（可拖进「应用程序」）
./make_app.sh

# 4. 打包 .dmg 分发
./make_dmg.sh
```

> 说明：`scripts/install.sh` 通过 `scripts/common.sh` 把 npm 缓存、Electron 下载缓存都重定向到工作区，并走 npmmirror 镜像下载 Electron。原因见下方「常见问题」。

## 冒烟测试（无需界面）

验证「启动 dsh → 解析端口 → HTTP 就绪 → 关停」这条核心链路：

```bash
npm run smoke
# 期望输出：SMOKE_OK url=http://127.0.0.1:<port>
```

## 配置

| 环境变量 | 作用 | 默认值 |
| --- | --- | --- |
| `DSH_HOME` | harness 数据目录（配置、会话、凭据） | `~/.dsh`（与命令行版共享） |
| `DSH_WORKSPACE` | harness 的工作区根目录（即 agent 的工作目录） | 用户主目录 `~` |
| `DSH_NODE` | 指定 Node 可执行文件路径 | 自动探测 |
| `DSH_DESKTOP_HOME` | 测试用：覆盖 `DSH_HOME` | 无 |
| `DSH_DESKTOP_USER_DATA` | 测试用：重定向 Electron userData | 系统默认 |
| `DSH_DESKTOP_URL` | 调试用：加载固定 URL 而非自动探测的 URL | 无 |

App 默认与命令行版 **共用 `~/.dsh`**，因此已配置的 API 凭据、历史会话直接可用；若想隔离，设置 `DSH_HOME` 即可。

## 打包产物

- `.app`：`dist/mac-<arch>/DeepSeek Harness.app`（`make_app.sh`，ad-hoc 签名）
- `.zip`：`dist/DeepSeek Harness-<version>-<arch>.zip`（`npm run dist`）
- `.dmg`：`dist/DeepSeek Harness-<version>-<arch>.dmg`（`make_dmg.sh`）

App 图标使用 DeepSeek 官方鲸鱼标（`build/deepseek-whale.png`，取自官方 `https://cdn.deepseek.com/chat/icon.png`），由 `scripts/gen_icon.py` 白底居中合成。

本项目未使用 Apple 开发者证书，产物为 ad-hoc 签名；他人 Mac 首次打开需 **右键 → 打开**（Gatekeeper 拦截提示下），或用开发者证书重新签名 + 公证。

## 实现要点

- **`asar: false`**：把 `node_modules` 原样解包到 `Contents/Resources/app/` 下，这样 `dsh` 及其全部依赖都能被系统 Node 直接解析执行。
- **`npmRebuild: false`**：阻止 electron-builder 把原生 addon 重建为 Electron ABI——我们要的是系统 Node 的 ABI。
- **动态端口**：`dsh web --host 127.0.0.1 --port 0` 让 OS 分配空闲端口，从 stdout 的 `dsh web: http://127.0.0.1:<port>` 行解析真实地址，再等待 HTTP 就绪——避免与正在运行的命令行实例（默认 3080）冲突。
- **单实例**：`app.requestSingleInstanceLock()`，二次启动只聚焦已有窗口，不会重复起服务。

## 常见问题

- **`npm install` 报 `EPERM ... /Users/codeyu/.npm/_cacache`**：本机 `~/.npm` 缓存里有 root 属主的文件（老版本 npm 的 bug）。要么执行 `sudo chown -R 501:20 ~/.npm` 修复，要么像本项目一样把缓存重定向（`scripts/common.sh`）。
- **为什么需要系统 Node？** harness 的原生 addon 依赖安装时的 Node ABI；Electron 内置 Node 的 ABI 不同，加载 `node-addon-require-builtin` 会报 `no compatible GetAlignedPointerFromEmbedderData`。因此 App 用系统 Node 跑后端，Electron 只负责窗口。
- **窗口是普通浏览器吗？** 不是。它是 Electron 窗口加载 harness 自带的 Web GUI，harness 后端跑在系统 Node 进程里，全程 `127.0.0.1`。
- **如何退出？** 关闭窗口或按 `⌘Q`，后台 harness 进程会一并结束。

## 开源许可

[MIT License](./LICENSE) © 2026 codeyu

> `@deepseek-ai/dsh` 及其依赖为 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的产物，按各自许可证分发。
