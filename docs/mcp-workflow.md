---
name: mcp-workflow
description: 星火2.0编辑器MCP工具的常用工作流固化。覆盖数据编辑器、触发器、调试启动、运行时检查的操作序列。
metadata: 
  node_type: memory
  type: reference
  engine: 星火2.0-WasiCore-CSharp
  originSessionId: 450df5c0-f903-4809-ae7e-73b0e1957c45
---

# MCP 工作流固化

> MCP 工具通过编辑器暴露，允许 AI 直接操作数编、触发器、调试和运行时。

## 前提条件
- 编辑器打开项目（`D:\xing02\game_entry_0`）
- MCP Host 运行中（编辑器自动启动）
- MCP 工具在 `ai/tools/Invoke-SceMcp.ps1` 可用

## 工作流 1：创建新 GameData 条目

**场景**：新增一个单位/技能/效果定义。

```
1. ui_get_editor_state     → 获取当前编辑器上下文
2. data_list_tables        → 确认表名和现有条目
3. data_create_entry       → 创建新条目
4. data_set_field          → 设置字段值（可多次调用）
5. data_save               → 保存
6. gamedata_generate_code  → 生成 DataGenerated/*
7. gamedata_validate_project → 验证项目完整性
```

## 工作流 2：编辑现有 GameData 条目

**场景**：修改已有单位的属性/技能等。

```
1. ui_get_editor_state     → 获取选中条目的上下文
2. data_get_entry          → 读取当前字段值
3. data_set_field          → 修改目标字段
4. data_save               → 保存
5. gamedata_generate_code  → 重新生成
```

## 工作流 3：代码修改后启动调试

**场景**：改了 C# 代码，需要跑起来验证。

```
1. dotnet build -c Server-Debug     (或 Build-Parallel.ps1)
2. dotnet build -c Client-Debug
3. Copy-Item DLL → AppBundle        (Build-Parallel.ps1 -SkipDeploy:$false 已包含)
4. debug_start_no_compile           → 编辑器启动调试（跳过编辑器自己编译）
```

## 工作流 4：检查运行时状态

**场景**：游戏跑起来后，需要查看单位/玩家/日志状态。

```
# 测通 Runtime MCP 是否可达
runtime_call_tool { tool: "debug.ping", arguments: {} }

# 查看在线玩家
runtime_call_tool { tool: "debug.list_players", arguments: {} }

# 查看单位
runtime_call_tool { tool: "debug.list_units", arguments: { playerId: 1 } }

# 执行服务端Lua
runtime_call_tool { tool: "debug.exec_lua", arguments: { code: "return ...", target: "server" } }
```

## 工作流 5：触发器编辑

**场景**：通过触发器编辑器创建/修改触发逻辑。

```
1. trigger_get_api_schema          → 获取可用API
2. trigger_create_folder           → 创建文件夹（如需）
3. trigger_create_class            → 创建类
4. trigger_create_function         → 创建函数
5. trigger_create_trigger          → 创建触发器
6. trigger_save                    → 保存
7. trigger_validate_project        → 验证
```

## MCP 调用方式

**推荐**：通过 `Invoke-SceMcp.ps1` + 临时 JSON 文件调用。

```powershell
$MapRoot = "D:\xing02\game_entry_0"
$McpScript = Join-Path $MapRoot 'ai\tools\Invoke-SceMcp.ps1'
$TempRequest = Join-Path $env:TEMP ("sce-mcp-" + [Guid]::NewGuid().ToString("n") + ".json")
@'
{ "baseUrl": "http://127.0.0.1:8765/", "tool": "data_list_tables", "arguments": {} }
'@ | Set-Content -LiteralPath $TempRequest -Encoding utf8
try {
  powershell -ExecutionPolicy Bypass -File $McpScript -RequestJsonPath $TempRequest
} finally {
  if (Test-Path -LiteralPath $TempRequest) { Remove-Item -LiteralPath $TempRequest -Force }
}
```

## Runtime MCP 端口与协议

- **端口**：`18765`（客户端 Runtime TCP bridge，调试启动后自动监听）
- **协议**：每条请求为一行 JSON + 分隔符 `|*|\n`，响应同理
- **请求格式**：
  ```json
  {"id":<timestamp>,"method":"runtime.call_tool","params":{"name":"<tool>","arguments":{...}}}|*|
  ```
- **成功响应**：`{"success":true,"result":{...},"id":<id>}|*|`
- **失败响应**：`{"success":false,"error_code":"...","message":"...","id":<id>}|*|`

### 直接 TCP 调用（fallback）

当外层编辑器 MCP 没有 `runtime_call_tool` 时，使用项目脚本：

```powershell
ai/tools/Invoke-SceRuntimeMcp.ps1 -Ping -Wait
ai/tools/Invoke-SceRuntimeMcp.ps1 -ListTools
ai/tools/Invoke-SceRuntimeMcp.ps1 -Tool debug.capture_screenshot -ArgumentsJson '{"path":"RuntimeMcpScreenshots/ui.png","overwrite":true,"maxWidth":1280,"maxHeight":720}'
ai/tools/Invoke-SceRuntimeMcp.ps1 -Tool ui.snapshot -ArgumentsJson '{"maxDepth":4,"maxNodes":200}'
```

## Runtime MCP 工具列表

| 工具名 | 说明 | 关键参数 |
|--------|------|----------|
| `debug.ping` | 确认 Runtime MCP 可达，返回调试模式信息 | 无 |
| `debug.list_tools` | 列出客户端已注册的所有 runtime 工具 | 无 |
| `debug.capture_screenshot` | 保存当前客户端画面为 PNG | `path?`, `overwrite?`, `maxWidth?`, `maxHeight?` |
| `debug.echo` | 回显参数，用于连接测试 | 任意 |
| `ui.snapshot` | 返回 GameUI 控件树快照 | `includeInvisible?`, `maxDepth?`(默认12), `maxNodes?`(默认500) |
| `ui.find` | 按 id/名称/文本/类型查找控件 | `query?`, `id?`, `field?`, `exact?`, `includeInvisible?`, `maxResults?` |
| `ui.get_rect` | 返回单个控件的屏幕像素坐标 | `id?`, `query?`, `field?`, `includeInvisible?` |

### ui.snapshot 返回字段

每个节点包含：`id`, `type`, `name`, `text`, `path`, `visible`, `actually_visible`, `disabled`, `child_count`, `rect_px{x,y,width,height,center_x,center_y}`, `children[]`

### 截图注意事项

- `pending: true` 表示截图已提交，客户端按帧异步保存，稍等 1-2 帧后检查文件
- 截图保存路径相对于**编辑器工作目录**（`D:\360downloads\星火编辑器\`），使用绝对路径更可靠
- 建议用 `maxWidth:1280, maxHeight:720` 限制尺寸；需看细节时不传这两个参数

## 注意事项
- 写操作不要并行 — 等上一个返回后再调用下一个
- `result.isError` 为 true 时检查 `result.content[0].text` 中的错误信息
- JSON 数据 Editor 以 `editor/data/` 为准，C# 代码以 `src/` 为准，两者互斥不混用
- Runtime MCP 只在调试客户端运行时可用（`debug_start` 或 `debug_start_no_compile` 后）
- 脚本侧工具不会出现在外层 MCP `tools/list` 中，需通过 `runtime_call_tool` 或直接 TCP 调用
