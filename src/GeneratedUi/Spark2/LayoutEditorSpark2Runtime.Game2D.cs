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
    
    // 场景模式：platformer | topdown（topdown 不叠加丛林天空渐变）
    public string Mode { get; set; } = "platformer";

    // 背景纯色（#rrggbb）；topdown 用它铺底，platformer 仍走丛林渐变
    public string BackgroundColorHex { get; set; } = "";
    
    // 背景图片路径 (格式: "image/xxx.png")
    public string BackgroundImage { get; set; } = "";
    
    // 是否启用键盘输入 (WASD + 方向键 + 空格)
    public bool EnableKeyboardInput { get; set; } = true;

    // 场景级玩法规则（P2：对照 GameRuntime.ts 的 rules）
    public float MaxHp { get; set; } = 3f;
    public string WinCondition { get; set; } = "none";   // none | reachGoal | clearEnemies
    public string GoalTag { get; set; } = "goal";
    public bool ShowScoreHud { get; set; }
    public bool ShowHpHud { get; set; }
    public bool ShowTimerHud { get; set; }

    // 相机视口与跟随（P4 视觉对齐：横版关卡用视口尺寸当 design 分辨率 + 相机横向卷动）
    public float ViewportWidth { get; set; }
    public float ViewportHeight { get; set; }
    public bool CameraFollow { get; set; }
    public float CameraSmooth { get; set; } = 0.1f;
    public float CameraZoom { get; set; } = 1f;
    public bool CameraLockBounds { get; set; } = true;
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
    // 碰撞盒收缩比例（占节点宽高，0=用默认）。属性面板「从精灵自动贴合」会写入。
    public float HitboxScaleX { get; set; }
    public float HitboxScaleY { get; set; }
    
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
    public string Kind { get; set; } = "rect";
    public float Width { get; set; }
    public float Height { get; set; }
    public float Radius { get; set; }
    public PathPoint2DConfig[]? Points { get; set; }
    public PathPoint2DConfig[]? SourcePoints { get; set; }
    public float LineWidth { get; set; }
    public string BodyType { get; set; } = "Static";
    public bool IsTrigger { get; set; }
    public float Restitution { get; set; }
    public float Friction { get; set; } = 0.5f;
    public string Tag { get; set; } = "";
}

public sealed class TileMap2DConfig
{
    // 兼容旧导出：单图集路径（新导出改用 Tilesets[]）
    public string TilesetAsset { get; set; } = "";
    // 多图集：路径 + 列数（列数由导出期解析，运行时 Image 拿不到像素尺寸）
    public TilesetRef2D[]? Tilesets { get; set; }
    // 行优先编码数组：cell = (tilesetIdx<<16)|tileIdx；<0 空格
    public int[]? Data { get; set; }
    // 实体（碰撞）瓦片编码集合；Solid=true 时所有非空格子均实体
    public int[]? CollisionTiles { get; set; }
    public bool Solid { get; set; }
    // 地图在场景画布中的左上偏移（像素）
    public float OffsetX { get; set; }
    public float OffsetY { get; set; }
    public int TileSize { get; set; } = 32;
    public int Columns { get; set; } = 25;
    public int Rows { get; set; } = 19;
    public int MapWidth { get; set; }
    public int MapHeight { get; set; }
    public string CustomMaterial { get; set; } = "";
}

public sealed class PathPoint2DConfig
{
    public float X { get; set; }
    public float Y { get; set; }
}

public sealed class Path2DConfig
{
    public PathPoint2DConfig[]? Points { get; set; }
    public string Mode { get; set; } = "linear";
    public string LoopMode { get; set; } = "none";
    public bool Closed { get; set; }
    public float ArriveThreshold { get; set; }
    public bool TriggerOncePerWaypoint { get; set; }
}

public sealed class CollisionBBox2DConfig
{
    public float Left { get; set; }
    public float Top { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
}

public sealed class CollisionPolygon2DConfig
{
    public string Kind { get; set; } = "area";
    public string Tag { get; set; } = "";
    public float LineWidth { get; set; }
    public CollisionBBox2DConfig? Bbox { get; set; }
    public PathPoint2DConfig[]? Points { get; set; }
    public PathPoint2DConfig[]? SourcePoints { get; set; }
}

public sealed class CollisionMap2DConfig
{
    public string MaskSrc { get; set; } = "";
    public CollisionPolygon2DConfig[]? Polygons { get; set; }
    public bool IsStatic { get; set; } = true;
    public bool IsTrigger { get; set; }
    public float Friction { get; set; } = 0.5f;
    public float Restitution { get; set; }
    public string Tag { get; set; } = "";
    public string CollisionLayer { get; set; } = "";
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
}

/// <summary>单张瓦片图集引用：资源路径 + 列数（= 图集像素宽 / tileSize，导出期解析）。</summary>
public sealed class TilesetRef2D
{
    public string Asset { get; set; } = "";
    public int Columns { get; set; } = 1;
}

/// <summary>装饰精灵配置：图集子矩形（源像素）+ 场景目标框（像素）。SrcW<=0 表示整图绘制。</summary>
public sealed class DecorationSprite2DConfig
{
    public string ImageAsset { get; set; } = "";
    public float SrcX { get; set; }
    public float SrcY { get; set; }
    public float SrcW { get; set; }
    public float SrcH { get; set; }
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
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

    // Tile maps (drawn beneath sprites/gameplay) and static decoration sprites
    public List<TileMapRenderer2D> TileMaps { get; } = new();
    public List<DecorationSprite2D> Decorations { get; } = new();

    // Whether this scene is topdown (skip the jungle sky gradient overlay)
    public bool IsTopdown { get; set; }

    // All collider visual configs for debug rendering
    public List<ColliderVisual2D> ColliderVisuals { get; } = new();

    // Character controller (if any)
    public CharacterController2DRuntime? Character { get; set; }

    // Joystick runtime (if any)
    public JoystickRuntime? Joystick { get; set; }

    // 迷雾层（世界坐标绘制，独立于 UI 节点）
    public List<FogOfWar2DRuntime> FogLayers { get; } = new();

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
    public float PrevX { get; set; }
    public float PrevY { get; set; }
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

/// <summary>
/// Tile map renderer: draws each non-empty cell by slicing the tileset texture with
/// DrawImage source rect. Mirrors editor truth source (tilemap.ts tileSourceRect):
/// sheetCols comes from the exporter (runtime Canvas Image has no pixel size).
/// </summary>
public sealed class TileMapRenderer2D
{
    public TileMap2DConfig Config { get; set; } = new();
    // Loaded tileset images aligned to Config.Tilesets index
    public List<GameCore.ResourceType.Image?> Tilesets { get; } = new();
    public List<int> TilesetColumns { get; } = new();

    public void Draw(CanvasAnimated canvas, float cameraX, float cameraY)
    {
        var cfg = Config;
        if (cfg.Data == null || cfg.Data.Length == 0) return;
        int cols = cfg.Columns > 0 ? cfg.Columns : 1;
        int tile = cfg.TileSize > 0 ? cfg.TileSize : 32;

        for (int i = 0; i < cfg.Data.Length; i++)
        {
            int v = cfg.Data[i];
            if (v < 0) continue;
            int tsetIdx = (v >> 16) & 0xff;
            int tileIdx = v & 0xffff;
            if (tsetIdx < 0 || tsetIdx >= Tilesets.Count) continue;
            var sheet = Tilesets[tsetIdx];
            if (sheet == null) continue;
            int sheetCols = (tsetIdx < TilesetColumns.Count && TilesetColumns[tsetIdx] > 0) ? TilesetColumns[tsetIdx] : 1;

            int col = i % cols;
            int row = i / cols;
            float dstX = cfg.OffsetX + col * tile - cameraX;
            float dstY = cfg.OffsetY + row * tile - cameraY;
            float srcX = (tileIdx % sheetCols) * tile;
            float srcY = (tileIdx / sheetCols) * tile;

            // 非整数缩放下相邻瓦片间会露出 1px 黑缝：目标矩形右/下各扩 1px 让瓦片互相盖住接缝。
            // 源矩形不扩（避免采样到邻格），仅放大目标贴图尺寸。
            const float bleed = 1f;
            canvas.DrawImage(sheet.Value, srcX, srcY, tile, tile, dstX, dstY, tile + bleed, tile + bleed);
        }
    }
}

/// <summary>Static decoration sprite: draws a tileset sub-rect (or whole image) at a fixed world frame.</summary>
public sealed class DecorationSprite2D
{
    public GameCore.ResourceType.Image? Image { get; set; }
    public DecorationSprite2DConfig Config { get; set; } = new();

    public void Draw(CanvasAnimated canvas, float cameraX, float cameraY)
    {
        if (Image == null) return;
        var c = Config;
        float dstX = c.X - cameraX;
        float dstY = c.Y - cameraY;
        if (c.SrcW > 0 && c.SrcH > 0)
        {
            canvas.DrawImage(Image.Value, c.SrcX, c.SrcY, c.SrcW, c.SrcH, dstX, dstY, c.Width, c.Height);
        }
        else
        {
            canvas.DrawImage(Image.Value, dstX, dstY, c.Width, c.Height);
        }
    }
}

/// <summary>Character controller runtime: simple physics + sprite + input.</summary>
public sealed class CharacterController2DRuntime
{
    public SimplePhysicsBody Body { get; set; } = new();
    public SpriteRenderer2D Sprite { get; set; } = new();
    public CharacterController2DConfig Config { get; set; } = new();

    // Input state (set by joystick or keyboard)
    public float InputX { get; set; }
    public float InputY { get; set; }
    /// <summary>俯视模式：用 InputX/InputY 八方向移动、无重力、无跳跃。</summary>
    public bool Topdown { get; set; }
    public bool JumpRequested { get; set; }
    // 贴图相对 hitbox 的渲染偏移（hitbox 比视觉小，贴图全尺寸居中对齐）
    public float SpriteOffsetX { get; set; }
    public float SpriteOffsetY { get; set; }

    // 动画切换：保存 idle / walk 两套配置和对应的 sprite sheet，按输入是否为零切换。
    public CharacterAnimationConfig? IdleAnim { get; set; }
    public CharacterAnimationConfig? WalkAnim { get; set; }
    public GameCore.ResourceType.Image? IdleSheet { get; set; }
    public GameCore.ResourceType.Image? WalkSheet { get; set; }
    /// <summary>当前播放的动画名，"idle" 或 "walk"。</summary>
    public string CurrentAnim { get; set; } = "idle";

    public void ApplyMovement(float dt, float gravity)
    {
        // Apply horizontal movement
        Body.VelocityX = InputX * Config.Speed;

        if (Topdown)
        {
            // 俯视：垂直方向直接由输入驱动，不施加重力/跳跃
            Body.VelocityY = InputY * Config.Speed;
        }
        else
        {
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
        }

        // Update position
        Body.PrevX = Body.X;
        Body.PrevY = Body.Y;
        Body.X += Body.VelocityX * dt;
        Body.Y += Body.VelocityY * dt;

        // Update sprite position
        Sprite.X = Body.X - SpriteOffsetX;
        Sprite.Y = Body.Y - SpriteOffsetY;

        // Update sprite flip
        if (InputX < 0) Sprite.FlipHorizontal = true;
        else if (InputX > 0) Sprite.FlipHorizontal = false;

        // 动画切换：有输入时播 walk，否则 idle。两套都缺失时保留当前。
        bool moving = MathF.Abs(InputX) > 0.01f || (Topdown && MathF.Abs(InputY) > 0.01f);
        string desired = moving ? "walk" : "idle";
        if (desired != CurrentAnim)
        {
            var nextAnim = desired == "walk" ? WalkAnim : IdleAnim;
            var nextSheet = desired == "walk" ? WalkSheet : IdleSheet;
            if (nextAnim != null && nextSheet != null)
            {
                Sprite.SpriteSheet = nextSheet;
                Sprite.Config = new SpriteAnimationConfig
                {
                    ImageAsset = nextAnim.ImageAsset,
                    FrameWidth = nextAnim.FrameWidth,
                    FrameHeight = nextAnim.FrameHeight,
                    FrameCount = nextAnim.FrameCount,
                    FramesPerRow = nextAnim.FramesPerRow,
                    Fps = nextAnim.Fps,
                    Loop = true,
                    Autoplay = true,
                };
                Sprite.CurrentFrame = 0;
                Sprite.FrameTimer = 0f;
                Sprite.Playing = true;
                CurrentAnim = desired;
            }
        }
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
        ctx.IsTopdown = string.Equals(config.Mode, "topdown", StringComparison.OrdinalIgnoreCase);
        _activeScene = ctx;

        // 初始化玩法状态（P2）：场景级规则与 HUD 开关来自导出配置。
        _gameplay = new GameplayState
        {
            MaxHp = config.MaxHp > 0 ? config.MaxHp : 3f,
            PlayerHp = config.MaxHp > 0 ? config.MaxHp : 3f,
            WinCondition = string.IsNullOrEmpty(config.WinCondition) ? "none" : config.WinCondition,
            GoalTag = string.IsNullOrEmpty(config.GoalTag) ? "goal" : config.GoalTag,
            ShowScoreHud = config.ShowScoreHud,
            ShowHpHud = config.ShowHpHud,
            ShowTimerHud = config.ShowTimerHud,
        };

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

        // 设计分辨率：相机跟随模式用视口尺寸（横版卷动），否则用世界尺寸（整张缩进窗口）。
        float designWidth = (config.CameraFollow && config.ViewportWidth > 0) ? config.ViewportWidth : config.BoundsWidth;
        float designHeight = (config.CameraFollow && config.ViewportHeight > 0) ? config.ViewportHeight : config.BoundsHeight;

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
                        if (!_activeScene.IsTopdown && _activeScene.Character != null)
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

            // 记录 design→screen 映射，供屏幕层飘字把世界坐标定位到屏幕
            if (_gameplay != null)
            {
                _gameplay.RenderScale = scale;
                _gameplay.RenderOffsetX = offsetX;
                _gameplay.RenderOffsetY = offsetY;
            }

            // 应用缩放变换
            canvas.SaveState();

            // 先用场景背景色铺满整个窗口（含保持宽高比产生的 letterbox 区域），
            // 避免出现黑边——俯视用导出背景色，横版用底部深绿。
            if (_activeScene.IsTopdown)
            {
                var winBg = ParseHexColor(_activeScene.Config.BackgroundColorHex, SysColor.FromArgb(255, 28, 36, 22));
                canvas.FillPaint = winBg;
                canvas.FillRectangle(0, 0, actualWidth, actualHeight);
            }

            canvas.Translate(offsetX, offsetY);
            canvas.Scale(scale, scale);

            // 先绘制背景图片 - 作为最底层，按世界尺寸绘制并随相机滚动
            // 关键：用 BoundsWidth/Height (世界尺寸) 而不是 designWidth/Height (视口尺寸)，
            // 否则世界会被压扁到视口中无法卷动。
            if (_activeScene.BackgroundImage != null)
            {
                float worldW = _activeScene.Config.BoundsWidth;
                float worldH = _activeScene.Config.BoundsHeight;
                canvas.DrawImage(
                    _activeScene.BackgroundImage.Value,
                    -_activeScene.CameraX, -_activeScene.CameraY,
                    worldW, worldH);
            }

            if (_activeScene.IsTopdown)
            {
                // 俯视场景：用场景背景纯色铺底（不叠加横版的丛林天空渐变，避免把瓦片地图洗成蓝绿）
                if (_activeScene.BackgroundImage == null)
                {
                    var bg = ParseHexColor(_activeScene.Config.BackgroundColorHex, SysColor.FromArgb(255, 28, 36, 22));
                    canvas.FillPaint = bg;
                    canvas.FillRectangle(0, 0, designWidth, designHeight);
                }
            }
            else
            {
                // 横版场景：半透明天空渐变覆盖在图片上 (模拟 opacity: 0.25 的效果)
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
            }

            // 瓦片地图（最底层场景内容）+ 静态装饰精灵，随相机滚动
            foreach (var tilemap in _activeScene.TileMaps)
            {
                tilemap.Draw(canvas, _activeScene.CameraX, _activeScene.CameraY);
            }
            foreach (var deco in _activeScene.Decorations)
            {
                deco.Draw(canvas, _activeScene.CameraX, _activeScene.CameraY);
            }

            // Update simple physics
            UpdateSimplePhysics(dt);

            // Update gameplay nodes (enemies/pickups/spawners/breakables/platforms/portals/timers/sound)
            UpdateGameplay(dt);

            // 迷雾揭示状态（依赖角色位置）
            UpdateFogOfWar(dt);

            // Update and draw sprites
            foreach (var sprite in _activeScene.Sprites)
            {
                sprite.Update(dt);
                sprite.Draw(canvas, _activeScene.CameraX, _activeScene.CameraY);
            }

            // Draw gameplay visuals (pickups/enemies/platforms/breakables placeholders)
            DrawGameplay(canvas);

            // 迷雾覆盖层（在实体之上、HUD 之下）
            DrawFogOfWar(canvas, _activeScene.CameraX, _activeScene.CameraY);

            // Draw joystick if present
            _activeScene.Joystick?.Draw(canvas);

            // Draw debug colliders (optional)
            DrawDebugColliders(canvas);

            // 世界层反馈（随相机滚）：粒子 + 飘字
            DrawWorldFeedback(canvas);

            canvas.RestoreState();

            // ── 屏幕层（不随相机/不受 design 偏移）：HUD + 受击闪红 + 失败/胜利遮罩 ──
            // 直接用真实画布像素坐标绘制，覆盖在最上层。
            DrawScreenOverlay(canvas, actualWidth, actualHeight);
        };

        // Start the animation loop
        canvas.StartTimingDelayed(16); // ~60 FPS

        // 创建 HUD/反馈用 Label 控件（覆盖在场景 panel 上，屏幕固定层）
        BuildGameplayHud(panel);

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

        // 俯视：上下键/WS 驱动垂直移动
        if (_activeScene.Character.Topdown)
        {
            float inputY = 0f;
            if (_activeScene.KeyUp) inputY -= 1f;
            if (_activeScene.KeyDown) inputY += 1f;
            _activeScene.Character.InputY = inputY;
        }
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
                    if (_activeScene.IsTopdown)
                        ResolveTopdownCollision(charBody, body);
                    else
                        ResolveCollision(charBody, body);
                }
            }

            // Clamp to bounds
            charBody.X = Math.Clamp(charBody.X, 0, config.BoundsWidth - charBody.Width);
            charBody.Y = Math.Clamp(charBody.Y, 0, config.BoundsHeight - charBody.Height);

            // Ground check at bottom（仅平台模式；俯视无重力不做底部贴地）
            if (!_activeScene.IsTopdown && charBody.Y >= config.BoundsHeight - charBody.Height - 1)
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

    private static bool CheckAABBCollisionAt(SimplePhysicsBody a, SimplePhysicsBody b, float x, float y)
    {
        return x < b.X + b.Width &&
               x + a.Width > b.X &&
               y < b.Y + b.Height &&
               y + a.Height > b.Y;
    }

    private static bool HasStaticCollisionAt(SimplePhysicsBody body, float x, float y, SimplePhysicsBody ignored)
    {
        if (_activeScene == null) return false;
        foreach (var other in _activeScene.PhysicsBodies)
        {
            if (!other.IsStatic || ReferenceEquals(other, ignored)) continue;
            if (CheckAABBCollisionAt(body, other, x, y)) return true;
        }
        return false;
    }

    private static void ResolveTopdownCollision(SimplePhysicsBody dynamic, SimplePhysicsBody staticBody)
    {
        float prevX = dynamic.PrevX;
        float prevY = dynamic.PrevY;
        bool canKeepX = !HasStaticCollisionAt(dynamic, dynamic.X, prevY, staticBody);
        bool canKeepY = !HasStaticCollisionAt(dynamic, prevX, dynamic.Y, staticBody);

        if (canKeepX && !canKeepY)
        {
            dynamic.Y = prevY;
            dynamic.VelocityY = 0;
            return;
        }
        if (canKeepY && !canKeepX)
        {
            dynamic.X = prevX;
            dynamic.VelocityX = 0;
            return;
        }
        if (canKeepX && canKeepY)
        {
            float dx = MathF.Abs(dynamic.X - prevX);
            float dy = MathF.Abs(dynamic.Y - prevY);
            if (dx >= dy)
            {
                dynamic.Y = prevY;
                dynamic.VelocityY = 0;
            }
            else
            {
                dynamic.X = prevX;
                dynamic.VelocityX = 0;
            }
            return;
        }

        ResolveCollision(dynamic, staticBody);
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

        // hitbox 比视觉小，从中心收缩（精灵帧四周大量透明留白）。
        // 优先用导出的 HitboxScaleX/Y（属性面板「从精灵自动贴合」算出，>0 才用）；
        // 否则回退默认：俯视 0.4×0.42 / 平台 0.55×0.8（对齐编辑器 addCharacter）。
        bool isTopdown = _activeScene.IsTopdown;
        float hbScaleX = config.HitboxScaleX > 0 ? config.HitboxScaleX : (isTopdown ? 0.4f : 0.55f);
        float hbScaleY = config.HitboxScaleY > 0 ? config.HitboxScaleY : (isTopdown ? 0.42f : 0.8f);
        float hbW = MathF.Max(8f, pxW * hbScaleX);
        float hbH = MathF.Max(8f, pxH * hbScaleY);
        float hbX = pxX + (pxW - hbW) / 2f;
        float hbY = pxY + (pxH - hbH) / 2f;

        var body = new SimplePhysicsBody
        {
            X = hbX,
            Y = hbY,
            Width = hbW,
            Height = hbH,
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
            X = hbX - (pxW - hbW) / 2f,
            Y = hbY - (pxH - hbH) / 2f,
            DisplayWidth = pxW,
            DisplayHeight = pxH,
            Playing = true,
        };

        // 预加载 walk sheet 用于运行时切换（保持原 idle 不变）
        GameCore.ResourceType.Image? walkSheet = null;
        if (config.WalkAnimation != null && !string.IsNullOrWhiteSpace(config.WalkAnimation.ImageAsset))
        {
            try
            {
                walkSheet = new GameCore.ResourceType.Image(config.WalkAnimation.ImageAsset);
                Game.Logger.LogInformation($"ConfigureCharacterController2D: Loaded walk sprite {config.WalkAnimation.ImageAsset}");
            }
            catch (Exception ex)
            {
                Game.Logger.LogWarning($"ConfigureCharacterController2D: Failed to load walk sprite '{config.WalkAnimation.ImageAsset}': {ex.Message}");
            }
        }

        var runtime = new CharacterController2DRuntime
        {
            Body = body,
            Sprite = sprite,
            Config = config,
            Topdown = _activeScene.IsTopdown,
            SpriteOffsetX = (pxW - hbW) / 2f,
            SpriteOffsetY = (pxH - hbH) / 2f,
            IdleAnim = config.IdleAnimation,
            WalkAnim = config.WalkAnimation,
            IdleSheet = sheet,
            WalkSheet = walkSheet,
            CurrentAnim = "idle",
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
                if (ctx.Character.Topdown)
                {
                    // 俯视：摇杆 Y 直接驱动垂直移动（向上为负）
                    ctx.Character.InputY = joystick.OutputY;
                }
                else if (joystick.OutputY < -0.5f)
                {
                    ctx.Character.JumpRequested = true;
                }
            }
        };

        canvas.OnPointerReleased += (sender, e) =>
        {
            joystick.Active = false;
            joystick.OutputX = 0;
            joystick.OutputY = 0;
            if (ctx.Character != null)
            {
                ctx.Character.InputX = 0;
                if (ctx.Character.Topdown) ctx.Character.InputY = 0;
            }
        };

        ctx.Joystick = joystick;
    }

    /// <summary>
    /// Configures a SpinePlayer node using the native GameUI.Control.Primitive.Spine control.
    /// The exported code now directly creates a Spine control, so this method is kept for
    /// backward compatibility with older exports that still call ConfigureSpinePlayer.
    /// </summary>
    public static void ConfigureSpinePlayer(Panel panel, SpinePlayerConfig config)
    {
        // 新版导出器直接生成 new Spine() 并设置属性，不再调用此方法。
        // 此方法保留用于兼容旧版导出代码。
        // 尝试创建 Spine 控件并挂载到 panel 的父节点
        try
        {
            var spine = new GameUI.Control.Primitive.Spine();
            spine.Width = panel.Width;
            spine.Height = panel.Height;
            spine.HorizontalAlignment = panel.HorizontalAlignment;
            spine.VerticalAlignment = panel.VerticalAlignment;
            spine.Margin = panel.Margin;

            if (!string.IsNullOrWhiteSpace(config.SkeletonAsset))
            {
                // 将路径转换为 Spine 资源格式: "Spine\path\to\skeleton" (无后缀)
                var resource = config.SkeletonAsset
                    .Replace(".json", "")
                    .Replace(".skel", "")
                    .Replace("/", "\\");
                spine.Resource = resource;
            }

            spine.Animation = config.AnimationName ?? "idle";
            if (!string.IsNullOrWhiteSpace(config.Skin) && config.Skin != "default")
            {
                spine.Skin = config.Skin;
            }
            spine.IsLooping = config.Loop;

            // 替换 panel: 将 spine 挂到 panel 的父节点
            if (panel.Parent != null)
            {
                spine.Parent = panel.Parent;
                panel.Parent = null; // 移除占位 panel
            }

            Game.Logger.LogInformation($"[LayoutEditor] SpinePlayer configured: resource={spine.Resource}, " +
                            $"anim={spine.Animation}, skin={spine.Skin}, loop={spine.IsLooping}");
        }
        catch (Exception ex)
        {
            Game.Logger.LogWarning($"[LayoutEditor] SpinePlayer fallback: {ex.Message}. " +
                            $"skeleton={config.SkeletonAsset}, anim={config.AnimationName}.");
        }
    }

    /// <summary>
    /// Configures a TileMap2D node. Builds a TileMapRenderer2D that slices each cell's
    /// sub-sprite from its tileset (DrawImage source rect), mirroring the editor's
    /// tileSourceRect. Per-tileset column counts come from the exporter (Canvas Image
    /// has no pixel-size accessor). Also registers static AABB bodies for collision tiles.
    /// </summary>
    public static void ConfigureTileMap2D(Panel panel, TileMap2DConfig config)
    {
        if (_activeScene == null) return;

        var renderer = new TileMapRenderer2D { Config = config };

        // 解析图集列表（新导出 Tilesets[]；兼容旧 TilesetAsset 单图集）
        var tilesets = config.Tilesets;
        if ((tilesets == null || tilesets.Length == 0) && !string.IsNullOrWhiteSpace(config.TilesetAsset))
        {
            tilesets = new[] { new TilesetRef2D { Asset = config.TilesetAsset, Columns = config.Columns > 0 ? config.Columns : 1 } };
        }
        if (tilesets != null)
        {
            foreach (var ts in tilesets)
            {
                GameCore.ResourceType.Image? img = null;
                if (!string.IsNullOrWhiteSpace(ts.Asset))
                {
                    try { img = new GameCore.ResourceType.Image(ts.Asset); }
                    catch { img = null; }
                }
                renderer.Tilesets.Add(img);
                renderer.TilesetColumns.Add(ts.Columns > 0 ? ts.Columns : 1);
            }
        }
        _activeScene.TileMaps.Add(renderer);

        // 碰撞瓦片 → 静态 AABB 体（角色/敌人被实体瓦片阻挡）
        if (config.Data != null)
        {
            int cols = config.Columns > 0 ? config.Columns : 1;
            int tile = config.TileSize > 0 ? config.TileSize : 32;
            var collisionSet = new HashSet<int>();
            if (config.CollisionTiles != null)
            {
                foreach (var c in config.CollisionTiles) collisionSet.Add(c);
            }
            for (int i = 0; i < config.Data.Length; i++)
            {
                int v = config.Data[i];
                if (v < 0) continue;
                bool solidCell = config.Solid || collisionSet.Contains(v);
                if (!solidCell) continue;
                int col = i % cols;
                int row = i / cols;
                _activeScene.PhysicsBodies.Add(new SimplePhysicsBody
                {
                    X = config.OffsetX + col * tile,
                    Y = config.OffsetY + row * tile,
                    Width = tile,
                    Height = tile,
                    IsStatic = true,
                    Tag = "tile",
                });
            }
        }

        Game.Logger.LogInformation($"ConfigureTileMap2D: {config.Columns}x{config.Rows} @ {config.TileSize}px, {renderer.Tilesets.Count} tilesets, {(_activeScene.TileMaps.Count)} maps.");
    }

    /// <summary>
    /// Configures a static decoration sprite (tileset sub-rect or whole image) drawn by
    /// the main Canvas. GameScene2D-child decoration Panels are hidden; this gives them
    /// a render path so trees/props/etc. actually appear.
    /// </summary>
    public static void ConfigureDecorationSprite(Panel panel, DecorationSprite2DConfig config)
    {
        if (_activeScene == null) return;

        GameCore.ResourceType.Image? img = null;
        if (!string.IsNullOrWhiteSpace(config.ImageAsset))
        {
            try { img = new GameCore.ResourceType.Image(config.ImageAsset); }
            catch { img = null; }
        }
        if (img == null) return;

        _activeScene.Decorations.Add(new DecorationSprite2D { Image = img, Config = config });
    }

    /// <summary>解析 #rrggbb / #aarrggbb 颜色；失败回退 fallback。</summary>
    private static SysColor ParseHexColor(string hex, SysColor fallback)
    {
        if (string.IsNullOrWhiteSpace(hex)) return fallback;
        var s = hex.Trim().TrimStart('#');
        try
        {
            if (s.Length == 6)
            {
                int r = Convert.ToInt32(s.Substring(0, 2), 16);
                int g = Convert.ToInt32(s.Substring(2, 2), 16);
                int b = Convert.ToInt32(s.Substring(4, 2), 16);
                return SysColor.FromArgb(255, r, g, b);
            }
            if (s.Length == 8)
            {
                int a = Convert.ToInt32(s.Substring(0, 2), 16);
                int r = Convert.ToInt32(s.Substring(2, 2), 16);
                int g = Convert.ToInt32(s.Substring(4, 2), 16);
                int b = Convert.ToInt32(s.Substring(6, 2), 16);
                return SysColor.FromArgb(a, r, g, b);
            }
        }
        catch { /* fall through */ }
        return fallback;
    }
}
#endif
