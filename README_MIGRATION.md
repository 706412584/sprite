# iApp 到 WasiCore 迁移项目

## 项目概述

本项目旨在将"纪元修仙"游戏从 iApp 框架（裕语言 V5 + Java + Android）迁移到 WasiCore 框架（C# / .NET 9.0 + WebAssembly）。

### 规模

- **管理器类**: 55 个 (.myu 文件)
- **UI 布局**: 96 个 (.iyu 文件)
- **总文件数**: 151 个
- **预计工作量**: 5-7 个月（2-3人团队）

## 快速开始

### 查看文档

1. **[迁移状态](MIGRATION_STATUS.md)** - 当前进度和已完成工作
2. **[迁移报告](MIGRATION_REPORT.md)** - 详细的技术分析和统计
3. **[迁移指南](MIGRATION_GUIDE.md)** - 语法转换规则和最佳实践
4. **[任务列表](.kiro/specs/iapp-to-wasicore-migration/tasks.md)** - 完整的实施计划

### 已创建的代码

```
src/
  Database/
    CloudDataWrapper.cs          # CloudData API 封装
  Managers/
    RoleDataManager.cs           # 角色数据管理示例
tools/
  YuLanguageConverter.cs         # 裕语言转换工具
```

### 编译项目

```powershell
# 服务端
dotnet build src/GameEntry.csproj -c Server-Debug

# 客户端
dotnet build src/GameEntry.csproj -c Client-Debug
```

## 核心概念

### 语法转换

| iApp (裕语言) | WasiCore (C#) |
|---------------|---------------|
| `sy` | `private static` |
| `ff` | `public` |
| `qj ff` | `public static` |
| `rg` | `if` |
| `fh` | `return` |

### 架构转换

**iApp 单例** → **WasiCore IGameClass**

```csharp
public class Manager : IGameClass
{
    public static void OnRegisterGameClass()
    {
        Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    }
    
    private static void OnGameTriggerInitialization()
    {
        if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
        // 初始化
    }
}
```

### 数据存储

**iApp Database** → **WasiCore CloudData**

```csharp
#if SERVER
// 保存
await CloudDataWrapper.SaveDataAsync("分类", "键", 值);

// 读取
var data = await CloudDataWrapper.LoadDataAsync<T>("分类", "键");
#endif
```

## 项目结构

```
.
├── com.Smliegame.jyxx/          # iApp 源代码
│   └── src/                     # 55个.myu + 96个.iyu
├── src/                         # WasiCore 目标代码
│   ├── Database/                # 数据存储封装
│   └── Managers/                # 管理器类
├── tools/                       # 转换工具
├── .kiro/specs/                 # 迁移规范
│   └── iapp-to-wasicore-migration/
│       ├── requirements.md      # 需求文档
│       ├── design.md            # 设计文档
│       └── tasks.md             # 任务列表
├── MIGRATION_STATUS.md          # 当前状态
├── MIGRATION_REPORT.md          # 详细报告
└── MIGRATION_GUIDE.md           # 迁移指南
```

## 迁移阶段

### ✅ 阶段 1: 准备（部分完成）

- [x] 文件扫描和分类
- [x] 基础设施创建
- [x] 转换工具原型
- [ ] 依赖关系分析

### ⏳ 阶段 2: 核心系统（进行中）

- [x] Database → CloudDataWrapper
- [x] RoleDataManager 示例
- [ ] GameModuleManager
- [ ] BattleManager
- [ ] 其他核心管理器

### ⏳ 阶段 3-8: 游戏系统（未开始）

- [ ] 战斗系统
- [ ] 背包系统
- [ ] 修炼系统
- [ ] 宗门系统
- [ ] 其他游戏系统

### ⏳ 阶段 9-14: UI 系统（未开始）

- [ ] 主界面
- [ ] 功能界面
- [ ] 列表项模板
- [ ] 弹窗界面

### ⏳ 阶段 15-21: 优化和测试（未开始）

- [ ] WebAssembly 兼容性
- [ ] 安全特性移除
- [ ] 代码质量优化
- [ ] 最终测试

## 关键技术

### WebAssembly 约束

```csharp
// ❌ 禁止
Task.Run(() => Work());
Task.Delay(1000);
Console.WriteLine("log");
Thread.Sleep(1000);

// ✅ 正确
await WorkAsync();
await Game.Delay(1000);
Game.Logger.LogInformation("log");
await Game.Delay(1000);
```

### 条件编译

```csharp
#if SERVER
// 服务端：游戏逻辑、数据存储
#endif

#if CLIENT
// 客户端：UI渲染、输入处理
#endif
```

### UI 流式布局

```csharp
#if CLIENT
var panel = new Panel()
    .FullScreen()
    .FlowVertical()
    .Padding(20);

var text = new TextBlock()
    .Text("标题")
    .FontSize(18);
text.Parent = panel;

panel.AddToVisualTree();
#endif
```

## 工具使用

### 裕语言转换器

```csharp
using MigrationTools;

// 转换裕语言代码
string csharpCode = YuLanguageConverter.Convert(yuCode);

// 生成 IGameClass 模板
string template = YuLanguageConverter.GenerateIGameClassTemplate(
    "ManagerName", 
    yuCode
);
```

## 风险评估

### 🔴 高风险

- Java 代码块转换（1600+ 行）
- UI 布局复杂性（96 个文件）
- 依赖关系复杂（55 个管理器）

### 🟡 中风险

- 数据结构差异
- 安全特性移除
- 性能优化

### 🟢 低风险

- 基础语法转换
- 日志系统转换
- 条件编译

## 团队建议

### 人员配置

- **2-3 名全职开发人员**
- 熟悉 C# 和 .NET
- 了解游戏开发
- 学习 WasiCore 框架

### 时间规划

- **准备阶段**: 2 周
- **核心系统**: 4 周
- **游戏系统**: 10 周
- **UI 系统**: 8 周
- **优化测试**: 6 周
- **总计**: 30 周（约 7 个月）

### 质量保证

- 每日编译验证
- 代码审查制度
- 单元测试覆盖
- 端到端测试

## 获取帮助

### 文档资源

- [WasiCore SDK 文档](docs/sdk/)
- [API 参考（服务端）](docs/api/server/)
- [API 参考（客户端）](docs/api/client/)

### 常见问题

查看 [迁移指南](MIGRATION_GUIDE.md) 的"常见问题"部分。

### 技术支持

1. 查看 SDK 文档
2. 检查编译日志
3. 查看运行时日志
4. 参考示例代码

## 贡献指南

### 代码规范

- 使用 PascalCase 命名类型和公共成员
- 使用 camelCase 命名私有字段
- 异步方法添加 Async 后缀
- 添加 XML 文档注释

### 提交规范

- 每个管理器一个提交
- 清晰的提交信息
- 包含测试验证

### 审查流程

1. 自测编译通过
2. 代码审查
3. 集成测试
4. 合并主分支

## 许可证

本迁移项目遵循原游戏项目的许可证。

## 联系方式

- 项目负责人: [待定]
- 技术支持: [待定]
- 问题反馈: [待定]

---

**项目状态**: 准备阶段部分完成  
**完成度**: 约 3% (5/151 文件)  
**最后更新**: 2025-01-XX
