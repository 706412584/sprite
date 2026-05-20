using System;
using System.IO;

namespace IAppConverter
{
    /// <summary>
    /// 转换工具命令行入口
    /// </summary>
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("=== iApp 到 WasiCore 转换工具 ===");
            Console.WriteLine();
            
            if (args.Length == 0)
            {
                ShowUsage();
                return;
            }
            
            var command = args[0].ToLower();
            
            switch (command)
            {
                case "convert-file":
                    if (args.Length < 2)
                    {
                        Console.WriteLine("错误: 请指定要转换的文件路径");
                        return;
                    }
                    ConvertSingleFile(args[1]);
                    break;
                
                case "convert-dir":
                    if (args.Length < 2)
                    {
                        Console.WriteLine("错误: 请指定要转换的目录路径");
                        return;
                    }
                    ConvertDirectory(args[1]);
                    break;
                
                case "test":
                    RunTests();
                    break;
                
                default:
                    Console.WriteLine($"未知命令: {command}");
                    ShowUsage();
                    break;
            }
        }
        
        static void ShowUsage()
        {
            Console.WriteLine("用法:");
            Console.WriteLine("  IAppConverter convert-file <文件路径>  - 转换单个文件");
            Console.WriteLine("  IAppConverter convert-dir <目录路径>   - 转换整个目录");
            Console.WriteLine("  IAppConverter test                     - 运行测试");
            Console.WriteLine();
            Console.WriteLine("示例:");
            Console.WriteLine("  IAppConverter convert-file com.Smliegame.jyxx/src/BattleManager.myu");
            Console.WriteLine("  IAppConverter convert-dir com.Smliegame.jyxx/src");
        }
        
        static void ConvertSingleFile(string filePath)
        {
            if (!File.Exists(filePath))
            {
                Console.WriteLine($"错误: 文件不存在 - {filePath}");
                return;
            }
            
            var converter = new IAppConverter();
            ConversionResult result;
            
            if (filePath.EndsWith(".myu"))
            {
                Console.WriteLine($"转换管理器文件: {filePath}");
                result = converter.ConvertManagerFile(filePath);
            }
            else if (filePath.EndsWith(".iyu"))
            {
                Console.WriteLine($"转换 UI 文件: {filePath}");
                result = converter.ConvertUIFile(filePath);
            }
            else
            {
                Console.WriteLine($"错误: 不支持的文件类型 - {filePath}");
                return;
            }
            
            if (result.Success)
            {
                Console.WriteLine($"✓ 转换成功");
                Console.WriteLine($"  输出文件: {result.OutputFile}");
                
                // 写入输出文件
                var outputDir = Path.GetDirectoryName(result.OutputFile);
                if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }
                
                File.WriteAllText(result.OutputFile, result.GeneratedCode);
                Console.WriteLine($"  已写入: {result.OutputFile}");
                
                // 显示数据模型
                if (result.DataModels != null && result.DataModels.Count > 0)
                {
                    Console.WriteLine($"  提取的数据模型: {result.DataModels.Count}");
                }
                
                // 显示数据库键
                if (result.DatabaseKeys != null && result.DatabaseKeys.Count > 0)
                {
                    Console.WriteLine($"  数据库键: {result.DatabaseKeys.Count}");
                }
            }
            else
            {
                Console.WriteLine($"✗ 转换失败");
                Console.WriteLine($"  错误: {result.ErrorMessage}");
            }
        }
        
        static void ConvertDirectory(string directoryPath)
        {
            if (!Directory.Exists(directoryPath))
            {
                Console.WriteLine($"错误: 目录不存在 - {directoryPath}");
                return;
            }
            
            Console.WriteLine($"转换目录: {directoryPath}");
            Console.WriteLine();
            
            var converter = new IAppConverter();
            var results = converter.ConvertDirectory(directoryPath);
            
            Console.WriteLine($"转换完成: {results.Count} 个文件");
            Console.WriteLine();
            
            // 写入所有输出文件
            foreach (var result in results)
            {
                if (result.Success)
                {
                    var outputDir = Path.GetDirectoryName(result.OutputFile);
                    if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
                    {
                        Directory.CreateDirectory(outputDir);
                    }
                    
                    File.WriteAllText(result.OutputFile, result.GeneratedCode);
                }
            }
            
            // 生成报告
            var report = converter.GenerateMigrationReport(results);
            var reportPath = "migration-report.md";
            File.WriteAllText(reportPath, report);
            
            Console.WriteLine($"迁移报告已生成: {reportPath}");
            Console.WriteLine();
            Console.WriteLine(report);
        }
        
        static void RunTests()
        {
            Console.WriteLine("运行测试...");
            Console.WriteLine();
            
            // 测试 1: 裕语言词法分析
            Console.WriteLine("测试 1: 裕语言词法分析");
            var lexer = new YuLanguageLexer();
            var testCode = @"
sy int 当前回合 = 0
sy boolean 战斗进行中 = fou

qj ff boolean 开始战斗(string 敌人配置) {
    当前回合 = 0
    战斗进行中 = shi
    rg 初始化战斗(敌人配置) {
        fh shi
    }
    fh fou
}
";
            
            var tokens = lexer.Tokenize(testCode);
            Console.WriteLine($"  Token 数量: {tokens.Count}");
            
            var csharpCode = lexer.TokensToCSharp(tokens);
            Console.WriteLine("  转换后的 C# 代码:");
            Console.WriteLine(csharpCode);
            Console.WriteLine();
            
            // 测试 2: C# 代码生成
            Console.WriteLine("测试 2: C# 代码生成");
            var generator = new CSharpCodeGenerator();
            var gameClass = generator.GenerateIGameClass("TestManager", csharpCode, true);
            Console.WriteLine("  生成的 IGameClass:");
            Console.WriteLine(gameClass.Substring(0, Math.Min(500, gameClass.Length)) + "...");
            Console.WriteLine();
            
            // 测试 3: Android XML 转换
            Console.WriteLine("测试 3: Android XML 转换");
            var uiConverter = new AndroidXmlToWasiCoreConverter();
            var testXml = @"
<LinearLayout
    android:layout_width=""match_parent""
    android:layout_height=""match_parent""
    android:orientation=""vertical"">
    
    <TextView
        android:id=""@+id/tv_title""
        android:text=""测试标题""
        android:textSize=""18sp""/>
    
    <Button
        android:id=""@+id/btn_test""
        android:text=""测试按钮""/>
</LinearLayout>
";
            
            var uiCode = uiConverter.ConvertLayout(testXml, "TestUI");
            Console.WriteLine("  生成的 UI 代码:");
            Console.WriteLine(uiCode.Substring(0, Math.Min(500, uiCode.Length)) + "...");
            Console.WriteLine();
            
            // 测试 4: 数据模型提取
            Console.WriteLine("测试 4: 数据模型提取");
            var dataExtractor = new DataModelExtractor();
            var testDataCode = @"
sy int 最大等级配置 = 100
sy long 初始金币配置 = 10000L
sy string 游戏名称配置 = ""纪元修仙""
";
            
            var dataModels = dataExtractor.ExtractDataModels(testDataCode);
            Console.WriteLine($"  提取的数据模型: {dataModels.Count}");
            foreach (var model in dataModels)
            {
                Console.WriteLine($"    - {model.Name} ({model.Type})");
            }
            
            Console.WriteLine();
            Console.WriteLine("所有测试完成!");
        }
    }
}
