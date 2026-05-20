---
inclusion: manual
description: 触发器 MCP 使用指南 - 如何在 Kiro 中使用触发器编辑器 MCP
---

# 触发器 MCP 使用指南

## 配置说明

触发器 MCP 已配置在 `.kiro/settings/mcp.json` 中，连接到 `http://127.0.0.1:8765/`。

## 启动 MCP 服务器

触发器 MCP 需要先启动服务器。有两种方式：

### 方式 1：使用 PowerShell 脚本（推荐）

```powershell
# 在项目根目录执行
powershell -ExecutionPolicy Bypass -File ai/tools/Invoke-SceTriggerMcp.ps1 -HealthOnly
```

这个脚本会：
1. 检查 MCP 服务器是否已运行
2. 如果未运行，自动启动 TriggerMcpHost
3. 等待服务器就绪（mapReady: true）

### 方式 2：手动启动（需要编辑器）

1. 打开星火编辑器
2. 打开当前地图项目
3. 编辑器会自动启动 MCP 服务器

## 在 Kiro 中使用

配置完成后，重启 Kiro 或重新加载 MCP 服务器。然后你可以使用以下工具：

### 查询操作

- `trigger_list_files` - 列出所有触发器文件
- `trigger_get_file` - 获取文件详细内容
- `trigger_list_validator_files` - 列出校验器文件
- `trigger_get_validator_file` - 获取校验器文件内容
- `trigger_search` - 搜索触发器节点

### 创建操作

- `trigger_create_function` - 创建函数
- `trigger_create_class` - 创建类
- `trigger_create_trigger` - 创建触发器
- `trigger_create_variable` - 创建变量
- `trigger_create_validator` - 创建校验函数
- `trigger_create_preset` - 创建预设枚举
- `trigger_create_custom_event` - 创建自定义事件
- `trigger_create_folder` - 创建文件夹

### 修改操作

- `trigger_rename` - 重命名节点
- `trigger_delete` - 删除节点
- `trigger_set_enabled` - 启用/禁用节点
- `trigger_replace_function_body` - 仅替换函数体

### 保存操作

- `trigger_save` - 保存触发器数据到地图工程

## 重要注意事项

1. **代码约束**：触发器代码必须符合编辑器支持的 C# 子集
   - ❌ 禁止使用 LINQ
   - ❌ 禁止使用 `++`、`--`、`?:`、`?.`、`??`
   - ❌ 禁止使用字符串插值 `$""`
   - ✅ 使用简单的语句和表达式

2. **串行调用**：所有修改操作必须串行执行，不能并行

3. **自动生成**：创建/修改操作成功后会自动刷新 `src/TriggerGenerated/`

4. **保存**：修改后需要调用 `trigger_save` 持久化到地图工程

## 示例用法

### 创建一个函数

```
使用 trigger_create_function 工具：
- env: "Common"
- code: "public static int Add(int a, int b) { return a + b; }"
```

### 搜索触发器

```
使用 trigger_search 工具：
- query: "Player"
- nodeType: "Trigger"
- env: "Common"
```

### 保存更改

```
使用 trigger_save 工具（无参数）
```

## 故障排除

### MCP 连接失败

1. 确认编辑器已打开并加载了地图
2. 检查端口 8765 是否被占用
3. 运行 PowerShell 脚本手动启动服务器

### 代码解析失败

1. 检查代码是否使用了禁止的语法
2. 参考 `src/TriggerGenerated/` 中的生成代码风格
3. 简化代码，避免复杂表达式

## 更多信息

详细的 API 文档和语法约束请参考：
- `.cursor/skills/trigger-editor-mcp/skill.md` - 完整的技能文档
- `docs/sdk/ai/` - SDK AI 开发指南
