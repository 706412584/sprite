# WasiCore 空白游戏项目

最小化的游戏项目起点，包含基础框架结构和一个默认游戏模式。适合从零开始开发新游戏。

## SDK 位置

本项目使用的 WasiCoreSDK 位置定义在 `src/WasiCoreSDK.props` 文件中。
该文件由编辑器自动生成和管理，不要手动修改。

**注意：** SDK 路径会随安装目录变化，请始终从该文件读取实际路径，不要硬编码。

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

## 文档位置

### 框架官方文档

位于 SDK 文件夹中：`{WasiCoreSDKPath}/docs/`

### API文档

位于 SDK 文件夹中：`{WasiCoreSDKPath}/api/`

- 服务端API列表 — 服务器端可用的完整API接口
- 客户端API列表 — 客户端可用的完整API接口

**提示：** 使用 `#if CLIENT` 和 `#if SERVER` 条件编译时，参考对应的API列表可避免使用错误的API。

## 查找文档的步骤

1. 读取 `src/WasiCoreSDK.props` 文件获取 SDK 路径
2. 官方文档位于 `{SDK路径}/docs/`
3. API文档位于 `{SDK路径}/api/`（服务端/客户端API列表）

## 快速开始

### 1. 打开项目

使用 Visual Studio 或其他IDE打开 `src/GameEntry.csproj` 或解决方案文件。

### 2. 开发游戏逻辑

在 `src/` 目录下创建新的 C# 文件，实现 `IGameClass` 接口。框架会自动发现并注册所有 `IGameClass` 实现。

### 3. 验证编译

WasiCore 框架同时包含客户端和服务端代码，需要确保两者都能正确编译：

```bash
dotnet build src/GameEntry.csproj -c Client-Debug
dotnet build src/GameEntry.csproj -c Server-Debug
```

## AI 辅助开发

本项目包含 AI 上下文引导文件。首次使用时运行：

```powershell
.\setup-ai-context.ps1
```

这会生成 SDK 文档映射和 Cursor/Claude 等 AI 工具所需的上下文文件。
