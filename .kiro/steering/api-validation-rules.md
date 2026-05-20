---
inclusion: auto
description: API 使用验证规则 - 确保代码使用正确的 API 和模式
---

# API 使用验证规则

## 自动检查机制

每次保存 `.cs` 文件时，会自动检查以下常见错误。

## 禁止的 API 模式

### 1. 线程和异步 API

❌ **禁止使用**：
```csharp
Task.Run(() => { ... })           // WebAssembly 无线程池
Task.Delay(1000)                  // 使用 Game.Delay()
Thread.Sleep(1000)                // 不支持
new Thread(() => { ... })         // 不支持
ThreadPool.QueueUserWorkItem()    // 不支持
```

✅ **正确使用**：
```csharp
await SomeAsyncMethod()           // 直接 await
await Game.Delay(1000)            // 框架提供的延迟
```

### 2. 日志 API

❌ **禁止使用**：
```csharp
Console.WriteLine("message")                          // 无效
Game.Logger.LogInformation($"Player {playerId}")     // 字符串插值
```

✅ **正确使用**：
```csharp
Game.Logger.LogInformation("message")
Game.Logger.LogInformation("Player {Id} joined", playerId)  // 参数化模板
Game.Logger.LogWarning("Warning: {Message}", msg)
Game.Logger.LogError(ex, "Error occurred: {Details}", details)
```

### 3. GameLink 比较

❌ **禁止使用**：
```csharp
if (link1 == link2)  // IGameLink<T> 不能用 ==
```

✅ **正确使用**：
```csharp
if (link1.Equals(link2))                    // IGameLink<T> 使用 Equals
if (gameLink1 == gameLink2)                 // GameLink<T,V> 可以用 ==
```

### 4. GameLink 类型参数

❌ **禁止使用**：
```csharp
GameLink<GameDataUnit> link;                // 错误：只有一个类型参数
```

✅ **正确使用**：
```csharp
GameLink<GameDataUnit, GameDataUnit> link;  // 正确：两个类型参数
IGameLink<GameDataUnit> link;               // 用于参数和属性
```

### 5. 游戏模式检查

❌ **禁止使用**：
```csharp
public static void OnRegisterGameClass()
{
    if (Game.GameModeLink != ...) return;   // 抛出异常！
}
```

✅ **正确使用**：
```csharp
public static void OnRegisterGameClass()
{
    Game.OnGameTriggerInitialization += OnInit;
}

private static void OnInit()
{
    if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
    // 安全检查
}
```

### 6. UI 父子关系

❌ **禁止使用**：
```csharp
parent.Children.Add(child)        // 不推荐
```

✅ **正确使用**：
```csharp
child.Parent = parent             // 推荐方式
```

### 7. UI 对齐

❌ **常见错误**：
```csharp
var child = new Panel()
{
    Margin = new Thickness(10, 20, 0, 0),
    // 缺少对齐设置！Margin 会从中心偏移
    Parent = parent
};
```

✅ **正确使用**：
```csharp
var child = new Panel()
{
    HorizontalAlignment = HorizontalAlignment.Left,
    VerticalAlignment = VerticalAlignment.Top,
    Margin = new Thickness(10, 20, 0, 0),
    Parent = parent
};

// 或使用流式 API
var child = new Panel()
    .AlignLeft()
    .AlignTop()
    .Margin(10, 20, 0, 0)
    .SetParent(parent);
```

### 8. 条件编译

❌ **禁止使用**：
```csharp
#if SERVER
var gameMode = new GameDataGameMode(...);  // GameMode 注册需要两端
#endif
```

✅ **正确使用**：
```csharp
// GameDataGameMode 注册不要用 #if 包裹
var gameMode = new GameDataGameMode(...);

#if SERVER
// 仅服务器逻辑
var entity = new MyEntity();
#endif

#if CLIENT
// 仅客户端逻辑
var actor = new MyActor();
#endif
```

### 9. 玩家 ID

❌ **禁止使用**：
```csharp
int playerId = 1;                           // 硬编码
await cloudData.GetAsync(Player.Id);        // Player.Id 是临时的
```

✅ **正确使用**：
```csharp
int playerId = Player.LocalPlayer.Id;       // 动态获取
await cloudData.GetAsync(User.UserId);      // UserId 是持久的
```

### 10. Entity vs Actor

❌ **禁止使用**：
```csharp
#if CLIENT
var unit = new Unit(...);                   // 客户端不能创建 Entity
#endif

#if SERVER
var actor = new Actor(...);                 // 服务器不创建 Actor
actor.Health = 100;                         // Actor 不应有游戏逻辑
#endif
```

✅ **正确使用**：
```csharp
#if SERVER
var unit = new Unit(...);                   // Entity 在服务器
unit.Health = 100;                          // 游戏逻辑在 Entity
#endif

#if CLIENT
var actor = new MyActor(...);               // Actor 在客户端
actor.PlayAnimation("idle");                // 仅视觉效果
#endif
```

### 11. 序列化

❌ **禁止使用**：
```csharp
public class MyData
{
    public int[,] Grid { get; set; }        // 多维数组不能序列化
}
```

✅ **正确使用**：
```csharp
public class MyData
{
    public int[] Grid { get; set; }         // 一维数组
    public int Width { get; set; }
    public int Height { get; set; }
}
```

### 12. UnitFilter

❌ **禁止使用**：
```csharp
var unit = new GameDataUnit(...)
{
    // 缺少 Filter！AI 无法锁定
};
```

✅ **正确使用**：
```csharp
var hero = new GameDataUnit(...)
{
    Filter = [UnitFilter.Unit, UnitFilter.Hero]
};

var monster = new GameDataUnit(...)
{
    Filter = [UnitFilter.Unit]
};

var building = new GameDataUnit(...)
{
    Filter = [UnitFilter.Structure]
};
```

## 检查清单

在保存代码前，确认：

- [ ] 没有使用 `Task.Run()` 或 `Task.Delay()`
- [ ] 没有使用 `Console.WriteLine()`
- [ ] 日志使用参数化模板，不是字符串插值
- [ ] `IGameLink` 比较使用 `.Equals()`
- [ ] `GameLink` 有两个类型参数
- [ ] 不在 `OnRegisterGameClass()` 中读取 `Game.GameModeLink`
- [ ] UI 子元素设置了对齐方式
- [ ] UI 使用 `child.Parent = parent`
- [ ] `GameDataGameMode` 注册没有 `#if` 包裹
- [ ] Entity 创建在 `#if SERVER`
- [ ] Actor 创建在 `#if CLIENT`
- [ ] 使用 `User.UserId` 而不是 `Player.Id` 访问云数据
- [ ] 战斗单位配置了 `Filter`
- [ ] 序列化数据使用一维数组

## API 参考位置

遇到 API 使用问题时，查看：

- `docs/api/client/` - 客户端 API 参考
- `docs/api/server/` - 服务端 API 参考
- `docs/api/shared/` - 共享 API 参考
- `docs/sdk/ai/` - AI 开发指南
- `docs/sdk/systems/` - 系统详细文档
