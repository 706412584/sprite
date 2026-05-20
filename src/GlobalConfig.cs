using GameCore.GameSystem.Data;

namespace GameEntry;

public class GlobalConfig : IGameClass
{
    public static void OnRegisterGameClass()
    {
        // 注册可用的游戏模式。
        // 联机模式下服务器会发送游戏模式字符串，引擎据此选择对应模式。
        GameDataGlobalConfig.AvailableGameModes = new()
        {
            // 框架内置默认模式（GameCore.ScopeData 是框架自身数据，非 GSC 别名）
            {"", GameCore.ScopeData.GameMode.Default},
            // 当前地图游戏模式（GameEntry.ScopeData 是项目数据编辑器生成的 Link）
            {"MapGameMode", ScopeData.GameDataGameMode.MapGameMode},
        };
        GameDataGlobalConfig.TestGameMode = ScopeData.GameDataGameMode.MapGameMode;
        GameDataGlobalConfig.SinglePlayerTestSlotId = 1;
    }
}
