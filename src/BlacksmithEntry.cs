using GameCore.GameSystem.Data;
using GameCore.SceneSystem;

namespace GameEntry;

public class BlacksmithEntry : IGameClass
{
    public static void OnRegisterGameClass()
    {
        Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
    }

    private static void OnGameTriggerInitialization()
    {
        if (Game.GameModeLink != ScopeData.GameDataGameMode.MapGameMode)
        {
            return;
        }

#if CLIENT
        // 禁用3D场景渲染（只显示UI，不渲染地形）
        DisableSceneRendering();
        MountScreen();
#endif
    }

#if CLIENT
    private static void DisableSceneRendering()
    {
        try
        {
            // 获取当前场景并禁用地形渲染
            var sceneData = ScopeData.GameDataScene.new_scene.Data;
            if (sceneData != null)
            {
                sceneData.RenderScenery = false;
                Game.Logger.LogInformation("Blacksmith: 3D scene rendering disabled");
            }
        }
        catch (System.Exception ex)
        {
            Game.Logger.LogWarning("Blacksmith: Failed to disable scene rendering: {0}", ex.Message);
        }
    }

    private static void MountScreen()
    {
        try
        {
            Game.Logger.LogInformation("Blacksmith: Starting Mount...");
            
            // 设置设计分辨率为 1366x768（横屏），引擎会自动缩放 UI 坐标适配实际屏幕
            GameUI.Device.ScreenViewport.Primary.SetDesignResolution(1366f, 768f, GameUI.Enum.ScaleMode.Contain);
            
            // 使用 LayoutRegistry 获取界面
            var result = GeneratedUi.Spark2.Screens.HomeScreen工坊主界面.Build();
            if (result.Root != null)
            {
                result.Root.AddToVisualTree();
                Game.Logger.LogInformation("Blacksmith: HomeScreen mounted successfully.");
            }
            else
            {
                Game.Logger.LogWarning("Blacksmith: HomeScreen Build returned null root.");
            }
        }
        catch (System.Exception ex)
        {
            Game.Logger.LogError("Blacksmith: Mount failed: {0}", ex);
        }
    }
#endif
}
