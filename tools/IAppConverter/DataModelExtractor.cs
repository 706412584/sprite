using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace IAppConverter
{
    /// <summary>
    /// 数据模型提取器 - 从 iApp 代码中识别和提取配置数据
    /// </summary>
    public class DataModelExtractor
    {
        public class DataModel
        {
            public string Name { get; set; }
            public string Type { get; set; }
            public Dictionary<string, object> Properties { get; set; } = new Dictionary<string, object>();
            public string Description { get; set; }
        }

        /// <summary>
        /// 从裕语言代码中提取数据模型
        /// </summary>
        public List<DataModel> ExtractDataModels(string sourceCode)
        {
            var models = new List<DataModel>();
            
            // 识别静态变量声明（可能是配置数据）
            var staticVarPattern = @"sy\s+(\w+)\s+(\w+)\s*=\s*(.+?)(?:;|\n)";
            var matches = Regex.Matches(sourceCode, staticVarPattern);
            
            foreach (Match match in matches)
            {
                var type = match.Groups[1].Value;
                var name = match.Groups[2].Value;
                var value = match.Groups[3].Value.Trim();
                
                // 判断是否是配置数据（基于命名约定）
                if (IsConfigurationData(name, type))
                {
                    var model = new DataModel
                    {
                        Name = name,
                        Type = MapYuTypeToCSharp(type),
                        Description = $"从 iApp 提取的配置数据"
                    };
                    
                    model.Properties["DefaultValue"] = ParseValue(value, type);
                    models.Add(model);
                }
            }
            
            return models;
        }

        /// <summary>
        /// 生成 GameData JSON Schema
        /// </summary>
        public string GenerateJsonSchema(DataModel model)
        {
            var sb = new StringBuilder();
            
            sb.AppendLine("{");
            sb.AppendLine($"  \"$type\": \"GameData{model.Name}\",");
            sb.AppendLine($"  \"Name\": \"{model.Name}\",");
            
            foreach (var prop in model.Properties)
            {
                if (prop.Value is string strValue)
                {
                    sb.AppendLine($"  \"{prop.Key}\": \"{strValue}\",");
                }
                else if (prop.Value is int || prop.Value is long || prop.Value is float || prop.Value is double)
                {
                    sb.AppendLine($"  \"{prop.Key}\": {prop.Value},");
                }
                else if (prop.Value is bool boolValue)
                {
                    sb.AppendLine($"  \"{prop.Key}\": {boolValue.ToString().ToLower()},");
                }
            }
            
            // 移除最后一个逗号
            var json = sb.ToString().TrimEnd();
            if (json.EndsWith(","))
            {
                json = json.Substring(0, json.Length - 1);
            }
            
            sb.Clear();
            sb.Append(json);
            sb.AppendLine();
            sb.AppendLine("}");
            
            return sb.ToString();
        }

        /// <summary>
        /// 生成 WasiCore 数据类定义
        /// </summary>
        public string GenerateDataClass(DataModel model)
        {
            var sb = new StringBuilder();
            
            sb.AppendLine("using GameCore;");
            sb.AppendLine();
            sb.AppendLine("namespace GameEntry");
            sb.AppendLine("{");
            sb.AppendLine($"    /// <summary>");
            sb.AppendLine($"    /// {model.Description}");
            sb.AppendLine($"    /// </summary>");
            sb.AppendLine($"    public class {model.Name}Data");
            sb.AppendLine("    {");
            
            foreach (var prop in model.Properties)
            {
                var propType = GetCSharpType(prop.Value);
                sb.AppendLine($"        public {propType} {prop.Key} {{ get; set; }}");
            }
            
            sb.AppendLine("    }");
            sb.AppendLine("}");
            
            return sb.ToString();
        }

        /// <summary>
        /// 判断是否是配置数据
        /// </summary>
        private bool IsConfigurationData(string name, string type)
        {
            // 基于命名约定判断
            var configKeywords = new[] { "配置", "Config", "设置", "Setting", "数据", "Data", "表", "Table" };
            
            foreach (var keyword in configKeywords)
            {
                if (name.Contains(keyword))
                {
                    return true;
                }
            }
            
            // 基于类型判断（数组、列表等可能是配置）
            if (type.Contains("[]") || type.Contains("List") || type.Contains("Array"))
            {
                return true;
            }
            
            return false;
        }

        /// <summary>
        /// 映射裕语言类型到 C# 类型
        /// </summary>
        private string MapYuTypeToCSharp(string yuType)
        {
            var typeMap = new Dictionary<string, string>
            {
                { "int", "int" },
                { "long", "long" },
                { "float", "float" },
                { "double", "double" },
                { "boolean", "bool" },
                { "string", "string" },
                { "String", "string" }
            };
            
            if (typeMap.ContainsKey(yuType))
            {
                return typeMap[yuType];
            }
            
            return yuType; // 保持原样
        }

        /// <summary>
        /// 解析值
        /// </summary>
        private object ParseValue(string value, string type)
        {
            value = value.Trim();
            
            if (type == "int")
            {
                if (int.TryParse(value, out int intValue))
                {
                    return intValue;
                }
            }
            else if (type == "long")
            {
                if (long.TryParse(value.Replace("L", ""), out long longValue))
                {
                    return longValue;
                }
            }
            else if (type == "float" || type == "double")
            {
                if (double.TryParse(value, out double doubleValue))
                {
                    return doubleValue;
                }
            }
            else if (type == "boolean")
            {
                if (value == "shi") return true;
                if (value == "fou") return false;
                if (bool.TryParse(value, out bool boolValue))
                {
                    return boolValue;
                }
            }
            else if (type == "string" || type == "String")
            {
                return value.Trim('"');
            }
            
            return value;
        }

        /// <summary>
        /// 获取 C# 类型
        /// </summary>
        private string GetCSharpType(object value)
        {
            if (value is int) return "int";
            if (value is long) return "long";
            if (value is float) return "float";
            if (value is double) return "double";
            if (value is bool) return "bool";
            if (value is string) return "string";
            
            return "object";
        }

        /// <summary>
        /// 提取数据库访问模式
        /// </summary>
        public List<string> ExtractDatabaseKeys(string sourceCode)
        {
            var keys = new List<string>();
            
            // 提取 Database.保存数据() 调用中的键
            var savePattern = @"Database\.保存数据\s*\(\s*""([^""]*)""\s*,\s*""([^""]*)""\s*,";
            var saveMatches = Regex.Matches(sourceCode, savePattern);
            
            foreach (Match match in saveMatches)
            {
                var category = match.Groups[1].Value;
                var key = match.Groups[2].Value;
                keys.Add($"{category}/{key}");
            }
            
            // 提取 Database.读取数据() 调用中的键
            var readPattern = @"Database\.读取数据\s*\(\s*""([^""]*)""\s*,\s*""([^""]*)""";
            var readMatches = Regex.Matches(sourceCode, readPattern);
            
            foreach (Match match in readMatches)
            {
                var category = match.Groups[1].Value;
                var key = match.Groups[2].Value;
                var fullKey = $"{category}/{key}";
                
                if (!keys.Contains(fullKey))
                {
                    keys.Add(fullKey);
                }
            }
            
            return keys;
        }
    }
}
