#if CLIENT
using System;
using System.Collections.Generic;
using System.Numerics;
using System.Threading.Tasks;
using GameCore.Event;
using GameCore.Platform.SDL;
using GameUI.Control;
using GameUI.Control.Primitive;
using GameUI.TriggerEvent;
using SysColor = System.Drawing.Color;

namespace GameEntry.GeneratedUi.Spark2;

// ─────────────────────────────────────────────
// Config data classes — mirror what csharpExporter.ts emits
// ─────────────────────────────────────────────

public sealed class GameScene2DConfig
{
    public float Gravity { get; set; } = 980f;
    public float BoundsWidth { get; set; } = 800f;
    public float BoundsHeight { get; set; } = 600f;
    public float PixelsPerMeter { get; set; } = 64f;
    
    // 背景图片路径 (格式: "image/xxx.png")
    public string BackgroundImage { get; set; } = "";
    
    // 是否启用键盘输入 (WASD + 方向键 + 空格)
    public bool EnableKeyboardInput { get; set; } = true;
}

public sealed class SpriteAnimationConfig
{
    public string ImageAsset { get; set; } = "";
    public int FrameWidth { get; set; } = 128;
    public int FrameHeight { get; set; } = 128;
    public int FrameCount { get; set; } = 12;
    public int FramesPerRow { get; set; } = 4;
    public int Fps { get; set; } = 24;
    public bool Loop { get; set; } = true;
    public bool Autoplay { get; set; } = true;
    public string DefaultAnimation { get; set; } = "idle";
}

public sealed class CharacterController2DConfig
{
    public float Speed { get; set; } = 200f;
    public float JumpForce { get; set; } = 400f;
    public float GravityScale { get; set; } = 1f;
    public string CurrentAnimation { get; set; } = "idle";
    public string BodyType { get; set; } = "Dynamic";
    
    // 动画配置 (idle/walk/jump)
    public CharacterAnimationConfig? IdleAnimation { get; set; }
    public CharacterAnimationConfig? WalkAnimation { get; set; }
    public CharacterAnimationConfig? JumpAnimation { get; set; }
}

/// <summary>角色动画配置</summary>
public sealed class CharacterAnimationConfig
{
    public string ImageAsset { get; set; } = "";
    public int FrameWidth { get; set; } = 512;
    public int FrameHeight { get; set; } = 512;
    public int FrameCount { get; set; } = 20;
    public int FramesPerRow { get; set; } = 10;
    public int Fps { get; set; } = 10;
}

public sealed class Collider2DConfig
{
    public string Shape { get; set; } = "rect";
    public string BodyType { get; set; } = "Static";
    public bool IsTrigger { get; set; }
    public float Restitution { get; set; }
    public float Friction { get; set; } = 0.5f;
    public string Tag { get; set; } = "";
}

public sealed class TileMap2DConfig
{
    public string TilesetAsset { get; set; } = "";
    public int TileSize { get; set; } = 32;
    public int Columns { get; set; } = 25;
    public int Rows { get; set; } = 19;
}

public sealed class SpinePlayerConfig
{
    public string SkeletonAsset { get; set; } = "";
    public string AtlasAsset { get; set; } = "";
    public string AnimationName { get; set; } = "idle";
    public string Skin { get; set; } = "default";
    public bool Loop { get; set; } = true;
    public bool Autoplay { get; set; } = true;
    public float TimeScale { get; set; } = 1f;
}

public sealed class JoystickConfig
{
    public float Size { get; set; } = 120f;
    public float DeadZone { get; set; } = 0.1f;
    public bool Fixed { get; set; } = true;
    public string TargetCharacterId { get; set; } = "";
}

// ─────────────────────────────────────────────
// Runtime state containers (Canvas-only, no SceneGraph)
// ─────────────────────────────────────────────

/// <summary>
/// Holds all 2D scene runtime state using pure Canvas rendering.
/// NO SceneGraph or PhysicsWorld2D - avoids native crash under MapGameMode.
/// </summary>
public sealed class Game2DSceneContext : IDisposable
{
    public CanvasAnimated? Canvas { get; set; }
    public GameScene2DConfig Config { get; set; } = new();

    // Camera offset (pixels, top-left of viewport in world space)
    public float CameraX { get; set; }
    public float CameraY { get; set; }

    // All registered sprite renderers for this scene
    public List<SpriteRenderer2D> Sprites { get; } = new();

    // All collider visual configs for debug rendering
    public List<ColliderVisual2D> ColliderVisuals { get; } = new();

    // Character controller (if any)
    public CharacterController2DRuntime? Character { get; set; }

    // Joystick runtime (if any)
    public JoystickRuntime? Joystick { get; set; }

    // Simple physics simulation state
    public List<SimplePhysicsBody> PhysicsBodies { get; } = new();

    // Last frame time for delta calculation
    public DateTime LastFrameTime { get; set; } = DateTime.Now;

    // Background image
    public GameCore.ResourceType.Image? BackgroundImage { get; set; }

    // Keyboard input state
    public bool KeyLeft { get; set; }
    public bool KeyRight { get; set; }
    public bool KeyUp { get; set; }
    public bool KeyDown { get; set; }
    public bool KeyJump { get; set; }

    // Input triggers
    public Trigger<EventGameKeyDown>? KeyDownTrigger { get; set; }
    public Trigger<EventGameKeyUp>? KeyUpTrigger { get; set; }

    public void Dispose()
    {
        KeyDownTrigger?.Destroy();
        KeyUpTrigger?.Destroy();
    }
}

/// <summary>Simple physics body for Canvas-only simulation (no Box2D).</summary>
public sealed class SimplePhysicsBody
{
    public float X { get; set; }
    public float Y { get; set; }
    public float VelocityX { get; set; }
    public float VelocityY { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
    public bool IsStatic { get; set; }
    public bool IsTrigger { get; set; }
    public string Tag { get; set; } = "";
    public float GravityScale { get; set; } = 1f;
    public bool IsGrounded { get; set; }
}

/// <summary>Runtime sprite sheet animation driven by Canvas.DrawImage with source rect.</summary>
public sealed class SpriteRenderer2D
{
    public GameCore.ResourceType.Image? SpriteSheet { get; set; }
    public SpriteAnimationConfig Config { get; set; } = new();

    // Position in the 2D world (pixels, origin = scene top-left)
    public float X { get; set; }
    public float Y { get; set; }
    // Display size (pixels)
    public float DisplayWidth { get; set; }
    public float DisplayHeight { get; set; }

    public bool FlipHorizontal { get; set; }
    public bool Playing { get; set; } = true;
    public int CurrentFrame { get; set; }
    public float FrameTimer { get; set; }

    public void Update(float dt)
    {
        if (!Playing || Config.Fps <= 0) return;
        FrameTimer += dt;
        var frameDuration = 1f / Config.Fps;
        while (FrameTimer >= frameDuration)
        {
            FrameTimer -= frameDuration;
            CurrentFrame++;
            if (CurrentFrame >= Config.FrameCount)
                CurrentFrame = Config.Loop ? 0 : Config.FrameCount - 1;
        }
    }

    public void Draw(CanvasAnimated canvas, float cameraX, float cameraY)
    {
        if (SpriteSheet == null) return;

        int col = CurrentFrame % Config.FramesPerRow;
        int row = CurrentFrame / Config.FramesPerRow;
        float srcX = col * Config.FrameWidth;
        float srcY = row * Config.FrameHeight;

        float drawX = X - cameraX;
        float drawY = Y - cameraY;

        // Debug: Log frame info occasionally
        if (CurrentFrame == 0 && FrameTimer < 0.02f)
        {
            Game.Logger.LogInformation($"SpriteRenderer2D.Draw: frame={CurrentFrame}, src=({srcX},{srcY},{Config.FrameWidth},{Config.FrameHeight}), dst=({drawX},{drawY},{DisplayWidth},{DisplayHeight})");
        }

        canvas.SaveState();
        if (FlipHorizontal)
        {
            canvas.Translate(drawX + DisplayWidth, drawY);
            canvas.Scale(-1f, 1f);
            canvas.DrawImage(SpriteSheet.Value, srcX, srcY, Config.FrameWidth, Config.FrameHeight,
                0, 0, DisplayWidth, DisplayHeight);
        }
        else
        {
            canvas.DrawImage(SpriteSheet.Value, srcX, srcY, Config.FrameWidth, Config.FrameHeight,
                drawX, drawY, DisplayWidth, DisplayHeight);
        }
        canvas.RestoreState();
    }
}

/// <summary>Collider debug/visual info for rendering outlines.</summary>
public sealed class ColliderVisual2D
{
    public SimplePhysicsBody? Body { get; set; }
    public Collider2DConfig Config { get; set; } = new();
    public float Width { get; set; }
    public float Height { get; set; }
    public float X { get; set; }
    public float Y { get; set; }
}

/// <summary>Character controller runtime: simple physics + sprite + input.</summary>
public sealed class CharacterController2DRuntime
{
    public SimplePhysicsBody Body { get; set; } = new();
    public SpriteRenderer2D Sprite { get; set; } = new();
    public CharacterController2DConfig Config { get; set; } = new();

    // Input state (set by joystick or keyboard)
    public float InputX { get; set; }
    public bool JumpRequested { get; set; }

    public void ApplyMovement(float dt, float gravity)
    {
        // Apply horizontal movement
        Body.VelocityX = InputX * Config.Speed;

        // Apply gravity
        if (!Body.IsGrounded)
        {
            Body.VelocityY += gravity * Config.GravityScale * dt;
        }

        // Apply jump
        if (JumpRequested && Body.IsGrounded)
        {
            Body.VelocityY = -Config.JumpForce;
            JumpRequested = false;
            Body.IsGrounded = false;
        }

        // Update position
        Body.X += Body.VelocityX * dt;
        Body.Y += Body.VelocityY * dt;

        // Update sprite position
        Sprite.X = Body.X;
        Sprite.Y = Body.Y;

        // Update sprite flip
        if (InputX < 0) Sprite.FlipHorizontal = true;
        else if (InputX > 0) Sprite.FlipHorizontal = false;
    }
}

/// <summary>Virtual joystick runtime state.</summary>
public sealed class JoystickRuntime
{
    public JoystickConfig Config { get; set; } = new();
    public float CenterX { get; set; }
    public float CenterY { get; set; }
    public float KnobX { get; set; }
    public float KnobY { get; set; }
    public bool Active { get; set; }
    public float OutputX { get; set; }
    public float OutputY { get; set; }

    public void Draw(CanvasAnimated canvas)
    {
        float r = Config.Size / 2f;
        // Outer circle
        canvas.StrokePaint = SysColor.FromArgb(100, 255, 255, 255);
        canvas.StrokeWidth = 2f;
        canvas.StrokeCircle(CenterX, CenterY, r);
        // Inner knob
        float knobR = r * 0.35f;
        canvas.FillPaint = SysColor.FromArgb(Active ? 160 : 80, 255, 255, 255);
        canvas.FillCircle(Active ? KnobX : CenterX, Active ? KnobY : CenterY, knobR);
    }
}

// ─────────────────────────────────────────────
// Configure* methods called by exported C# code
// ─────────────────────────────────────────────

public static partial class LayoutEditorSpark2Runtime
{
    // The active 2D scene context (one per screen for simplicity)
    private static Game2DSceneContext? _activeScene;

    /// <summary>
    /// Configures a GameScene2D node using pure Canvas rendering.
    /// NO SceneGraph or PhysicsWorld2D - avoids native crash under MapGameMode.
    /// Uses simple AABB collision detection instead.
    /// </summary>
    public static void ConfigureGameScene2D(Panel panel, GameScene2DConfig config)
    {
        Game.Logger.LogInformation("ConfigureGameScene2D: Canvas-only mode (no SceneGraph)");
        
        var ctx = new Game2DSceneContext { Config = config };
        _activeScene = ctx;

        // Create CanvasAnimated for rendering - 全屏并使用缩放
        var canvas = new CanvasAnimated
        {
            // 使用 Stretch 填满父容器
            Width = 0f,
            Height = 0f,
            WidthStretchRatio = 1f,
            HeightStretchRatio = 1f,
            HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Stretch,
            VerticalAlignment = GameUI.Enum.VerticalAlignment.Stretch,
        };
        canvas.Parent = panel;
        ctx.Canvas = canvas;

        // 设计分辨率
        float designWidth = config.BoundsWidth;
        float designHeight = config.BoundsHeight;

        // 加载背景图片 (从配置读取)
        if (!string.IsNullOrWhiteSpace(config.BackgroundImage))
        {
            try
            {
                ctx.BackgroundImage = new GameCore.ResourceType.Image(config.BackgroundImage);
                Game.Logger.LogInformation($"ConfigureGameScene2D: Background image loaded: {config.BackgroundImage}");
            }
            catch (Exception ex)
            {
                Game.Logger.LogWarning($"ConfigureGameScene2D: Failed to load background image '{config.BackgroundImage}': {ex.Message}");
            }
        }

        // 绑定键盘输入 (WASD + 方向键 + 空格) 使用全局事件触发器
        if (config.EnableKeyboardInput)
        {
            ctx.KeyDownTrigger = new Trigger<EventGameKeyDown>((s, d) =>
            {
                if (_activeScene == null) return Task.FromResult(true);
                Game.Logger.LogInformation($"KeyDown: {d.Key}");
                switch (d.Key)
                {
                    case VirtualKey.A:
                    case VirtualKey.Left:
                        _activeScene.KeyLeft = true;
                        break;
                    case VirtualKey.D:
                    case VirtualKey.Right:
                        _activeScene.KeyRight = true;
                        break;
                    case VirtualKey.W:
                    case VirtualKey.Up:
                        _activeScene.KeyUp = true;
                        if (_activeScene.Character != null)
                            _activeScene.Character.JumpRequested = true;
                        break;
                    case VirtualKey.S:
                    case VirtualKey.Down:
                        _activeScene.KeyDown = true;
                        break;
                    case VirtualKey.Space:
                        _activeScene.KeyJump = true;
                        if (_activeScene.Character != null)
                            _activeScene.Character.JumpRequested = true;
                        break;
                }
                UpdateKeyboardInput();
                return Task.FromResult(true);
            });
            ctx.KeyDownTrigger.Register(Game.Instance);

            ctx.KeyUpTrigger = new Trigger<EventGameKeyUp>((s, d) =>
            {
                if (_activeScene == null) return Task.FromResult(true);
                switch (d.Key)
                {
                    case VirtualKey.A:
                    case VirtualKey.Left:
                        _activeScene.KeyLeft = false;
                        break;
                    case VirtualKey.D:
                    case VirtualKey.Right:
                        _activeScene.KeyRight = false;
                        break;
                    case VirtualKey.W:
                    case VirtualKey.Up:
                        _activeScene.KeyUp = false;
                        break;
                    case VirtualKey.S:
                    case VirtualKey.Down:
                        _activeScene.KeyDown = false;
                        break;
                    case VirtualKey.Space:
                        _activeScene.KeyJump = false;
                        break;
                }
                UpdateKeyboardInput();
                return Task.FromResult(true);
            });
            ctx.KeyUpTrigger.Register(Game.Instance);
        }

        // Set up render loop
        canvas.OnRender += (sender, e) =>
        {
            if (_activeScene == null) return;

            var now = DateTime.Now;
            float dt = (float)(now - _activeScene.LastFrameTime).TotalSeconds;
            _activeScene.LastFrameTime = now;

            // Clamp dt to avoid huge jumps
            dt = Math.Min(dt, 0.1f);

            // 获取实际画布尺寸
            float actualWidth = canvas.ActualSize.Width;
            float actualHeight = canvas.ActualSize.Height;
            if (actualWidth <= 0) actualWidth = designWidth;
            if (actualHeight <= 0) actualHeight = designHeight;

            // 计算缩放比例（保持宽高比，适配屏幕）
            float scaleX = actualWidth / designWidth;
            float scaleY = actualHeight / designHeight;
            float scale = Math.Min(scaleX, scaleY); // 使用较小的缩放比保持宽高比

            // 计算居中偏移
            float offsetX = (actualWidth - designWidth * scale) / 2f;
            float offsetY = (actualHeight - designHeight * scale) / 2f;

            // 应用缩放变换
            canvas.SaveState();
            canvas.Translate(offsetX, offsetY);
            canvas.Scale(scale, scale);

            // 先绘制背景图片 (mossy_hills.png) - 作为最底层
            if (_activeScene.BackgroundImage != null)
            {
                canvas.DrawImage(_activeScene.BackgroundImage.Value, 0, 0, designWidth, designHeight);
            }

            // 然后绘制半透明的天空渐变背景覆盖在图片上 (模拟 opacity: 0.25 的效果)
            // 使用 75% 不透明度的渐变覆盖，让底层图片透出 25%
            // 上半部分: #0c1a2e (深蓝) -> #162a3e (蓝绿)
            canvas.FillPaint = new GameUI.Graphics.LinearGradientPaint(
                new System.Drawing.PointF(0, 0),
                new System.Drawing.PointF(0, designHeight * 0.5f),
                SysColor.FromArgb(192, 12, 26, 46),   // #0c1a2e with 75% opacity
                SysColor.FromArgb(192, 22, 42, 62)    // #162a3e with 75% opacity
            );
            canvas.FillRectangle(0, 0, designWidth, designHeight * 0.5f);

            // 下半部分: #162a3e (蓝绿) -> #1a3a2a (深绿)
            canvas.FillPaint = new GameUI.Graphics.LinearGradientPaint(
                new System.Drawing.PointF(0, designHeight * 0.5f),
                new System.Drawing.PointF(0, designHeight),
                SysColor.FromArgb(192, 22, 42, 62),   // #162a3e with 75% opacity
                SysColor.FromArgb(192, 26, 58, 42)    // #1a3a2a with 75% opacity
            );
            canvas.FillRectangle(0, designHeight * 0.5f, designWidth, designHeight * 0.5f);

            // Update simple physics
            UpdateSimplePhysics(dt);

            // Update and draw sprites
            foreach (var sprite in _activeScene.Sprites)
            {
                sprite.Update(dt);
                sprite.Draw(canvas, _activeScene.CameraX, _activeScene.CameraY);
            }

            // Draw joystick if present
            _activeScene.Joystick?.Draw(canvas);

            // Draw debug colliders (optional)
            DrawDebugColliders(canvas);

            canvas.RestoreState();
        };

        // Start the animation loop
        canvas.StartTimingDelayed(16); // ~60 FPS

        Game.Logger.LogInformation("ConfigureGameScene2D: Canvas-only setup complete, design={0}x{1}", designWidth, designHeight);
    }

    private static void UpdateKeyboardInput()
    {
        if (_activeScene?.Character == null)
        {
            Game.Logger.LogWarning("UpdateKeyboardInput: No character controller!");
            return;
        }

        float inputX = 0f;
        if (_activeScene.KeyLeft) inputX -= 1f;
        if (_activeScene.KeyRight) inputX += 1f;

        _activeScene.Character.InputX = inputX;
        Game.Logger.LogInformation($"UpdateKeyboardInput: InputX={inputX}, Left={_activeScene.KeyLeft}, Right={_activeScene.KeyRight}");
    }

    private static void UpdateSimplePhysics(float dt)
    {
        if (_activeScene == null) return;

        var config = _activeScene.Config;
        float gravity = config.Gravity;

        // Update character controller
        if (_activeScene.Character != null)
        {
            _activeScene.Character.ApplyMovement(dt, gravity);

            // Simple ground collision with static bodies
            var charBody = _activeScene.Character.Body;
            charBody.IsGrounded = false;

            foreach (var body in _activeScene.PhysicsBodies)
            {
                if (!body.IsStatic) continue;

                // AABB collision check
                if (CheckAABBCollision(charBody, body))
                {
                    // Resolve collision (simple push out)
                    ResolveCollision(charBody, body);
                }
            }

            // Clamp to bounds
            charBody.X = Math.Clamp(charBody.X, 0, config.BoundsWidth - charBody.Width);
            charBody.Y = Math.Clamp(charBody.Y, 0, config.BoundsHeight - charBody.Height);

            // Ground check at bottom
            if (charBody.Y >= config.BoundsHeight - charBody.Height - 1)
            {
                charBody.IsGrounded = true;
                charBody.VelocityY = 0;
            }
        }
    }

    private static bool CheckAABBCollision(SimplePhysicsBody a, SimplePhysicsBody b)
    {
        return a.X < b.X + b.Width &&
               a.X + a.Width > b.X &&
               a.Y < b.Y + b.Height &&
               a.Y + a.Height > b.Y;
    }

    private static void ResolveCollision(SimplePhysicsBody dynamic, SimplePhysicsBody staticBody)
    {
        // Calculate overlap
        float overlapLeft = (dynamic.X + dynamic.Width) - staticBody.X;
        float overlapRight = (staticBody.X + staticBody.Width) - dynamic.X;
        float overlapTop = (dynamic.Y + dynamic.Height) - staticBody.Y;
        float overlapBottom = (staticBody.Y + staticBody.Height) - dynamic.Y;

        // Find minimum overlap
        float minOverlapX = Math.Min(overlapLeft, overlapRight);
        float minOverlapY = Math.Min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY)
        {
            // Resolve horizontally
            if (overlapLeft < overlapRight)
                dynamic.X = staticBody.X - dynamic.Width;
            else
                dynamic.X = staticBody.X + staticBody.Width;
            dynamic.VelocityX = 0;
        }
        else
        {
            // Resolve vertically
            if (overlapTop < overlapBottom)
            {
                dynamic.Y = staticBody.Y - dynamic.Height;
                dynamic.IsGrounded = true;
                dynamic.VelocityY = 0;
            }
            else
            {
                dynamic.Y = staticBody.Y + staticBody.Height;
                dynamic.VelocityY = 0;
            }
        }
    }

    private static void DrawDebugColliders(CanvasAnimated canvas)
    {
        if (_activeScene == null) return;

        // Draw collider visuals (filled rectangles with borders like in layout editor)
        foreach (var visual in _activeScene.ColliderVisuals)
        {
            float x = visual.X - _activeScene.CameraX;
            float y = visual.Y - _activeScene.CameraY;

            // 根据 tag 决定颜色
            if (visual.Config.Tag == "ground")
            {
                // 地面: 深绿色填充 + 亮绿色边框
                canvas.FillPaint = SysColor.FromArgb(255, 26, 58, 26); // #1a3a1a
                canvas.FillRectangle(x, y, visual.Width, visual.Height);
                canvas.StrokePaint = SysColor.FromArgb(255, 74, 222, 128); // #4ade80
                canvas.StrokeWidth = 2f;
                canvas.StrokeRectangle(x, y, visual.Width, visual.Height);
            }
            else if (visual.Config.Tag == "platform")
            {
                // 平台: 稍深绿色填充 + 亮绿色边框
                canvas.FillPaint = SysColor.FromArgb(255, 42, 74, 42); // #2a4a2a
                canvas.FillRectangle(x, y, visual.Width, visual.Height);
                canvas.StrokePaint = SysColor.FromArgb(255, 74, 222, 128); // #4ade80
                canvas.StrokeWidth = 1f;
                canvas.StrokeRectangle(x, y, visual.Width, visual.Height);
            }
            else if (visual.Config.IsTrigger)
            {
                // 触发器 (敌人): 黄色半透明边框
                canvas.StrokePaint = SysColor.FromArgb(80, 255, 200, 0);
                canvas.StrokeWidth = 1f;
                canvas.StrokeRectangle(x, y, visual.Width, visual.Height);
            }
            else
            {
                // 其他碰撞体: 绿色半透明边框
                canvas.StrokePaint = SysColor.FromArgb(80, 0, 255, 100);
                canvas.StrokeWidth = 1f;
                canvas.StrokeRectangle(x, y, visual.Width, visual.Height);
            }
        }

        // 绘制草地线 (在地面上方)
        var groundCollider = _activeScene.ColliderVisuals.Find(v => v.Config.Tag == "ground");
        if (groundCollider != null)
        {
            float lineY = groundCollider.Y - _activeScene.CameraY - 2f;
            canvas.StrokePaint = SysColor.FromArgb(255, 74, 222, 128); // #4ade80
            canvas.StrokeWidth = 3f;
            canvas.DrawLine(0, lineY, _activeScene.Config.BoundsWidth, lineY);
        }
    }

    /// <summary>
    /// Configures a SpriteAnimation node. Creates a SpriteRenderer2D that draws
    /// frames from a sprite sheet using Canvas.DrawImage with source rectangles.
    /// </summary>
    public static void ConfigureSpriteAnimation(Panel panel, SpriteAnimationConfig config)
    {
        if (_activeScene == null) return;

        GameCore.ResourceType.Image? sheet = null;
        if (!string.IsNullOrWhiteSpace(config.ImageAsset))
        {
            try { sheet = new GameCore.ResourceType.Image(config.ImageAsset); }
            catch { /* Image not found — will skip drawing */ }
        }

        var renderer = new SpriteRenderer2D
        {
            SpriteSheet = sheet,
            Config = config,
            X = panel.Margin.Left,
            Y = panel.Margin.Top,
            DisplayWidth = panel.Width > 0 ? panel.Width : config.FrameWidth,
            DisplayHeight = panel.Height > 0 ? panel.Height : config.FrameHeight,
            Playing = config.Autoplay,
        };

        _activeScene.Sprites.Add(renderer);
    }

    /// <summary>
    /// Configures a Collider2D node using simple AABB physics (no Box2D).
    /// </summary>
    public static void ConfigureCollider2D(Panel panel, Collider2DConfig config)
    {
        if (_activeScene == null) return;

        float pxW = panel.Width > 0 ? panel.Width : 64f;
        float pxH = panel.Height > 0 ? panel.Height : 64f;
        float pxX = panel.Margin.Left;
        float pxY = panel.Margin.Top;

        var body = new SimplePhysicsBody
        {
            X = pxX,
            Y = pxY,
            Width = pxW,
            Height = pxH,
            IsStatic = config.BodyType != "Dynamic",
            IsTrigger = config.IsTrigger,
            Tag = config.Tag,
        };

        _activeScene.PhysicsBodies.Add(body);

        // Store visual info for debug rendering
        _activeScene.ColliderVisuals.Add(new ColliderVisual2D
        {
            Body = body,
            Config = config,
            Width = pxW,
            Height = pxH,
            X = pxX,
            Y = pxY,
        });
    }

    /// <summary>
    /// Configures a CharacterController2D node using simple physics.
    /// </summary>
    public static void ConfigureCharacterController2D(Panel panel, CharacterController2DConfig config)
    {
        if (_activeScene == null) return;

        float pxW = panel.Width > 0 ? panel.Width : 48f;
        float pxH = panel.Height > 0 ? panel.Height : 64f;
        float pxX = panel.Margin.Left;
        float pxY = panel.Margin.Top;

        var body = new SimplePhysicsBody
        {
            X = pxX,
            Y = pxY,
            Width = pxW,
            Height = pxH,
            IsStatic = false,
            GravityScale = config.GravityScale,
        };

        // 从配置读取动画信息，优先使用 IdleAnimation
        var animConfig = config.IdleAnimation ?? new CharacterAnimationConfig
        {
            ImageAsset = "image/game2d/sheets/wizard_idle.png",
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 20,
            FramesPerRow = 10,
            Fps = 10,
        };

        // Load character sprite
        GameCore.ResourceType.Image? sheet = null;
        if (!string.IsNullOrWhiteSpace(animConfig.ImageAsset))
        {
            try 
            { 
                sheet = new GameCore.ResourceType.Image(animConfig.ImageAsset);
                Game.Logger.LogInformation($"ConfigureCharacterController2D: Loaded sprite {animConfig.ImageAsset}");
            }
            catch (Exception ex) 
            { 
                Game.Logger.LogWarning($"ConfigureCharacterController2D: Failed to load sprite '{animConfig.ImageAsset}': {ex.Message}");
            }
        }

        // Create a sprite renderer for the character with animation config from export
        var sprite = new SpriteRenderer2D
        {
            SpriteSheet = sheet,
            Config = new SpriteAnimationConfig 
            { 
                ImageAsset = animConfig.ImageAsset,
                FrameWidth = animConfig.FrameWidth,
                FrameHeight = animConfig.FrameHeight,
                FrameCount = animConfig.FrameCount,
                FramesPerRow = animConfig.FramesPerRow,
                Fps = animConfig.Fps,
                Loop = true,
                Autoplay = true,
            },
            X = pxX,
            Y = pxY,
            DisplayWidth = pxW,
            DisplayHeight = pxH,
            Playing = true,
        };

        var runtime = new CharacterController2DRuntime
        {
            Body = body,
            Sprite = sprite,
            Config = config,
        };

        _activeScene.Character = runtime;
        _activeScene.Sprites.Add(sprite);
        _activeScene.PhysicsBodies.Add(body);
    }

    /// <summary>
    /// Configures a Joystick node. Provides virtual joystick input rendered on
    /// the CanvasAnimated overlay, driving the character controller.
    /// </summary>
    public static void ConfigureJoystick(Panel panel, JoystickConfig config)
    {
        if (_activeScene?.Canvas == null) return;

        var ctx = _activeScene;
        var canvas = ctx.Canvas;
        float size = config.Size;
        float cx = size / 2f + 40f; // default bottom-left position
        float cy = ctx.Config.BoundsHeight - size / 2f - 40f;

        var joystick = new JoystickRuntime
        {
            Config = config,
            CenterX = cx,
            CenterY = cy,
        };

        // Hook pointer events on the canvas for joystick input
        canvas.OnPointerPressed += (sender, e) =>
        {
            float px = e.Position.X;
            float py = e.Position.Y;
            float dist = MathF.Sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
            if (dist <= size)
            {
                joystick.Active = true;
                joystick.KnobX = px;
                joystick.KnobY = py;
                canvas.CapturePointer(e.PointerButtons);
            }
        };

        canvas.OnPointerCapturedMove += (sender, e) =>
        {
            if (!joystick.Active) return;
            float px = e.Position.X;
            float py = e.Position.Y;
            float dx = px - cx;
            float dy = py - cy;
            float dist = MathF.Sqrt(dx * dx + dy * dy);
            float maxR = size / 2f;
            if (dist > maxR)
            {
                dx = dx / dist * maxR;
                dy = dy / dist * maxR;
            }
            joystick.KnobX = cx + dx;
            joystick.KnobY = cy + dy;

            float normX = dx / maxR;
            float normY = dy / maxR;
            joystick.OutputX = MathF.Abs(normX) > config.DeadZone ? normX : 0f;
            joystick.OutputY = MathF.Abs(normY) > config.DeadZone ? normY : 0f;

            // Feed input to character controller
            if (ctx.Character != null)
            {
                ctx.Character.InputX = joystick.OutputX;
                if (joystick.OutputY < -0.5f)
                    ctx.Character.JumpRequested = true;
            }
        };

        canvas.OnPointerReleased += (sender, e) =>
        {
            joystick.Active = false;
            joystick.OutputX = 0;
            joystick.OutputY = 0;
            if (ctx.Character != null)
                ctx.Character.InputX = 0;
        };

        ctx.Joystick = joystick;
    }

    /// <summary>
    /// Configures a SpinePlayer node. Spark 2.0 has no native Spine support.
    /// This is a placeholder — logs a warning and creates a static panel.
    /// </summary>
    public static void ConfigureSpinePlayer(Panel panel, SpinePlayerConfig config)
    {
        Game.Logger.LogWarning($"[LayoutEditor] SpinePlayer not supported in Spark2 runtime. " +
                        $"skeleton={config.SkeletonAsset}, anim={config.AnimationName}. " +
                        $"Convert to frame sequence or use ActorModel.");
    }

    /// <summary>
    /// Configures a TileMap2D node. Spark 2.0 has no native TMX support.
    /// This is a placeholder that renders a debug grid.
    /// </summary>
    public static void ConfigureTileMap2D(Panel panel, TileMap2DConfig config)
    {
        if (_activeScene == null) return;
        Game.Logger.LogWarning($"[LayoutEditor] TileMap2D stub: {config.Columns}x{config.Rows} tiles at {config.TileSize}px. " +
                        $"Manual Canvas tile rendering not yet implemented.");
    }
}
#endif
