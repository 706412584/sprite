using System;
using System.Collections.Generic;
using System.Text;

namespace IAppConverter
{
    /// <summary>
    /// C# 代码生成器 - 生成 WasiCore IGameClass 模板和条件编译代码
    /// </summary>
    public class CSharpCodeGenerator
    {
        /// <summary>
        /// 生成 IGameClass 管理器类模板
        /// </summary>
        public string GenerateIGameClass(string className, string convertedCode, bool isServerSide = true)
        {
            var sb = new StringBuilder();
            
            sb.AppendLine("using GameCore.BaseInterface;");
            sb.AppendLine("using GameCore;");
            sb.AppendLine();
            sb.AppendLine("namespace GameEntry");
            sb.AppendLine("{");
            sb.AppendLine($"    /// <summary>");
            sb.AppendLine($"    /// {className} - 从 iApp 迁移");
            sb.AppendLine($"    /// </summary>");
            sb.AppendLine($"    public class {className} : IGameClass");
            sb.AppendLine("    {");
            sb.AppendLine("        public static void OnRegisterGameClass()");
            sb.AppendLine("        {");
            sb.AppendLine("            Game.OnGameTriggerInitialization += OnGameTriggerInitialization;");
            sb.AppendLine("        }");
            sb.AppendLine();
            sb.AppendLine("        private static void OnGameTriggerInitialization()");
            sb.AppendLine("        {");
            sb.AppendLine("            if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode) return;");
            sb.AppendLine("            Initialize();");
            sb.AppendLine("        }");
            sb.AppendLine();
            sb.AppendLine("        private static void Initialize()");
            sb.AppendLine("        {");
            sb.AppendLine("            // 初始化逻辑");
            sb.AppendLine("        }");
            sb.AppendLine();
            
            // 添加条件编译
            if (isServerSide)
            {
                sb.AppendLine("        #if SERVER");
            }
            else
            {
                sb.AppendLine("        #if CLIENT");
            }
            
            // 添加转换后的代码（缩进）
            foreach (var line in convertedCode.Split('\n'))
            {
                if (!string.IsNullOrWhiteSpace(line))
                {
                    sb.AppendLine("        " + line.TrimEnd());
                }
                else
                {
                    sb.AppendLine();
                }
            }
            
            sb.AppendLine("        #endif");
            sb.AppendLine("    }");
            sb.AppendLine("}");
            
            return sb.ToString();
        }

        /// <summary>
        /// 生成静态工具类
        /// </summary>
        public string GenerateStaticUtilityClass(string className, string convertedCode)
        {
            var sb = new StringBuilder();
            
            sb.AppendLine("using System;");
            sb.AppendLine("using GameCore;");
            sb.AppendLine();
            sb.AppendLine("namespace GameEntry");
            sb.AppendLine("{");
            sb.AppendLine($"    /// <summary>");
            sb.AppendLine($"    /// {className} - 工具类（从 iApp 迁移）");
            sb.AppendLine($"    /// </summary>");
            sb.AppendLine($"    public static class {className}");
            sb.AppendLine("    {");
            
            // 添加转换后的代码（缩进）
            foreach (var line in convertedCode.Split('\n'))
            {
                if (!string.IsNullOrWhiteSpace(line))
                {
                    sb.AppendLine("        " + line.TrimEnd());
                }
                else
                {
                    sb.AppendLine();
                }
            }
            
            sb.AppendLine("    }");
            sb.AppendLine("}");
            
            return sb.ToString();
        }

        /// <summary>
        /// 转换 Database API 调用为 CloudData
        /// </summary>
        public string ConvertDatabaseToCloudData(string code)
        {
            // Database.保存数据(分类, 键, 值) → CloudData.Set(User.UserId, key, value)
            code = System.Text.RegularExpressions.Regex.Replace(
                code,
                @"Database\.保存数据\s*\(\s*""([^""]*)""\s*,\s*""([^""]*)""\s*,\s*([^)]+)\)",
                "await CloudData.Set(User.UserId, \"$2\", $3)"
            );
            
            // Database.读取数据(分类, 键) → CloudData.Get<T>(User.UserId, key)
            code = System.Text.RegularExpressions.Regex.Replace(
                code,
                @"Database\.读取数据\s*\(\s*""([^""]*)""\s*,\s*""([^""]*)""\)",
                "await CloudData.Get<object>(User.UserId, \"$2\")"
            );
            
            // Database.删除数据(分类, 键) → CloudData.Delete(User.UserId, key)
            code = System.Text.RegularExpressions.Regex.Replace(
                code,
                @"Database\.删除数据\s*\(\s*""([^""]*)""\s*,\s*""([^""]*)""\)",
                "await CloudData.Delete(User.UserId, \"$2\")"
            );
            
            return code;
        }

        /// <summary>
        /// 添加 XML 文档注释
        /// </summary>
        public string AddXmlDocumentation(string methodName, string description = null)
        {
            var sb = new StringBuilder();
            sb.AppendLine("        /// <summary>");
            sb.AppendLine($"        /// {description ?? methodName}");
            sb.AppendLine("        /// </summary>");
            return sb.ToString();
        }

        /// <summary>
        /// 生成条件编译块
        /// </summary>
        public string WrapInConditionalCompilation(string code, string condition)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"        #{condition}");
            sb.AppendLine(code);
            sb.AppendLine("        #endif");
            return sb.ToString();
        }
    }
}
