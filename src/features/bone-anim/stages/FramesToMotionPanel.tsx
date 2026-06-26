// 「从角色自己的帧序列反推动作」面板
//
// 选一组帧图片（按文件名排序）→ 逐帧调用 /api/pose-detect 取 MediaPipe 关键点 →
// framesToMotion 反推每根骨骼的 rotate / root translate 关键帧 → 生成一条 Animation 写入 skeleton。
// 生成后自动接入现有 Spine / DragonBones / points JSON 导出。

import { useCallback, useRef, useState } from "react";
import { poseDetect } from "@/api/spriteApi";
import { useBoneAnim } from "../BoneAnimContext";
import { FramePose, framesToMotion } from "../model/framesToMotion";
import { safeName } from "../model/skeletonModel";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}

interface RunReport {
  animName: string;
  frameCount: number;
  usedBones: string[];
  skippedBones: string[];
  warnings: string[];
  avgScore: number;
}

export function FramesToMotionPanel() {
  const { skeleton, setSkeleton, setSelectedAnimationId } = useBoneAnim();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState("");

  const [animName, setAnimName] = useState("from_frames");
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [includeRootMotion, setIncludeRootMotion] = useState(true);
  const [smoothingWindow, setSmoothingWindow] = useState(1);
  const [simplifyToleranceDeg, setSimplifyToleranceDeg] = useState(0);
  const [minScore, setMinScore] = useState(0.3);

  const onPick = useCallback((list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(arr);
    setReport(null);
    setError("");
  }, []);

  const hasMappableBones = skeleton.bones.length > 0;

  const run = useCallback(async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const frames: FramePose[] = [];
      const scores: number[] = [];
      for (let i = 0; i < files.length; i += 1) {
        setProgress(`姿态检测 ${i + 1}/${files.length}：${files[i].name}`);
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await readFileAsDataUrl(files[i]);
        // eslint-disable-next-line no-await-in-loop
        const res = await poseDetect(dataUrl);
        frames.push({
          keypoints: res.keypoints.map((k) => ({ name: k.name, x: k.x, y: k.y, score: k.score })),
          width: res.width,
          height: res.height,
        });
        scores.push(res.score ?? 0);
      }

      setProgress("反推骨骼关键帧…");
      const result = framesToMotion(skeleton, frames, {
        fps,
        loop,
        name: safeName(animName, "from_frames"),
        mirror,
        includeRootMotion,
        smoothingWindow,
        simplifyToleranceDeg,
        minScore,
      });

      // 同名动画替换，避免反复生成堆积
      setSkeleton((prev) => {
        const without = prev.animations.filter((a) => a.name !== result.animation.name);
        return { ...prev, fps, animations: [...without, result.animation] };
      });
      setSelectedAnimationId(result.animation.id);

      const avgScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      setReport({
        animName: result.animation.name,
        frameCount: frames.length,
        usedBones: result.usedBones,
        skippedBones: result.skippedBones,
        warnings: result.warnings,
        avgScore,
      });
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress("");
    } finally {
      setBusy(false);
    }
  }, [files, busy, skeleton, fps, loop, animName, mirror, includeRootMotion, smoothingWindow, simplifyToleranceDeg, minScore, setSkeleton, setSelectedAnimationId]);

  return (
    <section className="bone-action-form" style={{ marginTop: 16 }}>
      <h4>从帧序列反推动作（角色自己的帧动画 → 骨骼动画）</h4>
      <p className="muted">
        选一组连续帧图片（同一角色、同一视角；按文件名顺序作为时间轴）。逐帧跑 MediaPipe Pose，
        反推出每根骨骼的旋转 / 根位移关键帧，生成一条动画。需先下载姿态模型（环境检测里）。
      </p>

      {!hasMappableBones && (
        <div className="info-box" style={{ borderColor: "rgba(248,113,113,0.5)" }}>
          <strong>请先在「骨架绑定」生成骨架</strong>
          <small>反推动作需要 torso / 四肢等命名骨骼作为映射目标。</small>
        </div>
      )}

      <div className="export-actions" style={{ flexWrap: "wrap", gap: 8 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files)}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          选择帧序列图片…
        </button>
        <span className="muted">{files.length > 0 ? `已选 ${files.length} 帧` : "未选择"}</span>
      </div>

      <div className="bone-action-params" style={{ marginTop: 8 }}>
        <label>
          <span>动画名</span>
          <input type="text" value={animName} onChange={(e) => setAnimName(e.target.value)} />
        </label>
        <label>
          <span>帧率 FPS（{fps}）</span>
          <input type="range" min={4} max={30} step={1} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
        </label>
        <label>
          <span>平滑窗口（{smoothingWindow}，奇数；1=关闭）</span>
          <input type="range" min={1} max={9} step={2} value={smoothingWindow} onChange={(e) => setSmoothingWindow(Number(e.target.value))} />
        </label>
        <label>
          <span>关键帧简化容差（{simplifyToleranceDeg}°；0=不简化）</span>
          <input type="range" min={0} max={10} step={0.5} value={simplifyToleranceDeg} onChange={(e) => setSimplifyToleranceDeg(Number(e.target.value))} />
        </label>
        <label>
          <span>关节最低可信度（{minScore.toFixed(2)}）</span>
          <input type="range" min={0.1} max={0.8} step={0.05} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </label>
      </div>

      <div className="export-actions" style={{ flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> 循环
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> 镜像左右（背向/自拍）
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={includeRootMotion} onChange={(e) => setIncludeRootMotion(e.target.checked)} /> 生成根位移
        </label>
      </div>

      <div className="export-actions">
        <button type="button" onClick={run} disabled={busy || files.length === 0 || !hasMappableBones}>
          {busy ? "处理中…" : "反推并生成动画"}
        </button>
        <span className="muted">{progress}</span>
      </div>

      {error && (
        <div className="info-box" style={{ borderColor: "rgba(248,113,113,0.5)" }}>
          <strong>失败</strong>
          <small>{error}</small>
        </div>
      )}

      {report && (
        <div className="info-box">
          <strong>已生成动画「{report.animName}」</strong>
          <small>
            {report.frameCount} 帧 · 平均姿态分 {(report.avgScore * 100).toFixed(0)}% · 使用骨骼{" "}
            {report.usedBones.length}（{report.usedBones.join(", ") || "无"}）
          </small>
          {report.skippedBones.length > 0 && <small>跳过：{report.skippedBones.join(", ")}</small>}
          {report.warnings.map((w, i) => (
            <small key={i} style={{ color: "#c98a00" }}>{w}</small>
          ))}
        </div>
      )}
    </section>
  );
}
