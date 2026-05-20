---
inclusion: auto
description: WasiCore 游戏项目上下文 — SDK 路径、编译命令、文档位置
---

# WasiCore 游戏项目

## SDK 路径

`D:/360downloads/星火编辑器/Update/editor-alpha.spark.xd.com/Res/_m/wasm/wasicoresdk/25/wasicoresdk/`

## 项目内文档（推荐使用）

SDK 文档已复制到项目目录（基于版本号自动同步，被 `.gitignore` 忽略），可直接浏览和搜索：

- 框架文档: `docs/sdk/` — 系统文档、AI 开发指南、最佳实践
- API 签名: `docs/api/` — 简化的 C# API 声明（含完整 XML 注释），分 client/、server/、shared/ 子目录
- 数据 Schema: `docs/schemas/` — 数据编辑器 JSON Schema（`types-index.json` + `types/*.json`）
- 资源索引: `docs/resources/` — 官方美术资源目录（角色、装饰物、特效、音效、动画、武器），查找可用资源名和路径

查阅文档时优先使用这些项目内路径，无需拼接 SDK 绝对路径。所有 `docs/` 文件均可使用 Grep 和 Glob 工具正常搜索。

## 运行时日志（排查行为问题时优先看这里）

通过编辑器启动/测试地图后，实际运行日志默认写到编辑器安装目录，而不是地图工程根目录：

- 客户端运行时日志：`D:/360downloads/星火编辑器/logs/client`
- 服务端运行时日志：`D:/360downloads/星火编辑器/logs/server`
- 编辑器 Lua 日志：`D:/360downloads/星火编辑器/logs/lua`（排查 `event.lua`、AI 上下文生成、打开项目流程时使用）

常见误区：

- 项目根目录里的 `Client-Debug.log` / `Server-Debug.log` 往往只是 `dotnet build` 输出，不是实际跑图日志。
- 运行时日志文件名通常类似 `wasm-default-*.log-*.log`（client）和 `wasm-game-server-*.log`（server）。

排查"编译通过但表现不对"时，优先结合 `Game.Logger` 输出与上述运行时日志确认客户端/服务端各自行为。

## 编译命令

修改代码后务必同时编译客户端和服务端：

```bash
dotnet build src/GameEntry.csproj -c Client-Debug
dotnet build src/GameEntry.csproj -c Server-Debug
```

## 游戏模式和项目数据

**直接使用项目已有的 `MapGameMode`**（与地形编辑器和玩家队伍设置联动，已完整配置）。除非明确需要多个游戏模式，否则不要新建游戏模式，不要修改 `GlobalConfig.cs`。

**不要在 `OnRegisterGameClass()` 中访问 `Game.GameModeLink`**（此时游戏模式尚未就绪，会抛异常）。仅在 `OnGameTriggerInitialization`、`OnGameDataInitialization` 等回调内部再判断 `Game.GameModeLink`。

`src/DataGenerated/` 包含编辑器自动生成的数据，通过 `ScopeData.*` 访问：

- `ScopeData.GameDataGameMode.MapGameMode` — 项目游戏模式（已注册为默认测试模式）
- `ScopeData.GameDataScene.new_scene` — 默认 4096×4096 场景
- `ScopeData.GameDataPlayerSettings.*` — 玩家/队伍配置

不要编造 `HostedSceneTag` 值，不要创建新的 `GameDataGameMode`。

`src/DataGenerated/` 是生成投影，不是主要维护入口。处理静态 GameData 配置时，先判断来源：

- `editor/data/**`（无论是手改 JSON，还是通过 `data_*` MCP 修改）属于数据源路线
- `src/**/*.cs` 中 `new GameDataXxx(...)` 属于代码定义路线
- 同一张 GameData 表只能选一路，不要对 json-backed 条目再做 `.Data` 静态补丁

如果存在 `.cursor/rules/project-data-ownership.mdc`，其中包含编辑器自动生成的项目数据归属摘要和 mixed-ownership 提示，处理 GameData 相关任务时优先参考。

如果存在 `.cursor/rules/project-info.mdc`，其中包含编辑器自动生成的项目配置速查信息（玩家队伍阵营关系等），在处理玩家/队伍/阵营相关代码时优先参考。

## 关键约束

- 使用 `#if CLIENT` / `#if SERVER` 条件编译区分客户端/服务端代码
- SDK 路径定义在 `src/WasiCoreSDK.props`，由编辑器自动管理，不要手动修改

## 查阅文档的优先级

需要了解框架功能时，按以下顺序查阅：
1. `docs/sdk/ai/` — AI 开发指南，针对 AI 辅助开发优化的精简文档
2. `docs/sdk/systems/` — 各子系统的详细文档
3. `docs/api/` — 简化的 C# API 声明，查看具体 API 签名和 XML 注释
4. `docs/schemas/` — 数据编辑器 Schema，定位 `$type` 对应的结构定义
5. `docs/resources/` — 官方美术资源索引（先看 `index.json` 总览，再按类型查找具体资源）
6. `docs/examples-index.md` — 示例代码意图索引（25+ 个完整游戏示例，按意图定位后可读取源码参考）。若任务与 `docs/sdk/ai/skills/` 下某专题匹配，应先读对应 `SKILL.md`；**示例与技能文档冲突时，以技能文档为准**（完整示例可能沿用旧写法）。
