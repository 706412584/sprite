---
inclusion: always
---

# 触发器 MCP（SCE 地图工程通用）

## 如何用本文件定位 PowerShell 脚本（相对路径固定）

本规则文件在仓库中的路径为 **`docs/sdk/ai/rules/trigger-mcp-workflow.mdc`**。与同一份 **WasiCoreSDK** 内的 **`Invoke-SceTriggerMcp.ps1`** 的相对关系是**固定**的，不依赖地图工程目录结构：

| 目标 | 相对**本文件所在目录**（`docs/sdk/ai/rules/`） |
|------|---------------------------------------------|
| MCP 入口脚本 | **`../tools/Invoke-SceTriggerMcp.ps1`** |
| 单次调用 JSON 示例 | **`../tools/trigger-mcp-call.example.json`** |

AI 在已打开或已解析出本文件绝对路径时：取 **`rules`** 目录的父目录为 **`docs/sdk/ai`**，再进入 **`tools`** 即可；或在 PowerShell 中对 **`rules` 目录**执行：

`Join-Path $RulesDir '..\tools\Invoke-SceTriggerMcp.ps1'` 后 **`[System.IO.Path]::GetFullPath(...)`** 得到脚本绝对路径。

**以 `docs/sdk/ai` 为锚的仓库内路径**（与上表等价）：**`tools/Invoke-SceTriggerMcp.ps1`**、**`tools/trigger-mcp-call.example.json`**。

## `trigger_*` 不可用或连接失败时

在 **允许使用终端** 的前提下，**不要**让用户手工起宿主；应执行上表解析出的 **`Invoke-SceTriggerMcp.ps1`**，由脚本完成 **`GET /health`**、按需启动 **TriggerMcpHost**、轮询至 **`mapReady: true`**，再执行**一次** **`tools/call`**。脚本**每次运行只处理一个** MCP 工具；需要多个工具时**多次运行**脚本。

**AI 执行顺序（优先）**：① 将要调用的 **`tool` + `arguments`** 按 **`../tools/trigger-mcp-call.example.json`**（相对本 **`rules`** 目录）同结构写入**临时 JSON**（路径自定，如 `%TEMP%`）；② **`powershell -ExecutionPolicy Bypass -File <Invoke-SceTriggerMcp.ps1 绝对路径> -RequestJsonPath <临时文件>`**；③ **`try` / `finally`** 删除临时文件。不要依赖内嵌批量 **`calls`**（已移除）。

**地图工程根目录**：含 **`project.sce`**、**`docs\.editor-root`** 的 SCE **工程根**。

- 脚本若部署在地图工程 **`ai\tools\`** 或 **`.cursor\tools\`** 下，脚本可通过 **`$PSScriptRoot`** 推断工程根，**不必**传 **`-ProjectRoot`**（亦**不必**读 **`docs\.sdk-version`** 来定位脚本）。
- 脚本若仅存在于 **SDK** 的 **`docs/sdk/ai/tools/`**（与本 workflow 为固定相对路径），则推断工程根**不适用**，须显式传 **`-ProjectRoot`** 指向地图根，或将终端 **`Set-Location`** 到地图工程后再按脚本说明处理。

**`-ProjectRoot`**：脚本不在地图侧 **`ai/tools`** / **`.cursor/tools`** 布局、或需覆盖工程根时**必须**或建议传入。

**AI 无需**自行枚举 **Cursor/Code PID** 或传 **`--exit-when-parent-pid`**：**`Invoke-SceTriggerMcp.ps1`** 在启动宿主时会从 **`$PID`** 父链解析并传入（**explorer** 直子优先，否则首个非 **PowerShell**）。**`-KeepHostAfterLauncher`** 可关闭。

若抛出 **`Cannot resolve directory from docs\.editor-root: …`**，说明地图 **`docs\.editor-root` 首行**指向的目录在本机不存在，须在工程中**更正**或**恢复**编辑器安装路径。

```powershell
# 已知本 workflow 文件路径时，由 rules 目录解析脚本（相对路径固定 ../tools/）
$WorkflowPath = "C:\NE\WasiCoreSDK\docs\sdk\ai\rules\trigger-mcp-workflow.mdc"
$RulesDir = Split-Path -LiteralPath $WorkflowPath -Parent
$TriggerScript = [System.IO.Path]::GetFullPath((Join-Path $RulesDir '..\tools\Invoke-SceTriggerMcp.ps1'))
$MapRoot = "D:\YourSceMap"   # 含 project.sce；若脚本在地图 ai/.cursor tools 下且已 cd 到地图树可省略
$TempRequest = Join-Path $env:TEMP ("sce-trigger-mcp-" + [Guid]::NewGuid().ToString("n") + ".json")
# 将 { "baseUrl": "...", "tool": "...", "arguments": { ... } } 写入 $TempRequest 后：
try {
  powershell -ExecutionPolicy Bypass -File $TriggerScript -ProjectRoot $MapRoot -RequestJsonPath $TempRequest
} finally {
  if (Test-Path -LiteralPath $TempRequest) { Remove-Item -LiteralPath $TempRequest -Force }
}
```

若当前工作目录在地图工程 **`ai\tools`** 或 **`.cursor\tools`** 且脚本在该目录：**`powershell -ExecutionPolicy Bypass -File .\Invoke-SceTriggerMcp.ps1 -RequestJsonPath $TempRequest`**（通常无需 **`-ProjectRoot`**）。

- 仅预热/确认就绪：**`-HealthOnly`**（无需 JSON 中的 **`tool`**；若需起 Host 仍须能解析地图根）。
- **`-HostExtraArgs`**、**`-Tool` / `-ArgumentsJson`** 等见 **[trigger-editor-mcp / SKILL.md](../skills/trigger-editor-mcp/SKILL.md)**。

**部署**：本文件在 **`docs/sdk/ai/rules/`**；若工作区未包含该路径，可复制或符号链接到工程根 **`.cursor/rules/`**，以便 **`alwaysApply`** 生效。

## `editor/trigger` 记录文件与时间戳（预期行为）

调用 **`trigger_save`**，以及会**自动刷新生成代码**的 MCP 写操作（各类 **`trigger_create_*`**、**`trigger_delete`**、**`trigger_rename`** 等，见 **[trigger-editor-mcp / SKILL.md](../skills/trigger-editor-mcp/SKILL.md)**）成功后，地图工程下的 **`editor/trigger/save_record.json`**、**`editor/trigger/generate_record.json`** 可能随之更新（含**文件修改时间**变化），**属于正常副作用**。

后续 AI 在查看工作区差异、**`git status`** 或未提交改动时：**不要**仅因上述两个文件被改动就将其单独视为异常、脏数据、或需要向用户**额外报警**的问题；除非另有明确业务依据，应视为 MCP 保存/生成流程的常规痕迹。

## `tools/call` 返回与自动化解析（`trigger_*`）

**`tools/call` 的 JSON-RPC `result`** 内含 **`isError`** 与 **`content`**。自动化应：**先看 `isError`**；若为 **`true`**，将 **`content[0].text`** 解析为 JSON，读取 **`success:false`**、**`message`**、可选 **`errorCode`** / **`details`**（详见 **[trigger-editor-mcp / SKILL.md](../skills/trigger-editor-mcp/SKILL.md)** 的 **「错误处理」**）。**不要**假定失败一定走 JSON-RPC 顶层 **`error`**。

---

## 触发器 `code` 与 C# 子集（必读）

触发器写入的 C# **不是完整语言**：由**触发器编辑器**按固定子集解析，**LINQ 禁止使用**；**`List` / `Dictionary` / `HashSet` 等容器仅宜使用实例上的基本必要方法**。细则、禁止项与 **`trigger_search`** 的适用边界见 **[trigger-editor-mcp / SKILL.md](../skills/trigger-editor-mcp/SKILL.md)** 中的 **「触发器支持的 C# 语法子集」**。

---

- **`trigger_create_function`**：`env` 按需选择，`code` 为 `public static`，解析时置于 `Scope` 内。
- **`trigger_create_class`**：创建独立类（非嵌套在 `Scope`），`code` 为完整类型声明；未写 `namespace` 时落在 `GameEntry`。写操作**成功返回前** MCP 会**自动**将当前模型生成到 **`src/TriggerGenerated/`**（与 SKILL 一致）；**`trigger_save`** 仍用于将触发器树**持久化到地图工程**。
- **就地改函数体**：已有静态/类成员函数可用 **`trigger_replace_function_body`**；其它大范围改动见 SKILL **「代码生成与等价修改」**（**`trigger_delete`** + **`trigger_create_*`**）。
- 避免并行大量创建导致超时；创建后可用 **`trigger_get_file`**、**`trigger_save`** 与 **`src/TriggerGenerated/`** 对照校验。
