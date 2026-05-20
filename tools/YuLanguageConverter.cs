using System;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;

namespace MigrationTools
{
    /// <summary>
    /// 裕语言到 C# 转换器
    /// 将 iApp 裕语言代码转换为 WasiCore C# 代码
    /// </summary>
    public class YuLanguageConverter
    {
        // 关键字映射表
        private static readonly Dictionary<string, string> KeywordMap = new Dictionary<string, string>
        {
            { "sy", "private static" },
            { "s", "var" },
            { "ff", "public" },
            { "qj ff", "public static" },
            { "rg", "if" },
            { "xh", "for" },
            { "fh", "return" },
            { "shi", "true" },
            { "fou", "false" },
            { "string", "string" },
            { "int", "int" },
            { "long", "long" },
            { "boolean", "bool" },
            { "Object", "object" }
        };

        /// <summary>
        /// 转换裕语言代码到 C#
        /// </summary>
        public static string Convert(string yuCode)
        {
            if (string.IsNullOrWhiteSpace(yuCode))
                return string.Empty;

            var result = yuCode;

            // 1. 转换关键字
            result = ConvertKeywords(result);

            // 2. 转换变量声明
            result = ConvertVariableDeclarations(result);

            // 3. 转换函数声明
            result = ConvertFunctionDeclarations(result);

            // 4. 转换控制流
            result = ConvertControlFlow(result);

            // 5. 处理 Java 代码块
            result = MarkJavaBlocks(result);

            return result;
        }

        /// <summary>
        /// 转换关键字
        /// </summary>
        private static string ConvertKeywords(string code)
        {
            var result = code;

            // 按长度排序，先替换长的关键字（避免 "qj ff" 被拆分）
            var sortedKeywords = new List<KeyValuePair<string, string>>(KeywordMap);
            sortedKeywords.Sort((a, b) => b.Key.Length.CompareTo(a.Key.Length));

            foreach (var kvp in sortedKeywords)
            {
                // 使用单词边界匹配，避免部分匹配
                var pattern = $@"\b{Regex.Escape(kvp.Key)}\b";
                result = Regex.Replace(result, pattern, kvp.Value);
            }

            return result;
        }

        /// <summary>
        /// 转换变量声明
        /// sy int 变量名 = 值 → private static int variableName = value
        /// </summary>
        private static string ConvertVariableDeclarations(string code)
        {
            // sy 类型 中文名 = 值
            var pattern = @"private static\s+(\w+)\s+([\u4e00-\u9fa5_]+)\s*=\s*(.+)";
            var result = Regex.Replace(code, pattern, match =>
            {
                var type = match.Groups[1].Value;
                var chineseName = match.Groups[2].Value;
                var value = match.Groups[3].Value;

                // 将中文名转换为拼音或英文（这里简化处理，保留中文）
                var englishName = ConvertChineseToEnglish(chineseName);

                return $"private static {type} {englishName} = {value}";
            });

            return result;
        }

        /// <summary>
        /// 转换函数声明
        /// ff 返回类型 函数名(参数) → public ReturnType FunctionName(params)
        /// </summary>
        private static string ConvertFunctionDeclarations(string code)
        {
            // ff 返回类型 中文函数名(参数)
            var pattern = @"public\s+(static\s+)?(\w+)\s+([\u4e00-\u9fa5_]+)\s*\(([^)]*)\)";
            var result = Regex.Replace(code, pattern, match =>
            {
                var staticModifier = match.Groups[1].Value;
                var returnType = match.Groups[2].Value;
                var chineseName = match.Groups[3].Value;
                var parameters = match.Groups[4].Value;

                // 转换函数名
                var englishName = ConvertChineseToEnglish(chineseName);

                // 转换参数
                var convertedParams = ConvertParameters(parameters);

                return $"public {staticModifier}{returnType} {englishName}({convertedParams})";
            });

            return result;
        }

        /// <summary>
        /// 转换控制流
        /// </summary>
        private static string ConvertControlFlow(string code)
        {
            var result = code;

            // rg 条件 { } → if (condition) { }
            result = Regex.Replace(result, @"if\s+([^{]+)\s*\{", "if ($1) {");

            // xh 循环 → for 循环
            result = Regex.Replace(result, @"for\s+([^{]+)\s*\{", "for ($1) {");

            return result;
        }

        /// <summary>
        /// 标记 Java 代码块
        /// </summary>
        private static string MarkJavaBlocks(string code)
        {
            // 查找 java { ... } 块
            var pattern = @"java\s*\{([^}]*)\}";
            var result = Regex.Replace(code, pattern, match =>
            {
                var javaCode = match.Groups[1].Value;
                return $"// TODO: 手动转换 Java 代码\n// Java 原始代码:\n/*\n{javaCode}\n*/";
            });

            return result;
        }

        /// <summary>
        /// 转换参数列表
        /// string 参数名 → string paramName
        /// </summary>
        private static string ConvertParameters(string parameters)
        {
            if (string.IsNullOrWhiteSpace(parameters))
                return string.Empty;

            var parts = parameters.Split(',');
            var converted = new List<string>();

            foreach (var part in parts)
            {
                var trimmed = part.Trim();
                var match = Regex.Match(trimmed, @"(\w+)\s+([\u4e00-\u9fa5_\w]+)");
                if (match.Success)
                {
                    var type = match.Groups[1].Value;
                    var name = match.Groups[2].Value;
                    var englishName = ConvertChineseToEnglish(name);
                    converted.Add($"{type} {englishName}");
                }
                else
                {
                    converted.Add(trimmed);
                }
            }

            return string.Join(", ", converted);
        }

        /// <summary>
        /// 将中文名称转换为英文（简化版本）
        /// 实际项目中应使用拼音库或预定义映射表
        /// </summary>
        private static string ConvertChineseToEnglish(string chineseName)
        {
            // 预定义的常用映射
            var commonMappings = new Dictionary<string, string>
            {
                { "当前回合", "currentRound" },
                { "战斗进行中", "battleInProgress" },
                { "开始战斗", "StartBattle" },
                { "敌人配置JSON", "enemyConfigJson" },
                { "初始化战斗", "InitializeBattle" },
                { "等级", "level" },
                { "金币", "gold" },
                { "灵石", "gold" },
                { "名称", "name" },
                { "姓名", "name" },
                { "境界", "realm" },
                { "基础属性", "baseAttributes" },
                { "角色数据", "roleData" },
                { "保存数据", "SaveData" },
                { "读取数据", "LoadData" },
                { "删除数据", "DeleteData" }
            };

            if (commonMappings.ContainsKey(chineseName))
                return commonMappings[chineseName];

            // 如果没有映射，保留中文（或使用拼音库）
            return chineseName;
        }

        /// <summary>
        /// 生成 IGameClass 模板
        /// </summary>
        public static string GenerateIGameClassTemplate(string className, string originalCode)
        {
            var convertedCode = Convert(originalCode);

            var template = $@"using System;
using System.Threading.Tasks;
using GameCore;
using GameCore.BaseInterface;

namespace GameEntry.Managers
{{
    /// <summary>
    /// {className} - 从 iApp 迁移
    /// </summary>
    public class {className} : IGameClass
    {{
        public static void OnRegisterGameClass()
        {{
            Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
        }}
        
        private static void OnGameTriggerInitialization()
        {{
            if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;
            
            Initialize();
        }}
        
        private static void Initialize()
        {{
            Game.Logger.LogInformation(""{className} 初始化完成"");
        }}
        
        #if SERVER
        // 转换后的代码
{IndentCode(convertedCode, 2)}
        #endif
    }}
}}";

            return template;
        }

        /// <summary>
        /// 缩进代码
        /// </summary>
        private static string IndentCode(string code, int level)
        {
            var indent = new string(' ', level * 4);
            var lines = code.Split('\n');
            var result = new StringBuilder();

            foreach (var line in lines)
            {
                if (!string.IsNullOrWhiteSpace(line))
                    result.AppendLine(indent + line);
                else
                    result.AppendLine();
            }

            return result.ToString();
        }
    }
}
