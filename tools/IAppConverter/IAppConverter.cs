using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace IAppConverter
{
    /// <summary>
    /// iApp 到 WasiCore 转换引擎主类
    /// </summary>
    public class IAppConverter
    {
        private readonly YuLanguageLexer lexer;
        private readonly CSharpCodeGenerator codeGenerator;
        private readonly AndroidXmlToWasiCoreConverter uiConverter;
        private readonly DataModelExtractor dataExtractor;

        public IAppConverter()
        {
            lexer = new YuLanguageLexer();
            codeGenerator = new CSharpCodeGenerator();
            uiConverter = new AndroidXmlToWasiCoreConverter();
            dataExtractor = new DataModelExtractor();
        }

        /// <summary>
        /// 转换 .myu 管理器文件
        /// </summary>
        public ConversionResult ConvertManagerFile(string filePath)
        {
            var result = new ConversionResult { SourceFile = filePath };
            
            try
            {
                // 读取源文件
                var sourceCode = File.ReadAllText(filePath);
                
                // 词法分析
                var tokens = lexer.Tokenize(sourceCode);
                
                // 转换为 C# 代码
                var convertedCode = lexer.TokensToCSharp(tokens);
                
                // 转换 Database API
                convertedCode = codeGenerator.ConvertDatabaseToCloudData(convertedCode);
                
                // 提取类名
                var className = Path.GetFileNameWithoutExtension(filePath);
                
                // 生成 IGameClass
                var finalCode = codeGenerator.GenerateIGameClass(className, convertedCode, isServerSide: true);
                
                result.Success = true;
                result.GeneratedCode = finalCode;
                result.OutputFile = $"src/{className}.cs";
                
                // 提取数据模型
                var dataModels = dataExtractor.ExtractDataModels(sourceCode);
                result.DataModels = dataModels;
                
                // 提取数据库键
                var dbKeys = dataExtractor.ExtractDatabaseKeys(sourceCode);
                result.DatabaseKeys = dbKeys;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }
            
            return result;
        }

        /// <summary>
        /// 转换 .iyu UI 布局文件
        /// </summary>
        public ConversionResult ConvertUIFile(string filePath)
        {
            var result = new ConversionResult { SourceFile = filePath };
            
            try
            {
                // 读取源文件
                var xmlContent = File.ReadAllText(filePath);
                
                // 提取类名
                var className = Path.GetFileNameWithoutExtension(filePath);
                className = ToPascalCase(className) + "UI";
                
                // 转换布局
                var generatedCode = uiConverter.ConvertLayout(xmlContent, className);
                
                result.Success = true;
                result.GeneratedCode = generatedCode;
                result.OutputFile = $"src/UI/{className}.cs";
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }
            
            return result;
        }

        /// <summary>
        /// 批量转换目录
        /// </summary>
        public List<ConversionResult> ConvertDirectory(string directoryPath)
        {
            var results = new List<ConversionResult>();
            
            // 转换 .myu 文件
            var myuFiles = Directory.GetFiles(directoryPath, "*.myu", SearchOption.AllDirectories);
            foreach (var file in myuFiles)
            {
                var result = ConvertManagerFile(file);
                results.Add(result);
            }
            
            // 转换 .iyu 文件
            var iyuFiles = Directory.GetFiles(directoryPath, "*.iyu", SearchOption.AllDirectories);
            foreach (var file in iyuFiles)
            {
                var result = ConvertUIFile(file);
                results.Add(result);
            }
            
            return results;
        }

        /// <summary>
        /// 生成迁移报告
        /// </summary>
        public string GenerateMigrationReport(List<ConversionResult> results)
        {
            var report = new System.Text.StringBuilder();
            
            report.AppendLine("# iApp 到 WasiCore 迁移报告");
            report.AppendLine();
            report.AppendLine($"生成时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            report.AppendLine();
            
            // 统计信息
            var successCount = results.Count(r => r.Success);
            var failureCount = results.Count(r => !r.Success);
            var managerCount = results.Count(r => r.SourceFile.EndsWith(".myu"));
            var uiCount = results.Count(r => r.SourceFile.EndsWith(".iyu"));
            
            report.AppendLine("## 统计信息");
            report.AppendLine();
            report.AppendLine($"- 总文件数: {results.Count}");
            report.AppendLine($"- 成功转换: {successCount}");
            report.AppendLine($"- 转换失败: {failureCount}");
            report.AppendLine($"- 管理器类: {managerCount}");
            report.AppendLine($"- UI 布局: {uiCount}");
            report.AppendLine();
            
            // 数据模型统计
            var totalDataModels = results.Sum(r => r.DataModels?.Count ?? 0);
            report.AppendLine($"- 提取的数据模型: {totalDataModels}");
            report.AppendLine();
            
            // 失败列表
            if (failureCount > 0)
            {
                report.AppendLine("## 转换失败的文件");
                report.AppendLine();
                
                foreach (var result in results.Where(r => !r.Success))
                {
                    report.AppendLine($"- {result.SourceFile}");
                    report.AppendLine($"  错误: {result.ErrorMessage}");
                    report.AppendLine();
                }
            }
            
            // 警告列表
            var warnings = results.SelectMany(r => r.Warnings).ToList();
            if (warnings.Any())
            {
                report.AppendLine("## 警告信息");
                report.AppendLine();
                
                foreach (var warning in warnings)
                {
                    report.AppendLine($"- {warning}");
                }
                report.AppendLine();
            }
            
            // 下一步建议
            report.AppendLine("## 下一步行动");
            report.AppendLine();
            report.AppendLine("1. 检查所有生成的代码文件");
            report.AppendLine("2. 手动审查标记为 TODO 的代码段");
            report.AppendLine("3. 运行编译验证（Client-Debug 和 Server-Debug）");
            report.AppendLine("4. 创建 GameData JSON 文件");
            report.AppendLine("5. 运行单元测试");
            
            return report.ToString();
        }

        private string ToPascalCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            
            var parts = input.Split('_');
            var result = new System.Text.StringBuilder();
            
            foreach (var part in parts)
            {
                if (part.Length > 0)
                {
                    result.Append(char.ToUpper(part[0]));
                    if (part.Length > 1)
                    {
                        result.Append(part.Substring(1));
                    }
                }
            }
            
            return result.ToString();
        }
    }

    /// <summary>
    /// 转换结果
    /// </summary>
    public class ConversionResult
    {
        public string SourceFile { get; set; }
        public string OutputFile { get; set; }
        public bool Success { get; set; }
        public string GeneratedCode { get; set; }
        public string ErrorMessage { get; set; }
        public List<string> Warnings { get; set; } = new List<string>();
        public List<DataModelExtractor.DataModel> DataModels { get; set; }
        public List<string> DatabaseKeys { get; set; }
    }
}
