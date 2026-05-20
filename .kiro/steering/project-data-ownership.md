---
inclusion: fileMatch
fileMatchPattern: ['src/**/*.cs', 'editor/data/**/*.json']
---

<!-- 本文件由编辑器自动生成，请勿手动编辑。重新打开项目或重新生成 AI 上下文后会刷新。 -->

# 项目数据归属

## 工作规则

- `editor/data/**` 与 `data_*` MCP 是同一路数据源编辑方式。
- `src/**/*.cs` 中 `new GameDataXxx(...)` 属于代码定义路线。
- 同一张 GameData 表只能选择一个静态来源；不要对 json-backed 条目再做 `ScopeData.GameDataXxx.*.Data` 静态补丁。
- `src/DataGenerated/**` 是生成投影，只用于查 Link、确认 `ScopeData.*` 名称和查看生成结果。

## 检测摘要

| GameData 类别 | editor/data | 代码定义 (`new GameDataXxx`) | 可疑 `.Data` 静态补丁 |
|---|---|---|---|
| — | 未检测到 | 未检测到 | 未检测到 |

## 可疑 mixed-ownership 提示

- 未检测到明显的 “json-backed 类别 + `.Data` 静态补丁” 组合。

## 说明

- “代码定义” 通过搜索 `new GameDataXxx(...)` 得到，只用于提示该类别存在代码 authoring。
- “可疑 `.Data` 静态补丁” 是启发式扫描结果，主要覆盖字段赋值、常见集合改写，以及把 `.Data` 作为 helper 参数传递的情况。