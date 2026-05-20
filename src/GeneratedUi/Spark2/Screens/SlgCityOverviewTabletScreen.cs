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

public static class SlgCityOverviewTabletScreen
{
    public const string ScreenId = "page_e0d23861";

    public static LayoutScreenResult Build(Action<string>? onAction = null)
    {
        var nodes = new Dictionary<string, Control>();

        var root = LayoutEditorSpark2Runtime.Register(nodes, "panel_38zl4n0g", new Panel());
        root.HorizontalAlignment = HorizontalAlignment.Left;
        root.VerticalAlignment = VerticalAlignment.Top;
        root.Width = 1536f;
        root.Height = 2048f;
        root.Background = new SolidColorBrush(Color.FromArgb(255, 18, 24, 38));
        root.Padding = new Thickness(16f, 16f, 16f, 16f);

        var topBar = LayoutEditorSpark2Runtime.Register(nodes, "panel_6uevvc8s", new Panel());
        topBar.Parent = root;
        topBar.HorizontalAlignment = HorizontalAlignment.Left;
        topBar.VerticalAlignment = VerticalAlignment.Top;

        var resourceBar = LayoutEditorSpark2Runtime.Register(nodes, "panel_nxwmc1eq", new Panel());
        resourceBar.Parent = topBar;
        resourceBar.HorizontalAlignment = HorizontalAlignment.Left;
        resourceBar.VerticalAlignment = VerticalAlignment.Top;

        var foodButton = LayoutEditorSpark2Runtime.Register(nodes, "button_2mcql1ig", new TextButton());
        foodButton.Parent = resourceBar;
        foodButton.HorizontalAlignment = HorizontalAlignment.Left;
        foodButton.VerticalAlignment = VerticalAlignment.Top;
        foodButton.Background = new SolidColorBrush(Color.FromArgb(255, 22, 101, 52));
        foodButton.Padding = new Thickness(8f, 8f, 8f, 8f);
        foodButton.CornerRadius = 999f;
        foodButton.Text = "粮草 48.2k";
        foodButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        foodButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        foodButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(foodButton, "resource.food", onAction);

        var woodButton = LayoutEditorSpark2Runtime.Register(nodes, "button_chcy116h", new TextButton());
        woodButton.Parent = resourceBar;
        woodButton.HorizontalAlignment = HorizontalAlignment.Left;
        woodButton.VerticalAlignment = VerticalAlignment.Top;
        woodButton.Background = new SolidColorBrush(Color.FromArgb(255, 146, 64, 14));
        woodButton.Padding = new Thickness(8f, 8f, 8f, 8f);
        woodButton.CornerRadius = 999f;
        woodButton.Text = "木材 31.6k";
        woodButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        woodButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        woodButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(woodButton, "resource.wood", onAction);

        var stoneButton = LayoutEditorSpark2Runtime.Register(nodes, "button_1u9tfeyn", new TextButton());
        stoneButton.Parent = resourceBar;
        stoneButton.HorizontalAlignment = HorizontalAlignment.Left;
        stoneButton.VerticalAlignment = VerticalAlignment.Top;
        stoneButton.Background = new SolidColorBrush(Color.FromArgb(255, 71, 85, 105));
        stoneButton.Padding = new Thickness(8f, 8f, 8f, 8f);
        stoneButton.CornerRadius = 999f;
        stoneButton.Text = "石料 27.8k";
        stoneButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        stoneButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        stoneButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(stoneButton, "resource.stone", onAction);

        var powerButton = LayoutEditorSpark2Runtime.Register(nodes, "button_awenhsyy", new TextButton());
        powerButton.Parent = topBar;
        powerButton.HorizontalAlignment = HorizontalAlignment.Left;
        powerButton.VerticalAlignment = VerticalAlignment.Top;
        powerButton.Background = new SolidColorBrush(Color.FromArgb(255, 124, 45, 18));
        powerButton.Padding = new Thickness(8f, 8f, 8f, 8f);
        powerButton.CornerRadius = 999f;
        powerButton.Text = "势力值 185,240";
        powerButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        powerButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        powerButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(powerButton, "resource.power", onAction);

        var middleBand = LayoutEditorSpark2Runtime.Register(nodes, "panel_b5p9sj5w", new Panel());
        middleBand.Parent = root;
        middleBand.HorizontalAlignment = HorizontalAlignment.Left;
        middleBand.VerticalAlignment = VerticalAlignment.Top;

        var missionPanel = LayoutEditorSpark2Runtime.Register(nodes, "panel_q2u3ogbx", new Panel());
        missionPanel.Parent = middleBand;
        missionPanel.HorizontalAlignment = HorizontalAlignment.Left;
        missionPanel.VerticalAlignment = VerticalAlignment.Top;
        missionPanel.Width = 240f;
        missionPanel.Background = new SolidColorBrush(Color.FromArgb(238, 15, 23, 42));
        missionPanel.Padding = new Thickness(12f, 12f, 12f, 12f);
        missionPanel.CornerRadius = 12f;

        var missionTitle = LayoutEditorSpark2Runtime.Register(nodes, "text_w1e8v580", new Label());
        missionTitle.Parent = missionPanel;
        missionTitle.HorizontalAlignment = HorizontalAlignment.Left;
        missionTitle.VerticalAlignment = VerticalAlignment.Top;
        missionTitle.Text = "发展任务";
        missionTitle.FontSize = 15f;
        missionTitle.TextColor = Color.FromArgb(255, 248, 250, 252);
        missionTitle.Bold = true;
        missionTitle.TextWrap = true;

        var missionBody = LayoutEditorSpark2Runtime.Register(nodes, "text_ukgsuhc8", new Label());
        missionBody.Parent = missionPanel;
        missionBody.HorizontalAlignment = HorizontalAlignment.Left;
        missionBody.VerticalAlignment = VerticalAlignment.Top;
        missionBody.Text = "升级兵营至 12 级，解锁重装步兵。";
        missionBody.FontSize = 12f;
        missionBody.TextColor = Color.FromArgb(255, 203, 213, 225);
        missionBody.TextWrap = true;

        var missionGo = LayoutEditorSpark2Runtime.Register(nodes, "button_opq8scl6", new TextButton());
        missionGo.Parent = missionPanel;
        missionGo.HorizontalAlignment = HorizontalAlignment.Left;
        missionGo.VerticalAlignment = VerticalAlignment.Top;
        missionGo.Background = new SolidColorBrush(Color.FromArgb(255, 37, 99, 235));
        missionGo.Padding = new Thickness(8f, 8f, 8f, 8f);
        missionGo.CornerRadius = 8f;
        missionGo.Text = "前往";
        missionGo.TextColor = Color.FromArgb(255, 255, 255, 255);
        missionGo.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        missionGo.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(missionGo, "mission.go", onAction);

        var sideTools = LayoutEditorSpark2Runtime.Register(nodes, "panel_279fhl4d", new Panel());
        sideTools.Parent = middleBand;
        sideTools.HorizontalAlignment = HorizontalAlignment.Left;
        sideTools.VerticalAlignment = VerticalAlignment.Top;

        var mailButton = LayoutEditorSpark2Runtime.Register(nodes, "button_yxp30mml", new TextButton());
        mailButton.Parent = sideTools;
        mailButton.HorizontalAlignment = HorizontalAlignment.Left;
        mailButton.VerticalAlignment = VerticalAlignment.Top;
        mailButton.Width = 88f;
        mailButton.Background = new SolidColorBrush(Color.FromArgb(255, 51, 65, 85));
        mailButton.Padding = new Thickness(10f, 10f, 10f, 10f);
        mailButton.CornerRadius = 10f;
        mailButton.Text = "邮件";
        mailButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        mailButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        mailButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(mailButton, "side.mail", onAction);

        var troopButton = LayoutEditorSpark2Runtime.Register(nodes, "button_trnafpqi", new TextButton());
        troopButton.Parent = sideTools;
        troopButton.HorizontalAlignment = HorizontalAlignment.Left;
        troopButton.VerticalAlignment = VerticalAlignment.Top;
        troopButton.Width = 88f;
        troopButton.Background = new SolidColorBrush(Color.FromArgb(255, 51, 65, 85));
        troopButton.Padding = new Thickness(10f, 10f, 10f, 10f);
        troopButton.CornerRadius = 10f;
        troopButton.Text = "部队";
        troopButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        troopButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        troopButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(troopButton, "side.troop", onAction);

        var worldButton = LayoutEditorSpark2Runtime.Register(nodes, "button_n6x1v178", new TextButton());
        worldButton.Parent = sideTools;
        worldButton.HorizontalAlignment = HorizontalAlignment.Left;
        worldButton.VerticalAlignment = VerticalAlignment.Top;
        worldButton.Width = 88f;
        worldButton.Background = new SolidColorBrush(Color.FromArgb(255, 51, 65, 85));
        worldButton.Padding = new Thickness(10f, 10f, 10f, 10f);
        worldButton.CornerRadius = 10f;
        worldButton.Text = "世界";
        worldButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        worldButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        worldButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(worldButton, "side.world", onAction);

        var bottomBand = LayoutEditorSpark2Runtime.Register(nodes, "panel_4g6t1aua", new Panel());
        bottomBand.Parent = root;
        bottomBand.HorizontalAlignment = HorizontalAlignment.Left;
        bottomBand.VerticalAlignment = VerticalAlignment.Top;
        bottomBand.Background = new SolidColorBrush(Color.FromArgb(238, 15, 23, 42));
        bottomBand.Padding = new Thickness(12f, 12f, 12f, 12f);
        bottomBand.CornerRadius = 14f;

        var cityButton = LayoutEditorSpark2Runtime.Register(nodes, "button_zb33vs9i", new TextButton());
        cityButton.Parent = bottomBand;
        cityButton.HorizontalAlignment = HorizontalAlignment.Left;
        cityButton.VerticalAlignment = VerticalAlignment.Top;
        cityButton.Background = new SolidColorBrush(Color.FromArgb(255, 30, 41, 59));
        cityButton.Padding = new Thickness(12f, 12f, 12f, 12f);
        cityButton.CornerRadius = 10f;
        cityButton.Text = "主城 Lv.15";
        cityButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        cityButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        cityButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(cityButton, "building.city", onAction);

        var barrackButton = LayoutEditorSpark2Runtime.Register(nodes, "button_v8vj9md4", new TextButton());
        barrackButton.Parent = bottomBand;
        barrackButton.HorizontalAlignment = HorizontalAlignment.Left;
        barrackButton.VerticalAlignment = VerticalAlignment.Top;
        barrackButton.Background = new SolidColorBrush(Color.FromArgb(255, 30, 41, 59));
        barrackButton.Padding = new Thickness(12f, 12f, 12f, 12f);
        barrackButton.CornerRadius = 10f;
        barrackButton.Text = "兵营 Lv.11";
        barrackButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        barrackButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        barrackButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(barrackButton, "building.barrack", onAction);

        var warehouseButton = LayoutEditorSpark2Runtime.Register(nodes, "button_g1ynyo0s", new TextButton());
        warehouseButton.Parent = bottomBand;
        warehouseButton.HorizontalAlignment = HorizontalAlignment.Left;
        warehouseButton.VerticalAlignment = VerticalAlignment.Top;
        warehouseButton.Background = new SolidColorBrush(Color.FromArgb(255, 30, 41, 59));
        warehouseButton.Padding = new Thickness(12f, 12f, 12f, 12f);
        warehouseButton.CornerRadius = 10f;
        warehouseButton.Text = "仓库 Lv.13";
        warehouseButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        warehouseButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        warehouseButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(warehouseButton, "building.warehouse", onAction);

        var academyButton = LayoutEditorSpark2Runtime.Register(nodes, "button_0zkgbiky", new TextButton());
        academyButton.Parent = bottomBand;
        academyButton.HorizontalAlignment = HorizontalAlignment.Left;
        academyButton.VerticalAlignment = VerticalAlignment.Top;
        academyButton.Background = new SolidColorBrush(Color.FromArgb(255, 30, 41, 59));
        academyButton.Padding = new Thickness(12f, 12f, 12f, 12f);
        academyButton.CornerRadius = 10f;
        academyButton.Text = "研究所 Lv.9";
        academyButton.TextColor = Color.FromArgb(255, 255, 255, 255);
        academyButton.TextHorizontalAlignment = HorizontalContentAlignment.Center;
        academyButton.TextVerticalAlignment = VerticalContentAlignment.Center;
        LayoutEditorSpark2Runtime.BindAction(academyButton, "building.academy", onAction);

        return new LayoutScreenResult(root, nodes);
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
            "No export notes.",
        };
    }
}
#endif
