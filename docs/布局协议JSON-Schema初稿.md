# 布局协议 JSON Schema 初稿

对应文件：

- [tools/layout-editor/src/schema/layout.schema.json](D:\User\70641\Documents\SCE Projects\game_entry_0\tools\layout-editor\src\schema\layout.schema.json)

## 当前内容

这版 schema 已经覆盖：

- `LayoutDocument`
- `LayoutMeta`
- `LayoutPage`
- `LayoutNode`
- `SpacingValue`
- `SizeValue`

并支持第一阶段节点：

- `Panel`
- `Text`
- `Button`
- `Icon`
- `Spacer`
- `ProgressBar`
- `ScrollView`
- `List`
- `Grid`
- `Tabs`
- `TabPage`
- `Modal`
- `Badge`

## 当前约束策略

这版是“可用的宽松初稿”，特点是：

1. 顶层结构严格
2. 节点类型枚举严格
3. `bindings/actions` 只能是字符串 key
4. `style` 先做半严格约束
5. `props` 先放宽，后续再按节点类型细分

## 下一步收紧方向

后续建议继续细化：

1. `Text` 节点禁止 `children`
2. `Button` 节点的 `props` 固定为：
   - `text`
   - `icon`
   - `variant`
3. `List/Grid` 强制要求：
   - `itemTemplateId`
   - `bindings.items`
4. `Tabs` 强制子节点只能是 `TabPage`
5. 补 `theme token` 与 `mock data` 相关字段

## 开工建议

现在已经可以直接用这版 schema 做三件事：

1. 编辑器导入校验
2. 默认文档生成
3. 预览器基本渲染
