# OpenClaw / ZeroClaw / PicoClaw 完全适配规划

这份文档用于给后续的跨宿主适配工作定边界、定架构、定分阶段目标。

它解决的不是“下次该改哪一行代码”，而是下面这些更关键的问题：

- 当前项目到底和 `OpenClaw` 绑定到了什么程度。
- `ZeroClaw` 和 `PicoClaw` 能适配到什么深度。
- 哪些能力可以快速复用，哪些能力必须重构。
- 为了避免二次返工，现在就该把哪些抽象和测试补上。

## 1. 目标定义

目标不是简单地“让项目在三个名字不同的宿主里跑起来”，而是分层达到下面三档兼容：

1. 工具级兼容  
   让宿主可以调用小爱相关能力，例如播报、播放音频、调音量、查状态、执行指令。
2. 会话级兼容  
   让宿主可以把来自外部入口的文本稳定投递到自己的 agent / session，并保留上下文。
3. 入口级兼容  
   让“小爱音箱”成为宿主的真实语音入口，支持轮询、拦截、打断、上下文注入、结果回播、控制台联动。

只有做到第 3 档，才算“完全适配”。

## 2. 当前事实基线

截至 2026-04-01，当前仓库是一个 `OpenClaw` 原生插件，不是通用插件。

主要强绑定点如下：

- 插件入口直接依赖 `api.registerTool(...)` 和 `api.registerService(...)`。
- 元数据文件是 `openclaw.plugin.json`。
- 运行时会动态加载 `openclaw/dist/plugin-sdk/gateway-runtime.js`。
- 状态目录和配置文件解析依赖 `OPENCLAW_HOME`、`OPENCLAW_STATE_DIR`、`OPENCLAW_CONFIG_PATH`、`openclaw.json`。
- 通知回推依赖 `openclaw message send --channel --target --message`。
- agent 调用依赖 OpenClaw Gateway WebSocket、`agent.wait`、`/v1/responses`、`model: openclaw:<agentId>`、`user`、`x-openclaw-agent-id`、`x-openclaw-session-key`。
- 安装脚本会直接修改 OpenClaw 的全局配置和 agent 列表。

因此，当前实现不能直接安装到 `ZeroClaw` 或 `PicoClaw`。

## 3. 官方文档基于什么判断

这份规划基于下面这些文档阅读结果：

- OpenClaw OpenResponses HTTP API  
  `https://openclawcn.com/docs/gateway/openresponses-http-api/`
- PicoClaw README  
  `https://github.com/sipeed/picoclaw/blob/main/README.zh.md`
- PicoClaw Configuration  
  `https://raw.githubusercontent.com/sipeed/picoclaw/main/docs/configuration.md`
- PicoClaw Tools Configuration  
  `https://raw.githubusercontent.com/sipeed/picoclaw/main/docs/tools_configuration.md`
- PicoClaw Hooks  
  `https://raw.githubusercontent.com/sipeed/picoclaw/main/docs/hooks/README.zh.md`
- PicoClaw Steering  
  `https://raw.githubusercontent.com/sipeed/picoclaw/main/docs/steering.md`
- ZeroClaw 社区镜像 README  
  `https://github.com/openagen/zeroclaw/blob/master/README.zh-CN.md`

这里必须单独说明 ZeroClaw 的资料风险：

- 之前规划里引用过的多个 `raw.githubusercontent.com/zeroclaw-labs/...` 文档路径已经失效
- 当前能直接读到的 GitHub README 还是社区镜像，不应直接当成稳定官方实现契约
- 真正进入 ZeroClaw 适配阶段前，必须再次核验其官方站点和官方仓库的最新扩展模型

所以这份文档对 ZeroClaw 的判断，只能作为“方向性规划”，不能直接当成编码说明书。

文档结论只用于做架构规划。真正进入实现阶段时，每一宿主都要再做一次源码级核验，确认宿主 API、配置结构和启动方式没有变化。

## 4. 三个宿主的适配难度判断

| 宿主 | 工具级兼容 | 会话级兼容 | 入口级兼容 | 结论 |
| --- | --- | --- | --- | --- |
| OpenClaw | 已有 | 已有 | 已有 | 当前基线 |
| PicoClaw | 高概率可做 | 中等概率可做 | 需要额外桥接 | 先做 MCP/工具，再逐步深入 |
| ZeroClaw | 理论上可做，但资料需二次核验 | 理论上可做，但资料需二次核验 | 需要原生适配 | 先核官方资料，再写接入层 |

更具体地说：

- `PicoClaw` 已明确支持 `tools`、`MCP`、`skills`、`process hook`、`steering`。这意味着先做“工具级兼容”最稳。
- `ZeroClaw` 从公开资料方向上看，更像是 `Provider / Channel / Tool / RuntimeAdapter` 一类原生扩展体系，但现在公开资料稳定性不够，必须谨慎。
- 对这两个宿主来说，最难的不是“调用 LLM”，而是“如何把小爱音箱轮询出来的对话当成宿主自己的外部消息入口”。

### 4.1 关键能力矩阵

| 能力维度 | OpenClaw | PicoClaw | ZeroClaw |
| --- | --- | --- | --- |
| 工具注册 | 原生 `api.registerTool` | 已文档化 `tools / MCP / skills` | 待重新核验原生扩展接口 |
| 会话绑定 | `agent + user/session-key` 已稳定 | `bindings + steering` 已有文档 | 待重新核验 |
| 运行中消息插入 | Gateway / Responses / 通知链路可用 | `steering` 是正式机制 | 待重新核验 |
| 后台服务与 HTTP | 插件服务 + gateway route 原生支持 | 更适合外部服务或工具桥接 | 待重新核验是否有同等级宿主能力 |
| 敏感数据与安全 | 主要靠插件自身控制 | `tools` 配置与 hooks 文档更明确 | 待重新核验 |

这个矩阵有两个结论：

1. `PicoClaw` 先做工具级兼容，技术路径最清晰。
2. `ZeroClaw` 不应该在当前资料不稳时直接开工深度适配，否则大概率返工。

## 5. 总体策略

总体策略只有一句话：

先把“小米能力”从 `OpenClaw` 宿主里剥离出来，再让三个宿主接同一套核心。

不这样做，后面每适配一个宿主，都会复制一遍：

- 登录流程
- 设备发现
- 会话轮询
- 打断逻辑
- 播报逻辑
- 音频播放逻辑
- 调音量逻辑
- 控制台状态逻辑
- 安装配置逻辑

那会直接把维护成本翻成三倍，而且很快失控。

## 6. 目标架构

建议把项目拆成 3 层：

```text
宿主接入层
  -> OpenClaw Adapter
  -> PicoClaw Adapter
  -> ZeroClaw Adapter

通用协调层
  -> Session Orchestrator
  -> Notification Router
  -> Voice Entry Pipeline
  -> Audio Playback Pipeline
  -> Console Backend

小米核心层
  -> Auth / Token Store
  -> Device Discovery
  -> Conversation Poller
  -> Pause / Execute / Speak / Audio URL / Volume
  -> State Store / Event Log / Debug Log
```

### 6.1 小米核心层

这一层完全不应该知道宿主是谁。

它只负责：

- 登录与 token 刷新
- 设备绑定与状态查询
- 云端对话轮询
- `pause / speak / execute / play audio / volume` 等设备动作
- 音频能力探测与回退
- 调试日志和状态持久化

建议抽成 `src/core/`，至少拆出下面这些模块：

- `xiaomi-auth.ts`
- `xiaomi-device-registry.ts`
- `xiaomi-conversation-poller.ts`
- `xiaomi-speaker-controller.ts`
- `xiaomi-audio-controller.ts`
- `xiaomi-state-store.ts`

### 6.2 通用协调层

这一层负责把“小米能力”翻译成“宿主可理解的行为”。

建议核心模块如下：

- `voice-entry-orchestrator.ts`
  负责拦截、打断、窗口期、上下文拼接、去重、防循环。
- `assistant-session-manager.ts`
  负责统一的会话键、历史压缩、摘要归档、幂等键。
- `reply-delivery-manager.ts`
  负责文字播报、音频播放、执行指令、失败回退。
- `notification-router.ts`
  负责把登录入口、播报回传、错误通知发回宿主用户侧。
- `console-service.ts`
  负责控制台 API，不直接依赖某个宿主的配置格式。

### 6.3 宿主接入层

这一层只做宿主差异适配，所有宿主差异都必须收口到接口里，不允许渗透回核心。

建议定义一个 `HostAdapter` 总接口：

```ts
interface HostAdapter {
  readonly hostId: "openclaw" | "zeroclaw" | "picoclaw";
  getCapabilities(): Promise<HostCapabilityProfile>;
  registerTools(registry: XiaoaiToolRegistry): Promise<void>;
  startBackgroundService(service: HostBackgroundService): Promise<void>;
  stopBackgroundService(serviceId: string): Promise<void>;
  resolveStateDir(): Promise<string>;
  readHostConfig(): Promise<HostConfigSnapshot>;
  writeHostConfig(patch: HostConfigPatch): Promise<void>;
  invokeAgent(input: HostAgentInput): Promise<HostAgentResult>;
  waitAgent(run: HostAgentRunRef): Promise<HostAgentWaitResult>;
  sendUserNotification(message: HostNotification): Promise<void>;
  exposeHttpRoutes?(routes: HostHttpRouteDefinition[]): Promise<void>;
  restartGatewayIfNeeded?(reason: string): Promise<void>;
}
```

再单独定义一个能力描述：

```ts
interface HostCapabilityProfile {
  supportsBackgroundService: boolean;
  supportsDirectToolRegistration: boolean;
  supportsExternalHttpRoutes: boolean;
  supportsAgentWait: boolean;
  supportsSessionKey: boolean;
  supportsUserNotification: boolean;
  supportsGatewayRestart: boolean;
  supportsModelDiscovery: boolean;
}
```

这样后面所有分支判断都以 capability 为准，而不是到处写 `if (host === "openclaw")`。

## 7. 建议的目录重构

建议重构后的目录大致如下：

```text
index.ts
src/
  core/
    xiaomi-auth.ts
    xiaomi-device-registry.ts
    xiaomi-conversation-poller.ts
    xiaomi-speaker-controller.ts
    xiaomi-audio-controller.ts
    xiaomi-state-store.ts
  app/
    voice-entry-orchestrator.ts
    assistant-session-manager.ts
    reply-delivery-manager.ts
    notification-router.ts
    console-service.ts
  host/
    host-adapter.ts
    openclaw-adapter.ts
    picoclaw-adapter.ts
    zeroclaw-adapter.ts
  shared/
    types.ts
    errors.ts
    logging.ts
    timing.ts
    ids.ts
```

当前体量最大的 `src/provider.ts` 不应该继续承担所有职责。  
适配前先拆文件，是后续成功的前置条件。

## 8. 兼容等级设计

为了避免目标失真，后续适配要按等级验收。

### 8.1 L1: 工具级兼容

宿主可以调用：

- `speak`
- `play_audio`
- `set_volume`
- `get_volume`
- `wake_up`
- `execute`
- `get_status`

这一级不要求：

- 小爱轮询接入宿主会话
- 小爱作为语音入口
- 控制台完全内嵌在宿主里

### 8.2 L2: 会话级兼容

在 L1 基础上，要求：

- 支持把来自控制台或外部入口的文本投递到宿主 agent
- 支持固定会话与新建会话
- 支持会话上下文压缩
- 支持消息回推给用户渠道

### 8.3 L3: 入口级兼容

在 L2 基础上，要求：

- 小爱轮询结果可被宿主当作真实输入
- 可在小爱默认回复之前完成打断
- 支持窗口期、唤醒词、去重、防循环
- 支持文字回复和音频回复
- 控制台可查看全链路事件

### 8.4 L4: 运维级兼容

在 L3 基础上，要求：

- 安装脚本对不同宿主可自动检测和正确落盘
- 所有权、权限、状态目录、日志目录、环境变量都可自恢复
- GitHub Release 可以按宿主打包
- CI 可以跑最小冒烟测试

“完全适配”定义为：至少达到 `L3 + L4`。

## 9. 各宿主具体适配路线

## 9.1 OpenClaw

`OpenClaw` 不是要“重新支持”，而是要作为第一个被重构完成的适配器。

目标：

- 保持现有功能不回退。
- 先把所有 OpenClaw 专有逻辑收口到 `openclaw-adapter.ts`。
- 把当前 `provider.ts` 里混在一起的宿主逻辑、会话逻辑、小米逻辑彻底剥开。

需要迁出的 OpenClaw 专有能力：

- 插件入口注册
- Gateway SDK 加载
- `openclaw.json` 读写
- `openclaw message send`
- `agent.wait`
- `/v1/responses`
- `x-openclaw-agent-id`
- `x-openclaw-session-key`
- agent 模型读取与回写
- gateway restart

只有 OpenClaw 适配层稳定后，另外两个宿主的抽象才不会漂。

## 9.2 PicoClaw

推荐分两步做。

### 第一步：PicoClaw L1 工具适配

首选方案是做成一个独立的 `MCP server` 或 `tool provider`：

- 宿主通过工具调用 `xiaomi-core`
- 先拿下播报、音频、调音量、执行指令、查状态
- 控制台单独跑，不先硬嵌到 PicoClaw

这样做的好处：

- 复用率高
- 风险低
- 不依赖 PicoClaw 是否暴露长期驻留服务接口
- 能先交付可用价值

### 第二步：PicoClaw L2/L3 深度适配

后续再看是否能利用下面能力组合完成完整入口：

- `process hook`
- `steering`
- 宿主对外消息注入接口
- 会话维持接口
- 用户通知接口

这里的关键核验项不是文档标题，而是源码里是否存在：

- 可从外部长期接入的后台服务
- 可把外部文本注入当前 agent/session 的正式 API
- 可给指定用户/频道发消息的正式 API
- 可稳定等待 agent 完成的 API

如果没有这 4 个条件，就不要强上 L3，停在 L1/L2。

## 9.3 ZeroClaw

`ZeroClaw` 更可能需要“原生集成”，而不是“兼容 OpenClaw 插件接口”。

推荐路线：

- 先做 `Tool / Integration` 级别接入，拿下 L1。
- 再评估是否以 `Channel` 或 `RuntimeAdapter` 的方式实现小爱入口。

对 `ZeroClaw` 来说，优先要核验的是：

- 外部消息进入会话的正式入口
- channel 的输入输出模型
- 外部用户标识和对话映射方式
- 配置文件 `config.toml` 的稳定可回写范围
- 是否存在适合常驻监听服务的扩展位

如果这些都成立，`ZeroClaw` 是有机会做到 L3 的。  
但实现方式大概率会和 `OpenClaw` 完全不同。

## 10. 先做什么，后做什么

推荐严格按下面阶段推进，不要跳步。

### 阶段 0：冻结当前基线

交付物：

- 记录当前 OpenClaw 功能矩阵
- 固化关键配置样例
- 固化关键日志样例
- 补充至少一套真实会话回放样本

目的：

- 后面每次重构都能知道是不是把已有功能做坏了

### 阶段 1：拆分 `provider.ts`

交付物：

- 把小米侧逻辑迁到 `core/`
- 把会话协调逻辑迁到 `app/`
- 保留 OpenClaw 行为不变

验收标准：

- OpenClaw 功能无回退
- 原有控制台、轮询、拦截、播报都还能工作

### 阶段 2：定义宿主接口

交付物：

- `host-adapter.ts`
- `HostCapabilityProfile`
- `HostConfigSnapshot`
- `HostAgentInput / Result / WaitResult`
- `HostNotification`

验收标准：

- OpenClaw 现有能力可以 100% 通过接口表达
- 接口里不出现 `openclaw` 字样

### 阶段 3：把 OpenClaw 改造成适配器

交付物：

- `openclaw-adapter.ts`
- 原 `provider.ts` 只保留装配逻辑

验收标准：

- 当前功能不变
- 宿主差异不再泄漏到核心层

### 阶段 4：提供独立 Sidecar 运行模式

交付物：

- 一个不依赖宿主插件系统的后台服务入口
- 可选的 HTTP / MCP 暴露方式

这是整个跨宿主适配最重要的一步。  
因为一旦 sidecar 成型，剩下两个宿主都可以先接 sidecar，而不是一上来就深度嵌入。

### 阶段 5：PicoClaw L1

交付物：

- PicoClaw 工具接入
- 最小控制台联动
- 最小安装说明

### 阶段 6：ZeroClaw L1

交付物：

- ZeroClaw 工具接入
- 最小配置接入
- 最小安装说明

### 阶段 7：PicoClaw L2/L3 评估与实现

前置条件：

- 已确认 PicoClaw 有正式的会话注入与用户通知能力

### 阶段 8：ZeroClaw L2/L3 评估与实现

前置条件：

- 已确认 ZeroClaw 的 Channel / RuntimeAdapter 能承载该场景

## 11. 必须先补的测试体系

如果没有测试，后面的多宿主适配非常容易把现有能力改坏。

至少要补下面这些测试：

### 11.1 核心单元测试

- 唤醒词匹配
- 对话窗口期判断
- 去重逻辑
- 防循环逻辑
- 上下文压缩
- 音频 URL 规范化
- 设备状态归一化

### 11.2 宿主契约测试

针对 `HostAdapter` 做统一契约测试：

- 工具注册是否完整
- agent 调用是否返回标准结果
- wait 是否按预期超时
- 通知发送失败时是否可恢复
- state dir 是否可解析

### 11.3 回放测试

保存真实日志样本，做回放：

- 用户唤醒小爱
- 小爱默认回复前被打断
- 文本被转发到宿主
- 宿主回播文字
- 宿主回播音频
- 执行设备指令
- 防循环命中

这里要额外单列一组“短音频回归样本”：

- `2s` 到 `3s` 的短 MP3
- TTS 桥接生成的短音频
- relay 音频
- 播放前先 interrupt 清场
- 播放尾部不应出现第二次补救式 pause
- 外部音频不应在“完成后”再次回到 `status=1` 继续推进
- 不能假设 `loop_type` 在所有宿主 / 所有机型 / 所有播放模式下都等于“播完即停”

原因很简单：

- 长音频通过，不代表短音频就安全
- 短音频最容易暴露 deadline 太晚、状态回读太慢、重复 pause、同步恢复 loop type 等问题
- 某些宿主虽然能写入 `loop_type`，但真实外部音频行为仍然会回绕
- 某些宿主里的 `relay hit / URL 已被拉取` 只能证明播放器碰到了资源，不能单独证明“已经稳定起播”
- 这类问题一旦只在某个宿主里被重新引入，用户体感会非常差

### 11.4 端到端冒烟测试

至少覆盖：

- OpenClaw 全链路
- PicoClaw 工具链路
- ZeroClaw 工具链路

## 12. 性能约束

后续适配不能只追求“能用”，还必须满足性能下限。

关键指标建议如下：

- 小爱新对话被轮询到的时间：目标 `<= 500ms`
- 执行 `pause` 的时间：目标 `<= 300ms`
- 拦截后过渡播报开始时间：目标 `<= 900ms`
- 从识别文本到宿主 agent 开始执行：目标 `<= 600ms`
- 工具级播报开始时间：目标 `<= 700ms`

适配阶段一律不要为了绕开难题而增加固定延迟。  
固定延迟会直接伤害语音交互体感。

另外，音频播放链路要单独满足两个约束：

- 极短音频的 guard finish 应尽量贴近理论 deadline，不能再晚一个完整状态轮询窗口
- deadline fast path 不能被额外的状态预读、重复 pause、同步 loop 恢复拖慢
- 不要把 `relay hit` 单独提升为跨宿主通用的“起播成功”信号；它最多只能作为辅证，仍然需要至少一份宿主播放状态 / 队列状态确认

这两条约束应该放在“通用音频播放管线”里统一保证，而不是留给某个宿主单独兜底。

## 13. 安全与稳定性要求

跨宿主适配时，必须同步满足下面这些要求：

- token、账号、会话状态、控制台口令必须继续落在宿主 state dir 或 sidecar state dir 内。
- 不允许把敏感数据散落到仓库目录。
- 日志必须继续支持自动裁剪。
- 安装脚本必须继续处理 owner / permission 问题。
- release 产物必须继续保留 `install.sh` 的可执行位；如果外部解压工具丢失执行位，脚本文档也必须明确允许 `bash ./install.sh` 作为等价入口。
- 不允许因为适配新宿主而削弱现有防循环逻辑。
- 外部音频播放必须继续有防循环与过期清理策略。
- 所有外部命令调用都必须可超时、可重试、可输出摘要。

## 14. 控制台策略

控制台不要一开始就为每个宿主重写一套。

建议策略：

- 保持当前控制台作为独立前端。
- 控制台后端直接连通用协调层，而不是连 OpenClaw 专有代码。
- 宿主只负责把控制台入口暴露给用户，或者由 sidecar 自己暴露。

这样做的好处是：

- 前端只维护一套
- 宿主差异只留在后端适配层
- 未来支持更多宿主时，控制台不用重复重写

## 15. 安装与发布策略

后续发布应从“一个 OpenClaw 插件包”改造成“多形态发布”。

建议发布 3 类产物：

1. `openclaw-plugin`  
   面向现有用户，保持当前安装方式。
2. `sidecar-core`  
   面向 PicoClaw / ZeroClaw / 其他宿主，提供通用后台服务。
3. `host-shims`  
   面向各宿主的薄接入层，只做工具注册、消息桥接、配置适配。

GitHub Action 后续也要分目标构建，而不是继续只产出一个压缩包。

发布链路还要补一条很实际的要求：

- 构建完成后要校验 `install.sh` 权限位是否仍为可执行
- release 说明里要保留 `./install.sh` 与 `bash ./install.sh` 两种入口
- 不能把“执行位丢失”误判成安装脚本逻辑失败

## 16. 不该做的事

为了避免走弯路，下面这些做法不建议采用：

- 不要试图让 `ZeroClaw` 或 `PicoClaw` 直接兼容 `openclaw.plugin.json`。
- 不要在现有 `provider.ts` 上继续堆条件分支。
- 不要把宿主差异散落到核心逻辑里。
- 不要一上来就追求 `L3`，先拿下 `L1` 才能尽快验证方向。
- 不要为了规避宿主缺口而引入固定延迟。
- 不要在没有契约测试的前提下大规模拆分现有逻辑。

## 17. 实施前检查清单

正式开工前，先确认这些事项：

- 当前 OpenClaw 版本和插件基线已经冻结。
- 已经抽取并保存真实日志样本。
- 已经补上最小契约测试。
- 已经明确 sidecar 的运行语言和入口形式。
- 已经确认三个宿主的配置文件位置、状态目录、权限模型。
- 已经确认 PicoClaw 的工具接入首选 `MCP` 还是原生 tools。
- 已经确认 ZeroClaw 的首选接入是 `Integration`、`Tool` 还是 `Channel`。

## 18. 最终建议

后续适配应遵循下面这个顺序：

1. 先把当前 OpenClaw 实现拆成“核心 + 适配器”。
2. 再提供 sidecar 形态。
3. PicoClaw 先做工具级兼容。
4. ZeroClaw 再做工具级兼容。
5. 等两个宿主的会话注入能力都核验清楚后，再决定是否推进完整语音入口适配。

这是当前风险最低、返工最少、也最符合现有代码形态的路线。

如果跳过第 1 步和第 2 步，直接在现有 `provider.ts` 上硬接 `ZeroClaw` / `PicoClaw`，后面基本一定会重构第二次。
