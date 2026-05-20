# iApp 到 WasiCore 迁移指南

## 概述

本指南提供从 iApp 框架迁移到 WasiCore 框架的详细步骤和最佳实践。

## 快速开始

### 1. 环境准备

确保已安装：
- 星火编辑器 2.0 (alpha版本)
- .NET 9.0 SDK
- 项目已正确配置 WasiCore SDK 路径

### 2. 编译验证

```powershell
# 编译服务端
dotnet build src/GameEntry.csproj -c Server-Debug

# 编译客户端
dotnet build src/GameEntry.csproj -c Client-Debug
```

## 语法转换规则

### 裕语言 → C# 关键字映射

| 裕语言 | C# | 说明 |
|--------|-----|------|
| `sy` | `private static` | 静态私有变量 |
| `s` | `var` | 局部变量 |
| `ff` | `public` | 公共方法 |
| `qj ff` | `public static` | 公共静态方法 |
| `rg` | `if` | 条件判断 |
| `xh` | `for` | 循环 |
| `fh` | `return` | 返回 |
| `shi` | `true` | 布尔真 |
| `fou` | `false` | 布尔假 |

### 示例转换

**iApp (裕语言)**:
```java
sy int 当前回合 = 0
sy boolean 战斗进行中 = false

qj ff BattleManager getInstance() {
    java {
        return getInstances();
    }
}

ff boolean 开始战斗(string 敌人配置JSON) {
    当前回合 = 0
    战斗进行中 = true
    
    rg 初始化战斗(敌人配置JSON) {
        fh shi
    }
    fh fou
}
```

**WasiCore (C#)**:
```csharp
private static int currentRound = 0;
private static bool battleInProgress = false;

public static BattleManager GetInstance()
{
    // 转换为静态类，不需要单例
    return null;
}

public static bool StartBattle(string enemyConfigJson)
{
    currentRound = 0;
    battleInProgress = true;
    
    if (InitializeBattle(enemyConfigJson))
    {
        return true;
    }
    return false;
}
```

## 架构转换

### 1. 管理器类转换

**iApp 单例模式** → **WasiCore IGameClass**

```csharp
using GameCore;
using GameCore.BaseInterface;

public class YourManager : IGameClass
{
    public static void OnRegisterGameClass()
    {
        Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    }
    
    private static void OnGameTriggerInitialization()
    {
        // 检查游戏模式
        if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
        
        // 初始化逻辑
        Initialize();
    }
    
    private static void Initialize()
    {
        Game.Logger.LogInformation("YourManager 初始化完成");
    }
}
```

### 2. 数据存储转换

**iApp Database API** → **WasiCore CloudData API**

```csharp
#if SERVER
// 保存数据
await CloudDataWrapper.SaveDataAsync("基础属性", "等级", 99);

// 读取数据
int level = await CloudDataWrapper.LoadDataAsync<int>("基础属性", "等级");

// 删除数据
await CloudDataWrapper.DeleteDataAsync("基础属性", "等级");
#endif
```

**重要**: 
- 只能在服务端访问云数据
- 使用 `User.UserId` (long) 而不是 `Player.Id` (int)
- 所有云数据操作都是异步的

### 3. UI 布局转换

**Android XML** → **WasiCore 流式布局**

**iApp (Android XML)**:
```xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    
    <TextView
        android:id="@+id/tv_title"
        android:text="标题"
        android:textSize="18sp"/>
    
    <Button
        android:id="@+id/btn_action"
        android:text="按钮"/>
</LinearLayout>
```

**WasiCore (C# 流式布局)**:
```csharp
#if CLIENT
using GameCore.UI;

public class YourUI : IGameClass
{
    private static Panel rootPanel;
    
    public static void OnRegisterGameClass()
    {
        Game.OnGameStart += OnGameStart;
    }
    
    private static void OnGameStart()
    {
        InitializeUI();
    }
    
    private static void InitializeUI()
    {
        // 根容器 - 垂直流式布局
        rootPanel = new Panel()
            .FullScreen()
            .FlowVertical()
            .Padding(20);
        
        // 标题文本
        var titleText = new TextBlock()
            .Text("标题")
            .FontSize(18)
            .TextColor(Color.White);
        titleText.Parent = rootPanel;
        
        // 按钮
        var actionButton = new Button()
            .Text("按钮")
            .Size(200, 50)
            .OnClick(OnActionClicked);
        actionButton.Parent = rootPanel;
        
        rootPanel.AddToVisualTree();
    }
    
    private static void OnActionClicked()
    {
        Game.Logger.LogInformation("按钮被点击");
    }
}
#endif
```

**关键点**:
- 使用 `.FlowVertical()` 自动垂直堆叠
- 使用链式 API (`.Text()`, `.FontSize()`, `.OnClick()`)
- 子控件通过 `child.Parent = parent` 设置父子关系
- 所有UI代码用 `#if CLIENT` 包裹

## 条件编译

### 客户端/服务端分离

```csharp
#if SERVER
// 服务端代码 - 游戏逻辑、数据存储
public static async Task ProcessGameLogic()
{
    // 访问云数据
    await CloudData.Set(User.UserId, "key", value);
    
    // 创建 Entity/Unit
    var unit = Unit.Create(...);
}
#endif

#if CLIENT
// 客户端代码 - UI渲染、输入处理
public static void RenderUI()
{
    // 创建 UI 控件
    var panel = new Panel();
    
    // 创建 Actor（视觉效果）
    var actor = Actor.Create(...);
}
#endif
```

## WebAssembly 约束

### 禁止的 API

```csharp
// ❌ 错误 - 不要使用
Task.Run(() => DoWork());           // 无线程池
Task.Delay(1000);                   // 使用 Game.Delay()
Console.WriteLine("log");           // 使用 Game.Logger
Thread.Sleep(1000);                 // 不支持线程
int[,] array = new int[2,3];       // JSON序列化时禁止多维数组

// ✅ 正确 - 应该使用
await DoWorkAsync();                // 直接 await
await Game.Delay(1000);            // WasiCore 延迟
Game.Logger.LogInformation("log"); // 参数化日志
await Game.Delay(1000);            // 异步延迟
int[] array = new int[6];          // 一维数组
```

### 日志系统

```csharp
// ❌ 错误 - 字符串插值
Game.Logger.LogInformation($"Player {playerId} joined");

// ✅ 正确 - 参数化模板
Game.Logger.LogInformation("Player {PlayerId} joined", playerId);
```

## 常见模式

### 1. 异步数据加载

```csharp
#if SERVER
public static async Task<PlayerData> LoadPlayerDataAsync()
{
    var name = await CloudDataWrapper.LoadDataAsync<string>("基础属性", "姓名");
    var level = await CloudDataWrapper.LoadDataAsync<int>("基础属性", "等级");
    var gold = await CloudDataWrapper.LoadDataAsync<long>("基础属性", "灵石");
    
    return new PlayerData
    {
        Name = name ?? "无名剑仙",
        Level = level > 0 ? level : 1,
        Gold = gold
    };
}
#endif
```

### 2. 事件订阅

```csharp
public static void OnRegisterGameClass()
{
    Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
}

private static void OnGameTriggerInitialization()
{
    if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
    
    // 订阅游戏事件
    Game.OnGameStart += OnGameStart;
    
    #if SERVER
    // 服务端事件
    #endif
    
    #if CLIENT
    // 客户端事件
    #endif
}
```

### 3. UI 响应式布局

```csharp
#if CLIENT
// 设计分辨率（竖屏 16:9）
private const float DesignWidth = 1080f;
private const float DesignHeight = 1920f;

private static void CreateResponsiveUI()
{
    var rootPanel = new Panel()
        .FullScreen()
        .FlowVertical();
    
    // 顶部固定区域
    var header = new Panel()
        .Size(DesignWidth, 100)
        .FlowHorizontal();
    header.Parent = rootPanel;
    
    // 中间可滚动区域（自动填充）
    var scrollViewer = new ScrollViewer()
        .HeightGrow(1)
        .WidthGrow(1);
    scrollViewer.Parent = rootPanel;
    
    // 底部固定区域
    var footer = new Panel()
        .Size(DesignWidth, 80)
        .FlowHorizontal();
    footer.Parent = rootPanel;
    
    rootPanel.AddToVisualTree();
}
#endif
```

## 调试技巧

### 1. 查看运行时日志

```powershell
# 服务端日志
Get-Content "D:\360downloads\星火编辑器\logs\server\wasm-game-server-*.log" -Tail 50

# 客户端日志
Get-Content "D:\360downloads\星火编辑器\logs\client\wasm-default-*.log-*.log" -Tail 50
```

### 2. 编译错误诊断

```powershell
# 完整编译输出
dotnet build src/GameEntry.csproj -c Server-Debug

# 仅显示错误
dotnet build src/GameEntry.csproj -c Server-Debug 2>&1 | Select-String "error"
```

### 3. 使用 getDiagnostics

在 Kiro 中使用 `getDiagnostics` 工具检查文件的编译错误，而不是运行 bash 命令。

## 最佳实践

### 1. 命名规范

```csharp
// 类型、公共成员: PascalCase
public class PlayerManager { }
public static void SaveData() { }

// 私有字段: camelCase
private static int playerLevel;

// 异步方法: Async 后缀
public static async Task LoadDataAsync() { }

// 接口: I 前缀
public interface IGameManager { }
```

### 2. 错误处理

```csharp
#if SERVER
public static async Task<bool> SavePlayerDataAsync(PlayerData data)
{
    try
    {
        await CloudDataWrapper.SaveDataAsync("基础属性", "姓名", data.Name);
        await CloudDataWrapper.SaveDataAsync("基础属性", "等级", data.Level);
        
        Game.Logger.LogInformation("玩家数据保存成功");
        return true;
    }
    catch (Exception ex)
    {
        Game.Logger.LogError("玩家数据保存失败: {Error}", ex.Message);
        return false;
    }
}
#endif
```

### 3. 代码组织

```
src/
  Database/
    CloudDataWrapper.cs      # 数据存储封装
  Managers/
    RoleDataManager.cs       # 角色数据管理
    BattleManager.cs         # 战斗管理
    BagManager.cs            # 背包管理
  UI/
    LoginUI.cs               # 登录界面
    MainUI.cs                # 主界面
    BattleUI.cs              # 战斗界面
  Models/
    PlayerData.cs            # 数据模型
```

## 常见问题

### Q: 如何处理 Java 代码块？

A: Java 代码块需要手动审查和转换：
1. 识别 Android API 调用
2. 查找 WasiCore 等价 API
3. 如果没有等价 API，考虑移除或重新设计

### Q: 如何处理循环依赖？

A: 
1. 使用依赖注入
2. 提取公共接口
3. 重构为事件驱动架构

### Q: UI 布局转换太复杂怎么办？

A: 
1. 先转换简单界面作为模板
2. 使用流式布局简化代码
3. 考虑使用 UI 组件库

### Q: 如何测试迁移后的代码？

A: 
1. 单元测试：测试单个管理器的功能
2. 集成测试：测试管理器之间的交互
3. 端到端测试：测试完整的游戏流程

## 参考资源

- [WasiCore SDK 文档](docs/sdk/)
- [API 参考（服务端）](docs/api/server/)
- [API 参考（客户端）](docs/api/client/)
- [迁移报告](MIGRATION_REPORT.md)
- [任务列表](.kiro/specs/iapp-to-wasicore-migration/tasks.md)

## 获取帮助

如果遇到问题：
1. 查看 SDK 文档
2. 检查编译日志
3. 查看运行时日志
4. 参考示例代码

---

*本指南持续更新中*
