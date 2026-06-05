#if CLIENT
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using GameUI.Control;
using GameUI.Control.Enum;
using GameUI.Control.Primitive;
using GameUI.Graphics;
using SysColor = System.Drawing.Color;

namespace GameEntry.GeneratedUi.Spark2;

public sealed class FogOfWar2DConfig
{
    public bool Enabled { get; set; } = true;
    public string? FogColor { get; set; } = "rgba(4, 8, 20, 0.82)";
    public float Opacity { get; set; } = 0.82f;
    public string? Effect { get; set; } = "softNoise";
    public float NoiseStrength { get; set; } = 0.18f;
    public float VignetteStrength { get; set; } = 0.35f;
    public bool TemporaryReveal { get; set; } = true;
    public bool PermanentReveal { get; set; } = true;
    public float TemporaryFadeSeconds { get; set; } = 2.5f;
    public string? RevealSource { get; set; } = "player";
    public string[]? SourceNodeIds { get; set; }
    public float Radius { get; set; } = 140f;
    public float Softness { get; set; } = 48f;
    public int PermanentCellSize { get; set; } = 16;
    public float RevealedFogOpacity { get; set; } = 0.08f;
    public float RevealedBrightness { get; set; } = 1f;
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
}

public sealed class FogOfWar2DRuntime
{
    public FogOfWar2DConfig Config { get; set; } = new();
    private readonly HashSet<string> _explored = new();
    private readonly Dictionary<string, float> _recent = new();
    private float _nowSec;

    public void Update(Game2DSceneContext scene, float dt)
    {
        if (!Config.Enabled) return;
        _nowSec += dt;
        var sources = GetRevealSources(scene);
        var radius = Math.Max(1f, Config.Radius);
        var cellSize = Math.Max(4, Config.PermanentCellSize);
        var fadeSeconds = Math.Max(0f, Config.TemporaryFadeSeconds);

        foreach (var source in sources)
        {
            if (Config.PermanentReveal)
            {
                var minCx = (int)Math.Floor((source.x - radius) / cellSize);
                var maxCx = (int)Math.Floor((source.x + radius) / cellSize);
                var minCy = (int)Math.Floor((source.y - radius) / cellSize);
                var maxCy = (int)Math.Floor((source.y + radius) / cellSize);
                for (var cy = minCy; cy <= maxCy; cy++)
                {
                    for (var cx = minCx; cx <= maxCx; cx++)
                    {
                        var cellX = cx * cellSize + cellSize / 2f;
                        var cellY = cy * cellSize + cellSize / 2f;
                        var dx = cellX - source.x;
                        var dy = cellY - source.y;
                        if (dx * dx + dy * dy <= radius * radius)
                            _explored.Add($"{cx},{cy}");
                    }
                }
            }

            if (Config.TemporaryReveal)
            {
                var key = $"{(int)Math.Floor(source.x / cellSize)},{(int)Math.Floor(source.y / cellSize)}";
                _recent[key] = _nowSec;
            }
        }

        if (Config.TemporaryReveal && fadeSeconds > 0)
        {
            var expired = new List<string>();
            foreach (var (key, seenAt) in _recent)
            {
                if (_nowSec - seenAt > fadeSeconds) expired.Add(key);
            }
            foreach (var key in expired) _recent.Remove(key);
        }
    }

    public void Draw(CanvasAnimated canvas, Game2DSceneContext scene, float cameraX, float cameraY)
    {
        if (!Config.Enabled) return;

        var fogRgb = ParseCssColor(Config.FogColor ?? "rgba(4, 8, 20, 0.82)", SysColor.FromArgb(210, 4, 8, 20));
        var opacity = Clamp01(Config.Opacity);
        var revealedFogOpacity = Clamp01(Config.RevealedFogOpacity);
        var revealedBrightness = Math.Clamp(Config.RevealedBrightness, 0f, 3f);
        var radius = Math.Max(1f, Config.Radius);
        var softness = Math.Max(0f, Config.Softness);
        var cellSize = Math.Max(4, Config.PermanentCellSize);
        var left = Config.X - cameraX;
        var top = Config.Y - cameraY;
        var width = Config.Width > 0 ? Config.Width : scene.Config.BoundsWidth;
        var height = Config.Height > 0 ? Config.Height : scene.Config.BoundsHeight;
        var sources = GetRevealSources(scene);

        // 1) 未解锁满雾（整体透明度只作用于此层）
        canvas.BlendMode = BlendMode.SourceOver;
        canvas.Alpha = opacity * (fogRgb.A / 255f);
        canvas.FillPaint = SysColor.FromArgb(255, fogRgb.R, fogRgb.G, fogRgb.B);
        canvas.FillRectangle(left, top, width, height);

        // 2) 挖洞：临时视野圈 + 永久探索格
        canvas.BlendMode = BlendMode.DestinationOut;
        canvas.Alpha = 1f;
        canvas.FillPaint = SysColor.FromArgb(255, 0, 0, 0);

        if (Config.TemporaryReveal)
        {
            foreach (var source in sources)
                DrawRevealCircle(canvas, source.x - cameraX, source.y - cameraY, radius, softness);
        }

        if (Config.PermanentReveal)
        {
            foreach (var key in _explored)
            {
                var parts = key.Split(',');
                if (parts.Length != 2) continue;
                if (!int.TryParse(parts[0], out var cx) || !int.TryParse(parts[1], out var cy)) continue;
                canvas.FillRectangle(
                    cx * cellSize - cameraX,
                    cy * cellSize - cameraY,
                    cellSize + 1,
                    cellSize + 1);
            }
        }

        // 3) 已揭示区域残留薄雾（独立于整体透明度）
        if (revealedFogOpacity > 0f)
        {
            canvas.BlendMode = BlendMode.SourceOver;
            canvas.Alpha = revealedFogOpacity * (fogRgb.A / 255f);
            canvas.FillPaint = SysColor.FromArgb(255, fogRgb.R, fogRgb.G, fogRgb.B);

            if (Config.TemporaryReveal)
            {
                foreach (var source in sources)
                    DrawRevealCircle(canvas, source.x - cameraX, source.y - cameraY, radius, softness);
            }

            if (Config.PermanentReveal)
            {
                foreach (var key in _explored)
                {
                    var parts = key.Split(',');
                    if (parts.Length != 2) continue;
                    if (!int.TryParse(parts[0], out var cx) || !int.TryParse(parts[1], out var cy)) continue;
                    canvas.FillRectangle(
                        cx * cellSize - cameraX,
                        cy * cellSize - cameraY,
                        cellSize + 1,
                        cellSize + 1);
                }
            }
        }

        // 4) 已揭示区域亮度（>1 提亮 Lighten，<1 压暗半透明黑幕 SourceOver）
        if (Math.Abs(revealedBrightness - 1f) > 0.001f)
        {
            var amount = revealedBrightness > 1f
                ? Math.Min(1f, revealedBrightness - 1f)
                : Math.Min(1f, 1f - revealedBrightness);
            var tint = revealedBrightness > 1f
                ? SysColor.FromArgb((int)Math.Round(amount * 255f), 255, 255, 255)
                : SysColor.FromArgb((int)Math.Round(amount * 255f), 0, 0, 0);
            canvas.BlendMode = revealedBrightness > 1f ? BlendMode.Lighten : BlendMode.SourceOver;
            canvas.Alpha = 1f;
            canvas.FillPaint = tint;

            if (Config.TemporaryReveal)
            {
                foreach (var source in sources)
                    DrawRevealCircle(canvas, source.x - cameraX, source.y - cameraY, radius, softness);
            }

            if (Config.PermanentReveal)
            {
                foreach (var key in _explored)
                {
                    var parts = key.Split(',');
                    if (parts.Length != 2) continue;
                    if (!int.TryParse(parts[0], out var cx) || !int.TryParse(parts[1], out var cy)) continue;
                    canvas.FillRectangle(
                        cx * cellSize - cameraX,
                        cy * cellSize - cameraY,
                        cellSize + 1,
                        cellSize + 1);
                }
            }
        }

        canvas.BlendMode = BlendMode.SourceOver;
        canvas.Alpha = 1f;
    }

    private IEnumerable<(float x, float y)> GetRevealSources(Game2DSceneContext scene)
    {
        var revealSource = (Config.RevealSource ?? "player").Trim();
        if (revealSource.Equals("allCharacters", StringComparison.OrdinalIgnoreCase))
        {
            var body = scene.Character?.Body;
            if (body != null)
                yield return (body.X + body.Width / 2f, body.Y + body.Height / 2f);
            yield break;
        }

        if (revealSource.Equals("nodeIds", StringComparison.OrdinalIgnoreCase))
        {
            var ids = Config.SourceNodeIds ?? Array.Empty<string>();
            var body = scene.Character?.Body;
            if (body != null && ids.Length == 0)
                yield return (body.X + body.Width / 2f, body.Y + body.Height / 2f);
            yield break;
        }

        var player = scene.Character?.Body;
        if (player != null)
            yield return (player.X + player.Width / 2f, player.Y + player.Height / 2f);
    }

    private static void DrawRevealCircle(CanvasAnimated canvas, float x, float y, float radius, float softness)
    {
        var inner = Math.Max(1f, radius - softness);
        var outer = radius + softness;
        canvas.FillPaint = new RadialGradientPaint(
            new System.Drawing.PointF(x, y),
            inner,
            outer,
            SysColor.FromArgb(255, 0, 0, 0),
            SysColor.FromArgb(0, 0, 0, 0));
        canvas.FillCircle(x, y, outer);
    }

    private static float Clamp01(float value) => Math.Max(0f, Math.Min(1f, value));

    private static SysColor ParseCssColor(string input, SysColor fallback)
    {
        if (string.IsNullOrWhiteSpace(input)) return fallback;
        var value = input.Trim();
        var rgba = Regex.Match(
            value,
            @"^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$",
            RegexOptions.IgnoreCase);
        if (rgba.Success)
        {
            var r = (byte)Math.Clamp(int.Parse(rgba.Groups[1].Value, CultureInfo.InvariantCulture), 0, 255);
            var g = (byte)Math.Clamp(int.Parse(rgba.Groups[2].Value, CultureInfo.InvariantCulture), 0, 255);
            var b = (byte)Math.Clamp(int.Parse(rgba.Groups[3].Value, CultureInfo.InvariantCulture), 0, 255);
            var a = rgba.Groups[4].Success
                ? (byte)Math.Clamp((int)Math.Round(float.Parse(rgba.Groups[4].Value, CultureInfo.InvariantCulture) * 255f), 0, 255)
                : (byte)255;
            return SysColor.FromArgb(a, r, g, b);
        }

        if (value.StartsWith('#'))
        {
            var hex = value.TrimStart('#');
            if (hex.Length == 6
                && byte.TryParse(hex[..2], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var r)
                && byte.TryParse(hex.Substring(2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var g)
                && byte.TryParse(hex.Substring(4, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var b))
            {
                return SysColor.FromArgb(255, r, g, b);
            }
        }

        return fallback;
    }
}

public static partial class LayoutEditorSpark2Runtime
{
    public static void ConfigureFogOfWar2D(Control panel, FogOfWar2DConfig config)
    {
        if (_activeScene == null) return;

        var bounds = config;
        if (bounds.Width <= 0 || bounds.Height <= 0)
        {
            bounds = new FogOfWar2DConfig
            {
                Enabled = config.Enabled,
                FogColor = config.FogColor,
                Opacity = config.Opacity,
                Effect = config.Effect,
                NoiseStrength = config.NoiseStrength,
                VignetteStrength = config.VignetteStrength,
                TemporaryReveal = config.TemporaryReveal,
                PermanentReveal = config.PermanentReveal,
                TemporaryFadeSeconds = config.TemporaryFadeSeconds,
                RevealSource = config.RevealSource,
                SourceNodeIds = config.SourceNodeIds,
                Radius = config.Radius,
                Softness = config.Softness,
                PermanentCellSize = config.PermanentCellSize,
                RevealedFogOpacity = config.RevealedFogOpacity,
                RevealedBrightness = config.RevealedBrightness,
                X = panel.Margin.Left,
                Y = panel.Margin.Top,
                Width = panel.Width > 0 ? panel.Width : _activeScene.Config.BoundsWidth,
                Height = panel.Height > 0 ? panel.Height : _activeScene.Config.BoundsHeight,
            };
        }

        _activeScene.FogLayers.Add(new FogOfWar2DRuntime { Config = bounds });
        Game.Logger.LogInformation(
            "ConfigureFogOfWar2D: effect={Effect} radius={Radius} revealedFogOpacity={RevealedFogOpacity}",
            bounds.Effect,
            bounds.Radius,
            bounds.RevealedFogOpacity);
    }

    private static void UpdateFogOfWar(float dt)
    {
        if (_activeScene == null) return;
        foreach (var fog in _activeScene.FogLayers)
            fog.Update(_activeScene, dt);
    }

    private static void DrawFogOfWar(CanvasAnimated canvas, float cameraX, float cameraY)
    {
        if (_activeScene == null) return;
        foreach (var fog in _activeScene.FogLayers)
            fog.Draw(canvas, _activeScene, cameraX, cameraY);
    }
}
#endif
