<!-- fullWidth: false tocVisible: true tableWrap: true -->
---
inclusion: auto
description: 星火编辑器 2.0 (WasiCore) 项目开发规则，包括架构说明、构建流程、代码规范和最佳实践
---

# 项目规则

## 项目概述

这是一个基于**星火编辑器 2.0 (WasiCore 框架)** 的游戏开发项目，使用 .NET 9.0 和 WASI 环境。

### 主要组件

- **编辑器数据系统** (`editor/data/`): 使用 JSON Schema 验证的游戏数据配置
- **触发器系统** (`editor/trigger/`): 客户端、服务端和通用触发器逻辑
- **游戏 HUD** (`game_hud/`): UI 资源和配置
- **场景资源** (`atmosphere/`, `block/`): 光照组和场景块
- **构建系统**: .NET 9.0 项目，支持 Server-Debug 和 Client-Debug 配置
- **用户指南** (`veteran-user-guide/`): 从 1.0 迁移到 2.0 的完整文档

### 框架特点

- 服务器与客户端代码分离（使用条件编译）
- 强类型的数编 Link 系统
- 基于事件的触发器系统
- 组件与实体架构
- 扩展枚举支持

### 日志系统

**游戏运行时日志位置**: `D:\360downloads\星火编辑器\logs\`

- **服务器日志**: `D:\360downloads\星火编辑器\logs\server\` - 包含服务器端游戏逻辑、战斗、玩家事件等日志
  - 文件名格式: `wasm-game-server-*.log`
- **客户端日志**: `D:\360downloads\星火编辑器\logs\client\` - 包含客户端 UI、渲染等日志
  - 文件名格式: `wasm-default-*.log-*.log`
- **Lua 日志**: `D:\360downloads\星火编辑器\logs\lua\` - 包含 Lua 脚本执行日志
- **编译日志**: 项目根目录的 `Server-Debug.log` 和 `Client-Debug.log` - 仅包含编译信息

**注意**:

- 项目根目录的 `.log` 文件是编译日志，不是运行时日志
- 查看游戏运行情况请查看 `D:\360downloads\星火编辑器\logs\server\` 中的最新日志文件
- 服务器端的 `Game.Logger` 输出会记录到服务器日志中

## 核心架构

### 游戏模式

**使用现有的 `MapGameMode`** - 已经链接到地形编辑器和玩家队伍设置，场景、玩家设置和游戏玩法都已预配置。除非需要多个游戏模式，否则不要创建新的游戏模式或修改 `GlobalConfig.cs`。

**重要**: 不要在 `OnRegisterGameClass()` 中读取 `Game.GameModeLink` - 游戏模式尚未初始化（会抛出 `InvalidOperationException`）。应该在 `OnRegisterGameClass` 中订阅事件，然后在 `OnGameTriggerInitialization` 或 `OnGameDataInitialization` 回调中检查模式。

```csharp
public static void OnRegisterGameClass()
{
    Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
}

private static void OnGameTriggerInitialization()
{
    if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
    // 注册触发器等
}
```

### 数据系统

- 使用 JSON Schema 进行类型验证和智能提示
- 支持 `$type` 字段指定数据类型
- 支持 `$inherit` 字段从模板继承（与 `$type` 互斥）
- 对象引用使用 `$ObjectName` 格式
- Schema 文件位于 `editor/data/Schemas/`

**自动生成的数据**: `src/DataGenerated/` 包含自动生成的数据类，通过 `ScopeData.*` 访问：
- `ScopeData.GameDataScene.new_scene` - 默认 4096×4096 场景（用于 3D 游戏）
- `ScopeData.GameDataGameMode.MapGameMode` - 项目的游戏模式（已注册）
- `ScopeData.GameDataPlayerSettings.*` - 玩家/队伍配置

**静态 GameData 创作有两种互斥的方式**：
- `editor/data/**` 源数据（直接编辑 JSON 或通过 `data_*` MCP 工具）
- `src/**/*.cs` 代码定义（如 `new GameDataUnit(...)`）

`src/DataGenerated/**` 是生成的投影代码，不是创作源。不要通过修改 `ScopeData.GameDataXxx.*.Data` 来建模已有 JSON 支持的表。

如果存在 `.cursor/rules/project-data-ownership.mdc`，在更改 GameData 相关代码或 JSON 之前先阅读它。

### 游戏数据类型

主要数据类型包括：

- `GameDataUnit`: 游戏单位
- `GameDataAbility`: 技能系统
- `GameDataBuff`: Buff 效果
- `GameDataItem`: 物品数据
- `GameDataScene`: 场景数据
- `GameDataCamera`: 摄像机设置
- 更多类型见 `editor/data/Schemas/` 目录

### 构建流程

#### 使用 dotnet 命令构建

**客户端调试版本**:

```powershell
dotnet build -c Client-Debug
```

**服务端调试版本**:

```powershell
dotnet build -c Server-Debug
```

**完整构建命令（带输出过滤）**:

```powershell
# 构建服务端并显示结果
$output = & "D:\360downloads\星火编辑器\Update\editor-alpha.spark.xd.com\Res\_m\wasm\dotnet_sdk_lite\2\dotnet_sdk_lite\dotnet.exe" build src/GameEntry.csproj -c Server-Debug 2>&1; $output | Select-String -Pattern "成功|失败" | Select-Object -Last 1

# 构建客户端并显示结果
$output = & "D:\360downloads\星火编辑器\Update\editor-alpha.spark.xd.com\Res\_m\wasm\dotnet_sdk_lite\2\dotnet_sdk_lite\dotnet.exe" build src/GameEntry.csproj -c Client-Debug 2>&1; $output | Select-String -Pattern "成功|失败" | Select-Object -Last 1
```

**注意**: 
- 测试版（alpha）才支持 C# 开发，使用 `editor-alpha.spark.xd.com` 路径
- dotnet SDK 位于版本 2 目录：`dotnet_sdk_lite\2\dotnet_sdk_lite\dotnet.exe`

#### 自动化构建脚本

使用 `BuildAndCopy.bat` 脚本可以自动完成以下步骤：

1. 构建 Server-Debug 配置
2. 复制 DLL 到 `AppBundle/managed`
3. 构建 Client-Debug 配置
4. 复制 DLL 到 `ui/AppBundle/managed`

## 开发规则

### SDK 文档位置

SDK 文档已复制到项目中（版本检查，gitignored，完全可搜索）：

| 资源 | 项目路径 | 描述 |
|------|---------|------|
| AI 指南 | `docs/sdk/ai/` | 为 AI 辅助开发优化的简明指南 |
| 系统文档 | `docs/sdk/systems/` | 每个子系统的详细文档 |
| API 参考（客户端）| `docs/api/client/` | 简化的 C# API 声明，带完整 XML 文档 |
| API 参考（服务端）| `docs/api/server/` | 简化的 C# API 声明，带完整 XML 文档 |
| 数据 Schema | `docs/schemas/` | 数据编辑器 JSON schemas（`types-index.json` + `types/*.json`）|
| 资源索引 | `docs/resources/` | 官方资源索引 - 角色、装饰、特效、声音、动画、武器 |
| 示例索引 | `docs/examples-index.md` | 25+ 完整游戏示例的意图到示例索引（如果可用）|

**使用建议**：
- 首先阅读 `docs/sdk/ai/` 获取简明开发指南
- 所有 `docs/` 文件都可以用 grep/glob 搜索
- 如果任务匹配 `docs/sdk/ai/skills/` 下的主题，先阅读该技能的 `SKILL.md`
- **当示例代码与技能文档不一致时，遵循技能文档**（示例可能滞后或显示替代风格）

### 重要文档位置（旧版）

项目包含完整的用户指南文档，位于 `veteran-user-guide/` 目录：

- `INDEX.md` - 文档导航索引
- `00-GETTING-STARTED.md` - 快速开始指南
- `01-CORE-CHANGES.md` - 核心差异说明
- `02-ADVANCED-FEATURES.md` - 高级功能
- `03-UI-SYSTEM.md` - UI 系统
- `04-LIMITATIONS.md` - 当前版本限制

**在回答用户问题时，优先参考这些文档中的内容。**

### 文档创建规则

**严格禁止在没有用户明确确认的情况下创建 Markdown 文档。**

- 不要自动创建总结文档
- 不要自动创建说明文档
- 不要自动创建任何 .md 文件
- 只有在用户明确要求时才创建文档

### 代码修改规则

#### 禁止的 API（WebAssembly - 单线程，无线程池）

- ❌ 禁止使用 `Task.Run()` - 在 WasiCore 框架中无法正常工作，直接用 `await` 调用异步方法
- ❌ 禁止使用 `Task.Delay()` - 使用 `Game.Delay()` 替代
- ❌ 禁止使用 `Thread` 或任何线程 API - 不支持
- ❌ 禁止使用 `Console.WriteLine()` - 使用 `Game.Logger.LogInformation()` 替代
- ❌ 禁止使用 `goto` - 重构控制流

#### 条件编译

- 服务器代码使用 `#if SERVER` 包裹
- 客户端代码使用 `#if CLIENT` 包裹
- Entity/Unit 创建：仅服务器端
- Actor 创建：仅客户端（视觉效果、模型）
- 云数据访问：仅服务器端，使用 `User.UserId`（long），不是 `Player.Id`（int）
- `GameDataGameMode` 注册：两端都需要 - 不要用 `#if` 包裹

#### 日志系统

- ✅ 使用参数化模板：`Game.Logger.LogInformation("Player {Id} joined", playerId)`
- ❌ 不要使用字符串插值：~~`Game.Logger.LogInformation($"Player {playerId}")`~~

#### Entity vs Actor

- Entity = 游戏逻辑 + 状态 + 同步（服务器创建/管理）
- Actor = 视觉效果（客户端创建，使用 ActorScope 管理生命周期）
- 永远不要在客户端创建 Entity
- 永远不要在 Actor 中放游戏逻辑
- 扩展 Unit 时：也要扩展 `GameDataUnit` 并重写 `CreateUnit()`

#### UnitFilter（GameDataUnit.Filter）

所有战斗 `GameDataUnit` 定义必须配置 `Filter`：
- 英雄：`Filter = [UnitFilter.Unit, UnitFilter.Hero]`
- 普通单位/小兵/怪物：`Filter = [UnitFilter.Unit]`
- 建筑：`Filter = [UnitFilter.Structure]`
- 物品：`Filter = [UnitFilter.Item]`
- 默认 AI `ScanFilters` 需要 `UnitFilter.Unit` - 没有它的单位不会被 AI 锁定

#### GameLink vs IGameLink

- **`GameLink<TCategory, V>`**: 值类型结构体，用于定义链接。`TCategory` = 数据类别，`V` = 特定子类型。总是两个类型参数，如 `GameLink<GameDataUnit, GameDataUnit>`
- **`IGameLink<T>`**: 协变接口（`out T`），用于接受链接。用于函数参数和属性 - 接受 `T` 及其派生类型
- 不存在单类型参数的 `GameLink<T>` - 那是编译错误
- 比较：`IGameLink` vs `IGameLink` 使用 `.Equals()`，不要用 `==`；`GameLink<T,V>` vs `GameLink<T,V>` 可以用 `==`

#### 玩家系统

- 永远不要硬编码玩家 ID；使用 `Player.LocalPlayer.Id`
- `Player.Id`（int）= 临时槽位 ≠ `User.UserId`（long）= 持久 ID
- CloudData 使用 `User.UserId`

#### UI 系统

- **对齐默认 = Center**：`HorizontalContentAlignment` / `VerticalContentAlignment` 默认为 Center。使用 Margin 定位子元素时，始终在子元素上设置 `HorizontalAlignment = Left`，`VerticalAlignment = Top` - 否则 Margin 从中心偏移，而不是左上角。多个没有对齐的子元素会聚集在中心并重叠
- **多个子元素**：容器有 2+ 个子元素时使用 `FlowOrientation = Vertical`（或 `.FlowVertical()`）- 自动堆叠防止重叠
- 父子关系：`child.Parent = parent`，不是 `parent.Children.Add()`
- 可见性：`Visible = true/false`，不是 `Visibility`
- 文本颜色：`TextColor`，不是 `Foreground`
- Canvas 全屏：在 `AddToVisualTree()` 之前调用 `canvas.FullScreen()`
- Canvas 没有 `OnPointerMoved`；使用 `DeviceInfo.PrimaryInputManager.OnPointerButtonMove`
- `HeightGrow` / `WidthGrow` 是扩展方法：`.HeightGrow(1)`
- 优先使用流式扩展（`.AlignLeft()`、`.Size()`、`.Margin()`）而不是对象初始化器 - 不容易遗漏对齐

#### 扩展枚举（EnumExtension）

- 框架属性类型（`PropertyUnit`、`PropertyEntity`、`PropertySubType`、`ComponentTag`、`EventType`）可通过 `[EnumExtension(Extends = typeof(...))]` 扩展
- 要查找可扩展枚举的所有值，在项目源码中搜索 `[EnumExtension(Extends = typeof(TargetEnum))]`
- 扩展枚举名称必须以 `E` 开头（如 `ECustomPropertyUnit`）；生成的静态类自动移除 `E` 前缀
- 详见 `docs/sdk/tools/EnumExtension.md`

#### 序列化（System.Text.Json）

- 需要 JSON 序列化的数据（如服务器/客户端通信）不能使用多维数组 `[,]`；使用一维数组
- 避免复杂的嵌套泛型和循环引用

#### 命名规范

- 注释使用中文
- PascalCase：类型、公共成员；camelCase：私有字段、局部变量
- 接口前缀 `I`；异步后缀 `Async`
- 4 空格缩进，Allman 大括号风格

#### 代码质量

- 修改 JSON 数据文件时，确保符合对应的 Schema 定义
- 使用 `getDiagnostics` 工具检查语法错误，而不是执行 bash 命令
- 重命名符号时使用 `semanticRename` 工具
- 移动或重命名文件时使用 `smartRelocate` 工具

### Schema 维护

- 添加新数据类型时，需要创建对应的 `*.schema.json` 文件
- 在 `MetaTypeRules.schema.json` 中添加类型映射
- 添加新模板后运行 `build-inheritance-schema.bat` 更新继承规则

### 触发器开发

- 客户端触发器放在 `editor/trigger/client/`
- 服务端触发器放在 `editor/trigger/server/`
- 通用触发器放在 `editor/trigger/common/`
- 每个目录需要 `module.config` 配置文件

### 资源管理

- 模型和粒子资源通过 `GameDataModel` 和 `GameDataParticle` 引用
- UI 资源放在 `game_hud/` 目录
- 场景资源使用光照组 (`.lightgroup`) 配置

## 最佳实践

1. **最小化代码**: 只编写必要的代码，避免冗余实现
2. **Schema 优先**: 修改数据前先检查 Schema 定义
3. **引用完整性**: 确保所有 `$ObjectName` 引用都指向存在的对象
4. **构建验证**: 修改后运行 `BuildAndCopy.bat` 验证构建
5. **类型安全**: 优先使用 `$type` 明确指定类型，除非需要继承

## 禁止事项

### 文档相关

- ❌ 未经用户确认创建 Markdown 文档

### 数据系统

- ❌ 同时使用 `$type` 和 `$inherit`
- ❌ 使用不存在的对象引用
- ❌ 修改 Schema 文件而不更新继承规则
- ❌ 在没有对应 Schema 的情况下创建新的数据类型

### 代码规范

- ❌ 使用 `Task.Run()` 调用异步函数
- ❌ 使用 `Task.Delay()` 而不是 `Game.Delay()`
- ❌ 使用 `Console.WriteLine()` 输出日志
- ❌ 在客户端代码中访问云数据
- ❌ 使用 `==` 比较 `IGameLink<T>` 类型（应使用 `Equals` 方法）
- ❌ 使用 `Thread` 或任何线程 API
- ❌ 使用 `goto` 语句
- ❌ 在 `OnRegisterGameClass()` 中读取 `Game.GameModeLink`
- ❌ 手动调用其他系统的 `OnRegisterGameClass()`
- ❌ 在客户端创建 Entity
- ❌ 在 Actor 中放置游戏逻辑
- ❌ 使用多维数组 `[,]` 进行 JSON 序列化
- ❌ 在日志中使用字符串插值（使用参数化模板）
- ❌ 硬编码玩家 ID
- ❌ 混淆 `Player.Id`（int，临时）和 `User.UserId`（long，持久）
- ❌ 在 UI 中忘记设置对齐方式导致元素重叠
- ❌ 使用 `parent.Children.Add()` 而不是 `child.Parent = parent`
- ❌ 创建新的 `GameDataGameMode` 或修改 `GlobalConfig.cs`（除非需要多模式）
- ❌ 修改 `src/DataGenerated/` 或 `src/WasiCoreSDK.props`（自动生成）
- ❌ 通过修改 `ScopeData.GameDataXxx.*.Data` 来建模 JSON 支持的表

### 触发器系统

- ✅ 推荐使用 `Subscribe` 方法创建触发器（简洁且不易出错）
- ✅ 触发器支持异步委托，可直接使用 `async/await`
- 在 `OnGameTriggerInitialization` 中注册（不是 `OnGameDataInitialization`）
- 检查 `Game.GameModeLink` 并仅为相关模式注册
- 使用 `Trigger<T>` / `Subscribe` 处理触发器事件，或使用 `Game.OnGameStart += ...` 的 C# 事件风格
- 在长时间运行的循环中检查 `Game.IsActive`（游戏已开始且未结束时为 true）

### IGameClass

- `OnRegisterGameClass()` 必须是 `public static`
- 永远不要手动调用其他系统的 `OnRegisterGameClass()`
- 不要在 `OnRegisterGameClass()` 中使用 `Game.GameModeLink` - 仅在 `OnGameTriggerInitialization` / `OnGameDataInitialization`（或更晚）中检查模式

### 事件系统

- 在 `OnGameTriggerInitialization` 中注册事件（不是 `OnGameDataInitialization`）
- 检查 `Game.GameModeLink` 并仅为相关模式注册
- 使用 `Trigger<T>` / `Subscribe` 处理触发器事件
- 使用 `Game.OnGameStart += ...` 处理 C# 风格事件
- 在长时间运行的循环中检查 `Game.IsActive`