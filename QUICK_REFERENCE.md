# iApp → WasiCore 快速参考

## 语法速查表

### 关键字转换

```
sy              → private static
s               → var
ff              → public
qj ff           → public static
rg              → if
xh              → for
fh              → return
shi             → true
fou             → false
string          → string
int             → int
long            → long
boolean         → bool
Object          → object
```

### 变量声明

```csharp
// iApp
sy int 当前回合 = 0

// WasiCore
private static int currentRound = 0;
```

### 函数声明

```csharp
// iApp
qj ff boolean 开始战斗(string 配置) { }

// WasiCore
public static bool StartBattle(string config) { }
```

### 控制流

```csharp
// iApp
rg 条件 { }
xh 循环 { }
fh 值

// WasiCore
if (condition) { }
for (loop) { }
return value;
```

## 架构模式

### IGameClass 模板

```csharp
using GameCore;
using GameCore.BaseInterface;

public class Manager : IGameClass
{
    public static void OnRegisterGameClass()
    {
        Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    }
    
    private static void OnGameTriggerInitialization()
    {
        if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
        Initialize();
    }
    
    private static void Initialize()
    {
        Game.Logger.LogInformation("Manager 初始化完成");
    }
}
```

## 数据存储

### CloudData 操作

```csharp
#if SERVER
// 保存
await CloudDataWrapper.SaveDataAsync("分类", "键", 值);

// 读取
var data = await CloudDataWrapper.LoadDataAsync<T>("分类", "键");

// 删除
await CloudDataWrapper.DeleteDataAsync("分类", "键");

// 检查存在
bool exists = await CloudDataWrapper.ExistsAsync("分类", "键");
#endif
```

### 常用数据类型

```csharp
// 基础类型
int, long, float, double, bool, string

// 集合类型
List<T>, Dictionary<TKey, TValue>

// 异步类型
Task, Task<T>
```

## UI 布局

### 基础容器

```csharp
#if CLIENT
// 全屏面板
var panel = new Panel()
    .FullScreen()
    .FlowVertical()
    .Padding(20);

// 固定大小面板
var panel = new Panel()
    .Size(1080, 100)
    .FlowHorizontal();

// 自动填充面板
var panel = new Panel()
    .HeightGrow(1)
    .WidthGrow(1);
#endif
```

### 常用控件

```csharp
#if CLIENT
// 文本
var text = new TextBlock()
    .Text("内容")
    .FontSize(18)
    .TextColor(Color.White);

// 按钮
var button = new Button()
    .Text("按钮")
    .Size(200, 50)
    .OnClick(OnClick);

// 输入框
var input = new TextBox()
    .PlaceholderText("提示")
    .Size(300, 40);

// 图片
var image = new Image()
    .Source("path/to/image")
    .Size(100, 100);

// 滚动视图
var scroll = new ScrollViewer()
    .HeightGrow(1)
    .VerticalScrollBarVisibility(ScrollBarVisibility.Auto);
#endif
```

### 父子关系

```csharp
#if CLIENT
// 设置父子关系
child.Parent = parent;

// 添加到视觉树
rootPanel.AddToVisualTree();
#endif
```

## 条件编译

### 客户端/服务端

```csharp
#if SERVER
// 服务端代码
// - 游戏逻辑
// - 数据存储
// - Entity/Unit 创建
#endif

#if CLIENT
// 客户端代码
// - UI 渲染
// - 输入处理
// - Actor 创建
#endif
```

## WebAssembly 约束

### 禁止的 API

```csharp
// ❌ 禁止
Task.Run(() => Work());           // 无线程池
Task.Delay(1000);                 // 使用 Game.Delay()
Console.WriteLine("log");         // 使用 Game.Logger
Thread.Sleep(1000);               // 不支持线程
int[,] array = new int[2,3];     // JSON 序列化禁止多维数组
```

### 正确的 API

```csharp
// ✅ 正确
await WorkAsync();                // 直接 await
await Game.Delay(1000);          // WasiCore 延迟
Game.Logger.LogInformation("log", args); // 参数化日志
await Game.Delay(1000);          // 异步延迟
int[] array = new int[6];        // 一维数组
```

## 日志系统

### 参数化日志

```csharp
// ❌ 错误 - 字符串插值
Game.Logger.LogInformation($"Player {id} joined");

// ✅ 正确 - 参数化模板
Game.Logger.LogInformation("Player {PlayerId} joined", id);
```

### 日志级别

```csharp
Game.Logger.LogDebug("调试信息", args);
Game.Logger.LogInformation("普通信息", args);
Game.Logger.LogWarning("警告信息", args);
Game.Logger.LogError("错误信息", args);
```

## 异步编程

### 异步方法

```csharp
// 声明
public static async Task<T> MethodAsync()
{
    // 实现
    await SomeAsyncOperation();
    return result;
}

// 调用
var result = await MethodAsync();
```

### 延迟操作

```csharp
// 延迟 1 秒
await Game.Delay(1000);

// 延迟后执行
await Game.Delay(1000);
DoSomething();
```

## 事件系统

### 订阅事件

```csharp
public static void OnRegisterGameClass()
{
    // 订阅初始化事件
    Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    
    // 订阅游戏开始事件
    Game.OnGameStart += OnGameStart;
}

private static void OnGameStart()
{
    Game.Logger.LogInformation("游戏开始");
}
```

### 触发器

```csharp
// 使用 Subscribe 创建触发器
var trigger = new Trigger<EventType>()
    .Subscribe(OnEvent);

private static void OnEvent(EventType eventData)
{
    // 处理事件
}
```

## 命名规范

### C# 命名约定

```csharp
// 类型、公共成员: PascalCase
public class PlayerManager { }
public static void SaveData() { }

// 私有字段: camelCase
private static int playerLevel;

// 局部变量: camelCase
var currentLevel = 1;

// 常量: PascalCase
private const int MaxLevel = 100;

// 异步方法: Async 后缀
public static async Task LoadDataAsync() { }

// 接口: I 前缀
public interface IGameManager { }
```

## 常用模式

### 数据加载

```csharp
#if SERVER
public static async Task<PlayerData> LoadPlayerAsync()
{
    var name = await CloudDataWrapper.LoadDataAsync<string>("基础属性", "姓名");
    var level = await CloudDataWrapper.LoadDataAsync<int>("基础属性", "等级");
    
    return new PlayerData
    {
        Name = name ?? "默认名称",
        Level = level > 0 ? level : 1
    };
}
#endif
```

### 数据保存

```csharp
#if SERVER
public static async Task<bool> SavePlayerAsync(PlayerData data)
{
    try
    {
        await CloudDataWrapper.SaveDataAsync("基础属性", "姓名", data.Name);
        await CloudDataWrapper.SaveDataAsync("基础属性", "等级", data.Level);
        return true;
    }
    catch (Exception ex)
    {
        Game.Logger.LogError("保存失败: {Error}", ex.Message);
        return false;
    }
}
#endif
```

### UI 初始化

```csharp
#if CLIENT
private static void InitializeUI()
{
    var root = new Panel()
        .FullScreen()
        .FlowVertical();
    
    var title = new TextBlock()
        .Text("标题")
        .FontSize(24);
    title.Parent = root;
    
    var button = new Button()
        .Text("按钮")
        .OnClick(OnClick);
    button.Parent = root;
    
    root.AddToVisualTree();
}
#endif
```

## 编译命令

### 构建项目

```powershell
# 服务端
dotnet build src/GameEntry.csproj -c Server-Debug

# 客户端
dotnet build src/GameEntry.csproj -c Client-Debug

# 带输出过滤
$output = dotnet build src/GameEntry.csproj -c Server-Debug 2>&1
$output | Select-String -Pattern "成功|失败|error"
```

## 调试技巧

### 查看日志

```powershell
# 服务端日志
Get-Content "D:\360downloads\星火编辑器\logs\server\wasm-game-server-*.log" -Tail 50

# 客户端日志
Get-Content "D:\360downloads\星火编辑器\logs\client\wasm-default-*.log-*.log" -Tail 50
```

### 诊断错误

```csharp
// 使用 getDiagnostics 工具检查文件
// 不要使用 bash 命令
```

## 常见错误

### 类型转换

```csharp
// ❌ 错误
int playerId = User.UserId;  // long → int

// ✅ 正确
long userId = User.UserId;
```

### 对齐设置

```csharp
#if CLIENT
// ❌ 错误 - 忘记设置对齐
var child = new Panel().Margin(10, 10);
child.Parent = parent;  // 会居中，Margin 从中心偏移

// ✅ 正确 - 设置对齐
var child = new Panel()
    .Margin(10, 10)
    .HorizontalAlignment(HorizontalAlignment.Left)
    .VerticalAlignment(VerticalAlignment.Top);
child.Parent = parent;
#endif
```

### 游戏模式检查

```csharp
// ❌ 错误 - 在 OnRegisterGameClass 中检查
public static void OnRegisterGameClass()
{
    if (Game.GameModeLink != ...) return;  // 抛出异常
}

// ✅ 正确 - 在回调中检查
public static void OnRegisterGameClass()
{
    Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
}

private static void OnGameTriggerInitialization()
{
    if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
}
```

## 快速链接

- [完整迁移指南](MIGRATION_GUIDE.md)
- [迁移状态](MIGRATION_STATUS.md)
- [任务列表](.kiro/specs/iapp-to-wasicore-migration/tasks.md)
- [SDK 文档](docs/sdk/)

---

**提示**: 将此文件打印或保存为书签，方便随时查阅。
