<p align="center">
  <img src="assets/ui/favicon.svg" alt="XiaoAI Cloud Plugin Logo" width="176" height="176">
</p>

<p align="center">将小爱音箱接入 OpenClaw </p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-Plugin-1f6feb?style=flat-square" alt="OpenClaw Plugin">
  <img src="https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22+">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5">
</p>

## 这是什么

运行在 OpenClaw Gateway 所在环境的插件，把小爱音箱接进 OpenClaw，让 OpenClaw 拥有调用小爱音箱的能力，或者用小爱音箱和 OpenClaw 对话。

当前支持的核心功能：
- 语音拦截与转发
- 小爱播报与远程唤醒
- 小爱本地执行指令
- 音量、唤醒词、工作模式、上下文记忆控制
- 内嵌登录、设备切换、事件流和对话控制台
- OpenClaw URL音频回复处理（Beta）

## 快速开始

### 从 Release 安装

macOS / Linux：
```bash
chmod +x install.sh
./install.sh
```

Windows：
```bat
install.cmd
```

要求：
- 安装脚本和发布压缩包放在同一目录
- 脚本必须在真正运行 OpenClaw Gateway 的那台机器 / 容器里执行

<details>
<summary><strong>从源码安装</strong></summary>

### 从源码安装

```bash
cd openclaw-plugin-xiaoai-cloud
chmod +x install.sh
./install.sh
```

Windows：
```bat
cd openclaw-plugin-xiaoai-cloud
install.cmd
```

</details>

<details>
<summary><strong>安装脚本会干的事</strong></summary>

## 安装脚本会干的事

1. 安装依赖并构建插件
2. 安装到 OpenClaw
3. 创建或复用专属 `xiaoai` agent
4. 写入 `openclawAgent`
5. 合并必要工具 allowlist
6. 检查插件并重启 Gateway

</details>

### 安装脚本参数

- `--profile <name>`：指定 OpenClaw profile
- `--state-dir <dir>`：指定 `OPENCLAW_STATE_DIR`
- `--openclaw-bin <path>`：指定 OpenClaw CLI 路径
- `--skip-npm-install`：跳过依赖安装

## 环境要求

- Node.js `>= 22`
- 可执行的 `openclaw` CLI
- 建议安装 Python 3 + `requests`
```bash
python3 -m pip install requests
```

## 首次使用

1. 安装完成后让OpenClaw打开小爱控制台，OpenClaw会调用 `xiaoai_console_open`，返回控制台网页链接。
2. 打开控制台，先登录小米账号
3. 在概览页选择要接管的音箱
4. 到控制页设置模式、音量、唤醒词、上下文记忆和必要时的非流式兜底（一般不需要）

## 用法示例

- 通过小爱和OpenClaw对话
- 让小爱说话，任何话，可通过任务定式
- 让OpenClaw返回音频
- 等等

## 控制逻辑

工作模式：
- `唤醒模式`：命中唤醒词，或窗口期内才接管
- `代理模式`：完全接管所有语音
- `静默模式`：不接管，只保留主动播报

<details>
<summary><strong>常用工具（OpenClaw会自己调用合适的工具）</strong></summary>

## 常用工具（OpenClaw会自己调用合适的工具）

- `xiaoai_console_open`
- `xiaoai_speak`
- `xiaoai_play_audio`
- `xiaoai_execute`
- `xiaoai_set_volume`
- `xiaoai_get_volume`
- `xiaoai_wake_up`
- `xiaoai_set_mode`
- `xiaoai_set_wake_word`
- `xiaoai_set_dialog_window`
- `xiaoai_new_session`
- `xiaoai_get_status`

</details>

<details>
<summary><strong>排障</strong></summary>

## 排障

先看插件状态：

```bash
openclaw plugins inspect openclaw-plugin-xiaoai-cloud --json
```
再看 OpenClaw 日志：
```bash
openclaw logs --limit 260 --plain | tail -n 260
```
重点看：
- `xiaomi-network.log`
- 控制台 `事件` 页

如果你遇到“音频没播出来”：

1. 先确认返回的是可直接访问的 `http/https` URL
2. 再看控制台事件里是 `speaker` 还是 `browser-fallback`
3. 如果连续都是同一音频源失败，插件会暂时直接走浏览器兜底，这是为了减少等待时间

如果你遇到“执行指令循环”：

1. 优先使用 `xiaoai_execute`
2. 避免让 `xiaoai_speak` 去读设备控制口令
3. 查看事件页里是否出现最近主动执行指令的回灌忽略记录

</details>

## 本人测试环境
- 阿里云轻量应用服务器2C2G
- 小爱音箱Play增强版 (L05C)
- OpenClaw v2026.4.1
