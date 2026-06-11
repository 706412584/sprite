import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "@/api/spriteApi";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useAppActions, useAppState } from "@/state/AppContext";
import {
  analyzeUiSmartSlices,
  cropUiSlice,
  defaultUiSmartSliceOptions,
  downloadDataUrl,
  downloadSlicesAsZip,
  loadImageElement,
  safeFileName,
  type UiSliceCandidate,
  type UiSmartSliceOptions,
  type ZipSliceEntry,
} from "@/features/smart-slice/uiSmartSlice";

type DragMode = "move" | "resize-se";

interface DisplayMetrics {
  x: number;
  y: number;
  w: number;
  h: number;
  scaleX: number;
  scaleY: number;
}

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origin: UiSliceCandidate;
}

type SmartSliceStepKey = "source" | "matte" | "detect" | "export";

export function UiSmartSlicePanel() {
  const { upload, sourcePreviewUrl, preview, busy } = useAppState();
  const { runPreview, importSourceFile } = useAppActions();
  const [options, setOptions] = useState<UiSmartSliceOptions>(defaultUiSmartSliceOptions);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [candidates, setCandidates] = useState<UiSliceCandidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeStep, setActiveStep] = useState<SmartSliceStepKey>("source");
  const [displayMetrics, setDisplayMetrics] = useState<DisplayMetrics>({ x: 0, y: 0, w: 0, h: 0, scaleX: 1, scaleY: 1 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selected = candidates.find((candidate) => candidate.id === selectedId) || null;
  // 源图统一来自全局：优先流水线去底预览，否则用导入的原图预览（与骨骼动画制作页一致）
  const activeSource = preview?.processed_url || sourcePreviewUrl;
  const canUsePipelinePreview = Boolean(preview?.processed_url);
  const smartSliceSteps: ReadonlyArray<{ key: SmartSliceStepKey; label: string; done: boolean; suggested: boolean }> = [
    { key: "source", label: "选择来源", done: Boolean(sourceUrl), suggested: !sourceUrl },
    { key: "matte", label: "准备去底图", done: canUsePipelinePreview, suggested: Boolean(sourceUrl) && !canUsePipelinePreview },
    { key: "detect", label: "识别切片", done: candidates.length > 0, suggested: Boolean(sourceUrl) && candidates.length === 0 },
    { key: "export", label: "微调导出", done: candidates.length > 0 && Boolean(selectedId), suggested: candidates.length > 0 },
  ];

  const displayScale = { x: displayMetrics.scaleX, y: displayMetrics.scaleY };

  const updateDisplayMetrics = useCallback(() => {
    const stage = stageRef.current;
    const img = imageRef.current;
    if (!stage || !img || sourceSize.width === 0 || sourceSize.height === 0) return;
    const stageRect = stage.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    setDisplayMetrics({
      x: imageRect.left - stageRect.left,
      y: imageRect.top - stageRect.top,
      w: imageRect.width,
      h: imageRect.height,
      scaleX: imageRect.width / sourceSize.width,
      scaleY: imageRect.height / sourceSize.height,
    });
  }, [sourceSize]);

  useEffect(() => {
    updateDisplayMetrics();
    window.addEventListener("resize", updateDisplayMetrics);
    return () => window.removeEventListener("resize", updateDisplayMetrics);
  }, [sourceUrl, candidates.length, updateDisplayMetrics]);

  useEffect(() => {
    let cancelled = false;
    if (!activeSource) {
      setSourceUrl("");
      setCandidates([]);
      setSelectedId("");
      return;
    }
    resolveMediaUrl(activeSource)
      .then((url) => {
        if (!cancelled) void loadSource(url);
      })
      .catch(() => {
        if (!cancelled) void loadSource(activeSource);
      });
    return () => { cancelled = true; };
  }, [activeSource]);

  useEffect(() => {
    if (!selected || !sourceUrl) {
      setPreviewDataUrl("");
      return;
    }
    let cancelled = false;
    cropUiSlice(sourceUrl, selected)
      .then((dataUrl) => { if (!cancelled) setPreviewDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setPreviewDataUrl(""); });
    return () => { cancelled = true; };
  }, [sourceUrl, selected]);

  async function loadSource(url: string) {
    const img = await loadImageElement(url);
    setSourceUrl(url);
    setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    // 与骨骼动画制作页一致：选择单图也走全局 importSourceFile 上传，
    // 这样 upload.id 会被填充，"生成去底图" 按钮才能点亮。
    setCandidates([]);
    setSelectedId("");
    await importSourceFile(file);
  }

  const runAnalyze = useCallback(async () => {
    if (!sourceUrl) return;
    setAnalyzing(true);
    try {
      const result = await analyzeUiSmartSlices(sourceUrl, options);
      setSourceSize({ width: result.width, height: result.height });
      setCandidates(result.candidates);
      setSelectedId(result.candidates[0]?.id || "");
      setWarnings(result.warnings);
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : String(error)]);
    } finally {
      setAnalyzing(false);
    }
  }, [sourceUrl, options]);

  function updateCandidate(id: string, patch: Partial<UiSliceCandidate>) {
    setCandidates((current) => current.map((candidate) => candidate.id === id ? clampCandidate({ ...candidate, ...patch }) : candidate));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setCandidates((current) => current.filter((candidate) => candidate.id !== selectedId));
    const nextCandidates = candidates.filter((candidate) => candidate.id !== selectedId);
    setSelectedId((current) => {
      const index = candidates.findIndex((candidate) => candidate.id === current);
      return nextCandidates[index]?.id || nextCandidates[index - 1]?.id || "";
    });
  }

  function addCandidate() {
    const w = Math.max(32, Math.round(sourceSize.width * 0.16));
    const h = Math.max(32, Math.round(sourceSize.height * 0.12));
    const next: UiSliceCandidate = {
      id: `manual_${Date.now().toString(36)}`,
      name: `ui_slice_${String(candidates.length + 1).padStart(2, "0")}`,
      x: Math.max(0, Math.round((sourceSize.width - w) / 2)),
      y: Math.max(0, Math.round((sourceSize.height - h) / 2)),
      w,
      h,
      area: w * h,
      confidence: 1,
    };
    setCandidates((current) => [...current, next]);
    setSelectedId(next.id);
  }

  function deleteAll() {
    setCandidates([]);
    setSelectedId("");
  }

  async function exportAll() {
    if (!sourceUrl || candidates.length === 0) return;
    // 按预览区里的全部切片框（自动识别 + 手动新增）逐个裁剪，打包成 zip 一次性下载，
    // 避免逐张 a.click() 被浏览器拦截、以及同名 PNG 互相覆盖导致手动框丢失。
    const entries: ZipSliceEntry[] = await Promise.all(
      candidates.map(async (candidate) => ({
        name: candidate.name,
        pngDataUrl: await cropUiSlice(sourceUrl, candidate),
        width: Math.round(candidate.w),
        height: Math.round(candidate.h),
      })),
    );
    await downloadSlicesAsZip(entries, "ui-smart-slices.zip");
  }

  async function exportSourceImage() {
    if (!sourceUrl) return;
    const resp = await fetch(sourceUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const ext = blob.type === "image/jpeg" ? "jpg" : "png";
    const a = document.createElement("a");
    a.href = url;
    a.download = `去底图.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onCanvasMouseDown(event: React.MouseEvent<HTMLElement>, candidate: UiSliceCandidate, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(candidate.id);
    setDragState({ id: candidate.id, mode, startX: event.clientX, startY: event.clientY, origin: candidate });
  }

  function onCanvasMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!dragState) return;
    const dx = (event.clientX - dragState.startX) / displayScale.x;
    const dy = (event.clientY - dragState.startY) / displayScale.y;
    if (dragState.mode === "move") {
      updateCandidate(dragState.id, { x: Math.round(dragState.origin.x + dx), y: Math.round(dragState.origin.y + dy) });
      return;
    }
    updateCandidate(dragState.id, {
      w: Math.round(Math.max(1, dragState.origin.w + dx)),
      h: Math.round(Math.max(1, dragState.origin.h + dy)),
    });
  }

  function nudgeSelected(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selected) return;
    const step = event.shiftKey ? 10 : 1;
    const patch: Partial<UiSliceCandidate> = {};
    if (event.key === "ArrowLeft") patch.x = selected.x - step;
    else if (event.key === "ArrowRight") patch.x = selected.x + step;
    else if (event.key === "ArrowUp") patch.y = selected.y - step;
    else if (event.key === "ArrowDown") patch.y = selected.y + step;
    else if (event.key === "Delete") deleteSelected();
    else return;
    event.preventDefault();
    updateCandidate(selected.id, patch);
  }

  function clampCandidate(candidate: UiSliceCandidate): UiSliceCandidate {
    const w = Math.max(1, Math.min(sourceSize.width, Math.round(candidate.w)));
    const h = Math.max(1, Math.min(sourceSize.height, Math.round(candidate.h)));
    const x = Math.max(0, Math.min(sourceSize.width - w, Math.round(candidate.x)));
    const y = Math.max(0, Math.min(sourceSize.height - h, Math.round(candidate.y)));
    return { ...candidate, x, y, w, h, area: w * h };
  }

  return (
    <section className="panel ui-smart-slice-panel">
      <div className="ui-smart-slice-header">
        <div>
          <h3>UI 智能识别切片</h3>
          <p>按“来源 → 去底图 → 识别 → 微调导出”拆分 UI 元素，适合按钮、图标、面板等静态 UI 资产。</p>
        </div>
      </div>

      <nav className="tool-stepper" aria-label="UI 智能切片步骤">
        {smartSliceSteps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            className={`tool-step ${step.done ? "done" : ""} ${activeStep === step.key ? "active" : ""} ${step.suggested ? "suggested" : ""}`}
            onClick={() => setActiveStep(step.key)}
          >
            <b>{index + 1}</b>
            {step.label}
          </button>
        ))}
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(event) => { void handleFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>当前来源：{canUsePipelinePreview ? "制作流水线去底预览" : sourceUrl ? "原图 / 手动单图" : "未选择"}</span>
        <span>尺寸：{sourceSize.width || "-"} × {sourceSize.height || "-"}</span>
        <span>切片：{candidates.length} 个</span>
      </div>

      {warnings.length > 0 && <div className="info-box">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}

      <div className="tool-stage-host smart-slice-stage-host">
        {activeStep === "source" && (
          <section className="panel compact-panel">
            <div className="action-group-grid single-row">
              <div className="action-group">
                <strong>选择 UI 来源图</strong>
                <button onClick={() => fileInputRef.current?.click()} disabled={busy || analyzing}>选择单图</button>
                <span>{activeSource ? "已接入当前图像" : "可从本页导入或复用制作流水线素材"}</span>
              </div>
              <div className="action-group">
                <strong>来源检查</strong>
                <span>来源图：{sourceUrl ? "已准备" : "未选择"}</span>
                <span>尺寸：{sourceSize.width || "-"} × {sourceSize.height || "-"}</span>
              </div>
            </div>
          </section>
        )}

        {activeStep === "matte" && (
          <section className="panel compact-panel">
            <div className="action-group-grid single-row">
              <div className="action-group">
                <strong>生成去底图</strong>
                <button onClick={runPreview} disabled={busy || analyzing || !upload?.id}>生成去底预览</button>
                <button onClick={() => void exportSourceImage()} disabled={!sourceUrl}>导出去底图</button>
                <span>{canUsePipelinePreview ? "已使用制作流水线去底预览" : "可先生成去底图，再进入识别切片"}</span>
              </div>
            </div>
            <SettingsPanel title="去底参数" showActions={false} />
          </section>
        )}

        {activeStep === "detect" && (
          <div className="ui-smart-slice-grid detect-only">
            <div className="ui-slice-main-column">
              <section className="panel compact-panel">
                <div className="action-group-grid single-row">
                  <div className="action-group">
                    <strong>识别切片</strong>
                    <button onClick={runAnalyze} disabled={analyzing || !sourceUrl}>{analyzing ? "识别中…" : "智能识别"}</button>
                    <button onClick={addCandidate} disabled={!sourceUrl}>新增切片框</button>
                    <span>{candidates.length > 0 ? `已识别 ${candidates.length} 个切片` : "先识别或手动新增切片框"}</span>
                  </div>
                </div>
                <details className="collapsible-card">
                  <summary>识别参数</summary>
                  <div className="settings-grid compact">
                    <label>Alpha 阈值<input type="number" min="0" max="255" value={options.alphaThreshold} onChange={(e) => setOptions((current) => ({ ...current, alphaThreshold: Number(e.target.value) }))} /></label>
                    <label title="连通性分析阈值，越高越能隔离半透明边缘，防止阴影/光晕把元素粘连">连通阈值<input type="number" min="0" max="255" value={options.alphaFloodThreshold} onChange={(e) => setOptions((current) => ({ ...current, alphaFloodThreshold: Number(e.target.value) }))} /></label>
                    <label>背景差异<input type="number" min="1" max="255" value={options.colorThreshold} onChange={(e) => setOptions((current) => ({ ...current, colorThreshold: Number(e.target.value) }))} /></label>
                    <label>最小尺寸<input type="number" min="1" value={options.minSize} onChange={(e) => setOptions((current) => ({ ...current, minSize: Number(e.target.value) }))} /></label>
                    <label>扩边像素<input type="number" min="0" value={options.padding} onChange={(e) => setOptions((current) => ({ ...current, padding: Number(e.target.value) }))} /></label>
                    <label>合并间距<input type="number" min="0" value={options.mergeGap} onChange={(e) => setOptions((current) => ({ ...current, mergeGap: Number(e.target.value) }))} /></label>
                    <label className="toggle-field"><input type="checkbox" checked={options.includeThin} onChange={(e) => setOptions((current) => ({ ...current, includeThin: e.target.checked }))} /><span>保留细长元素</span></label>
                  </div>
                </details>
              </section>
              <div
                ref={stageRef}
                className="ui-slice-stage"
                tabIndex={0}
                onKeyDown={nudgeSelected}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={() => setDragState(null)}
                onMouseLeave={() => setDragState(null)}
              >
                {sourceUrl ? <img ref={imageRef} src={sourceUrl} alt="UI 切片源图" onLoad={updateDisplayMetrics} /> : <span>先在“选择来源”步骤导入 UI 图。</span>}
                {sourceUrl && candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`ui-slice-box ${candidate.id === selectedId ? "selected" : ""}`}
                    style={{
                      left: displayMetrics.x + candidate.x * displayScale.x,
                      top: displayMetrics.y + candidate.y * displayScale.y,
                      width: candidate.w * displayScale.x,
                      height: candidate.h * displayScale.y,
                    }}
                    onMouseDown={(event) => onCanvasMouseDown(event, candidate, "move")}
                  >
                    <span>{candidate.name}</span>
                    <button aria-label="缩放切片" onMouseDown={(event) => onCanvasMouseDown(event, candidate, "resize-se")} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeStep === "export" && (
          <div className="ui-smart-slice-grid export-only">
            <aside className="ui-slice-inspector">
              <div className="tool-checklist slice-checklist">
                <span className={`tool-check-item ${sourceUrl ? "ok" : ""}`}>来源图：{sourceUrl ? "已准备" : "未选择"}</span>
                <span className={`tool-check-item ${canUsePipelinePreview ? "ok" : ""}`}>去底图：{canUsePipelinePreview ? "已生成" : "可选"}</span>
                <span className={`tool-check-item ${candidates.length > 0 ? "ok" : ""}`}>切片：{candidates.length} 个</span>
                <span className={`tool-check-item ${selected ? "ok" : ""}`}>当前选中：{selected ? selected.name : "无"}</span>
                <span className={`tool-check-item ${sourceUrl && candidates.length > 0 ? "ok" : ""}`}>导出：{sourceUrl && candidates.length > 0 ? "可导出" : "待识别"}</span>
              </div>
              <div className="export-actions">
                <button onClick={exportAll} disabled={!sourceUrl || candidates.length === 0}>导出切片 ZIP</button>
                <button onClick={deleteSelected} disabled={!selected}>删除框</button>
                <button onClick={deleteAll} disabled={candidates.length === 0}>清空所有</button>
              </div>
              {selected ? (
                <>
                  <label>名称<input value={selected.name} onChange={(e) => updateCandidate(selected.id, { name: e.target.value })} /></label>
                  <div className="settings-grid compact slice-rect-grid">
                    <label>X<input type="number" value={selected.x} onChange={(e) => updateCandidate(selected.id, { x: Number(e.target.value) })} /></label>
                    <label>Y<input type="number" value={selected.y} onChange={(e) => updateCandidate(selected.id, { y: Number(e.target.value) })} /></label>
                    <label>W<input type="number" min="1" value={selected.w} onChange={(e) => updateCandidate(selected.id, { w: Number(e.target.value) })} /></label>
                    <label>H<input type="number" min="1" value={selected.h} onChange={(e) => updateCandidate(selected.id, { h: Number(e.target.value) })} /></label>
                  </div>
                  <div className="ui-slice-preview">
                    {previewDataUrl ? <img src={previewDataUrl} alt="当前切片预览" /> : <span>无预览</span>}
                  </div>
                  {previewDataUrl && <button onClick={() => downloadDataUrl(previewDataUrl, `${safeFileName(selected.name)}.png`)}>下载当前切片</button>}
                </>
              ) : <p>选择一个切片框后可编辑名称、坐标和尺寸。</p>}
              <div className="ui-slice-list">
                {candidates.map((candidate) => (
                  <button key={candidate.id} className={candidate.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(candidate.id)}>
                    <strong>{candidate.name}</strong>
                    <span>{candidate.w} × {candidate.h}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
