// 骨骼动画制作面板
// 五步 stepper：切片 → 骨架搭建 → 动作模板 → 实时预览 → 导出

import { useMemo, useState } from "react";
import { BoneAnimProvider, useBoneAnim } from "./BoneAnimContext";
import { StageSlice } from "./stages/StageSlice";
import { StageRig } from "./stages/StageRig";
import { StageAction } from "./stages/StageAction";
import { StagePreview } from "./stages/StagePreview";
import { StageExport } from "./stages/StageExport";

const stages = [
  { key: "slice", label: "切片" },
  { key: "rig", label: "骨架搭建" },
  { key: "action", label: "动作模板" },
  { key: "preview", label: "实时预览" },
  { key: "export", label: "导出" },
] as const;
type StageKey = (typeof stages)[number]["key"];

function BoneAnimPanelInner() {
  const [active, setActive] = useState<StageKey>("slice");
  const { skeleton } = useBoneAnim();

  const summary = useMemo(() => {
    return `部件 ${skeleton.attachments.length} · 骨骼 ${skeleton.bones.length} · 槽位 ${skeleton.slots.length} · 动画 ${skeleton.animations.length}`;
  }, [skeleton]);

  return (
    <div className="panel bone-anim-panel">
      <header className="bone-anim-header">
        <div>
          <h3>骨骼动画制作</h3>
          <p className="muted">{summary}</p>
        </div>
      </header>

      <nav className="workflow-stepper bone-anim-stepper">
        {stages.map((s, i) => (
          <a
            key={s.key}
            href={`#bone-${s.key}`}
            className={active === s.key ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              setActive(s.key);
            }}
          >
            <span>{i + 1}</span>
            {s.label}
          </a>
        ))}
      </nav>

      <div className="bone-anim-stage-host">
        {active === "slice" && <StageSlice onNext={() => setActive("rig")} />}
        {active === "rig" && <StageRig onNext={() => setActive("action")} />}
        {active === "action" && <StageAction onNext={() => setActive("preview")} />}
        {active === "preview" && <StagePreview onNext={() => setActive("export")} />}
        {active === "export" && <StageExport />}
      </div>
    </div>
  );
}

export function BoneAnimPanel() {
  return (
    <BoneAnimProvider>
      <BoneAnimPanelInner />
    </BoneAnimProvider>
  );
}
