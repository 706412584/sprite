---
inclusion: auto
description: WasiCore 框架编码约束 — 禁用 API、客户端/服务端分离、编码模式
---

# WasiCore 编码规则

## 禁用 API（WebAssembly 单线程环境）

| 禁用 | 替代 | 原因 |
|------|------|------|
| `Task.Run()` | 直接 await 异步方法 | 无线程池 |
| `Task.Delay()` | `Game.Delay()` | 框架定时器 |
| `Thread` / 任何线程 API | — | 单线程环境，不支持 |
| `Console.WriteLine` | `Game.Logger.LogInformation()` | 框架日志系统 |
| `goto` | 重构控制流 | 禁止使用 |

## 日志

- 使用参数化模板：`Game.Logger.LogInformation("Player {Id} joined", playerId)`
- **禁止**字符串插值：~~`Game.Logger.LogInformation($"Player {playerId} joined")`~~
- 级别：`LogDebug` / `LogInformation` / `LogWarning` / `LogError`

## 客户端/服务端分离

- 用 `#if SERVER` 包裹服务端代码，`#if CLIENT` 包裹客户端代码
- Entity / Unit 创建：**仅服务端**
- Actor 创建：**仅客户端**（用于视觉表现、特效、模型）
- CloudData 操作：**仅服务端**，使用 `User.UserId`（long），不要用 `Player.Id`（int）
- `GameDataGameMode` 注册：**两端都需要**，不要包在 `#if` 里

## UnitFilter 分类（GameDataUnit.Filter）

所有参与战斗的 `GameDataUnit` **必须**配置 `Filter` 字段，否则 AI 无法检测到该单位。

| 单位类型 | Filter 配置 |
|------|------|
| 英雄 | `Filter = [UnitFilter.Unit, UnitFilter.Hero]` |
| 普通单位/小兵/怪物 | `Filter = [UnitFilter.Unit]` |
| 建筑 | `Filter = [UnitFilter.Structure]` |
| 物品 | `Filter = [UnitFilter.Item]` |
| 投射物 | `Filter = [UnitFilter.Missile]` |

- `Unit` 和 `Structure` 是并列的主分类，互不包含
- `Hero`、`Ground`、`Air` 是可叠加的子分类

## Entity vs Actor 架构

- **Entity** = 游戏逻辑 + 状态 + 同步（服务端创建和管理）
- **Actor** = 视觉表现 + 特效（客户端创建，使用 ActorScope 管理生命周期）
- 不要在客户端创建 Entity；不要在 Actor 中放游戏逻辑
- 扩展 Unit 时，同时扩展 `GameDataUnit` 并覆写 `CreateUnit()`
- 同样模式适用于 Item / Ability 及其 GameData 类型

## IGameClass

- `OnRegisterGameClass()` 必须是 `public static`
- 不要手动调用其他系统的 `OnRegisterGameClass()`
- **禁止在 `OnRegisterGameClass()` 内读取 `Game.GameModeLink`**（模式尚未初始化，会抛 `InvalidOperationException`）。只在 `OnGameTriggerInitialization`、`OnGameDataInitialization` 等回调里判断模式并注册逻辑

## 事件系统

- 在 `OnGameTriggerInitialization` 中注册事件（不是 `OnGameDataInitialization`）
- 检查 `Game.GameModeLink`，只为相关模式注册
- 使用 `Trigger<T>` / `Subscribe` 处理事件
- Trigger 回调必须标记 `async`：`new Trigger<T>(async (s, d) => { /* 处理逻辑 */ })`
- 监听游戏开始：C# 事件用 `Game.OnGameStart += ...`，触发器用 `Trigger<EventGameStart>`
- 在长循环中检查 `Game.IsActive`（游戏已启动且未结束）

## GameLink 与 IGameLink

- **`GameLink<TCategory, V>`**：值类型结构体，用于**定义** Link。`TCategory` 是数据分类，`V` 是分类中的具体子类型。必须写两个类型参数，如 `GameLink<GameDataUnit, GameDataUnit>`
- **`IGameLink<T>`**：协变接口（`out T`），用于**接受** Link。函数参数和属性类型应优先使用 `IGameLink<T>`，因为它接受 `T` 及其派生类的 Link
- 不存在 `GameLink<T>` 单类型参数形式，这是编译错误
- 比较规则：`IGameLink` vs `IGameLink` 使用 `.Equals()`，不要用 `==`；`GameLink<T,V>` vs `GameLink<T,V>` 可以用 `==`

## 玩家系统

- 不要硬编码玩家 ID，使用 `Player.LocalPlayer.Id`
- `Player.Id`（int）= 临时槽位 ≠ `User.UserId`（long）= 持久用户 ID
- CloudData 关联用 `User.UserId`
- 监听 `EventPlayerUserConnected` / `EventPlayerUserDisconnected`

## UI 规则

- 设置父子：`child.Parent = parent`，不是 `parent.Children.Add()`
- 显隐：`Visible = true/false`，不是 `Visibility`
- 文字颜色：`TextColor`，不是 `Foreground`
- Canvas 全屏：先 `canvas.FullScreen()` 再 `AddToVisualTree()`
- Canvas 无 `OnPointerMoved`，用 `DeviceInfo.PrimaryInputManager.OnPointerButtonMove`
- `HeightGrow` / `WidthGrow` 是扩展方法：`.HeightGrow(1)` / `.WidthGrow(1)`
- 优先使用流式布局（`FlowOrientation`、`AutoMode.Auto`）

## 扩展枚举（EnumExtension）

- 框架属性类型（`PropertyUnit`、`PropertyEntity`、`PropertySubType`、`ComponentTag`、`EventType`）支持通过 `[EnumExtension(Extends = typeof(...))]` 扩展
- 要查找某个可扩展枚举的所有已定义值，搜索项目中所有 `[EnumExtension(Extends = typeof(TargetEnum))]`
- 扩展枚举名必须以 `E` 开头（如 `ECustomPropertyUnit`），生成的静态类自动去除 `E` 前缀
- 详见 `docs/sdk/tools/EnumExtension.md`

## 扩展方法

- API 声明中带 `this` 修饰符的参数表示扩展方法，如 `static void Forget(this Task task)` 实际用法为 `task.Forget()`
- UI 扩展方法（`HeightGrow`、`WidthGrow`、`FullScreen` 等）在 `GameUI.Control.Extensions` 命名空间
- 颜色扩展方法（`ToHex`、`FromHex`）在 `GameUI.Extensions` 命名空间
- 查找某类型可用的扩展方法：搜索 `docs/api/` 中带该类型 `this` 参数的静态方法

## Canvas API 风格

- Canvas 绘图状态使用**扩展方法**（支持链式调用）：`canvas.FontSize(20)`、`canvas.TextAlign(TextAlign.Center)`
- 不要用属性赋值风格 `canvas.FontSize = 20`（虽然也能编译，但文档统一推荐扩展方法）
- UI 控件（Label 等）的 `FontSize` 仍然是属性赋值：`label.FontSize = 16`

## ScopeData 与 GSC 别名

- 框架预置数据（属性、生命值、伤害类型等）在 `gamesparkcore.ScopeData` 命名空间中
- csproj 已配置全局别名：`GSC = gamesparkcore.ScopeData`
- **数编与单位/技能配置**：优先使用 `GSC.GameDataUnitProperty.*`、`GSC.GameDataVital.*`、`GSC.GameDataDamageType.*`、`GSC.GameDataStatusBar.*` 等与编辑器数据一致的 Link
- **框架内置、非项目数编条目**：仍可使用 `GameCore.ScopeData`（例如 `GlobalConfig` 里注册可用模式时常用 `GameCore.ScopeData.GameMode.Default`）。不要将二者混为一谈：**不要用 `GameCore.ScopeData` 的成员去充当 `GameDataUnit.Properties` 等需要 GSC Link 的字典键**
- 游戏模式配置：`Gameplay = GSC.GameDataGameplay.Default`
- 不要 `using gamesparkcore.ScopeData;`（会与框架类型同名冲突），直接用 `GSC.` 前缀

## GameData 数据归属

- 静态 GameData 配置只有两条合法路径：
  - `editor/data/**` 源数据（无论是手改 JSON，还是通过 `data_*` MCP 工具修改，本质上都是同一路）
  - `src/**/*.cs` 中的代码定义（如 `OnGameDataInitialization` 里 `new GameDataUnit(...)`）
- **同一张 GameData 表只能选择一个静态来源**。不要一部分放在 `editor/data`，再在代码里对同一表的 `ScopeData.GameDataXxx.*.Data` 做静态补丁。
- `src/DataGenerated/**` 是编辑器根据源数据生成的投影代码，只用于查 Link、确认 `ScopeData.*` 名称和查看生成结果；它不是主要维护入口，也不是推荐仿写模式。
- 读取 `ScopeData.GameDataXxx.*.Data` 并消费其中数据是正常用法；但不要把对 `.Data` 的字段回写、集合清空/追加，当成静态配置手段。
- 如果项目已生成 `.cursor/rules/project-data-ownership.mdc`，处理 GameData 相关任务时优先阅读它，先判断当前表是 `editor/data` 路线还是代码定义路线，再开始修改。

## API 查阅与构建产物

- 查签名与用法以 `docs/api/`、`docs/sdk/` 为准
- `src/bin/`、`src/obj/` 下的 XML 等为编译产物，噪音大、易与 `GSC` / `GameCore.ScopeData` 混淆，**不要作为主要 API 依据**；需要时用 `docs/api/` 中的简化声明

## 序列化（System.Text.Json）

- 需要 JSON 序列化的数据（如服务器/客户端间传递）不要用多维数组 `[,]`，用一维数组
- 避免复杂嵌套泛型和循环引用
- 优先使用简单类型（string、int、float、bool）

## 命名规范

- 注释使用中文
- PascalCase：类型、公共成员；camelCase：私有字段、局部变量
- 接口前缀 `I`，异步方法后缀 `Async`
- 4 空格缩进，Allman 花括号风格
