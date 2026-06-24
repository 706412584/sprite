// 骨骼动画制作面板
// 四步流程：导入角色 → 骨架绑定 → 生成动作 → 预览导出

import { useEffect, useMemo, useState } from "react";
import { BoneAnimProvider, useBoneAnim } from "./BoneAnimContext";
import { StageSlice } from "./stages/StageSlice";
import { StageRig } from "./stages/StageRig";
import { StageAction } from "./stages/StageAction";
import { StagePreview } from "./stages/StagePreview";
import { StageExport } from "./stages/StageExport";
import { psdSplit } from "@/api/spriteApi";
import { layersToParts } from "./model/layersToParts";
import { applyTemplate, getTemplateById } from "./model/skeletonTemplates";
import { mapPsdLayerToBone } from "./model/psdBoneMapping";
import { fitSkeletonToPsd } from "./model/fitSkeletonToPsd";
import { detectPose, CharacterPose } from "./model/poseDetector";
import { applyAction } from "./model/actionTemplates";
import { findBoneByName, makeId } from "./model/skeletonModel";

const stages = [
  { key: "slice", label: "导入角色" },
  { key: "rig", label: "骨架绑定" },
  { key: "action", label: "生成动作" },
  { key: "preview", label: "预览导出" },
] as const;
type StageKey = (typeof stages)[number]["key"];

function BoneAnimPanelInner() {
  const [active, setActive] = useState<StageKey>("slice");
  const { skeleton, setSkeleton, setPoseDetection, setPoseOverride } = useBoneAnim();

  // dev-only 自动驱动：?dev=psd&file=_psd_test/pA.psd&pose=front&action=walk
  // 用于浏览器自动化（playwright/chrome-devtools MCP）跑全流程，仅 dev 启用。
  const [devStatus, setDevStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("dev") !== "psd") return;
    const fileRel = sp.get("file");
    if (!fileRel) return;
    const poseParam = (sp.get("pose") as CharacterPose | null) ?? null;
    const actionParam = sp.get("action") ?? "walk";
    const filtersExclude = sp.get("filtersExclude")?.split(/[,\n\r]+/).map((v) => v.trim()).filter(Boolean) ?? [];
    const filtersHide = sp.get("filtersHide")?.split(/[,\n\r]+/).map((v) => v.trim()).filter(Boolean) ?? [];
    const validateMode = sp.get("validate");
    let aborted = false;

    (async () => {
      try {
        setDevStatus(`[dev] fetch /work/${fileRel} ...`);
        const res = await fetch(`/work/${fileRel}`);
        if (!res.ok) throw new Error(`fetch /work/${fileRel} 失败: ${res.status}`);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read blob failed"));
          reader.readAsDataURL(blob);
        });
        if (aborted) return;

        setDevStatus("[dev] PSD 解析中...");
        const result = await psdSplit({ dataUrl, excludeNames: filtersExclude, hideNames: filtersHide });
        const { parts } = layersToParts(result, { excludeNames: filtersExclude, hideNames: filtersHide });
        if (parts.length === 0) throw new Error("PSD 未解析出可用图层");
        if (aborted) return;

        // 写入 attachments
        let next = { ...skeleton, attachments: parts };
        // 应用 humanoid 细分模板
        const tpl = getTemplateById(poseParam === "sideLeft" || poseParam === "sideRight" ? "humanoid_side_detailed" : "humanoid_detailed") || getTemplateById("humanoid");
        if (tpl) next = applyTemplate(next, tpl);

        // 一键绑骨
        const slots = [...next.slots];
        const sidedLayerPattern = /(^|[-_])(l|r)($|[-_0-9])|left|right/i;
        parts.forEach((att, index) => {
          const { boneNames } = mapPsdLayerToBone(att.name);
          if (boneNames.length === 0) return;
          const boneName = boneNames.find((n) => findBoneByName(next, n));
          const bone = boneName ? findBoneByName(next, boneName) : undefined;
          if (!bone) return;
          slots.push({ id: makeId("sl"), name: att.name, displayName: att.displayName, boneId: bone.id, attachmentId: att.id, zOrder: index });
        });
        next = { ...next, slots };
        const fit = fitSkeletonToPsd(next);
        next = fit.skeleton;

        // 姿态识别
        const detection = detectPose(next);
        setPoseDetection(detection);
        const effectivePose = poseParam ?? detection.pose;
        if (poseParam) setPoseOverride(poseParam);

        // 应用动作
        const tplDef = (await import("./model/actionTemplates")).getActionTemplate(actionParam);
        if (tplDef) {
          const params: Record<string, number> = {};
          for (const p of tplDef.params) params[p.key] = p.default;
          next = applyAction(next, actionParam, params, effectivePose);
        }

        if (aborted) return;
        setSkeleton(next);
        // dev-only debug 通道：把最终 skeleton 暴露到 window，
        // 方便浏览器 console / playwright 自动化直接读取 bones/slots/animations
        // 来排查 PSD 图层→骨骼归属、动画 timeline 是否落到真挂图骨等问题。
        // 仅在 DEV 启用，生产构建会被 import.meta.env.DEV 守门排除。
        (window as unknown as { __lastSkeleton?: unknown }).__lastSkeleton = next;
        setActive("preview");
        setDevStatus(`[dev] 完成：${parts.length} 部件 / 姿态=${detection.pose}@${(detection.confidence * 100).toFixed(0)}% / 动作=${actionParam} / 实际姿态=${effectivePose}`);

        // 自动截图：等 preview canvas 渲染 + 走完 1s 让动画转一圈，再 POST 到 /api/dev-canvas
        if (validateMode === "pixel-change") {
          const frames = Math.max(2, parseInt(sp.get("frames") || "4", 10));
          const interval = parseInt(sp.get("intervalMs") || "160", 10);
          const minChangedPixels = parseInt(sp.get("minChangedPixels") || "32", 10);
          const minChangedRatio = Number(sp.get("minChangedRatio") || "0.0005");
          await new Promise((r) => setTimeout(r, 800));
          const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) {
            setDevStatus((s) => `${s} | 像素验证=找不到 canvas`);
          } else {
            let previous: Uint8ClampedArray | null = null;
            let changedPixels = 0;
            for (let i = 0; i < frames; i += 1) {
              if (i > 0) await new Promise((r) => setTimeout(r, interval));
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              if (previous) {
                for (let p = 0; p < data.length; p += 4) {
                  if (Math.abs(data[p] - previous[p]) > 8 || Math.abs(data[p + 1] - previous[p + 1]) > 8 || Math.abs(data[p + 2] - previous[p + 2]) > 8 || Math.abs(data[p + 3] - previous[p + 3]) > 8) {
                    changedPixels += 1;
                  }
                }
              }
              previous = new Uint8ClampedArray(data);
            }
            const totalPixels = Math.max(1, canvas.width * canvas.height * (frames - 1));
            const changedRatio = changedPixels / totalPixels;
            const pass = changedPixels >= minChangedPixels && changedRatio >= minChangedRatio;
            const report = { pass, changedPixels, changedRatio, frames, minChangedPixels, minChangedRatio };
            (window as unknown as { __lastPixelValidation?: unknown }).__lastPixelValidation = report;
            setDevStatus((s) => `${s} | 像素验证=${pass ? "PASS" : "FAIL"} changed=${changedPixels} ratio=${changedRatio.toFixed(6)}`);
          }
        }

        // 自动截图：等 preview canvas 渲染 + 走完 1s 让动画转一圈，再 POST 到 /api/dev-canvas
        const snapName = sp.get("snap");
        if (snapName) {
          const frames = parseInt(sp.get("frames") || "1", 10);
          const interval = parseInt(sp.get("intervalMs") || "220", 10);
          await new Promise((r) => setTimeout(r, 800));
          const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
          if (!canvas) {
            setDevStatus((s) => `${s} | 截图=找不到 canvas`);
          } else {
            const reports: string[] = [];
            for (let i = 0; i < Math.max(1, frames); i += 1) {
              if (i > 0) await new Promise((r) => setTimeout(r, interval));
              const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
              if (!blob) {
                reports.push(`f${i}=blobNull`);
                continue;
              }
              const path = frames > 1 ? `work/_psd_test/${snapName.replace(/\.png$/, "")}_t${i}.png` : `work/_psd_test/${snapName}`;
              const r = await fetch(`/api/dev-canvas?path=${encodeURIComponent(path)}`, { method: "POST", body: blob });
              const j = await r.json().catch(() => ({}));
              reports.push(j.ok ? `f${i}=${j.bytes}B` : `f${i}=FAIL ${j.error}`);
            }
            setDevStatus((s) => `${s} | 截图=${reports.join(" ")}`);
          }
        }
      } catch (err) {
        setDevStatus(`[dev] 失败：${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    return `部件 ${skeleton.attachments.length} · 骨骼 ${skeleton.bones.length} · 槽位 ${skeleton.slots.length} · 动画 ${skeleton.animations.length}`;
  }, [skeleton]);

  return (
    <div className="panel bone-anim-panel">
      <header className="bone-anim-header">
        <div>
          <h3>骨骼动画制作</h3>
          <p className="muted">{summary}</p>
          {devStatus && <p className="muted" data-testid="dev-status">{devStatus}</p>}
        </div>
      </header>

      <nav className="workflow-stepper bone-anim-stepper">
        {stages.map((s, i) => {
          const done =
            (s.key === "slice" && skeleton.attachments.length > 0) ||
            (s.key === "rig" && skeleton.slots.length > 0) ||
            (s.key === "action" && skeleton.animations.length > 0) ||
            (s.key === "preview" && skeleton.animations.length > 0);
          return (
            <a
              key={s.key}
              href={`#bone-${s.key}`}
              className={`${active === s.key ? "active" : ""} ${done ? "done" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActive(s.key);
              }}
            >
              <span>{i + 1}</span>
              {s.label}
            </a>
          );
        })}
      </nav>

      <div className="bone-anim-stage-host">
        {active === "slice" && <StageSlice onNext={() => setActive("rig")} />}
        {active === "rig" && <StageRig onNext={() => setActive("action")} />}
        {active === "action" && <StageAction onNext={() => setActive("preview")} />}
        {active === "preview" && (
          <div className="bone-preview-export-stack">
            <StagePreview onNext={() => undefined} />
            <StageExport />
          </div>
        )}
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
