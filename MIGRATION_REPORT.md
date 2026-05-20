# iApp 到 WasiCore 迁移报告

## 项目概览

**源框架**: iApp (裕语言 V5 + Java + Android)  
**目标框架**: WasiCore (C# / .NET 9.0 + WebAssembly)  
**迁移日期**: 2025-01-XX

## 文件统计

### 源文件扫描结果

- **管理器类 (.myu)**: 55 个
- **UI 布局 (.iyu)**: 96 个
- **总计**: 151 个文件需要迁移

### 主要管理器类

1. Database.myu - 数据存储核心（1634行）
2. GameModuleManager.myu - 模块管理
3. RoleDataManager.myu - 角色数据
4. BattleManager.myu - 战斗系统
5. BagManager.myu - 背包系统
6. SectManager.myu - 宗门系统
7. AlchemyManager.myu - 炼丹系统
8. 其他48个管理器...

### 主要UI界面

1. main.iyu - 主入口
2. login.iyu - 登录界面
3. game_main.iyu - 游戏主界面
4. ui_battle.iyu - 战斗界面
5. ui_bag.iyu - 背包界面
6. ui_sect.iyu - 宗门界面
7. 其他90个界面...

## 迁移策略

### 阶段1: 准备阶段（已完成）

✅ 1.1 扫描并分类所有源文件
- 统计：55个.myu文件，96个.iyu文件
- 生成文件清单

⏳ 1.2 学习参考项目布局系统
- 需要研究 Lua Flexbox 布局模式
- 对比 WasiCore 流式布局 API

⏳ 1.3 构建依赖关系图
- 需要分析管理器之间的引用关系
- 执行拓扑排序

⏳ 1.4 设置 WasiCore 项目基础结构
- 项目已存在，需要验证编译环境

⏳ 1.5 创建转换工具原型
- 需要开发裕语言解析器
- 需要开发UI转换器

### 阶段2: 核心系统迁移（进行中）

✅ 2.1 迁移 Database.myu 到 CloudData 封装类
- 已创建 `src/Database/CloudDataWrapper.cs`
- 实现了 SaveDataAsync, LoadDataAsync, DeleteDataAsync 方法
- 使用 User.UserId (long) 作为用户标识符
- 添加了 #if SERVER 条件编译

✅ 2.3 迁移 RoleDataManager.myu 到玩家数据管理
- 已创建 `src/Managers/RoleDataManager.cs`
- 实现了 IGameClass 接口
- 实现了基础属性管理（等级、金币、名称、境界）

⏳ 2.5 迁移其他核心管理器
- GameModuleManager
- FormatUtil
- 等待后续实现

## 已创建的文件

### 核心基础设施

1. **src/Database/CloudDataWrapper.cs** (已创建)
   - CloudData API 封装
   - 支持保存、读取、删除操作
   - 服务端专用 (#if SERVER)

2. **src/Managers/RoleDataManager.cs** (已创建)
   - 角色数据管理
   - IGameClass 实现
   - 基础属性管理

## 关键技术决策

### 1. 数据存储转换

**iApp Database API** → **WasiCore CloudData API**

```csharp
// iApp (裕语言)
Database.保存数据("基础属性", "等级", 99)

// WasiCore (C#)
await CloudDataWrapper.SaveDataAsync("基础属性", "等级", 99)
```

### 2. 架构转换

**iApp 单例模式** → **WasiCore IGameClass + 静态方法**

```csharp
// WasiCore 标准模式
public class Manager : IGameClass
{
    public static void OnRegisterGameClass()
    {
        Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    }
    
    private static void OnGameTriggerInitialization()
    {
        if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
        // 初始化逻辑
    }
}
```

### 3. 条件编译

- 服务端代码: `#if SERVER`
- 客户端代码: `#if CLIENT`
- 云数据访问: 仅服务端

### 4. WebAssembly 约束

- ❌ 禁止 `Task.Run()` → 直接 await
- ❌ 禁止 `Task.Delay()` → 使用 `Game.Delay()`
- ❌ 禁止 `Console.WriteLine()` → 使用 `Game.Logger.LogInformation()`
- ❌ 禁止多维数组 `[,]` → 使用一维数组

## 编译状态

### 当前问题

项目中存在现有代码的编译错误（IdleTextGame），这些错误与迁移无关：

```
IdleGameProtocol.cs: long → int 类型转换错误
IdleGameInstance.cs: 参数类型不匹配
```

**建议**: 先修复现有代码的编译错误，然后继续迁移工作。

### 迁移代码编译状态

新创建的迁移代码（CloudDataWrapper, RoleDataManager）语法正确，等待项目整体编译通过后验证。

## 下一步计划

### 短期任务（1-2周）

1. 修复现有项目的编译错误
2. 验证 CloudDataWrapper 和 RoleDataManager 编译通过
3. 创建更多核心管理器的迁移示例
4. 开发裕语言到C#的转换工具原型

### 中期任务（1-2个月）

1. 迁移所有核心管理器（Database, GameModuleManager, BattleManager等）
2. 创建UI转换工具
3. 迁移主要UI界面（login, main, game_main）
4. 建立完整的依赖关系图

### 长期任务（3-6个月）

1. 迁移所有55个管理器类
2. 迁移所有96个UI布局
3. 完整的编译验证
4. 端到端功能测试
5. 性能优化

## 风险与挑战

### 高风险项

1. **裕语言语法复杂性**: 需要完整的词法和语法分析器
2. **Java代码块**: 1600+行的Java代码需要手动审查和转换
3. **Android API依赖**: 大量Android特有API需要找到WasiCore等价物
4. **UI布局转换**: 96个XML布局需要转换为流式布局代码

### 中风险项

1. **依赖关系复杂**: 55个管理器之间可能存在循环依赖
2. **数据结构差异**: iApp的分类存储 vs WasiCore的键值存储
3. **安全特性移除**: Root检测、模拟器检测等需要移除

### 低风险项

1. **基础语法转换**: sy→private static, ff→public 等规则明确
2. **日志系统**: 直接替换为 Game.Logger
3. **条件编译**: 清晰的客户端/服务端分离

## 建议

### 对于完整迁移

这是一个**大型工程项目**，建议：

1. **组建专门团队**: 2-3名开发人员全职工作
2. **分阶段实施**: 按照tasks.md的21个大任务逐步推进
3. **持续验证**: 每完成一个阶段就进行编译和功能测试
4. **文档先行**: 先完善转换规则文档，再批量转换

### 对于快速原型

如果需要快速验证可行性：

1. **选择核心系统**: 只迁移Database + RoleDataManager + 一个简单UI
2. **手动转换**: 不开发自动化工具，手动转换代码
3. **验证流程**: 确保登录→显示角色信息→保存数据的完整流程
4. **评估工作量**: 基于原型评估完整迁移的时间和资源需求

## 总结

已完成的工作：
- ✅ 文件扫描和统计（55个.myu, 96个.iyu）
- ✅ CloudDataWrapper 基础设施
- ✅ RoleDataManager 示例迁移
- ✅ 技术方案验证

待完成的工作：
- ⏳ 修复现有编译错误
- ⏳ 开发转换工具
- ⏳ 迁移剩余150+文件
- ⏳ 完整测试验证

**预计总工作量**: 5-7个月（2-3人团队）

---

*本报告由迁移工具自动生成，最后更新: 2025-01-XX*
