# Implementation Plan: iApp 到 WasiCore 迁移

## 概述

本实施计划将《纪元修仙》游戏从 iApp 框架（裕语言 V5 + Java）迁移到 WasiCore 框架（C# / .NET 9.0）。
项目包含约 150 个文件（40+ 管理器类 `.myu`、60+ UI 界面 `.iyu`），采用分阶段增量迁移策略，确保每个阶段都可编译验证。

## 任务列表

- [x] 1. 准备阶段：建立迁移基础设施
  - [x] 1.1 扫描并分类所有 iApp 源文件（`.myu` 和 `.iyu`）
    - 统计管理器类数量（`.myu` 文件）
    - 统计 UI 布局数量（`.iyu` 文件）
    - 生成文件清单和分类报告
    - _需求: 1.1, 1.2_
  - [x] 1.2 学习参考项目布局系统
    - 研究 `D:\download\game_djbtz-master\scripts` 的 Flexbox 布局
    - 对比 Lua Flexbox 与 WasiCore 流式布局 API
    - 提取可复用布局模式（网格、列表、表单、滚动）
    - 创建布局转换速查表
    - _参考: design.md「参考示例：Lua 项目的流式布局」_
  - [x] 1.3 构建依赖关系图
    - 分析管理器之间的引用关系
    - 识别核心模块（Database、GameModuleManager、RoleDataManager）
    - 识别边缘模块（可独立迁移的系统）
    - 执行拓扑排序确定迁移顺序
    - _需求: 1.3, 1.4, 1.5, 7.1, 7.2_
  - [x] 1.4 设置 WasiCore 项目基础结构
    - 验证 SDK 路径和编译环境
    - 创建基础项目框架（`src/`、`editor/data/`、`editor/trigger/`）
    - 配置 `.gitignore` 和版本控制
    - 运行初始编译验证
    - _需求: 1.1_
  - [x] 1.5 创建转换工具原型
    - 裕语言词法分析器（`sy, s, ff, qj ff, rg, xh, fh, shi, fou`）
    - C# 代码生成器（IGameClass 模板、条件编译）
    - Android XML -> WasiCore 流式布局转换器
    - 数据模型提取器（识别配置数据）
    - _需求: 1.4, 2.1-2.9, 4.1-4.14_

- [x] 2. 核心系统迁移：转换基础管理器类
  - [x] 2.1 迁移 `Database.myu` 到 CloudData 封装类
    - 创建 `CloudDataWrapper.cs` 封装 CloudData API
    - 实现 `Set/Get/Delete` 方法映射
    - 添加 `#if SERVER` 条件编译
    - 使用 `User.UserId` 作为用户标识符
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 11.5_
  - [ ]* 2.2 为 CloudData 封装类编写属性测试
    - **属性 6: Database API 映射正确性**
    - **验证需求: 5.1, 5.2, 5.3, 5.5**
  - [x] 2.3 迁移 `GameModuleManager.myu` 到模块注册系统
    - 转换为 IGameClass 实现
    - 创建 `OnRegisterGameClass()` 静态方法
    - 订阅 `Game.OnGameTriggerInitialization` 事件
    - 检查 `Game.GameModeLink` 条件
    - _需求: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 2.4 为 IGameClass 结构编写属性测试
    - **属性 3: IGameClass 结构完整性**
    - **验证需求: 3.1, 3.2, 3.3, 3.4**
  - [x] 2.5 迁移 `RoleDataManager.myu` 到玩家数据管理
    - 转换裕语言语法到 C#
    - 实现静态类方法
    - 添加服务端条件编译
    - _需求: 2.1-2.9_
  - [ ]* 2.6 为裕语言转换编写属性测试
    - **属性 2: 裕语言关键字转换一致性**
    - **验证需求: 2.1-2.9**
  - [x] 2.7 迁移 `FormatUtil.myu` 工具类
    - 转换工具函数为 C# 静态方法
    - 移除不兼容 Java API
    - 添加 XML 文档注释
    - _需求: 2.1-2.9, 19.1, 19.2_

- [x] 3. 检查点 - 核心系统编译验证
  - [x] 编译客户端配置（Client-Debug）
  - 编译服务端配置（Server-Debug）
  - 确保所有核心管理器编译成功
  - [x] 询问用户是否有问题

- [x] 4. 战斗系统迁移
  - [x] 4.1 迁移 `BattleManager.myu`
    - 转换战斗逻辑为 C# IGameClass
    - 实现服务端战斗计算
    - 添加 `#if SERVER` 条件编译
    - _需求: 3.1-3.6, 11.1_
  - [ ]* 4.2 为战斗管理器编写单元测试
    - 测试战斗初始化逻辑
    - 测试回合计算
    - 测试伤害计算
    - _需求: 18.1, 18.3_
  - [x] 4.3 迁移 `BattleReportManager.myu`
    - 转换战报生成逻辑
    - 实现服务端战报记录
    - _需求: 3.1-3.6_
  - [x] 4.4 迁移 `FormationManager.myu`
    - 转换阵型管理逻辑
    - 实现阵型配置系统
    - _需求: 3.1-3.6_

- [x] 5. 背包与物品系统迁移
  - [x] 5.1 迁移 `BagManager.myu`
    - 转换背包管理逻辑
    - 实现物品增删改查
    - 使用 CloudData 存储背包数据
    - _需求: 3.1-3.6, 5.1-5.5_
  - [ ]* 5.2 为背包系统编写属性测试
    - **属性 6: Database API 映射正确性**
    - 测试物品添加/删除的数据一致性
    - _需求: 5.1-5.5_
  - [x] 5.3 创建物品数据 GameData 定义
    - 在 `editor/data/` 创建 `ItemData.json`
    - 定义物品属性（名称、品质、效果）
    - 创建对应 JSON Schema
    - _需求: 6.1-6.4_
  - [ ]* 5.4 验证物品数据 JSON Schema
    - **属性 10: GameData JSON 结构正确性**
    - **验证需求: 6.3, 6.4, 6.5**

- [x] 6. 修炼系统迁移
  - [x] 6.1 迁移 `BreakthroughManager.myu`
    - 转换突破逻辑
    - 实现境界提升系统
    - _需求: 3.1-3.6_
  - [x] 6.2 迁移 `RealmConfig.myu` 到 GameData
    - 创建 `RealmConfig.json` 定义境界配置
    - 包含境界名称、等级要求、属性加成
    - _需求: 6.1-6.5_
  - [x] 6.3 迁移 `TribulationManager.myu`
    - 转换渡劫逻辑
    - 实现天劫系统
    - _需求: 3.1-3.6_

- [x] 7. 宗门系统迁移
  - [x] 7.1 迁移 `SectManager.myu`
    - 转换宗门管理逻辑
    - 实现宗门创建/加入/退出
    - 使用 CloudData 存储宗门数据
    - _需求: 3.1-3.6, 5.1-5.5_
  - [x] 7.2 迁移 `SectBuildingManager.myu`
    - 转换宗门建筑管理
    - 实现建筑升级系统
    - _需求: 3.1-3.6_
  - [x] 7.3 迁移 `SectTechManager.myu`
    - 转换宗门科技管理
    - 实现科技研发系统
    - _需求: 3.1-3.6_

- [x] 8. 其他游戏系统迁移
  - [x] 8.1 迁移 `AlchemyManager.myu`（炼丹系统）
  - [x] 8.2 迁移 `AdventureManager.myu`（历险系统）
  - [x] 8.3 迁移 `CaveManager.myu`（洞府系统）
  - [x] 8.4 迁移 `BossManager.myu`（Boss 系统）
  - [x] 8.5 迁移 `ArtifactManager.myu`（法宝系统）
  - [x] 8.6 迁移 `CheckinManager.myu`（签到系统）
  - [x] 8.7 迁移 `ChatManager.myu`（聊天系统）
  - [x] 8.8 迁移 `CDKManager.myu`（兑换码系统）
  - [x] 8.9 迁移 `EraTimeManager.myu`（纪元时间系统）
  - [x] 8.10 迁移 `BackgroundIdleManager.myu`（挂机系统）

- [x] 9. 检查点 - 游戏系统编译验证
  - 编译客户端和服务端配置
  - 验证所有游戏系统编译成功
  - 运行单元测试
  - [x] 询问用户是否有问题

- [x] 10. 主界面 UI 迁移（流式布局 + Lua 参考）
  - [x] 10.1 迁移 `main.iyu`（主入口界面）
    - 参考 Lua 项目 `ui_gm.lua` 布局模式
    - 转换 XML 布局为 `Panel + 流式布局` 代码
    - 使用 `.FlowVertical()` 链式 API
    - 定义设计分辨率常量（1080x1920，6:9 竖屏）
    - 添加 `#if CLIENT` 条件编译
    - _需求: 4.1-4.14, 11.2_
  - [x]* 10.2 为 UI 布局转换编写属性测试
    - **属性 4: Android 控件映射正确性**
    - **属性 5: UI 父子关系保持**
    - **验证需求: 4.1, 4.4-4.8, 4.11-4.14**
  - [x] 10.3 迁移 `login.iyu`（登录界面）
    - 参考 Lua 表单布局（输入框 + 按钮行）
    - 转换为流式布局
    - 使用 `.FlowVertical()` 垂直堆叠输入项
    - 实现登录按钮事件处理（`.OnClick()`）
    - 适配竖屏居中布局
    - _需求: 4.1-4.14_
  - [x] 10.4 迁移 `game_main.iyu`（游戏主界面）
    - 参考 Lua 分区卡片布局（`createSection` 模式）
    - 转换为流式布局
    - 实现导航菜单（`.FlowVertical()` 或 `.FlowHorizontal()`）
    - 使用 `.Padding()` 保持安全区域
    - 适配 16:9 与 20:9 竖屏比例
    - _需求: 4.1-4.14_

- [x] 11. 功能界面 UI 迁移（流式布局 + 竖屏适配）
  - [x] 11.1 迁移 `ui_battle.iyu`（战斗界面）
  - [x] 11.2 迁移 `ui_bag.iyu`（背包界面）
  - [x] 11.3 迁移 `ui_sect.iyu`（宗门界面）
  - [x] 11.4 迁移 `ui_alchemy.iyu`（炼丹界面）
  - [x] 11.5 迁移其他功能界面（20+）

- [x] 12. 列表项模板 UI 迁移
  - [x] 12.1 迁移 `item_bag.iyu`
  - [x] 12.2 迁移 `item_battle_unit.iyu`
  - [x] 12.3 迁移 `item_sect_member.iyu`
  - [x] 12.4 迁移其他列表项模板（20+）

- [x] 13. 弹窗界面 UI 迁移
  - [x] 13.1 迁移 `popup_window.iyu`（通用弹窗）
  - [x] 13.2 迁移 `popup_game.iyu`（游戏弹窗）
  - [x] 13.3 迁移 `dialog_loading.iyu`（加载对话框）

- [x] 14. 检查点 - UI 系统编译验证
  - [x] 编译客户端配置
  - [x] 验证所有 UI 正确渲染
  - [x] 测试布局响应式
  - [x] 询问用户是否有问题

- [x] 15. WebAssembly 兼容性处理
  - [x] 15.1 移除 `Task.Run()` 调用
  - [ ]* 15.2 为 WebAssembly 兼容性编写属性测试
  - [x] 15.3 替换 `Task.Delay()` 为 `Game.Delay()`
  - [x] 15.4 移除 Thread API 使用
  - [x] 15.5 替换 `Console.WriteLine()` 为 `Game.Logger`

- [x] 16. 安全特性移除
  - [x] 16.1 移除 Root 检测代码
  - [x] 16.2 移除模拟器检测代码
  - [x] 16.3 移除 Hook 检测代码
  - [x] 16.4 移除 SSL 双向认证代码
  - [ ]* 16.5 为安全特性移除编写属性测试

- [x] 17. 代码质量优化
  - [x] 17.1 应用 C# 命名规范
  - [ ]* 17.2 为命名规范编写属性测试
  - [x] 17.3 统一代码格式
  - [ ]* 17.4 为代码格式编写属性测试
  - [x] 17.5 添加 XML 文档注释

- [x] 18. 依赖关系处理与验证
  - [x] 18.1 构建完整依赖关系图
  - [ ]* 18.2 为依赖顺序编写属性测试
  - [x] 18.3 检测并报告循环依赖

- [x] 19. 最终编译与测试
  - [x] 19.1 完整编译验证
  - [x] 19.2 运行所有单元测试
  - [x] 19.3 运行所有属性测试
  - [x] 19.4 端到端功能测试

- [x] 20. 生成迁移报告
  - [x] 20.1 统计迁移数据
  - [x] 20.2 收集警告和错误
  - [x] 20.3 生成迁移报告文档
  - [ ]* 20.4 为迁移报告编写属性测试

- [x] 21. 最终检查点 - 迁移完成验证
  - 确认所有任务完成
  - 确认所有测试通过
  - 确认编译成功
  - 询问用户是否有其他问题或需要调整

## 注意事项

- 标记 `*` 的任务为可选任务，可在 MVP 阶段跳过。
- 每个任务都引用了需求编号，便于追溯。
- 检查点任务用于确保增量验证。
- 属性测试用于验证通用正确性属性。
- 单元测试用于验证具体示例和边缘情况。
- 所有代码必须符合 WasiCore 框架规范与 WebAssembly 约束。

## 关键约束

### API 调用规范

**所有 WasiCore API 调用必须参考官方文档：**

- 客户端 API：`docs/api/client/`
- 服务端 API：`docs/api/server/`
- 系统文档：`docs/sdk/systems/`
- AI 指南：`docs/sdk/ai/`

**禁止行为：**
- 不要凭猜测或记忆调用 API。
- 不要使用未在文档定义的 API。
- 不要混用客户端和服务端 API。

### 增量构建验证

每完成一个大任务（1-21）后，必须运行：

```powershell
# 服务端
$output = & "D:\360downloads\星火编辑器\Update\editor-alpha.spark.xd.com\Res\_m\wasm\dotnet_sdk_lite\2\dotnet_sdk_lite\dotnet.exe" build src/GameEntry.csproj -c Server-Debug 2>&1
$output | Select-String -Pattern "成功|失败" | Select-Object -Last 1

# 客户端
$output = & "D:\360downloads\星火编辑器\Update\editor-alpha.spark.xd.com\Res\_m\wasm\dotnet_sdk_lite\2\dotnet_sdk_lite\dotnet.exe" build src/GameEntry.csproj -c Client-Debug 2>&1
$output | Select-String -Pattern "成功|失败" | Select-Object -Last 1
```

**构建要求：**
- Server-Debug 成功
- Client-Debug 成功
- 无编译错误（允许警告，但需记录）
- 构建失败必须修复后再继续

检查点任务（3、9、14、21）除构建外，还要等待用户确认。

## 迁移策略

采用增量迁移策略：
1. 核心优先：先迁移 Database、GameModuleManager。
2. 依赖顺序：按拓扑顺序迁移管理器。
3. 分层验证：每个阶段做编译验证。
4. 测试驱动：属性测试 + 单元测试保障正确性。
5. 文档完整：补充注释与文档便于维护。

## 预计时间

- 准备阶段：1-2 周
- 核心系统迁移：3-4 周
- 游戏系统迁移：4-6 周
- UI 系统迁移：3-4 周
- 优化与测试：2-3 周
- **总计：约 5-7 个月**




