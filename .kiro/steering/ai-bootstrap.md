---
inclusion: always
---

# WasiCore 空白游戏项目

这是一个**空白游戏项目**模版，最小化的起点，包含基础框架结构和一个默认游戏模式。适合从零开始开发新游戏。

## 项目结构

```
src/
  GameEntry.csproj      # 主项目文件
  GlobalConfig.cs       # 游戏模式配置入口
  DataGenerated/        # 自动生成的数据类（勿手动修改）
  TriggerGenerated/     # 自动生成的触发器脚本（勿手动修改）
editor/
  data/                 # 游戏数据定义（JSON），在编辑器中编辑
  trigger/              # 触发器脚本（JSON），在编辑器中编辑
scene/                  # 场景定义
config.ini              # 地图/游戏基础配置
```

## 编译命令

修改代码后务必同时编译客户端和服务端：

```bash
dotnet build src/GameEntry.csproj -c Client-Debug
dotnet build src/GameEntry.csproj -c Server-Debug
```

## 关键编码约束（WebAssembly 运行时）

- `Task.Run()` 禁用（无线程池），直接调用 async 方法
- `Task.Delay()` → 使用 `Game.Delay()`
- `Console.WriteLine` → 使用 `Game.Logger.LogInformation()` 参数化模板，不要用字符串插值
- `#if CLIENT` / `#if SERVER` 条件编译区分客户端/服务端代码
- Entity / Unit 创建：仅服务端；Actor 创建：仅客户端
- `IGameLink` 比较：使用 `.Equals()`，不要用 `==`；`GameLink<T,V>` 可用 `==`
- `OnRegisterGameClass()` 必须是 `public static`
- 在 `OnGameTriggerInitialization` 中注册事件，不要在 `OnGameDataInitialization` 中注册
- 需要 JSON 序列化的数据（如服务器/客户端间传递）禁止多维数组 `[,]`，使用一维数组
- UI 父子关系：`child.Parent = parent`，不要用 `parent.Children.Add()`

## 自动生成的上下文文件

如果以下文件存在，它们会被 Cursor 自动加载，无需手动读取：

- `.cursor/rules/project-context.mdc` — SDK 路径、编译命令、文档位置（alwaysApply）
- `.cursor/rules/wasicore-coding-rules.mdc` — 框架编码约束（编辑 C# 文件时自动加载）

## 文档查阅

SDK 文档已复制到项目内（版本比对后按需更新），可直接使用 Glob 和 Grep 搜索：

- `docs/sdk/ai/` — AI 开发指南（优先阅读）
- `docs/sdk/systems/` — 各子系统文档
- `docs/sdk/best-practices/` — 最佳实践和常见陷阱
- `docs/api/client/` — 客户端 API 声明
- `docs/api/server/` — 服务端 API 声明

## 如果上述自动生成文件不存在或已过期

项目首次克隆后、或长时间未通过编辑器打开本项目时，自动生成的上下文文件可能缺失或过期。请提示用户：

- 使用编辑器打开一次项目（自动刷新），或
- 手动运行初始化脚本：

```powershell
.\setup-ai-context.ps1
```
