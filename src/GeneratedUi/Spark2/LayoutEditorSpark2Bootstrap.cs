// 由布局编辑器自动生成，请勿手动修改。每次导出会覆盖。
// 在游戏 IGameClass 入口里调用 Initialize() 一次即可，例如：
//
//   public static void OnRegisterGameClass()
//   {
//       Game.OnGameTriggerInitialization += () =>
//       {
//           #if CLIENT
//           GameEntry.GeneratedUi.Spark2.LayoutEditorSpark2Bootstrap.Initialize();
//           #endif
//       };
//   }
#if CLIENT
using GameUI;

namespace GameEntry.GeneratedUi.Spark2;

public static class LayoutEditorSpark2Bootstrap
{
    /// <summary>项目设计分辨率，单位：像素。</summary>
    public const float DesignWidth = 1080f;
    public const float DesignHeight = 1920f;

    /// <summary>项目缩放策略：MatchHeight。</summary>
    public const GameUI.Enum.ScaleMode DesignScaleMode = GameUI.Enum.ScaleMode.MatchHeight;

    private static bool _initialized;

    /// <summary>
    /// 设置当前 ScreenViewport 的设计分辨率与缩放策略。
    /// 多次调用是幂等的——首次生效，后续直接返回。如果项目重新导出后
    /// 设计分辨率改了，需要重新进游戏才生效。
    /// </summary>
    public static void Initialize()
    {
        if (_initialized) return;
        _initialized = true;
        GameUI.Device.ScreenViewport.Primary.SetDesignResolution(
            DesignWidth, DesignHeight, DesignScaleMode);
    }

    /// <summary>
    /// 强制重新设置设计分辨率，忽略幂等保护。仅用于热更或调试。
    /// </summary>
    public static void Reapply()
    {
        GameUI.Device.ScreenViewport.Primary.SetDesignResolution(
            DesignWidth, DesignHeight, DesignScaleMode);
        _initialized = true;
    }
}
#endif
