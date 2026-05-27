using GameCore.GameSystem.Data;
using GameCore.SceneSystem;
#if CLIENT
using GameEntry.GeneratedUi.Spark2;
#endif

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

            // 设置项目级设计分辨率与缩放策略（由布局编辑器导出，存在 Bootstrap 里）
            LayoutEditorSpark2Bootstrap.Initialize();

            var result = GeneratedUi.Spark2.Screens.登录界面.Build(actionId =>
            {
                Game.Logger.LogInformation("Action: {0}", actionId);
            });
            if (result.Root != null)
            {
                // 覆盖根面板对齐方式为居中，保持原始 1080x1920 固定尺寸
                // CoverCentered 会缩放设计分辨率空间填满视口，根面板居中确保内容正确定位
                result.Root.HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Center;
                result.Root.VerticalAlignment = GameUI.Enum.VerticalAlignment.Center;

                result.Root.AddToVisualTree();
                Game.Logger.LogInformation("NewProject: 登录界面 mounted. DesignRes=1080x1920 CoverCentered, root=1080x1920 centered");

                // === Mount 后手动修正：把布局器里居中过的节点强制水平居中 ===
                // 现状：导出器把所有节点都写成 HorizontalAlignment.Left + Width=parentWidth + Margin.left=0/手动偏移，
                // 不会把布局器侧的 alignSelf:center / justifyContent:center 翻译成 HorizontalAlignment.Center。
                // 这里按节点 id 显式覆盖，作为修正预览的临时手段；后续应在导出器里统一处理。
                CenterHorizontallyById(result, "coin_row");

                // 打印 Spine 节点信息
                foreach (var kvp in result.Nodes)
                {
                    var ctrl = kvp.Value;
                    if (ctrl is GameUI.Control.Primitive.Spine spine)
                    {
                        Game.Logger.LogInformation("Spine node '{0}': Resource={1}, Animation={2}, IsLooping={3}", 
                            kvp.Key, spine.Resource, spine.Animation, spine.IsLooping);
                    }
                }
            }
            else
            {
                Game.Logger.LogWarning("NewProject: Build returned null root.");
            }
        }
        catch (System.Exception ex)
        {
            Game.Logger.LogError("NewProject: Mount failed: {0}", ex);
        }
    }

    /// <summary>
    /// 把节点强制水平居中：HorizontalAlignment=Center + 清掉左右 Margin。
    /// 用于修正导出器目前没把"alignSelf:center / justifyContent:center"翻译过来的临时方案。
    /// </summary>
    private static void CenterHorizontallyById(LayoutScreenResult result, string nodeId)
    {
        if (result?.Nodes == null) return;
        if (!result.Nodes.TryGetValue(nodeId, out var ctrl) || ctrl == null)
        {
            Game.Logger.LogWarning("CenterHorizontallyById: node '{0}' not found", nodeId);
            return;
        }
        ctrl.HorizontalAlignment = GameUI.Enum.HorizontalAlignment.Center;
        var m = ctrl.Margin;
        ctrl.Margin = new GameUI.Struct.Thickness(0f, m.Top, 0f, m.Bottom);
        Game.Logger.LogInformation("CenterHorizontallyById: '{0}' centered (Margin.Top={1}, Bottom={2})", nodeId, m.Top, m.Bottom);
    }
#endif
}
