import { useState } from "react";
import { AppProvider, useAppState, useAppActions } from "@/state/AppContext";
import { RuntimePanel } from "@/features/settings/RuntimePanel";
import { SpriteFlowPanel } from "@/spriteflow/SpriteFlowPanel";
import { WorkflowPanel } from "@/features/workflow/WorkflowPanel";
import { UiSmartSlicePanel } from "@/features/smart-slice/UiSmartSlicePanel";
import { BoneAnimPanel } from "@/features/bone-anim/BoneAnimPanel";
import { QuantizePanel } from "@/features/quantize/QuantizePanel";

type WorkspaceTab = "workflow" | "smart-slice" | "bone-anim" | "spriteflow" | "quantize" | "runtime";

const tabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: "workflow", label: "制作流水线" },
  { key: "smart-slice", label: "UI 智能切片" },
  { key: "bone-anim", label: "骨骼动画制作" },
  { key: "spriteflow", label: "SpriteFlow" },
  { key: "quantize", label: "像素量化" },
  { key: "runtime", label: "运行时" },
];

function AppInner() {
  const { desktopApi, runtime, version, message, busy } = useAppState();
  const { restartServer } = useAppActions();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("workflow");

  const pythonConnected = desktopApi ? Boolean(runtime?.serverRunning) : version !== "Python 服务未连接";

  return (
    <main className="app-shell">
      {/* 左侧导航 */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SVL</span>
          <div>
            <h1>Sprite Video Lab</h1>
            <p>AI 动画特效工具</p>
          </div>
        </div>
        <nav className="nav-list">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              className={activeTab === tab.key ? "active" : ""}
              onClick={(e) => { e.preventDefault(); setActiveTab(tab.key); }}
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
            <button onClick={restartServer} disabled={!desktopApi || busy}>重启 Python</button>
          </div>
        </header>

        <div className="workspace-body unified-workspace">
          <div className="workspace-main full-width">
            {activeTab === "workflow" && <WorkflowPanel />}
            {activeTab === "smart-slice" && <UiSmartSlicePanel />}
            {activeTab === "bone-anim" && <BoneAnimPanel />}
            {activeTab === "spriteflow" && <SpriteFlowPanel />}
            {activeTab === "quantize" && <QuantizePanel />}
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