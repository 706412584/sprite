import { useEffect, useState } from "react";
import { AppProvider, useAppState, useAppActions } from "@/state/AppContext";
import { RuntimePanel } from "@/features/settings/RuntimePanel";
import { SpriteFlowPanel } from "@/spriteflow/SpriteFlowPanel";
import { WorkflowPanel } from "@/features/workflow/WorkflowPanel";
import { UiSmartSlicePanel } from "@/features/smart-slice/UiSmartSlicePanel";
import { BgInpaintPanel } from "@/features/bg-inpaint/BgInpaintPanel";
import { BoneAnimPanel } from "@/features/bone-anim/BoneAnimPanel";
import { QuantizePanel } from "@/features/quantize/QuantizePanel";
import { NineSlicePanel } from "@/features/nine-slice/NineSlicePanel";
import { PixelFontPanel } from "@/features/pixel-font/PixelFontPanel";
import { NormalMapPanel } from "@/features/normal-map/NormalMapPanel";
import { FrameDiffPanel } from "@/features/frame-diff/FrameDiffPanel";

type WorkspaceTab = "workflow" | "smart-slice" | "bg-inpaint" | "bone-anim" | "spriteflow" | "quantize" | "nine-slice" | "pixel-font" | "normal-map" | "frame-diff" | "runtime";

const tabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: "workflow", label: "制作流水线" },
  { key: "smart-slice", label: "UI 智能切片" },
  { key: "bg-inpaint", label: "背景补全" },
  { key: "bone-anim", label: "骨骼动画" },
  { key: "spriteflow", label: "SpriteFlow 角色序列帧" },
  { key: "quantize", label: "像素量化" },
  { key: "nine-slice", label: "9-slice 编辑器" },
  { key: "pixel-font", label: "像素字体" },
  { key: "normal-map", label: "法线贴图" },
  { key: "frame-diff", label: "帧质量检查" },
  { key: "runtime", label: "运行时" },
];

function AppInner() {
  const { desktopApi, runtime, version, message, busy, canCancelTask } = useAppState();
  const { restartServer, cancelCurrentTask } = useAppActions();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    // 初始化时按 hash 选 tab，外链 / MCP 直接跳转 #bone-anim 等也能命中。
    const fromHash = (typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "") as WorkspaceTab;
    return tabs.some((t) => t.key === fromHash) ? fromHash : "workflow";
  });

  // hashchange：浏览器后退 / 用户手动改 URL 也能切 tab。
  useEffect(() => {
    function onHash() {
      const k = window.location.hash.replace(/^#/, "") as WorkspaceTab;
      if (tabs.some((t) => t.key === k)) setActiveTab(k);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const pythonConnected = desktopApi ? Boolean(runtime?.serverRunning) : version !== "Python 服务未连接";

  return (
    <main className="app-shell">
      {/* 左侧导航 */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SVL</span>
          <div>
            <h1>Sprite Video Lab</h1>
            <p>角色动画、UI 切片与序列帧制作工具</p>
          </div>
        </div>
        <nav className="nav-list">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              className={activeTab === tab.key ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(tab.key);
                // 同步地址栏 hash，避免 activeTab 与 location.hash 发散：
                // 否则之后跳到"看似已是当前 hash"的地址不会触发 hashchange，tab 卡住。
                if (window.location.hash.replace(/^#/, "") !== tab.key) {
                  window.history.replaceState(null, "", `#${tab.key}`);
                }
              }}
            >
              {tab.label}
            </a>
          ))}
        </nav>
        <section className="runtime-card">
          <strong>运行时</strong>
          <span>{desktopApi ? "Electron 桌面" : "浏览器模式"}</span>
          <span>Python：{pythonConnected ? "已连接" : "未连接"}</span>
        </section>
      </aside>

      {/* 主工作区 */}
      <section className="workspace">
        <header className="topbar">
          <div>
            <h2>{tabs.find((t) => t.key === activeTab)?.label}</h2>
            <p>{busy ? "处理中…" : message}</p>
          </div>
          <div className="topbar-actions">
            {canCancelTask && (
              <button onClick={cancelCurrentTask}>取消任务</button>
            )}
            <button onClick={restartServer} disabled={!desktopApi || busy}>重启 Python</button>
          </div>
        </header>

        <div className="workspace-body unified-workspace">
          <div className="workspace-main full-width">
            {activeTab === "workflow" && <WorkflowPanel />}
            {activeTab === "smart-slice" && <UiSmartSlicePanel />}
            {activeTab === "bg-inpaint" && <BgInpaintPanel />}
            {activeTab === "bone-anim" && <BoneAnimPanel />}
            {activeTab === "spriteflow" && <SpriteFlowPanel />}
            {activeTab === "quantize" && <QuantizePanel />}
            {activeTab === "nine-slice" && <NineSlicePanel />}
            {activeTab === "pixel-font" && <PixelFontPanel />}
            {activeTab === "normal-map" && <NormalMapPanel />}
            {activeTab === "frame-diff" && <FrameDiffPanel />}
            {activeTab === "runtime" && <RuntimePanel />}
          </div>
        </div>

        <footer className="statusbar">
          {busy && <span className="busy-dot" />}
          {message}
        </footer>
      </section>
    </main>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}