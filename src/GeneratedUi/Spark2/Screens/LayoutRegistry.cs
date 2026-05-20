#if CLIENT
using System;
using System.Collections.Generic;

namespace GameEntry.GeneratedUi.Spark2.Screens;

public static class LayoutRegistry
{
    public static readonly IReadOnlyDictionary<string, Func<LayoutScreenResult>> Screens =
        new Dictionary<string, Func<LayoutScreenResult>>
        {
            ["page_e0d23861"] = () => SlgCityOverviewTabletScreen.Build(),
            ["doc_adaec96b"] = () => JungleAdventure2DScreen.Build(),
        };
}
#endif
