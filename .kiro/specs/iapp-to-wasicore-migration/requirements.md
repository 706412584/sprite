# 需求文档: iApp 到 WasiCore 迁移

## 简介

本文档定义了将"纪元修仙"游戏从 iApp 框架(裕语言 V5 + Java)迁移到 WasiCore 框架(C# / .NET 9.0)的正式需求。项目包含约 150 个文件(40+ 管理器类 .myu、60+ UI 界面 .iyu)，需要完整的架构转换、语言转换和数据系统迁移。

## 术语表

- **iApp**: 源框架，基于裕语言 V5 和 Android Java
- **WasiCore**: 目标框架，基于 C# / .NET 9.0 和 WebAssembly
- **裕语言**: iApp 使用的编程语言(V5 版本)
- **管理器类**: .myu 文件，包含游戏业务逻辑
- **UI 布局**: .iyu 文件，包含 XML Android 布局和 Java 逻辑
- **转换引擎**: 自动化代码转换工具
- **IGameClass**: WasiCore 的游戏类注册接口
- **CloudData**: WasiCore 的云数据存储 API
- **Canvas**: WasiCore 的 UI 容器系统
- **Database**: iApp 的数据存储 API
- **GameData**: WasiCore 的静态配置数据系统
- **AST**: 抽象语法树(Abstract Syntax Tree)

## 需求

### 需求 1: 源代码扫描与分析

**用户故事:** 作为迁移工程师，我需要完整扫描和分类所有 iApp 源文件，以便了解项目结构和依赖关系。

#### 验收标准

1. WHEN 转换引擎启动时，THE 转换引擎 SHALL 扫描项目 src/ 目录下的所有 .myu 和 .iyu 文件
2. WHEN 扫描完成后，THE 转换引擎 SHALL 生成包含文件路径、类型和大小的文件清单
3. WHEN 分析管理器类时，THE 转换引擎 SHALL 提取类名、函数签名和依赖关系
4. WHEN 分析 UI 布局时，THE 转换引擎 SHALL 提取控件类型、ID 和事件处理器
5. WHEN 构建依赖图时，THE 转换引擎 SHALL 识别管理器之间的引用关系

### 需求 2: 裕语言到 C# 语法转换

**用户故事:** 作为迁移工程师，我需要将裕语言代码自动转换为 C# 代码，以便减少手动工作量并保证一致性。

#### 验收标准

1. WHEN 转换变量声明时，THE 转换引擎 SHALL 将 `sy` 转换为 `private static`
2. WHEN 转换变量声明时，THE 转换引擎 SHALL 将 `s` 转换为 `var`
3. WHEN 转换函数声明时，THE 转换引擎 SHALL 将 `qj ff` 转换为 `public static`
4. WHEN 转换函数声明时，THE 转换引擎 SHALL 将 `ff` 转换为 `public`
5. WHEN 转换控制流时，THE 转换引擎 SHALL 将 `rg` 转换为 `if`
6. WHEN 转换控制流时，THE 转换引擎 SHALL 将 `xh` 转换为 `for`
7. WHEN 转换返回语句时，THE 转换引擎 SHALL 将 `fh` 转换为 `return`
8. WHEN 转换布尔值时，THE 转换引擎 SHALL 将 `shi` 转换为 `true`
9. WHEN 转换布尔值时，THE 转换引擎 SHALL 将 `fou` 转换为 `false`
10. WHEN 遇到 Java 代码块时，THE 转换引擎 SHALL 保留代码块内容并标记需要手动审查

### 需求 3: 管理器类架构转换

**用户故事:** 作为迁移工程师，我需要将 iApp 管理器类转换为 WasiCore IGameClass，以便符合目标框架的架构模式。

#### 验收标准

1. WHEN 转换管理器类时，THE 转换引擎 SHALL 生成实现 IGameClass 接口的 C# 类
2. WHEN 生成 IGameClass 时，THE 转换引擎 SHALL 创建 `OnRegisterGameClass()` 静态方法
3. WHEN 生成 IGameClass 时，THE 转换引擎 SHALL 在 `OnRegisterGameClass()` 中订阅 `Game.OnGameTriggerInitialization` 事件
4. WHEN 生成初始化逻辑时，THE 转换引擎 SHALL 在 `OnGameTriggerInitialization` 回调中检查 `Game.GameModeLink`
5. WHEN 转换单例模式时，THE 转换引擎 SHALL 将实例方法转换为静态类方法
6. WHEN 管理器包含游戏逻辑时，THE 转换引擎 SHALL 将代码包裹在 `#if SERVER` 条件编译块中

### 需求 4: UI 布局转换（流式布局）

**用户故事:** 作为迁移工程师，我需要将 Android XML 布局转换为 WasiCore 流式布局代码，以便在新框架中重建用户界面，并适配竖屏布局（16:9 和 20:9）。

#### 验收标准

1. WHEN 转换 LinearLayout 时，THE 转换引擎 SHALL 生成 Panel 并使用 FlowOrientation
2. WHEN LinearLayout 的 orientation 为 vertical 时，THE 转换引擎 SHALL 使用 `.FlowVertical()` 链式 API
3. WHEN LinearLayout 的 orientation 为 horizontal 时，THE 转换引擎 SHALL 使用 `.FlowHorizontal()` 链式 API
4. WHEN 转换 TextView 时，THE 转换引擎 SHALL 生成 TextBlock 控件并使用链式 API（`.Text()`, `.FontSize()`, `.TextColor()`）
5. WHEN 转换 Button 时，THE 转换引擎 SHALL 生成 Button 控件并使用链式 API（`.Text()`, `.Size()`, `.OnClick()`）
6. WHEN 转换 EditText 时，THE 转换引擎 SHALL 生成 TextBox 控件并使用 `.PlaceholderText()` 设置提示文本
7. WHEN 转换 ImageView 时，THE 转换引擎 SHALL 生成 Image 控件并使用 `.Source()` 设置图片
8. WHEN 设置控件父子关系时，THE 转换引擎 SHALL 生成 `child.Parent = parent` 代码
9. WHEN 转换事件处理器时，THE 转换引擎 SHALL 将 Android onClick 转换为 `.OnClick()` 链式 API
10. WHEN 生成 UI 代码时，THE 转换引擎 SHALL 将代码包裹在 `#if CLIENT` 条件编译块中
11. WHEN 生成 UI 代码时，THE 转换引擎 SHALL 定义设计分辨率常量（1080x1920 或 1080x2400）
12. WHEN 转换布局时，THE 转换引擎 SHALL 使用 `.Padding()` 和 `.Margin()` 保持安全区域
13. WHEN 容器有多个子控件时，THE 转换引擎 SHALL 优先使用流式布局避免重叠
14. WHEN 需要响应式布局时，THE 转换引擎 SHALL 使用 `.ResponsiveWidth()` 和 `.ResponsiveHeight()` API

### 需求 5: 数据存储系统转换

**用户故事:** 作为迁移工程师，我需要将 iApp Database API 调用转换为 WasiCore CloudData API，以便保持数据持久化功能。

#### 验收标准

1. WHEN 转换 `Database.保存数据(分类, 键, 值)` 时，THE 转换引擎 SHALL 生成 `CloudData.Set(User.UserId, key, value)` 调用
2. WHEN 转换 `Database.读取数据(分类, 键)` 时，THE 转换引擎 SHALL 生成 `CloudData.Get<T>(User.UserId, key)` 调用
3. WHEN 转换 `Database.删除数据(分类, 键)` 时，THE 转换引擎 SHALL 生成 `CloudData.Delete(User.UserId, key)` 调用
4. WHEN 转换云数据访问时，THE 转换引擎 SHALL 将代码包裹在 `#if SERVER` 条件编译块中
5. WHEN 转换云数据访问时，THE 转换引擎 SHALL 使用 `User.UserId` (long) 而不是 `Player.Id` (int)
6. WHEN 遇到客户端的云数据访问时，THE 转换引擎 SHALL 移除该代码并生成警告注释

### 需求 6: 静态配置数据迁移

**用户故事:** 作为迁移工程师，我需要将游戏配置数据转换为 WasiCore GameData 格式，以便在新框架中使用静态配置。

#### 验收标准

1. WHEN 识别配置数据时，THE 转换引擎 SHALL 提取数据结构和值
2. WHEN 生成 GameData 时，THE 转换引擎 SHALL 创建对应的 JSON Schema 文件
3. WHEN 生成 JSON 数据时，THE 转换引擎 SHALL 在 editor/data/ 目录中创建 JSON 文件
4. WHEN 生成 JSON 数据时，THE 转换引擎 SHALL 包含 `$type` 字段指定数据类型
5. WHEN 数据包含对象引用时，THE 转换引擎 SHALL 使用 `$ObjectName` 格式

### 需求 7: 依赖关系处理

**用户故事:** 作为迁移工程师，我需要按正确的依赖顺序转换管理器类，以便避免编译错误。

#### 验收标准

1. WHEN 构建依赖图时，THE 转换引擎 SHALL 分析所有管理器之间的引用关系
2. WHEN 确定转换顺序时，THE 转换引擎 SHALL 对依赖图执行拓扑排序
3. WHEN 检测到循环依赖时，THE 转换引擎 SHALL 生成警告并建议重构方案
4. WHEN 转换管理器时，THE 转换引擎 SHALL 按拓扑排序的顺序处理文件

### 需求 8: 编译验证

**用户故事:** 作为迁移工程师，我需要验证生成的代码可以成功编译，以便确保转换的正确性。

#### 验收标准

1. WHEN 完成代码生成后，THE 转换引擎 SHALL 执行客户端配置编译
2. WHEN 完成代码生成后，THE 转换引擎 SHALL 执行服务端配置编译
3. WHEN 编译客户端时，THE 转换引擎 SHALL 使用 `dotnet build src/GameEntry.csproj -c Client-Debug` 命令
4. WHEN 编译服务端时，THE 转换引擎 SHALL 使用 `dotnet build src/GameEntry.csproj -c Server-Debug` 命令
5. WHEN 编译失败时，THE 转换引擎 SHALL 收集错误信息并生成详细报告
6. WHEN 编译成功时，THE 转换引擎 SHALL 在迁移报告中标记验证通过

### 需求 9: 错误处理与报告

**用户故事:** 作为迁移工程师，我需要详细的错误报告和警告信息，以便识别和解决转换问题。

#### 验收标准

1. WHEN 遇到不支持的裕语言特性时，THE 转换引擎 SHALL 生成警告并在代码中添加 TODO 注释
2. WHEN 遇到不兼容的 Android API 时，THE 转换引擎 SHALL 查找 API 映射表并尝试自动转换
3. IF API 映射不存在，THEN THE 转换引擎 SHALL 生成错误报告并标记需要手动处理
4. WHEN 转换完成时，THE 转换引擎 SHALL 生成包含成功、警告和错误统计的迁移报告
5. WHEN 生成报告时，THE 转换引擎 SHALL 列出所有需要手动审查的文件和代码段

### 需求 10: 安全特性处理

**用户故事:** 作为迁移工程师，我需要识别并移除移动端特有的安全特性，因为它们在 WasiCore 中不适用。

#### 验收标准

1. WHEN 检测到 Root 检测代码时，THE 转换引擎 SHALL 移除该代码并生成说明注释
2. WHEN 检测到模拟器检测代码时，THE 转换引擎 SHALL 移除该代码并生成说明注释
3. WHEN 检测到 Hook 框架检测代码时，THE 转换引擎 SHALL 移除该代码并生成说明注释
4. WHEN 检测到 SSL 双向认证代码时，THE 转换引擎 SHALL 移除该代码并生成说明注释
5. WHEN 移除安全特性时，THE 转换引擎 SHALL 在迁移报告中记录移除的功能

### 需求 11: 客户端/服务端代码分离

**用户故事:** 作为迁移工程师，我需要正确分离客户端和服务端代码，以便符合 WasiCore 的架构要求。

#### 验收标准

1. WHEN 识别游戏逻辑代码时，THE 转换引擎 SHALL 将代码包裹在 `#if SERVER` 块中
2. WHEN 识别 UI 渲染代码时，THE 转换引擎 SHALL 将代码包裹在 `#if CLIENT` 块中
3. WHEN 识别 Entity 或 Unit 创建代码时，THE 转换引擎 SHALL 将代码放在服务端块中
4. WHEN 识别 Actor 创建代码时，THE 转换引擎 SHALL 将代码放在客户端块中
5. WHEN 识别云数据访问时，THE 转换引擎 SHALL 确保代码仅在服务端执行

### 需求 12: WebAssembly 兼容性

**用户故事:** 作为迁移工程师，我需要确保生成的代码符合 WebAssembly 环境的约束，以便代码可以正常运行。

#### 验收标准

1. WHEN 检测到 `Task.Run()` 调用时，THE 转换引擎 SHALL 将其转换为直接 await 调用
2. WHEN 检测到 `Task.Delay()` 调用时，THE 转换引擎 SHALL 将其转换为 `Game.Delay()` 调用
3. WHEN 检测到 Thread 或线程 API 时，THE 转换引擎 SHALL 生成错误并建议替代方案
4. WHEN 检测到多维数组用于序列化时，THE 转换引擎 SHALL 将其转换为一维数组
5. WHEN 检测到 `Console.WriteLine()` 时，THE 转换引擎 SHALL 将其转换为 `Game.Logger.LogInformation()` 调用

### 需求 13: 日志系统转换

**用户故事:** 作为迁移工程师，我需要将日志输出转换为 WasiCore 的日志系统，以便保持调试能力。

#### 验收标准

1. WHEN 转换日志调用时，THE 转换引擎 SHALL 使用参数化模板而不是字符串插值
2. WHEN 生成日志代码时，THE 转换引擎 SHALL 使用 `Game.Logger.LogInformation(template, args)` 格式
3. WHEN 检测到字符串插值日志时，THE 转换引擎 SHALL 将其转换为参数化格式
4. WHEN 转换调试日志时，THE 转换引擎 SHALL 使用 `Game.Logger.LogDebug()` 方法
5. WHEN 转换错误日志时，THE 转换引擎 SHALL 使用 `Game.Logger.LogError()` 方法

### 需求 14: 性能优化

**用户故事:** 作为迁移工程师，我需要生成高效的代码，以便在 WebAssembly 环境中获得良好性能。

#### 验收标准

1. WHEN 生成代码时，THE 转换引擎 SHALL 使用静态类代替单例模式
2. WHEN 生成代码时，THE 转换引擎 SHALL 避免不必要的装箱/拆箱操作
3. WHEN 生成代码时，THE 转换引擎 SHALL 使用条件编译减少代码体积
4. WHEN 识别简单函数时，THE 转换引擎 SHALL 考虑内联优化
5. WHEN 生成数据访问代码时，THE 转换引擎 SHALL 避免频繁的跨边界调用

### 需求 15: 迁移报告生成

**用户故事:** 作为项目经理，我需要详细的迁移报告，以便了解迁移进度和质量。

#### 验收标准

1. WHEN 迁移完成时，THE 转换引擎 SHALL 生成包含统计信息的迁移报告
2. WHEN 生成报告时，THE 转换引擎 SHALL 列出已转换的管理器类数量
3. WHEN 生成报告时，THE 转换引擎 SHALL 列出已转换的 UI 布局数量
4. WHEN 生成报告时，THE 转换引擎 SHALL 列出生成的数据模型数量
5. WHEN 生成报告时，THE 转换引擎 SHALL 列出编译结果(成功/失败)
6. WHEN 生成报告时，THE 转换引擎 SHALL 列出所有警告和需要手动处理的项目
7. WHEN 生成报告时，THE 转换引擎 SHALL 提供下一步行动建议

### 需求 16: 增量迁移支持

**用户故事:** 作为迁移工程师，我需要支持增量迁移，以便分阶段完成大型项目的迁移。

#### 验收标准

1. WHEN 指定文件子集时，THE 转换引擎 SHALL 仅转换指定的文件
2. WHEN 执行增量迁移时，THE 转换引擎 SHALL 保留已转换文件的状态
3. WHEN 检测到已转换文件时，THE 转换引擎 SHALL 询问是否覆盖
4. WHEN 生成增量报告时，THE 转换引擎 SHALL 区分新转换和已存在的文件

### 需求 17: 代码质量保证

**用户故事:** 作为迁移工程师，我需要生成符合 C# 编码规范的代码，以便保持代码质量和可维护性。

#### 验收标准

1. WHEN 生成 C# 代码时，THE 转换引擎 SHALL 使用 PascalCase 命名公共成员
2. WHEN 生成 C# 代码时，THE 转换引擎 SHALL 使用 camelCase 命名私有字段
3. WHEN 生成 C# 代码时，THE 转换引擎 SHALL 使用 4 空格缩进
4. WHEN 生成 C# 代码时，THE 转换引擎 SHALL 使用 Allman 大括号风格
5. WHEN 生成异步方法时，THE 转换引擎 SHALL 在方法名后添加 Async 后缀
6. WHEN 生成接口时，THE 转换引擎 SHALL 在接口名前添加 I 前缀

### 需求 18: 测试支持

**用户故事:** 作为质量保证工程师，我需要生成的代码支持单元测试，以便验证迁移的正确性。

#### 验收标准

1. WHEN 生成管理器类时，THE 转换引擎 SHALL 使用可测试的设计模式
2. WHEN 生成数据访问代码时，THE 转换引擎 SHALL 支持依赖注入
3. WHEN 生成业务逻辑时，THE 转换引擎 SHALL 将逻辑与 UI 分离
4. WHEN 生成代码时，THE 转换引擎 SHALL 避免硬编码的依赖关系

### 需求 19: 文档生成

**用户故事:** 作为开发人员，我需要生成的代码包含清晰的注释和文档，以便理解迁移后的代码。

#### 验收标准

1. WHEN 生成类时，THE 转换引擎 SHALL 添加 XML 文档注释
2. WHEN 生成公共方法时，THE 转换引擎 SHALL 添加方法说明注释
3. WHEN 转换复杂逻辑时，THE 转换引擎 SHALL 添加行内注释解释转换决策
4. WHEN 生成需要手动处理的代码时，THE 转换引擎 SHALL 添加 TODO 注释说明原因
5. WHEN 保留原始代码结构时，THE 转换引擎 SHALL 添加注释说明对应的 iApp 代码

### 需求 20: 配置管理

**用户故事:** 作为迁移工程师，我需要灵活的配置选项，以便根据项目需求调整转换行为。

#### 验收标准

1. WHEN 启动转换引擎时，THE 转换引擎 SHALL 支持通过配置文件指定转换选项
2. WHEN 配置转换选项时，THE 转换引擎 SHALL 支持指定输出目录
3. WHEN 配置转换选项时，THE 转换引擎 SHALL 支持启用/禁用特定转换规则
4. WHEN 配置转换选项时，THE 转换引擎 SHALL 支持自定义 API 映射表
5. WHEN 配置转换选项时，THE 转换引擎 SHALL 支持指定日志级别
