// 阶段 1：切片
// 复用 UI 智能切片算法。源图优先 preview.processed_url，没有就用 sourcePreviewUrl。
// 切片结果转为 AttachmentImage[]，写入当前 skeleton.attachments。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { poseDetect, resolveMediaUrl } from "@/api/spriteApi";
import { useAppActions, useAppState } from "@/state/AppContext";
import {
  analyzeUiSmartSlices,
  cropUiSlice,
  defaultUiSmartSliceOptions,
  loadImageElement,
  UiSliceCandidate,
} from "@/features/smart-slice/uiSmartSlice";
import { useBoneAnim } from "../BoneAnimContext";
import { AttachmentImage, makeId, safeName } from "../model/skeletonModel";
import { poseToParts } from "../model/poseToParts";

interface Props {
  onNext: () => void;
}

interface SliceItem {
  candidate: UiSliceCandidate;
  pngDataUrl: string;
}

interface BoneSliceQuality {
  status: "idle" | "ok" | "warning" | "blocking";
  title: string;
  messages: string[];
  actions: string[];
  canImport: boolean;
  canContinue: boolean;
}

function evaluateBoneSliceQuality(items: SliceItem[], sourceSize: { width: number; height: number }, attachmentCount: number): BoneSliceQuality {
  const messages: string[] = [];
  const actions: string[] = [];
  let blocking = false;

  if (items.length === 0) {
    return {
      status: "idle",
      title: "等待切片质量检查",
      messages: ["识别后会检查候选数量、主体是否粘连、小碎片比例。"],
      actions: ["先导入图片，可选生成去底图，再点击智能识别切片。"],
      canImport: false,
      canContinue: attachmentCount >= 3,
    };
  }

  if (items.length < 3) {
    blocking = true;
    messages.push(`只识别到 ${items.length} 个候选，数量不足以拆成头、躯干和四肢。`);
  } else if (items.length < 6) {
    blocking = true;
    messages.push(`只识别到 ${items.length} 个候选，不足以稳定拆成头、躯干和四肢。`);
  }

  const imageArea = Math.max(1, sourceSize.width * sourceSize.height);
  const largest = items.reduce<SliceItem | null>((best, item) => (!best || item.candidate.w * item.candidate.h > best.candidate.w * best.candidate.h ? item : best), null);
  if (largest) {
    const bboxAreaRatio = (largest.candidate.w * largest.candidate.h) / imageArea;
    const heightRatio = largest.candidate.h / Math.max(1, sourceSize.height);
    if (bboxAreaRatio > 0.45) {
      messages.push(`最大候选占整图 ${(bboxAreaRatio * 100).toFixed(0)}%，疑似整图或大块身体粘连。`);
    }
    if (heightRatio > 0.7) {
      messages.push(`最大候选高度占整图 ${(heightRatio * 100).toFixed(0)}%，疑似主体未拆开。`);
    }
  }

  const tinyCount = items.filter((item) => (item.candidate.w * item.candidate.h) / imageArea < 0.002).length;
  if (items.length >= 3 && tinyCount / items.length > 0.45) {
    messages.push("小碎片占比较高，可能是边缘噪声或去底质量不足。");
  }

  if (messages.length > 0) {
    actions.push("请换高清透明背景、四肢分离明显的角色拆件图。");
    actions.push("也可以先去底/清晰化/超分，或手动补切头、躯干、四肢。");
  }

  if (attachmentCount > 0 && attachmentCount < 3) {
    messages.push(`当前骨架部件库只有 ${attachmentCount} 个部件，低于进入骨架搭建的最低数量。`);
  }

  return {
    status: blocking ? "blocking" : messages.length > 0 ? "warning" : "ok",
    title: blocking ? "当前切片不适合导入骨架" : messages.length > 0 ? "当前素材需要人工处理" : "切片质量通过基础检查",
    messages: messages.length > 0 ? messages : ["候选数量和主体拆分情况满足基础骨骼制作要求。"],
    actions,
    canImport: !blocking && items.length > 0,
    canContinue: attachmentCount >= 3,
  };
}

export function StageSlice({ onNext }: Props) {
  const { upload, sourcePreviewUrl, preview, busy } = useAppState();
  const { runPreview, importSourceFile } = useAppActions();
  const { skeleton, setSkeleton } = useBoneAnim();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<SliceItem[]>([]);
  const [poseParts, setPoseParts] = useState<AttachmentImage[]>([]);
  const [poseAnalyzing, setPoseAnalyzing] = useState(false);
  const [poseMessage, setPoseMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);

  const activeSource = preview?.processed_url || sourcePreviewUrl;
  const usingProcessed = Boolean(preview?.processed_url);
  const quality = useMemo(() => evaluateBoneSliceQuality(items, sourceSize, skeleton.attachments.length), [items, sourceSize, skeleton.attachments.length]);

  // 监听上层导入 / 去底结果，自动加载到 stage
  useEffect(() => {
    if (!activeSource) {
      setSourceUrl("");
      return;
    }
    let cancelled = false;
    (async () => {
      const url = await resolveMediaUrl(activeSource);
      if (cancelled) return;
      try {
        const img = await loadImageElement(url);
        if (cancelled) return;
        setSourceUrl(url);
        setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
      } catch {
        setSourceUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSource]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      await importSourceFile(file);
    },
    [importSourceFile],
  );

  const runAnalyze = useCallback(async () => {
    if (!sourceUrl) return;
    setAnalyzing(true);
    try {
      const result = await analyzeUiSmartSlices(sourceUrl, defaultUiSmartSliceOptions);
      const slices: SliceItem[] = [];
      for (const cand of result.candidates) {
        const png = await cropUiSlice(sourceUrl, cand);
        slices.push({ candidate: cand, pngDataUrl: png });
      }
      setItems(slices);
      setWarnings(result.warnings);
    } finally {
      setAnalyzing(false);
    }
  }, [sourceUrl]);

  // 把当前源图转成 base64 PNG dataUrl（pose-detect 端点要 image_data_url）。
  const toDataUrl = useCallback(async (): Promise<string | null> => {
    if (!sourceUrl) return null;
    if (sourceUrl.startsWith("data:")) return sourceUrl;
    const img = await loadImageElement(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  }, [sourceUrl]);

  const runPoseDetect = useCallback(async () => {
    if (!sourceUrl) return;
    setPoseAnalyzing(true);
    setPoseMessage(null);
    try {
      const dataUrl = await toDataUrl();
      if (!dataUrl) {
        setPoseMessage({ tone: "warning", text: "无法读取源图，请重新导入图片。" });
        return;
      }
      const result = await poseDetect(dataUrl);
      if (!result.keypoints || result.keypoints.length < 4 || result.score < 0.2) {
        setPoseParts([]);
        setPoseMessage({
          tone: "warning",
          text: "未稳定识别人体姿态（卡通/Q 版或无人体图常见）。请改用下方「智能识别切片」做几何兜底，或手动补切。",
        });
        return;
      }
      const { parts, warnings: poseWarnings } = await poseToParts(dataUrl, result.keypoints, result.width, result.height);
      if (parts.length === 0) {
        setPoseParts([]);
        setPoseMessage({ tone: "warning", text: "识别到人体但未能框出有效部件，请改用几何切片或手动补切。" });
        return;
      }
      setPoseParts(parts);
      const limbCount = parts.filter((p) => p.name !== "head" && p.name !== "torso").length;
      const tips = [`姿态识别成功：${parts.length} 个语义部件（四肢 ${limbCount} 个）。`, ...poseWarnings];
      setPoseMessage({ tone: poseWarnings.length > 0 ? "warning" : "info", text: tips.join(" ") });
    } catch (err) {
      setPoseParts([]);
      setPoseMessage({ tone: "warning", text: `姿态识别失败：${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setPoseAnalyzing(false);
    }
  }, [sourceUrl, toDataUrl]);

  // 语义部件按原名导入；同名先清掉旧的同名部件，再追加，保证语义名稳定不被加后缀。
  const importPosePartsToSkeleton = useCallback(() => {
    if (poseParts.length === 0) return;
    const names = new Set(poseParts.map((p) => p.name));
    setSkeleton((prev) => ({
      ...prev,
      attachments: [...prev.attachments.filter((a) => !names.has(a.name)), ...poseParts.map((p) => ({ ...p, id: makeId("att") }))],
    }));
  }, [poseParts, setSkeleton]);

  const importToSkeleton = useCallback(() => {
    if (!quality.canImport) return;
    const used = new Set(skeleton.attachments.map((a) => a.name));
    const next: AttachmentImage[] = items.map((it) => {
      let base = safeName(it.candidate.name, "part");
      let n = base;
      let i = 2;
      while (used.has(n)) {
        n = `${base}_${i++}`;
      }
      used.add(n);
      return {
        id: makeId("att"),
        name: n,
        pngDataUrl: it.pngDataUrl,
        width: it.candidate.w,
        height: it.candidate.h,
        pivot: { x: 0.5, y: 0.5 },
      };
    });
    setSkeleton((prev) => ({ ...prev, attachments: [...prev.attachments, ...next] }));
  }, [items, quality.canImport, skeleton.attachments, setSkeleton]);

  const clearAttachments = useCallback(() => {
    setSkeleton((prev) => ({ ...prev, attachments: [] }));
  }, [setSkeleton]);

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第一步：把角色图切成部件</strong>
        <p className="muted">
          复用 UI 智能切片：导入一张角色图，可选去底，再跑切片，结果写入骨骼模型的部件库。
          源图来自"制作流水线"的去底输出（{preview?.processed_url ? "已就绪" : "未生成"}）或当前导入素材。
        </p>
      </div>

      <div className={`bone-source-banner ${usingProcessed ? "processed" : "raw"}`}>
        <strong>当前切片来源：{usingProcessed ? "制作流水线去底结果" : "原始图（未去底）"}</strong>
        <span>
          {usingProcessed
            ? "智能切片只是从这张去底图精确裁剪，不会重新抠图，会原样保留你在制作流水线选的抠图效果（如 BiRefNet + Luma）。"
            : "还没有去底结果，当前会直接切原图。先点「生成去底图」，或回制作流水线选好抠图模式再回来切，避免切到未去底的原图。"}
        </span>
      </div>

      <div className="export-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => void handleFile(e.target.files?.[0] || null)}
        />
        <button onClick={() => fileRef.current?.click()} disabled={busy || analyzing}>
          选择单图
        </button>
        <button onClick={runPreview} disabled={busy || analyzing || !upload?.id}>
          生成去底图
        </button>
        <button onClick={runPoseDetect} disabled={poseAnalyzing || analyzing || !sourceUrl}>
          {poseAnalyzing ? "识别人体中…" : "按姿态识别部位（推荐）"}
        </button>
        <button onClick={importPosePartsToSkeleton} disabled={poseParts.length === 0} title={poseParts.length === 0 ? "先点「按姿态识别部位」" : "按语义名导入，同名部件会被覆盖"}>
          导入语义部件（+{poseParts.length}）
        </button>
        <button onClick={runAnalyze} disabled={analyzing || poseAnalyzing || !sourceUrl}>
          {analyzing ? "识别中…" : "智能识别切片（几何兜底）"}
        </button>
        <button onClick={importToSkeleton} disabled={!quality.canImport} title={!quality.canImport && items.length > 0 ? "当前切片质量不足，不能导入骨架" : undefined}>
          导入到骨架（+{items.length}）
        </button>
        <button onClick={clearAttachments} disabled={skeleton.attachments.length === 0}>
          清空已导入部件
        </button>
        <button onClick={onNext} disabled={!quality.canContinue} title={!quality.canContinue ? "至少需要 3 个已导入部件才能进入骨架搭建" : undefined}>
          下一步：骨架搭建 →
        </button>
      </div>

      {poseMessage && (
        <div className={`bone-pose-banner ${poseMessage.tone}`}>
          <strong>{poseMessage.tone === "info" ? "姿态识别结果" : "姿态识别提示"}</strong>
          <span>{poseMessage.text}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="info-box" style={{ borderColor: "rgba(250,204,21,0.5)" }}>
          <strong>识别警告</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(items.length > 0 || skeleton.attachments.length > 0) && (
        <div className={`bone-quality-box ${quality.status}`}>
          <strong>{quality.title}</strong>
          <ul>
            {quality.messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
          {quality.actions.length > 0 && (
            <div className="bone-quality-actions">
              {quality.actions.map((action, index) => (
                <span key={index}>{action}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bone-slice-grid">
        <div className="bone-slice-source">
          {sourceUrl ? (
            <img src={sourceUrl} alt="角色源图" />
          ) : (
            <span className="muted">先导入图片或在"制作流水线"中选择素材。</span>
          )}
          {sourceUrl && (
            <p className="muted" style={{ marginTop: 8 }}>
              尺寸：{sourceSize.width} × {sourceSize.height}，识别 {items.length} 个候选
            </p>
          )}
        </div>

        <div className="bone-slice-thumbs">
          {poseParts.length > 0 && (
            <>
              <h4>姿态语义部件（{poseParts.length}）</h4>
              <div className="bone-thumb-grid">
                {poseParts.map((p) => (
                  <div key={p.id} className="bone-thumb pose">
                    <img src={p.pngDataUrl} alt={p.name} />
                    <span>{p.name}</span>
                    <small>
                      {p.width}×{p.height}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}

          <h4>识别结果</h4>
          {items.length === 0 && <p className="muted">点"智能识别切片"开始。</p>}
          <div className="bone-thumb-grid">
            {items.map((it) => (
              <div key={it.candidate.id} className="bone-thumb">
                <img src={it.pngDataUrl} alt={it.candidate.name} />
                <span>{it.candidate.name}</span>
                <small>
                  {it.candidate.w}×{it.candidate.h}
                </small>
              </div>
            ))}
          </div>

          <h4>已导入部件（{skeleton.attachments.length}）</h4>
          <div className="bone-thumb-grid">
            {skeleton.attachments.map((a) => (
              <div key={a.id} className="bone-thumb">
                <img src={a.pngDataUrl} alt={a.name} />
                <span>{a.name}</span>
                <small>
                  {a.width}×{a.height}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
