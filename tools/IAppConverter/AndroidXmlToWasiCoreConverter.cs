using System;
using System.Collections.Generic;
using System.Text;
using System.Xml.Linq;

namespace IAppConverter
{
    /// <summary>
    /// Android XML 布局转换为 WasiCore 流式布局代码
    /// </summary>
    public class AndroidXmlToWasiCoreConverter
    {
        // 设计分辨率常量（竖屏 16:9）
        private const float DesignWidth = 1080f;
        private const float DesignHeight = 1920f;

        /// <summary>
        /// 转换 Android XML 布局为 WasiCore 流式布局代码
        /// </summary>
        public string ConvertLayout(string xmlContent, string className)
        {
            var sb = new StringBuilder();
            
            // 生成类头部
            sb.AppendLine("#if CLIENT");
            sb.AppendLine("using GameCore;");
            sb.AppendLine("using GameCore.BaseInterface;");
            sb.AppendLine("using GameCore.UI;");
            sb.AppendLine();
            sb.AppendLine("namespace GameEntry");
            sb.AppendLine("{");
            sb.AppendLine($"    /// <summary>");
            sb.AppendLine($"    /// {className} - UI 界面（从 iApp 迁移）");
            sb.AppendLine($"    /// </summary>");
            sb.AppendLine($"    public class {className} : IGameClass");
            sb.AppendLine("    {");
            sb.AppendLine("        // 设计分辨率（竖屏 16:9）");
            sb.AppendLine($"        private const float DesignWidth = {DesignWidth}f;");
            sb.AppendLine($"        private const float DesignHeight = {DesignHeight}f;");
            sb.AppendLine();
            sb.AppendLine("        private static Panel rootPanel;");
            sb.AppendLine();
            sb.AppendLine("        public static void OnRegisterGameClass()");
            sb.AppendLine("        {");
            sb.AppendLine("            Game.OnGameStart += OnGameStart;");
            sb.AppendLine("        }");
            sb.AppendLine();
            sb.AppendLine("        private static void OnGameStart()");
            sb.AppendLine("        {");
            sb.AppendLine("            InitializeUI();");
            sb.AppendLine("        }");
            sb.AppendLine();
            sb.AppendLine("        private static void InitializeUI()");
            sb.AppendLine("        {");
            
            // 解析 XML 并生成 UI 代码
            try
            {
                var doc = XDocument.Parse(xmlContent);
                var rootElement = doc.Root;
                
                if (rootElement != null)
                {
                    sb.AppendLine("            // 根容器 - 使用流式布局");
                    sb.AppendLine("            rootPanel = new Panel()");
                    sb.AppendLine("                .FullScreen()");
                    
                    // 根据根元素类型设置流式布局方向
                    var orientation = rootElement.Attribute("android:orientation")?.Value;
                    if (orientation == "vertical")
                    {
                        sb.AppendLine("                .FlowVertical()");
                    }
                    else if (orientation == "horizontal")
                    {
                        sb.AppendLine("                .FlowHorizontal()");
                    }
                    else
                    {
                        sb.AppendLine("                .FlowVertical()  // 默认垂直布局");
                    }
                    
                    sb.AppendLine("                .Padding(20)");
                    sb.AppendLine("                .Background(Color.Transparent);");
                    sb.AppendLine();
                    
                    // 转换子元素
                    ConvertChildElements(rootElement, "rootPanel", sb, 3);
                    
                    sb.AppendLine();
                    sb.AppendLine("            rootPanel.AddToVisualTree();");
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine($"            // TODO: XML 解析错误 - {ex.Message}");
                sb.AppendLine("            // 请手动转换布局");
            }
            
            sb.AppendLine("        }");
            sb.AppendLine("    }");
            sb.AppendLine("}");
            sb.AppendLine("#endif");
            
            return sb.ToString();
        }

        /// <summary>
        /// 转换子元素
        /// </summary>
        private void ConvertChildElements(XElement parent, string parentVarName, StringBuilder sb, int indentLevel)
        {
            int childIndex = 0;
            
            foreach (var element in parent.Elements())
            {
                string childVarName = $"{parentVarName}Child{childIndex++}";
                string indent = new string(' ', indentLevel * 4);
                
                sb.AppendLine();
                sb.AppendLine($"{indent}// {element.Name.LocalName}");
                
                switch (element.Name.LocalName)
                {
                    case "LinearLayout":
                        ConvertLinearLayout(element, childVarName, parentVarName, sb, indentLevel);
                        break;
                    
                    case "TextView":
                        ConvertTextView(element, childVarName, parentVarName, sb, indentLevel);
                        break;
                    
                    case "Button":
                        ConvertButton(element, childVarName, parentVarName, sb, indentLevel);
                        break;
                    
                    case "EditText":
                        ConvertEditText(element, childVarName, parentVarName, sb, indentLevel);
                        break;
                    
                    case "ImageView":
                        ConvertImageView(element, childVarName, parentVarName, sb, indentLevel);
                        break;
                    
                    default:
                        sb.AppendLine($"{indent}// TODO: 不支持的控件类型 {element.Name.LocalName}");
                        break;
                }
            }
        }

        private void ConvertLinearLayout(XElement element, string varName, string parentVarName, StringBuilder sb, int indentLevel)
        {
            string indent = new string(' ', indentLevel * 4);
            var orientation = element.Attribute("android:orientation")?.Value;
            
            sb.AppendLine($"{indent}var {varName} = new Panel()");
            sb.AppendLine($"{indent}    .AutoHeight()");
            sb.AppendLine($"{indent}    .WidthGrow(1)");
            
            if (orientation == "vertical")
            {
                sb.AppendLine($"{indent}    .FlowVertical()");
            }
            else
            {
                sb.AppendLine($"{indent}    .FlowHorizontal()");
            }
            
            sb.AppendLine($"{indent}    .Padding(10);");
            sb.AppendLine($"{indent}{varName}.Parent = {parentVarName};");
            
            // 递归转换子元素
            ConvertChildElements(element, varName, sb, indentLevel);
        }

        private void ConvertTextView(XElement element, string varName, string parentVarName, StringBuilder sb, int indentLevel)
        {
            string indent = new string(' ', indentLevel * 4);
            var text = element.Attribute("android:text")?.Value ?? "";
            var textSize = element.Attribute("android:textSize")?.Value?.Replace("sp", "") ?? "16";
            
            sb.AppendLine($"{indent}var {varName} = new TextBlock()");
            sb.AppendLine($"{indent}    .Text(\"{text}\")");
            sb.AppendLine($"{indent}    .FontSize({textSize})");
            sb.AppendLine($"{indent}    .TextColor(Color.White)");
            sb.AppendLine($"{indent}    .Margin(0, 0, 0, 10);");
            sb.AppendLine($"{indent}{varName}.Parent = {parentVarName};");
        }

        private void ConvertButton(XElement element, string varName, string parentVarName, StringBuilder sb, int indentLevel)
        {
            string indent = new string(' ', indentLevel * 4);
            var text = element.Attribute("android:text")?.Value ?? "按钮";
            var id = element.Attribute("android:id")?.Value?.Replace("@+id/", "") ?? "button";
            
            sb.AppendLine($"{indent}var {varName} = new Button()");
            sb.AppendLine($"{indent}    .Text(\"{text}\")");
            sb.AppendLine($"{indent}    .Size(DesignWidth - 40, 50)");
            sb.AppendLine($"{indent}    .FontSize(16)");
            sb.AppendLine($"{indent}    .OnClick(On{ToPascalCase(id)}Clicked);");
            sb.AppendLine($"{indent}{varName}.Parent = {parentVarName};");
        }

        private void ConvertEditText(XElement element, string varName, string parentVarName, StringBuilder sb, int indentLevel)
        {
            string indent = new string(' ', indentLevel * 4);
            var hint = element.Attribute("android:hint")?.Value ?? "";
            
            sb.AppendLine($"{indent}var {varName} = new TextBox()");
            sb.AppendLine($"{indent}    .PlaceholderText(\"{hint}\")");
            sb.AppendLine($"{indent}    .Size(DesignWidth - 40, 40)");
            sb.AppendLine($"{indent}    .FontSize(16)");
            sb.AppendLine($"{indent}    .Margin(0, 0, 0, 10);");
            sb.AppendLine($"{indent}{varName}.Parent = {parentVarName};");
        }

        private void ConvertImageView(XElement element, string varName, string parentVarName, StringBuilder sb, int indentLevel)
        {
            string indent = new string(' ', indentLevel * 4);
            var src = element.Attribute("android:src")?.Value ?? "";
            
            sb.AppendLine($"{indent}var {varName} = new Image()");
            sb.AppendLine($"{indent}    .Size(100, 100)");
            sb.AppendLine($"{indent}    .Margin(10);");
            sb.AppendLine($"{indent}// TODO: 设置图片源 - {src}");
            sb.AppendLine($"{indent}{varName}.Parent = {parentVarName};");
        }

        private string ToPascalCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            
            var parts = input.Split('_');
            var sb = new StringBuilder();
            
            foreach (var part in parts)
            {
                if (part.Length > 0)
                {
                    sb.Append(char.ToUpper(part[0]));
                    if (part.Length > 1)
                    {
                        sb.Append(part.Substring(1));
                    }
                }
            }
            
            return sb.ToString();
        }
    }
}
