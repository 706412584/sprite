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

public static class StoryScreen剧情对话
{
    public const string ScreenId = "doc_2696e0d2";

    public static LayoutScreenResult Build(Action<string>? onAction = null)
    {
        var nodes = new Dictionary<string, Control>();
        var root = LayoutEditorSpark2Runtime.Register(nodes, "root", new Panel());
        root.HorizontalAlignment = HorizontalAlignment.Stretch;
        root.VerticalAlignment = VerticalAlignment.Stretch;
        root.Width = 0f;
        root.WidthStretchRatio = 1f;
        root.Height = 0f;
        root.HeightStretchRatio = 1f;
        root.Background = new SolidColorBrush(Color.FromArgb(255, 31, 26, 23));
        var sr_0 = LayoutEditorSpark2Runtime.Register(nodes, "sr_0", new Panel());
        sr_0.Parent = root;
        sr_0.HorizontalAlignment = HorizontalAlignment.Left;
        sr_0.VerticalAlignment = VerticalAlignment.Top;
        sr_0.Width = 1366f;
        sr_0.Height = 768f;
        sr_0.Background = new SolidColorBrush(Color.FromArgb(255, 31, 26, 23));
        var ph_1 = LayoutEditorSpark2Runtime.Register(nodes, "ph_1", new Panel());
        ph_1.Parent = root;
        ph_1.HorizontalAlignment = HorizontalAlignment.Left;
        ph_1.VerticalAlignment = VerticalAlignment.Top;
        ph_1.Width = 1366f;
        ph_1.Height = 768f;
        var sr_2 = LayoutEditorSpark2Runtime.Register(nodes, "sr_2", new Panel());
        sr_2.Parent = ph_1;
        sr_2.HorizontalAlignment = HorizontalAlignment.Left;
        sr_2.VerticalAlignment = VerticalAlignment.Top;
        sr_2.Width = 1366f;
        sr_2.Height = 768f;
        sr_2.Background = new SolidColorBrush(Color.FromArgb(242, 15, 12, 10));
        var sl_3 = LayoutEditorSpark2Runtime.Register(nodes, "sl_3", new Canvas());
        sl_3.Parent = ph_1;
        sl_3.HorizontalAlignment = HorizontalAlignment.Left;
        sl_3.VerticalAlignment = VerticalAlignment.Top;
        sl_3.Width = 1366f;
        sl_3.Height = 768f;
        var sl_4 = LayoutEditorSpark2Runtime.Register(nodes, "sl_4", new Canvas());
        sl_4.Parent = ph_1;
        sl_4.HorizontalAlignment = HorizontalAlignment.Left;
        sl_4.VerticalAlignment = VerticalAlignment.Top;
        sl_4.Width = 1366f;
        sl_4.Height = 768f;
        var tx_5 = LayoutEditorSpark2Runtime.Register(nodes, "tx_5", new Label());
        tx_5.Parent = ph_1;
        tx_5.HorizontalAlignment = HorizontalAlignment.Left;
        tx_5.VerticalAlignment = VerticalAlignment.Top;
        tx_5.Width = 1366f;
        tx_5.Height = 20f;
        tx_5.Margin = new Thickness(0f, 374f, 0f, 0f);
        tx_5.Text = "【剧情场景占位】铁匠铺夜景 · 烛火 · 雨檐 · 远山";
        tx_5.FontSize = 14f;
        tx_5.TextColor = Color.FromArgb(102, 247, 232, 200);
        tx_5.TextWrap = true;
        var sl_6 = LayoutEditorSpark2Runtime.Register(nodes, "sl_6", new Canvas());
        sl_6.Parent = root;
        sl_6.HorizontalAlignment = HorizontalAlignment.Left;
        sl_6.VerticalAlignment = VerticalAlignment.Top;
        sl_6.Width = 20f;
        sl_6.Height = 768f;
        sl_6.Margin = new Thickness(80f, 0f, 0f, 0f);
        var sl_7 = LayoutEditorSpark2Runtime.Register(nodes, "sl_7", new Canvas());
        sl_7.Parent = root;
        sl_7.HorizontalAlignment = HorizontalAlignment.Left;
        sl_7.VerticalAlignment = VerticalAlignment.Top;
        sl_7.Width = 20f;
        sl_7.Height = 768f;
        sl_7.Margin = new Thickness(180f, 0f, 0f, 0f);
        var sl_8 = LayoutEditorSpark2Runtime.Register(nodes, "sl_8", new Canvas());
        sl_8.Parent = root;
        sl_8.HorizontalAlignment = HorizontalAlignment.Left;
        sl_8.VerticalAlignment = VerticalAlignment.Top;
        sl_8.Width = 20f;
        sl_8.Height = 768f;
        sl_8.Margin = new Thickness(280f, 0f, 0f, 0f);
        var sl_9 = LayoutEditorSpark2Runtime.Register(nodes, "sl_9", new Canvas());
        sl_9.Parent = root;
        sl_9.HorizontalAlignment = HorizontalAlignment.Left;
        sl_9.VerticalAlignment = VerticalAlignment.Top;
        sl_9.Width = 20f;
        sl_9.Height = 768f;
        sl_9.Margin = new Thickness(380f, 0f, 0f, 0f);
        var sl_a = LayoutEditorSpark2Runtime.Register(nodes, "sl_a", new Canvas());
        sl_a.Parent = root;
        sl_a.HorizontalAlignment = HorizontalAlignment.Left;
        sl_a.VerticalAlignment = VerticalAlignment.Top;
        sl_a.Width = 20f;
        sl_a.Height = 768f;
        sl_a.Margin = new Thickness(480f, 0f, 0f, 0f);
        var sl_b = LayoutEditorSpark2Runtime.Register(nodes, "sl_b", new Canvas());
        sl_b.Parent = root;
        sl_b.HorizontalAlignment = HorizontalAlignment.Left;
        sl_b.VerticalAlignment = VerticalAlignment.Top;
        sl_b.Width = 20f;
        sl_b.Height = 768f;
        sl_b.Margin = new Thickness(580f, 0f, 0f, 0f);
        var sl_c = LayoutEditorSpark2Runtime.Register(nodes, "sl_c", new Canvas());
        sl_c.Parent = root;
        sl_c.HorizontalAlignment = HorizontalAlignment.Left;
        sl_c.VerticalAlignment = VerticalAlignment.Top;
        sl_c.Width = 20f;
        sl_c.Height = 768f;
        sl_c.Margin = new Thickness(680f, 0f, 0f, 0f);
        var sl_d = LayoutEditorSpark2Runtime.Register(nodes, "sl_d", new Canvas());
        sl_d.Parent = root;
        sl_d.HorizontalAlignment = HorizontalAlignment.Left;
        sl_d.VerticalAlignment = VerticalAlignment.Top;
        sl_d.Width = 20f;
        sl_d.Height = 768f;
        sl_d.Margin = new Thickness(780f, 0f, 0f, 0f);
        var sl_e = LayoutEditorSpark2Runtime.Register(nodes, "sl_e", new Canvas());
        sl_e.Parent = root;
        sl_e.HorizontalAlignment = HorizontalAlignment.Left;
        sl_e.VerticalAlignment = VerticalAlignment.Top;
        sl_e.Width = 20f;
        sl_e.Height = 768f;
        sl_e.Margin = new Thickness(880f, 0f, 0f, 0f);
        var sl_f = LayoutEditorSpark2Runtime.Register(nodes, "sl_f", new Canvas());
        sl_f.Parent = root;
        sl_f.HorizontalAlignment = HorizontalAlignment.Left;
        sl_f.VerticalAlignment = VerticalAlignment.Top;
        sl_f.Width = 20f;
        sl_f.Height = 768f;
        sl_f.Margin = new Thickness(980f, 0f, 0f, 0f);
        var sl_g = LayoutEditorSpark2Runtime.Register(nodes, "sl_g", new Canvas());
        sl_g.Parent = root;
        sl_g.HorizontalAlignment = HorizontalAlignment.Left;
        sl_g.VerticalAlignment = VerticalAlignment.Top;
        sl_g.Width = 20f;
        sl_g.Height = 768f;
        sl_g.Margin = new Thickness(1080f, 0f, 0f, 0f);
        var sl_h = LayoutEditorSpark2Runtime.Register(nodes, "sl_h", new Canvas());
        sl_h.Parent = root;
        sl_h.HorizontalAlignment = HorizontalAlignment.Left;
        sl_h.VerticalAlignment = VerticalAlignment.Top;
        sl_h.Width = 20f;
        sl_h.Height = 768f;
        sl_h.Margin = new Thickness(1180f, 0f, 0f, 0f);
        var ph_i = LayoutEditorSpark2Runtime.Register(nodes, "ph_i", new Panel());
        ph_i.Parent = root;
        ph_i.HorizontalAlignment = HorizontalAlignment.Left;
        ph_i.VerticalAlignment = VerticalAlignment.Top;
        ph_i.Width = 360f;
        ph_i.Height = 548f;
        ph_i.Margin = new Thickness(60f, 100f, 0f, 0f);
        var sr_j = LayoutEditorSpark2Runtime.Register(nodes, "sr_j", new Panel());
        sr_j.Parent = ph_i;
        sr_j.HorizontalAlignment = HorizontalAlignment.Left;
        sr_j.VerticalAlignment = VerticalAlignment.Top;
        sr_j.Width = 360f;
        sr_j.Height = 548f;
        sr_j.Background = new SolidColorBrush(Color.FromArgb(217, 31, 26, 23));
        sr_j.CornerRadius = 8f;
        var sl_k = LayoutEditorSpark2Runtime.Register(nodes, "sl_k", new Canvas());
        sl_k.Parent = ph_i;
        sl_k.HorizontalAlignment = HorizontalAlignment.Left;
        sl_k.VerticalAlignment = VerticalAlignment.Top;
        sl_k.Width = 360f;
        sl_k.Height = 548f;
        var sl_l = LayoutEditorSpark2Runtime.Register(nodes, "sl_l", new Canvas());
        sl_l.Parent = ph_i;
        sl_l.HorizontalAlignment = HorizontalAlignment.Left;
        sl_l.VerticalAlignment = VerticalAlignment.Top;
        sl_l.Width = 360f;
        sl_l.Height = 548f;
        var tx_m = LayoutEditorSpark2Runtime.Register(nodes, "tx_m", new Label());
        tx_m.Parent = ph_i;
        tx_m.HorizontalAlignment = HorizontalAlignment.Left;
        tx_m.VerticalAlignment = VerticalAlignment.Top;
        tx_m.Width = 360f;
        tx_m.Height = 20f;
        tx_m.Margin = new Thickness(0f, 264f, 0f, 0f);
        tx_m.Text = "【立绘 · 老师傅】\n抱铁拳 · 围裙 · 烟斗";
        tx_m.FontSize = 16f;
        tx_m.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_m.TextWrap = true;
        var sr_n = LayoutEditorSpark2Runtime.Register(nodes, "sr_n", new Panel());
        sr_n.Parent = root;
        sr_n.HorizontalAlignment = HorizontalAlignment.Left;
        sr_n.VerticalAlignment = VerticalAlignment.Top;
        sr_n.Width = 280f;
        sr_n.Height = 36f;
        sr_n.Margin = new Thickness(40f, 638f, 0f, 0f);
        sr_n.Background = new SolidColorBrush(Color.FromArgb(255, 58, 50, 43));
        sr_n.CornerRadius = 6f;
        var tx_o = LayoutEditorSpark2Runtime.Register(nodes, "tx_o", new Label());
        tx_o.Parent = root;
        tx_o.HorizontalAlignment = HorizontalAlignment.Left;
        tx_o.VerticalAlignment = VerticalAlignment.Top;
        tx_o.Width = 280f;
        tx_o.Height = 36f;
        tx_o.Margin = new Thickness(40f, 638f, 0f, 0f);
        tx_o.Text = "· 老 · 钟 · ";
        tx_o.FontSize = 18f;
        tx_o.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_o.Bold = true;
        tx_o.TextWrap = true;
        var tx_p = LayoutEditorSpark2Runtime.Register(nodes, "tx_p", new Label());
        tx_p.Parent = root;
        tx_p.HorizontalAlignment = HorizontalAlignment.Left;
        tx_p.VerticalAlignment = VerticalAlignment.Top;
        tx_p.Width = 280f;
        tx_p.Height = 18f;
        tx_p.Margin = new Thickness(40f, 678f, 0f, 0f);
        tx_p.Text = "北街铁匠铺  ·  你师父";
        tx_p.FontSize = 11f;
        tx_p.TextColor = Color.FromArgb(153, 247, 232, 200);
        tx_p.TextWrap = true;
        var df_q = LayoutEditorSpark2Runtime.Register(nodes, "df_q", new Panel());
        df_q.Parent = root;
        df_q.HorizontalAlignment = HorizontalAlignment.Left;
        df_q.VerticalAlignment = VerticalAlignment.Top;
        df_q.Width = 280f;
        df_q.Height = 200f;
        df_q.Margin = new Thickness(1046f, 100f, 0f, 0f);
        var sr_r = LayoutEditorSpark2Runtime.Register(nodes, "sr_r", new Panel());
        sr_r.Parent = df_q;
        sr_r.HorizontalAlignment = HorizontalAlignment.Left;
        sr_r.VerticalAlignment = VerticalAlignment.Top;
        sr_r.Width = 280f;
        sr_r.Height = 200f;
        sr_r.Background = new SolidColorBrush(Color.FromArgb(217, 31, 26, 23));
        sr_r.CornerRadius = 4f;
        var sc_s = LayoutEditorSpark2Runtime.Register(nodes, "sc_s", new Panel());
        sc_s.Parent = df_q;
        sc_s.HorizontalAlignment = HorizontalAlignment.Left;
        sc_s.VerticalAlignment = VerticalAlignment.Top;
        sc_s.Width = 6f;
        sc_s.Height = 6f;
        sc_s.Margin = new Thickness(6f, 6f, 0f, 0f);
        sc_s.Background = new SolidColorBrush(Color.FromArgb(255, 201, 164, 90));
        sc_s.CornerRadius = 999f;
        var sc_t = LayoutEditorSpark2Runtime.Register(nodes, "sc_t", new Panel());
        sc_t.Parent = df_q;
        sc_t.HorizontalAlignment = HorizontalAlignment.Left;
        sc_t.VerticalAlignment = VerticalAlignment.Top;
        sc_t.Width = 6f;
        sc_t.Height = 6f;
        sc_t.Margin = new Thickness(268f, 6f, 0f, 0f);
        sc_t.Background = new SolidColorBrush(Color.FromArgb(255, 201, 164, 90));
        sc_t.CornerRadius = 999f;
        var sc_u = LayoutEditorSpark2Runtime.Register(nodes, "sc_u", new Panel());
        sc_u.Parent = df_q;
        sc_u.HorizontalAlignment = HorizontalAlignment.Left;
        sc_u.VerticalAlignment = VerticalAlignment.Top;
        sc_u.Width = 6f;
        sc_u.Height = 6f;
        sc_u.Margin = new Thickness(6f, 188f, 0f, 0f);
        sc_u.Background = new SolidColorBrush(Color.FromArgb(255, 201, 164, 90));
        sc_u.CornerRadius = 999f;
        var sc_v = LayoutEditorSpark2Runtime.Register(nodes, "sc_v", new Panel());
        sc_v.Parent = df_q;
        sc_v.HorizontalAlignment = HorizontalAlignment.Left;
        sc_v.VerticalAlignment = VerticalAlignment.Top;
        sc_v.Width = 6f;
        sc_v.Height = 6f;
        sc_v.Margin = new Thickness(268f, 188f, 0f, 0f);
        sc_v.Background = new SolidColorBrush(Color.FromArgb(255, 201, 164, 90));
        sc_v.CornerRadius = 999f;
        var tx_w = LayoutEditorSpark2Runtime.Register(nodes, "tx_w", new Label());
        tx_w.Parent = root;
        tx_w.HorizontalAlignment = HorizontalAlignment.Left;
        tx_w.VerticalAlignment = VerticalAlignment.Top;
        tx_w.Width = 248f;
        tx_w.Height = 22f;
        tx_w.Margin = new Thickness(1062f, 116f, 0f, 0f);
        tx_w.Text = "· 章节 · 一章·三幕 ·";
        tx_w.FontSize = 14f;
        tx_w.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_w.Bold = true;
        tx_w.TextWrap = true;
        var sl_x = LayoutEditorSpark2Runtime.Register(nodes, "sl_x", new Canvas());
        sl_x.Parent = root;
        sl_x.HorizontalAlignment = HorizontalAlignment.Left;
        sl_x.VerticalAlignment = VerticalAlignment.Top;
        sl_x.Width = 248f;
        sl_x.Height = 2f;
        sl_x.Margin = new Thickness(1062f, 144f, 0f, 0f);
        var tx_y = LayoutEditorSpark2Runtime.Register(nodes, "tx_y", new Label());
        tx_y.Parent = root;
        tx_y.HorizontalAlignment = HorizontalAlignment.Left;
        tx_y.VerticalAlignment = VerticalAlignment.Top;
        tx_y.Width = 248f;
        tx_y.Height = 100f;
        tx_y.Margin = new Thickness(1062f, 154f, 0f, 0f);
        tx_y.Text = "入门徒之夜\n师父交付头一道委托\n选择关乎名声的初印象";
        tx_y.FontSize = 12f;
        tx_y.TextColor = Color.FromArgb(255, 241, 229, 204);
        tx_y.TextWrap = true;
        var sr_z = LayoutEditorSpark2Runtime.Register(nodes, "sr_z", new Panel());
        sr_z.Parent = root;
        sr_z.HorizontalAlignment = HorizontalAlignment.Left;
        sr_z.VerticalAlignment = VerticalAlignment.Top;
        sr_z.Width = 1286f;
        sr_z.Height = 220f;
        sr_z.Margin = new Thickness(40f, 528f, 0f, 0f);
        sr_z.Background = new SolidColorBrush(Color.FromArgb(235, 15, 12, 10));
        sr_z.CornerRadius = 10f;
        var sr_10 = LayoutEditorSpark2Runtime.Register(nodes, "sr_10", new Panel());
        sr_10.Parent = root;
        sr_10.HorizontalAlignment = HorizontalAlignment.Left;
        sr_10.VerticalAlignment = VerticalAlignment.Top;
        sr_10.Width = 160f;
        sr_10.Height = 32f;
        sr_10.Margin = new Thickness(60f, 534f, 0f, 0f);
        sr_10.Background = new SolidColorBrush(Color.FromArgb(255, 201, 106, 43));
        sr_10.CornerRadius = 4f;
        var tx_11 = LayoutEditorSpark2Runtime.Register(nodes, "tx_11", new Label());
        tx_11.Parent = root;
        tx_11.HorizontalAlignment = HorizontalAlignment.Left;
        tx_11.VerticalAlignment = VerticalAlignment.Top;
        tx_11.Width = 160f;
        tx_11.Height = 32f;
        tx_11.Margin = new Thickness(60f, 534f, 0f, 0f);
        tx_11.Text = "老钟";
        tx_11.FontSize = 14f;
        tx_11.TextColor = Color.FromArgb(255, 241, 229, 204);
        tx_11.Bold = true;
        tx_11.TextWrap = true;
        var tx_12 = LayoutEditorSpark2Runtime.Register(nodes, "tx_12", new Label());
        tx_12.Parent = root;
        tx_12.HorizontalAlignment = HorizontalAlignment.Left;
        tx_12.VerticalAlignment = VerticalAlignment.Top;
        tx_12.Width = 1226f;
        tx_12.Height = 70f;
        tx_12.Margin = new Thickness(60f, 572f, 0f, 0f);
        tx_12.Text = "\"小子，柳七娘的剪子今晚要交。\n手里的料是寒铁配银线钢，文火慢锻，莫贪求出尘。\n她要的是 平日好用，不是镇山之宝。听明白了？\"";
        tx_12.FontSize = 16f;
        tx_12.TextColor = Color.FromArgb(255, 241, 229, 204);
        tx_12.TextWrap = true;
        var plate_13 = LayoutEditorSpark2Runtime.Register(nodes, "plate_13", new Panel());
        plate_13.Parent = root;
        plate_13.HorizontalAlignment = HorizontalAlignment.Left;
        plate_13.VerticalAlignment = VerticalAlignment.Top;
        plate_13.Width = 294.5f;
        plate_13.Height = 80f;
        plate_13.Margin = new Thickness(60f, 652f, 0f, 0f);
        var sr_14 = LayoutEditorSpark2Runtime.Register(nodes, "sr_14", new Panel());
        sr_14.Parent = plate_13;
        sr_14.HorizontalAlignment = HorizontalAlignment.Left;
        sr_14.VerticalAlignment = VerticalAlignment.Top;
        sr_14.Width = 294.5f;
        sr_14.Height = 80f;
        sr_14.Background = new SolidColorBrush(Color.FromArgb(217, 79, 122, 99));
        sr_14.CornerRadius = 8f;
        var tx_15 = LayoutEditorSpark2Runtime.Register(nodes, "tx_15", new Label());
        tx_15.Parent = plate_13;
        tx_15.HorizontalAlignment = HorizontalAlignment.Left;
        tx_15.VerticalAlignment = VerticalAlignment.Top;
        tx_15.Width = 294.5f;
        tx_15.Height = 80f;
        tx_15.Text = "\"我懂——\n应了。\"";
        tx_15.FontSize = 13f;
        tx_15.TextColor = Color.FromArgb(255, 241, 229, 204);
        tx_15.Bold = true;
        tx_15.TextWrap = true;
        var plate_16 = LayoutEditorSpark2Runtime.Register(nodes, "plate_16", new Panel());
        plate_16.Parent = root;
        plate_16.HorizontalAlignment = HorizontalAlignment.Left;
        plate_16.VerticalAlignment = VerticalAlignment.Top;
        plate_16.Width = 294.5f;
        plate_16.Height = 80f;
        plate_16.Margin = new Thickness(366.5f, 652f, 0f, 0f);
        var sr_17 = LayoutEditorSpark2Runtime.Register(nodes, "sr_17", new Panel());
        sr_17.Parent = plate_16;
        sr_17.HorizontalAlignment = HorizontalAlignment.Left;
        sr_17.VerticalAlignment = VerticalAlignment.Top;
        sr_17.Width = 294.5f;
        sr_17.Height = 80f;
        sr_17.CornerRadius = 8f;
        var tx_18 = LayoutEditorSpark2Runtime.Register(nodes, "tx_18", new Label());
        tx_18.Parent = plate_16;
        tx_18.HorizontalAlignment = HorizontalAlignment.Left;
        tx_18.VerticalAlignment = VerticalAlignment.Top;
        tx_18.Width = 294.5f;
        tx_18.Height = 80f;
        tx_18.Text = "\"师父，能不能\n再讲一遍？\"";
        tx_18.FontSize = 13f;
        tx_18.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_18.Bold = true;
        tx_18.TextWrap = true;
        var plate_19 = LayoutEditorSpark2Runtime.Register(nodes, "plate_19", new Panel());
        plate_19.Parent = root;
        plate_19.HorizontalAlignment = HorizontalAlignment.Left;
        plate_19.VerticalAlignment = VerticalAlignment.Top;
        plate_19.Width = 294.5f;
        plate_19.Height = 80f;
        plate_19.Margin = new Thickness(673f, 652f, 0f, 0f);
        var sr_1a = LayoutEditorSpark2Runtime.Register(nodes, "sr_1a", new Panel());
        sr_1a.Parent = plate_19;
        sr_1a.HorizontalAlignment = HorizontalAlignment.Left;
        sr_1a.VerticalAlignment = VerticalAlignment.Top;
        sr_1a.Width = 294.5f;
        sr_1a.Height = 80f;
        sr_1a.CornerRadius = 8f;
        var tx_1b = LayoutEditorSpark2Runtime.Register(nodes, "tx_1b", new Label());
        tx_1b.Parent = plate_19;
        tx_1b.HorizontalAlignment = HorizontalAlignment.Left;
        tx_1b.VerticalAlignment = VerticalAlignment.Top;
        tx_1b.Width = 294.5f;
        tx_1b.Height = 80f;
        tx_1b.Text = "\"我能不能用\n更好的料？\"";
        tx_1b.FontSize = 13f;
        tx_1b.TextColor = Color.FromArgb(255, 201, 106, 43);
        tx_1b.Bold = true;
        tx_1b.TextWrap = true;
        var plate_1c = LayoutEditorSpark2Runtime.Register(nodes, "plate_1c", new Panel());
        plate_1c.Parent = root;
        plate_1c.HorizontalAlignment = HorizontalAlignment.Left;
        plate_1c.VerticalAlignment = VerticalAlignment.Top;
        plate_1c.Width = 294.5f;
        plate_1c.Height = 80f;
        plate_1c.Margin = new Thickness(979.5f, 652f, 0f, 0f);
        var sr_1d = LayoutEditorSpark2Runtime.Register(nodes, "sr_1d", new Panel());
        sr_1d.Parent = plate_1c;
        sr_1d.HorizontalAlignment = HorizontalAlignment.Left;
        sr_1d.VerticalAlignment = VerticalAlignment.Top;
        sr_1d.Width = 294.5f;
        sr_1d.Height = 80f;
        sr_1d.Background = new SolidColorBrush(Color.FromArgb(140, 138, 61, 46));
        sr_1d.CornerRadius = 8f;
        var tx_1e = LayoutEditorSpark2Runtime.Register(nodes, "tx_1e", new Label());
        tx_1e.Parent = plate_1c;
        tx_1e.HorizontalAlignment = HorizontalAlignment.Left;
        tx_1e.VerticalAlignment = VerticalAlignment.Top;
        tx_1e.Width = 294.5f;
        tx_1e.Height = 80f;
        tx_1e.Text = "【沉默】\n（点头）";
        tx_1e.FontSize = 13f;
        tx_1e.TextColor = Color.FromArgb(255, 241, 229, 204);
        tx_1e.Bold = true;
        tx_1e.TextWrap = true;
        var plate_1f = LayoutEditorSpark2Runtime.Register(nodes, "plate_1f", new Panel());
        plate_1f.Parent = root;
        plate_1f.HorizontalAlignment = HorizontalAlignment.Left;
        plate_1f.VerticalAlignment = VerticalAlignment.Top;
        plate_1f.Width = 80f;
        plate_1f.Height = 28f;
        plate_1f.Margin = new Thickness(1166f, 16f, 0f, 0f);
        var sr_1g = LayoutEditorSpark2Runtime.Register(nodes, "sr_1g", new Panel());
        sr_1g.Parent = plate_1f;
        sr_1g.HorizontalAlignment = HorizontalAlignment.Left;
        sr_1g.VerticalAlignment = VerticalAlignment.Top;
        sr_1g.Width = 80f;
        sr_1g.Height = 28f;
        sr_1g.CornerRadius = 14f;
        var tx_1h = LayoutEditorSpark2Runtime.Register(nodes, "tx_1h", new Label());
        tx_1h.Parent = plate_1f;
        tx_1h.HorizontalAlignment = HorizontalAlignment.Left;
        tx_1h.VerticalAlignment = VerticalAlignment.Top;
        tx_1h.Width = 80f;
        tx_1h.Height = 28f;
        tx_1h.Text = "跳过";
        tx_1h.FontSize = 12f;
        tx_1h.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_1h.Bold = true;
        tx_1h.TextWrap = true;
        var plate_1i = LayoutEditorSpark2Runtime.Register(nodes, "plate_1i", new Panel());
        plate_1i.Parent = root;
        plate_1i.HorizontalAlignment = HorizontalAlignment.Left;
        plate_1i.VerticalAlignment = VerticalAlignment.Top;
        plate_1i.Width = 90f;
        plate_1i.Height = 28f;
        plate_1i.Margin = new Thickness(1256f, 16f, 0f, 0f);
        var sr_1j = LayoutEditorSpark2Runtime.Register(nodes, "sr_1j", new Panel());
        sr_1j.Parent = plate_1i;
        sr_1j.HorizontalAlignment = HorizontalAlignment.Left;
        sr_1j.VerticalAlignment = VerticalAlignment.Top;
        sr_1j.Width = 90f;
        sr_1j.Height = 28f;
        sr_1j.CornerRadius = 14f;
        var tx_1k = LayoutEditorSpark2Runtime.Register(nodes, "tx_1k", new Label());
        tx_1k.Parent = plate_1i;
        tx_1k.HorizontalAlignment = HorizontalAlignment.Left;
        tx_1k.VerticalAlignment = VerticalAlignment.Top;
        tx_1k.Width = 90f;
        tx_1k.Height = 28f;
        tx_1k.Text = "自动·滑";
        tx_1k.FontSize = 12f;
        tx_1k.TextColor = Color.FromArgb(255, 201, 164, 90);
        tx_1k.Bold = true;
        tx_1k.TextWrap = true;
        return new LayoutScreenResult((Panel)root, nodes);
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
            "ShapeLine sl_3 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_4 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_6 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_7 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_8 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_9 is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_a is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_b is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_c is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_d is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_e is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_f is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_g is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_h is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeRect sr_j has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeLine sl_k is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeLine sl_l is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeRect sr_n has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_r has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeCircle sc_s has stroke (width=1, color=#3A322B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeCircle sc_t has stroke (width=1, color=#3A322B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeCircle sc_u has stroke (width=1, color=#3A322B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeCircle sc_v has stroke (width=1, color=#3A322B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeLine sl_x is exported as Canvas shell. Rebuild draw logic with GameUI.Canvas APIs.",
            "ShapeRect sr_z has stroke (width=3, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_10 has stroke (width=1, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_14 has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_17 has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_1a has stroke (width=2, color=#C96A2B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_1d has stroke (width=2, color=#3A322B). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_1g has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
            "ShapeRect sr_1j has stroke (width=2, color=#C9A45A). Panel does not support BorderBrush. Add a Canvas child or use a separate Panel overlay to draw the stroke.",
        };
    }
}
#endif
