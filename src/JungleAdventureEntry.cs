using GameCore.GameSystem.Data;
using GameCore.SceneSystem;

namespace GameEntry;

public class JungleAdventureEntry : IGameClass
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
                Game.Logger.LogInformation("JungleAdventure: 3D scene rendering disabled");
            }
        }
        catch (System.Exception ex)
        {
            Game.Logger.LogWarning("JungleAdventure: Failed to disable scene rendering: {0}", ex.Message);
        }
    }

    private static void MountScreen()
    {
        try
        {
            Game.Logger.LogInformation("JungleAdventure: Starting full Mount...");
            GeneratedUi.Spark2.Screens.JungleAdventure2DScreen.Mount();
            Game.Logger.LogInformation("JungleAdventure: Mount complete.");
        }
        catch (System.Exception ex)
        {
            Game.Logger.LogError("JungleAdventure: Mount failed: {0}", ex);
        }
    }
#endif
}
