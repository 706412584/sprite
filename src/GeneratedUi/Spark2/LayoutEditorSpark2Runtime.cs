#if CLIENT
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using GameUI;
using GameUI.Control;
using GameUI.Control.Primitive;
using GameUI.Control.Struct;
using GameUI.Struct;

namespace GameEntry.GeneratedUi.Spark2;

public sealed class LayoutScreenResult
{
    public LayoutScreenResult(Panel root, IReadOnlyDictionary<string, Control> nodes)
    {
        Root = root;
        Nodes = nodes;
    }

    public Panel Root { get; }
    public IReadOnlyDictionary<string, Control> Nodes { get; }

    public Panel Mount()
    {
        UIRoot.Instance.AddChild(Root);
        return Root;
    }

    public Panel AttachTo(Control parent)
    {
        Root.Parent = parent;
        return Root;
    }
}

public static partial class LayoutEditorSpark2Runtime
{
    public static string AssetRoot { get; set; } =
        @"D:\User\70641\Documents\SCE Projects\game_entry_0\tools\layout-editor\mcp-runtime-export-spark2\丛林冒险\默认项目";

    public static T Register<T>(IDictionary<string, Control> nodes, string id, T control) where T : Control
    {
        nodes[id] = control;
        return control;
    }

    public static void BindAction(Control control, string actionId, Action<string>? onAction)
    {
        control.OnPointerClicked += (_, _) => onAction?.Invoke(actionId);
    }

    public static Thickness Thickness(float left, float top, float right, float bottom)
    {
        return new Thickness(left, top, right, bottom);
    }

    public static Color Color(byte r, byte g, byte b, byte a = 255)
    {
        return System.Drawing.Color.FromArgb(a, r, g, b);
    }

    public static string Asset(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return string.Empty;
        }

        // 处理相对路径，转换为引擎资源路径
        // 输入: "./assets/game2d/sheets/mossy_hills.png"
        // 输出: "image/game2d/sheets/mossy_hills.png" (假设文件在 ui/image/ 下)
        
        string cleanPath = relativePath;
        
        // 移除 "./" 前缀
        if (cleanPath.StartsWith("./"))
        {
            cleanPath = cleanPath.Substring(2);
        }
        
        // 将 "assets/" 映射到 "image/"
        // 因为引擎要求: ui/image/xxx.png -> 代码中使用 "image/xxx.png"
        if (cleanPath.StartsWith("assets/"))
        {
            cleanPath = "image/" + cleanPath.Substring(7); // 移除 "assets/" 加上 "image/"
        }
        
        Game.Logger.LogInformation($"[LayoutEditor] Asset path: {relativePath} -> {cleanPath}");
        return cleanPath;
    }

    public static Panel CreateImageCard(
        string debugName,
        string imagePath,
        float width,
        float height,
        Color backgroundColor,
        float cornerRadius = 8f)
    {
        return new Panel
        {
            Width = width,
            Height = height,
            HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Left,
            VerticalAlignment = GameUI.Enum.VerticalAlignment.Top,
            Image = imagePath,
            Background = new GameUI.Brush.SolidColorBrush(backgroundColor),
            CornerRadius = cornerRadius,
        };
    }

    public static Panel CreateBadge(
        string debugName,
        string text,
        float width,
        float height,
        Color backgroundColor,
        Color textColor,
        float fontSize = 12f,
        float cornerRadius = 999f)
    {
        var panel = new Panel
        {
            Width = width,
            Height = height,
            HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Left,
            VerticalAlignment = GameUI.Enum.VerticalAlignment.Top,
            Background = new GameUI.Brush.SolidColorBrush(backgroundColor),
            CornerRadius = cornerRadius,
            ClipContent = true,
        };

        _ = new Label
        {
            Text = text,
            Width = 0f,
            Height = 0f,
            WidthStretchRatio = 1f,
            HeightStretchRatio = 1f,
            TextColor = textColor,
            FontSize = fontSize,
            Bold = true,
            HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Left,
            VerticalAlignment = GameUI.Enum.VerticalAlignment.Top,
            HorizontalContentAlignment = GameUI.Enum.HorizontalContentAlignment.Center,
            VerticalContentAlignment = GameUI.Enum.VerticalContentAlignment.Center,
            Parent = panel,
        };

        return panel;
    }
}
#endif
