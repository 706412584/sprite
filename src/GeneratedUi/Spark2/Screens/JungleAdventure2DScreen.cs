#if CLIENT
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using GameUI;
using GameUI.Brush;
using GameUI.Control;
using GameUI.Control.Advanced;
using GameUI.Control.Primitive;
using GameUI.Control.Struct;
using GameUI.Device;
using GameUI.Enum;
using GameUI.Struct;

namespace GameEntry.GeneratedUi.Spark2.Screens;

public static class JungleAdventure2DScreen
{
    public const string ScreenId = "doc_adaec96b";

    public static LayoutScreenResult Build(Action<string>? onAction = null)
    {
        var nodes = new Dictionary<string, Control>();
        var gamescene2d_ztj183re = LayoutEditorSpark2Runtime.Register(nodes, "gamescene2d_ztj183re", new Panel());
        // 全屏覆盖3D场景
        gamescene2d_ztj183re.HorizontalAlignment = HorizontalAlignment.Stretch;
        gamescene2d_ztj183re.VerticalAlignment = VerticalAlignment.Stretch;
        gamescene2d_ztj183re.Width = 0f;  // 使用Stretch时设为0
        gamescene2d_ztj183re.Height = 0f;
        gamescene2d_ztj183re.WidthStretchRatio = 1f;
        gamescene2d_ztj183re.HeightStretchRatio = 1f;
        gamescene2d_ztj183re.Background = new SolidColorBrush(Color.FromArgb(255, 12, 26, 46)); // 不透明背景覆盖3D
        // 2D 场景: 星火2.0 使用 CanvasAnimated + Physics2D 架构
        // SceneGraph 管理物理世界（不渲染），CanvasAnimated 负责渲染
        LayoutEditorSpark2Runtime.ConfigureGameScene2D(gamescene2d_ztj183re, new GameScene2DConfig
        {
            Gravity = 900f,
            BoundsWidth = 960f,
            BoundsHeight = 540f,
            PixelsPerMeter = 64f,
        });
        var gradientblock_mwjzd5fu = LayoutEditorSpark2Runtime.Register(nodes, "gradientblock_mwjzd5fu", new Canvas());
        gradientblock_mwjzd5fu.Parent = gamescene2d_ztj183re;
        gradientblock_mwjzd5fu.HorizontalAlignment = HorizontalAlignment.Left;
        gradientblock_mwjzd5fu.VerticalAlignment = VerticalAlignment.Top;
        gradientblock_mwjzd5fu.Width = 960f;
        gradientblock_mwjzd5fu.Height = 540f;
        gradientblock_mwjzd5fu.Visible = false; // 隐藏，背景在Canvas中绘制
        var image_i0rdvtg5 = LayoutEditorSpark2Runtime.Register(nodes, "image_i0rdvtg5", LayoutEditorSpark2Runtime.CreateImageCard("image_i0rdvtg5", LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/mossy_hills.png"), 960f, 540f, LayoutEditorSpark2Runtime.Color(80, 16, 16, 18), 8f));
        image_i0rdvtg5.Parent = gamescene2d_ztj183re;
        image_i0rdvtg5.HorizontalAlignment = HorizontalAlignment.Left;
        image_i0rdvtg5.VerticalAlignment = VerticalAlignment.Top;
        image_i0rdvtg5.Width = 960f;
        image_i0rdvtg5.Height = 540f;
        image_i0rdvtg5.Visible = false; // 隐藏，背景在Canvas中绘制
        var spriteanimation_ys7k64aa = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_ys7k64aa", new Panel());
        spriteanimation_ys7k64aa.Parent = gamescene2d_ztj183re;
        spriteanimation_ys7k64aa.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_ys7k64aa.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_ys7k64aa.Margin = new Thickness(10f, 420f, 0f, 0f); // deco_plant1: left=10, top=420
        spriteanimation_ys7k64aa.Width = 80f;
        spriteanimation_ys7k64aa.Height = 80f;
        spriteanimation_ys7k64aa.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_ys7k64aa, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/plant1.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 90,
            FramesPerRow = 10,
            Fps = 12,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var spriteanimation_5lcymdot = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_5lcymdot", new Panel());
        spriteanimation_5lcymdot.Parent = gamescene2d_ztj183re;
        spriteanimation_5lcymdot.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_5lcymdot.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_5lcymdot.Margin = new Thickness(200f, 440f, 0f, 0f); // deco_plant2: left=200, top=440
        spriteanimation_5lcymdot.Width = 60f;
        spriteanimation_5lcymdot.Height = 60f;
        spriteanimation_5lcymdot.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_5lcymdot, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/plant1.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 90,
            FramesPerRow = 10,
            Fps = 10,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var spriteanimation_5llm3r4r = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_5llm3r4r", new Panel());
        spriteanimation_5llm3r4r.Parent = gamescene2d_ztj183re;
        spriteanimation_5llm3r4r.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_5llm3r4r.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_5llm3r4r.Margin = new Thickness(480f, 430f, 0f, 0f); // deco_plant3: left=480, top=430
        spriteanimation_5llm3r4r.Width = 70f;
        spriteanimation_5llm3r4r.Height = 70f;
        spriteanimation_5llm3r4r.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_5llm3r4r, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/plant_poison.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 30,
            FramesPerRow = 10,
            Fps = 8,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var spriteanimation_y2x5fomx = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_y2x5fomx", new Panel());
        spriteanimation_y2x5fomx.Parent = gamescene2d_ztj183re;
        spriteanimation_y2x5fomx.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_y2x5fomx.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_y2x5fomx.Margin = new Thickness(850f, 450f, 0f, 0f); // deco_plant4: left=850, top=450
        spriteanimation_y2x5fomx.Width = 50f;
        spriteanimation_y2x5fomx.Height = 50f;
        spriteanimation_y2x5fomx.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_y2x5fomx, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/plant1.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 90,
            FramesPerRow = 10,
            Fps = 14,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var spriteanimation_m6mj18dd = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_m6mj18dd", new Panel());
        spriteanimation_m6mj18dd.Parent = gamescene2d_ztj183re;
        spriteanimation_m6mj18dd.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_m6mj18dd.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_m6mj18dd.Margin = new Thickness(680f, 440f, 0f, 0f); // deco_plant5: left=680, top=440
        spriteanimation_m6mj18dd.Width = 55f;
        spriteanimation_m6mj18dd.Height = 55f;
        spriteanimation_m6mj18dd.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_m6mj18dd, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/plant_poison.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 30,
            FramesPerRow = 10,
            Fps = 6,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var collider2d_zypn0bay = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_zypn0bay", new Panel());
        collider2d_zypn0bay.Parent = gamescene2d_ztj183re;
        collider2d_zypn0bay.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_zypn0bay.VerticalAlignment = VerticalAlignment.Top;
        collider2d_zypn0bay.Margin = new Thickness(0f, 500f, 0f, 0f); // ground: left=0, top=500
        collider2d_zypn0bay.Width = 960f;
        collider2d_zypn0bay.Height = 40f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_zypn0bay, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = false,
            Restitution = 0f,
            Friction = 0.8f,
            Tag = "ground",
        });
        var shaperect_9bvxln2x = LayoutEditorSpark2Runtime.Register(nodes, "shaperect_9bvxln2x", new Canvas());
        shaperect_9bvxln2x.Parent = gamescene2d_ztj183re;
        shaperect_9bvxln2x.HorizontalAlignment = HorizontalAlignment.Left;
        shaperect_9bvxln2x.VerticalAlignment = VerticalAlignment.Top;
        shaperect_9bvxln2x.Margin = new Thickness(0f, 500f, 0f, 0f); // ground_vis: left=0, top=500
        shaperect_9bvxln2x.Width = 960f;
        shaperect_9bvxln2x.Height = 40f;
        var shapeline_g7jeu764 = LayoutEditorSpark2Runtime.Register(nodes, "shapeline_g7jeu764", new Canvas());
        shapeline_g7jeu764.Parent = gamescene2d_ztj183re;
        shapeline_g7jeu764.HorizontalAlignment = HorizontalAlignment.Left;
        shapeline_g7jeu764.VerticalAlignment = VerticalAlignment.Top;
        shapeline_g7jeu764.Margin = new Thickness(0f, 498f, 0f, 0f); // grass_line: left=0, top=498
        shapeline_g7jeu764.Width = 960f;
        shapeline_g7jeu764.Height = 3f;
        var collider2d_m1a21kdw = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_m1a21kdw", new Panel());
        collider2d_m1a21kdw.Parent = gamescene2d_ztj183re;
        collider2d_m1a21kdw.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_m1a21kdw.VerticalAlignment = VerticalAlignment.Top;
        collider2d_m1a21kdw.Margin = new Thickness(120f, 390f, 0f, 0f); // plat1: left=120, top=390
        collider2d_m1a21kdw.Width = 160f;
        collider2d_m1a21kdw.Height = 20f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_m1a21kdw, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = false,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "platform",
        });
        var shaperect_ei19bp0i = LayoutEditorSpark2Runtime.Register(nodes, "shaperect_ei19bp0i", new Canvas());
        shaperect_ei19bp0i.Parent = gamescene2d_ztj183re;
        shaperect_ei19bp0i.HorizontalAlignment = HorizontalAlignment.Left;
        shaperect_ei19bp0i.VerticalAlignment = VerticalAlignment.Top;
        shaperect_ei19bp0i.Margin = new Thickness(120f, 390f, 0f, 0f); // plat1_v: left=120, top=390
        shaperect_ei19bp0i.Width = 160f;
        shaperect_ei19bp0i.Height = 20f;
        var collider2d_48uj6zky = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_48uj6zky", new Panel());
        collider2d_48uj6zky.Parent = gamescene2d_ztj183re;
        collider2d_48uj6zky.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_48uj6zky.VerticalAlignment = VerticalAlignment.Top;
        collider2d_48uj6zky.Margin = new Thickness(380f, 310f, 0f, 0f); // plat2: left=380, top=310
        collider2d_48uj6zky.Width = 130f;
        collider2d_48uj6zky.Height = 20f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_48uj6zky, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = false,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "platform",
        });
        var shaperect_k0cgbwn3 = LayoutEditorSpark2Runtime.Register(nodes, "shaperect_k0cgbwn3", new Canvas());
        shaperect_k0cgbwn3.Parent = gamescene2d_ztj183re;
        shaperect_k0cgbwn3.HorizontalAlignment = HorizontalAlignment.Left;
        shaperect_k0cgbwn3.VerticalAlignment = VerticalAlignment.Top;
        shaperect_k0cgbwn3.Margin = new Thickness(380f, 310f, 0f, 0f); // plat2_v: left=380, top=310
        shaperect_k0cgbwn3.Width = 130f;
        shaperect_k0cgbwn3.Height = 20f;
        var collider2d_3w390iej = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_3w390iej", new Panel());
        collider2d_3w390iej.Parent = gamescene2d_ztj183re;
        collider2d_3w390iej.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_3w390iej.VerticalAlignment = VerticalAlignment.Top;
        collider2d_3w390iej.Margin = new Thickness(620f, 240f, 0f, 0f); // plat3: left=620, top=240
        collider2d_3w390iej.Width = 140f;
        collider2d_3w390iej.Height = 20f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_3w390iej, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = false,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "platform",
        });
        var shaperect_nuf5zzj0 = LayoutEditorSpark2Runtime.Register(nodes, "shaperect_nuf5zzj0", new Canvas());
        shaperect_nuf5zzj0.Parent = gamescene2d_ztj183re;
        shaperect_nuf5zzj0.HorizontalAlignment = HorizontalAlignment.Left;
        shaperect_nuf5zzj0.VerticalAlignment = VerticalAlignment.Top;
        shaperect_nuf5zzj0.Margin = new Thickness(620f, 240f, 0f, 0f); // plat3_v: left=620, top=240
        shaperect_nuf5zzj0.Width = 140f;
        shaperect_nuf5zzj0.Height = 20f;
        var collider2d_9m8ogd4r = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_9m8ogd4r", new Panel());
        collider2d_9m8ogd4r.Parent = gamescene2d_ztj183re;
        collider2d_9m8ogd4r.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_9m8ogd4r.VerticalAlignment = VerticalAlignment.Top;
        collider2d_9m8ogd4r.Margin = new Thickness(800f, 370f, 0f, 0f); // plat4: left=800, top=370
        collider2d_9m8ogd4r.Width = 100f;
        collider2d_9m8ogd4r.Height = 20f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_9m8ogd4r, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = false,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "platform",
        });
        var shaperect_9kb47ul0 = LayoutEditorSpark2Runtime.Register(nodes, "shaperect_9kb47ul0", new Canvas());
        shaperect_9kb47ul0.Parent = gamescene2d_ztj183re;
        shaperect_9kb47ul0.HorizontalAlignment = HorizontalAlignment.Left;
        shaperect_9kb47ul0.VerticalAlignment = VerticalAlignment.Top;
        shaperect_9kb47ul0.Margin = new Thickness(800f, 370f, 0f, 0f); // plat4_v: left=800, top=370
        shaperect_9kb47ul0.Width = 100f;
        shaperect_9kb47ul0.Height = 20f;
        var spriteanimation_6g23g0o8 = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_6g23g0o8", new Panel());
        spriteanimation_6g23g0o8.Parent = gamescene2d_ztj183re;
        spriteanimation_6g23g0o8.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_6g23g0o8.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_6g23g0o8.Margin = new Thickness(300f, 442f, 0f, 0f); // enemy1: left=300, top=442
        spriteanimation_6g23g0o8.Width = 72f;
        spriteanimation_6g23g0o8.Height = 58f;
        spriteanimation_6g23g0o8.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_6g23g0o8, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/slime_orange.png"),
            FrameWidth = 510,
            FrameHeight = 410,
            FrameCount = 30,
            FramesPerRow = 10,
            Fps = 12,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var collider2d_ex6ai4yz = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_ex6ai4yz", new Panel());
        collider2d_ex6ai4yz.Parent = gamescene2d_ztj183re;
        collider2d_ex6ai4yz.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_ex6ai4yz.VerticalAlignment = VerticalAlignment.Top;
        collider2d_ex6ai4yz.Margin = new Thickness(306f, 447f, 0f, 0f); // enemy1_col: left=306, top=447
        collider2d_ex6ai4yz.Width = 60f;
        collider2d_ex6ai4yz.Height = 48f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_ex6ai4yz, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = true,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "enemy",
        });
        var spriteanimation_9m1aubjh = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_9m1aubjh", new Panel());
        spriteanimation_9m1aubjh.Parent = gamescene2d_ztj183re;
        spriteanimation_9m1aubjh.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_9m1aubjh.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_9m1aubjh.Margin = new Thickness(540f, 456f, 0f, 0f); // enemy2: left=540, top=456
        spriteanimation_9m1aubjh.Width = 64f;
        spriteanimation_9m1aubjh.Height = 44f;
        spriteanimation_9m1aubjh.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_9m1aubjh, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/slime_green.png"),
            FrameWidth = 376,
            FrameHeight = 256,
            FrameCount = 30,
            FramesPerRow = 10,
            Fps = 10,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var collider2d_sqwpkl9x = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_sqwpkl9x", new Panel());
        collider2d_sqwpkl9x.Parent = gamescene2d_ztj183re;
        collider2d_sqwpkl9x.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_sqwpkl9x.VerticalAlignment = VerticalAlignment.Top;
        collider2d_sqwpkl9x.Margin = new Thickness(546f, 460f, 0f, 0f); // enemy2_col: left=546, top=460
        collider2d_sqwpkl9x.Width = 52f;
        collider2d_sqwpkl9x.Height = 36f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_sqwpkl9x, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = true,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "enemy",
        });
        var spriteanimation_ehzwzr2b = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_ehzwzr2b", new Panel());
        spriteanimation_ehzwzr2b.Parent = gamescene2d_ztj183re;
        spriteanimation_ehzwzr2b.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_ehzwzr2b.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_ehzwzr2b.Margin = new Thickness(660f, 195f, 0f, 0f); // enemy3: left=660, top=195
        spriteanimation_ehzwzr2b.Width = 56f;
        spriteanimation_ehzwzr2b.Height = 45f;
        spriteanimation_ehzwzr2b.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_ehzwzr2b, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/slime_orange.png"),
            FrameWidth = 510,
            FrameHeight = 410,
            FrameCount = 30,
            FramesPerRow = 10,
            Fps = 14,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var collider2d_ehc99f42 = LayoutEditorSpark2Runtime.Register(nodes, "collider2d_ehc99f42", new Panel());
        collider2d_ehc99f42.Parent = gamescene2d_ztj183re;
        collider2d_ehc99f42.HorizontalAlignment = HorizontalAlignment.Left;
        collider2d_ehc99f42.VerticalAlignment = VerticalAlignment.Top;
        collider2d_ehc99f42.Margin = new Thickness(666f, 200f, 0f, 0f); // enemy3_col: left=666, top=200
        collider2d_ehc99f42.Width = 44f;
        collider2d_ehc99f42.Height = 36f;
        // 碰撞体: RigidBody2D(Static) + CollisionBox2D
        LayoutEditorSpark2Runtime.ConfigureCollider2D(collider2d_ehc99f42, new Collider2DConfig
        {
            Shape = "rect",
            BodyType = "Static",
            IsTrigger = true,
            Restitution = 0f,
            Friction = 0.5f,
            Tag = "enemy",
        });
        var charactercontroller2d_pgrzbdex = LayoutEditorSpark2Runtime.Register(nodes, "charactercontroller2d_pgrzbdex", new Panel());
        charactercontroller2d_pgrzbdex.Parent = gamescene2d_ztj183re;
        charactercontroller2d_pgrzbdex.HorizontalAlignment = HorizontalAlignment.Left;
        charactercontroller2d_pgrzbdex.VerticalAlignment = VerticalAlignment.Top;
        charactercontroller2d_pgrzbdex.Margin = new Thickness(60f, 404f, 0f, 0f); // player: left=60, top=404
        charactercontroller2d_pgrzbdex.Width = 96f;
        charactercontroller2d_pgrzbdex.Height = 96f;
        // 角色控制器: RigidBody2D(Dynamic) + AnimatedImageSource 帧动画
        LayoutEditorSpark2Runtime.ConfigureCharacterController2D(charactercontroller2d_pgrzbdex, new CharacterController2DConfig
        {
            Speed = 200f,
            JumpForce = 380f,
            GravityScale = 1f,
            CurrentAnimation = "idle",
            BodyType = "Dynamic",
        });
        var spriteanimation_wuq4e93w = LayoutEditorSpark2Runtime.Register(nodes, "spriteanimation_wuq4e93w", new Panel());
        spriteanimation_wuq4e93w.Parent = gamescene2d_ztj183re;
        spriteanimation_wuq4e93w.HorizontalAlignment = HorizontalAlignment.Left;
        spriteanimation_wuq4e93w.VerticalAlignment = VerticalAlignment.Top;
        spriteanimation_wuq4e93w.Margin = new Thickness(140f, 420f, 0f, 0f); // dash_fx: left=140, top=420
        spriteanimation_wuq4e93w.Width = 64f;
        spriteanimation_wuq4e93w.Height = 64f;
        spriteanimation_wuq4e93w.Visible = false; // 隐藏Panel，通过Canvas绘制
        // 帧动画: 使用 AnimatedImageSource 在 Canvas 上绘制
        // 需要在数据编辑器中定义 GameDataAnimatedImage 资源
        LayoutEditorSpark2Runtime.ConfigureSpriteAnimation(spriteanimation_wuq4e93w, new SpriteAnimationConfig
        {
            ImageAsset = LayoutEditorSpark2Runtime.Asset("./assets/game2d/sheets/wizard_dash_fx.png"),
            FrameWidth = 512,
            FrameHeight = 512,
            FrameCount = 16,
            FramesPerRow = 8,
            Fps = 16,
            Loop = true,
            Autoplay = true,
            DefaultAnimation = "idle",
        });
        var joystick_ola1xd6b = LayoutEditorSpark2Runtime.Register(nodes, "joystick_ola1xd6b", new Panel());
        joystick_ola1xd6b.Parent = gamescene2d_ztj183re;
        joystick_ola1xd6b.HorizontalAlignment = HorizontalAlignment.Left;
        joystick_ola1xd6b.VerticalAlignment = VerticalAlignment.Top;
        joystick_ola1xd6b.Margin = new Thickness(20f, 420f, 0f, 0f); // joystick: left=20, top=420
        joystick_ola1xd6b.Width = 100f;
        joystick_ola1xd6b.Height = 100f;
        // 虚拟摇杆: Canvas 绘制 + CapturePointer 拖拽输入
        LayoutEditorSpark2Runtime.ConfigureJoystick(joystick_ola1xd6b, new JoystickConfig
        {
            Size = 100f,
            DeadZone = 0.15f,
            Fixed = true,
            TargetCharacterId = "player",
        });
        var text_rmoicp1q = LayoutEditorSpark2Runtime.Register(nodes, "text_rmoicp1q", new Label());
        text_rmoicp1q.Parent = gamescene2d_ztj183re;
        text_rmoicp1q.HorizontalAlignment = HorizontalAlignment.Left;
        text_rmoicp1q.VerticalAlignment = VerticalAlignment.Top;
        text_rmoicp1q.Margin = new Thickness(16f, 12f, 0f, 0f); // hud_hp: left=16, top=12
        text_rmoicp1q.Text = "HP: III";
        text_rmoicp1q.FontSize = 16f;
        text_rmoicp1q.TextColor = Color.FromArgb(255, 239, 68, 68);
        text_rmoicp1q.Bold = true;
        text_rmoicp1q.TextWrap = true;
        var text_78rdu92p = LayoutEditorSpark2Runtime.Register(nodes, "text_78rdu92p", new Label());
        text_78rdu92p.Parent = gamescene2d_ztj183re;
        text_78rdu92p.HorizontalAlignment = HorizontalAlignment.Right;
        text_78rdu92p.VerticalAlignment = VerticalAlignment.Top;
        text_78rdu92p.Margin = new Thickness(0f, 12f, 16f, 0f); // hud_score: right=16, top=12
        text_78rdu92p.Text = "SCORE: 00000";
        text_78rdu92p.FontSize = 13f;
        text_78rdu92p.TextColor = Color.FromArgb(255, 251, 191, 36);
        text_78rdu92p.Bold = true;
        text_78rdu92p.TextWrap = true;
        var text_8ngu0ok6 = LayoutEditorSpark2Runtime.Register(nodes, "text_8ngu0ok6", new Label());
        text_8ngu0ok6.Parent = gamescene2d_ztj183re;
        text_8ngu0ok6.HorizontalAlignment = HorizontalAlignment.Center;
        text_8ngu0ok6.VerticalAlignment = VerticalAlignment.Top;
        text_8ngu0ok6.Margin = new Thickness(0f, 12f, 0f, 0f); // hud_stage: center, top=12
        text_8ngu0ok6.Text = "STAGE 1";
        text_8ngu0ok6.FontSize = 11f;
        text_8ngu0ok6.TextColor = Color.FromArgb(255, 100, 116, 139);
        text_8ngu0ok6.TextWrap = true;
        return new LayoutScreenResult((Panel)gamescene2d_ztj183re, nodes);
    }

    public static Panel BuildRoot(Action<string>? onAction = null)
    {
        return Build(onAction).Root;
    }

    public static Panel Mount(Action<string>? onAction = null)
    {
        return Build(onAction).Mount();
    }

    public static Panel BuildInto(Control parent, Action<string>? onAction = null)
    {
        var root = BuildRoot(onAction);
        root.Parent = parent;
        return root;
    }

    public static IReadOnlyList<string> ExportNotes()
    {
        return new string[]
        {
            "GameScene2D gamescene2d_ztj183re: 星火2.0 2D场景架构 = CanvasAnimated(渲染) + PhysicsWorld2D(物理)。设计分辨率 960x540，重力=900。坐标转换: PhysToScreenX = px * PixelsPerMeter - cameraX, PhysToScreenY = viewportHeight - py * PixelsPerMeter。",
            "GradientBlock gradientblock_mwjzd5fu is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "Node image_i0rdvtg5 binds image resource ./assets/game2d/sheets/mossy_hills.png; Spark2 export now writes it to the control Image property.",
            "SpriteAnimation spriteanimation_ys7k64aa: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/plant1.png, FramesPerRow=10, 帧数=90）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_ys7k64aa binds image resource ./assets/game2d/sheets/plant1.png; Spark2 export now writes it to the control Image property.",
            "SpriteAnimation spriteanimation_5lcymdot: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/plant1.png, FramesPerRow=10, 帧数=90）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_5lcymdot binds image resource ./assets/game2d/sheets/plant1.png; Spark2 export now writes it to the control Image property.",
            "SpriteAnimation spriteanimation_5llm3r4r: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/plant_poison.png, FramesPerRow=10, 帧数=30）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_5llm3r4r binds image resource ./assets/game2d/sheets/plant_poison.png; Spark2 export now writes it to the control Image property.",
            "SpriteAnimation spriteanimation_y2x5fomx: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/plant1.png, FramesPerRow=10, 帧数=90）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_y2x5fomx binds image resource ./assets/game2d/sheets/plant1.png; Spark2 export now writes it to the control Image property.",
            "SpriteAnimation spriteanimation_m6mj18dd: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/plant_poison.png, FramesPerRow=10, 帧数=30）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_m6mj18dd binds image resource ./assets/game2d/sheets/plant_poison.png; Spark2 export now writes it to the control Image property.",
            "Collider2D collider2d_zypn0bay: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=false(触发器不阻挡物理)。tag=ground。",
            "ShapeRect shaperect_9bvxln2x is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine shapeline_g7jeu764 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "Collider2D collider2d_m1a21kdw: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=false(触发器不阻挡物理)。tag=platform。",
            "ShapeRect shaperect_ei19bp0i is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "Collider2D collider2d_48uj6zky: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=false(触发器不阻挡物理)。tag=platform。",
            "ShapeRect shaperect_k0cgbwn3 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "Collider2D collider2d_3w390iej: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=false(触发器不阻挡物理)。tag=platform。",
            "ShapeRect shaperect_nuf5zzj0 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "Collider2D collider2d_9m8ogd4r: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=false(触发器不阻挡物理)。tag=platform。",
            "ShapeRect shaperect_9kb47ul0 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "SpriteAnimation spriteanimation_6g23g0o8: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/slime_orange.png, FramesPerRow=10, 帧数=30）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_6g23g0o8 binds image resource ./assets/game2d/sheets/slime_orange.png; Spark2 export now writes it to the control Image property.",
            "Collider2D collider2d_ex6ai4yz: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=true(触发器不阻挡物理)。tag=enemy。",
            "SpriteAnimation spriteanimation_9m1aubjh: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/slime_green.png, FramesPerRow=10, 帧数=30）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_9m1aubjh binds image resource ./assets/game2d/sheets/slime_green.png; Spark2 export now writes it to the control Image property.",
            "Collider2D collider2d_sqwpkl9x: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=true(触发器不阻挡物理)。tag=enemy。",
            "SpriteAnimation spriteanimation_ehzwzr2b: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/slime_orange.png, FramesPerRow=10, 帧数=30）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_ehzwzr2b binds image resource ./assets/game2d/sheets/slime_orange.png; Spark2 export now writes it to the control Image property.",
            "Collider2D collider2d_ehc99f42: 星火2.0使用 RigidBody2D(Static) + CollisionBox2D。IsTrigger=true(触发器不阻挡物理)。tag=enemy。",
            "CharacterController2D charactercontroller2d_pgrzbdex: 星火2.0使用 RigidBody2D(Dynamic) + CollisionBox2D 实现角色物理。动画通过 AnimatedImageSource.PlayAnimation(\"idle\") 切换。速度=200, 跳跃力=380, 动画集=[idle,walk,jump]。",
            "SpriteAnimation spriteanimation_wuq4e93w: 星火2.0使用 AnimatedImageSource + CanvasAnimated 绘制帧动画。需在数据编辑器中创建 GameDataAnimatedImage 资源（Image=./assets/game2d/sheets/wizard_dash_fx.png, FramesPerRow=8, 帧数=16）。Canvas.DrawAnimatedImage(anim, x, y) 进行渲染。",
            "Node spriteanimation_wuq4e93w binds image resource ./assets/game2d/sheets/wizard_dash_fx.png; Spark2 export now writes it to the control Image property.",
            "Joystick joystick_ola1xd6b: 星火2.0使用 Canvas.OnPointerPressed + CapturePointer + OnPointerCapturedMove 实现虚拟摇杆。size=100, deadZone=0.15。",
        };
    }
}
#endif
