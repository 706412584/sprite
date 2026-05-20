#if CLIENT
using System;
using System.Collections.Generic;

namespace GameEntry.GeneratedUi.Spark2.Screens;

public static class LayoutRegistry
{
    public static readonly IReadOnlyDictionary<string, Func<LayoutScreenResult>> Screens =
        new Dictionary<string, Func<LayoutScreenResult>>
        {
            ["doc_1d2e6fbf"] = () => HomeScreen工坊主界面.Build(),
            ["doc_3c0047cc"] = () => OrderBoardScreen订单板.Build(),
            ["doc_cf61de2e"] = () => ForgeScreen锻造界面.Build(),
            ["doc_fdf5013f"] = () => ResultScreen结算界面.Build(),
            ["doc_bb25af14"] = () => UpgradeScreen设施升级.Build(),
            ["doc_be8fef73"] = () => CodexScreen名器图鉴.Build(),
            ["doc_2696e0d2"] = () => StoryScreen剧情对话.Build(),
            ["doc_dc119ed5"] = () => SettingsScreen设置.Build(),
        };
}
#endif
