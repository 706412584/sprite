import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "@/api/spriteApi";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useAppActions, useAppState } from "@/state/AppContext";
import {
  analyzeUiSmartSlices,
  cropUiSlice,
  defaultUiSmartSliceOptions,
  downloadDataUrl,
  downloadText,
  exportUiSlices,
  loadImageElement,
  safeFileName,
  type UiSliceCandidate,
  type UiSmartSliceOptions,
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
  const [displayMetrics, setDisplayMetrics] = useState<DisplayMetrics>({ x: 0, y: 0, w: 0, h: 0, scaleX: 1, scaleY: 1 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selected = candidates.find((candidate) => candidate.id === selectedId) || null;
  const activeSource = preview?.processed_url || sourcePreviewUrl;
  const canUsePipelinePreview = Boolean(preview?.processed_url);

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

  async function exportAll() {
    if (!sourceUrl || candidates.length === 0) return;
    const result = await exportUiSlices(sourceUrl, candidates);
    for (const item of result.slices) {
      downloadDataUrl(item.dataUrl, `${safeFileName(item.candidate.name)}.png`);
    }
    downloadText(JSON.stringify(result.metadata, null, 2), "ui-slices.metadata.json");
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
          <p>复用制作流水线的导入和去底结果，自动识别 UI 元素并支持手动微调切片框。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()} disabled={busy || analyzing}>选择单图</button>
          <button onClick={runPreview} disabled={busy || analyzing || !upload?.id}>生成去底图</button>
          <button onClick={runAnalyze} disabled={analyzing || !sourceUrl}>{analyzing ? "识别中…" : "智能识别"}</button>
          <button onClick={exportAll} disabled={!sourceUrl || candidates.length === 0}>导出切片</button>
        </div>
      </div>

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

      <div className="settings-grid compact">
        <label>Alpha 阈值<input type="number" min="0" max="255" value={options.alphaThreshold} onChange={(e) => setOptions((current) => ({ ...current, alphaThreshold: Number(e.target.value) }))} /></label>
        <label>背景差异<input type="number" min="1" max="255" value={options.colorThreshold} onChange={(e) => setOptions((current) => ({ ...current, colorThreshold: Number(e.target.value) }))} /></label>
        <label>最小尺寸<input type="number" min="1" value={options.minSize} onChange={(e) => setOptions((current) => ({ ...current, minSize: Number(e.target.value) }))} /></label>
        <label>扩边像素<input type="number" min="0" value={options.padding} onChange={(e) => setOptions((current) => ({ ...current, padding: Number(e.target.value) }))} /></label>
        <label>合并间距<input type="number" min="0" value={options.mergeGap} onChange={(e) => setOptions((current) => ({ ...current, mergeGap: Number(e.target.value) }))} /></label>
        <label className="toggle-field"><input type="checkbox" checked={options.includeThin} onChange={(e) => setOptions((current) => ({ ...current, includeThin: e.target.checked }))} /><span>保留细长元素</span></label>
      </div>

      {warnings.length > 0 && <div className="info-box">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}

      <div className="ui-smart-slice-grid">
        <div className="ui-slice-main-column">
          <SettingsPanel title="去底参数" showActions={false} />
          <div
            ref={stageRef}
            className="ui-slice-stage"
            tabIndex={0}
            onKeyDown={nudgeSelected}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={() => setDragState(null)}
            onMouseLeave={() => setDragState(null)}
          >
            {sourceUrl ? <img ref={imageRef} src={sourceUrl} alt="UI 切片源图" onLoad={updateDisplayMetrics} /> : <span>先在制作流水线导入图片，或在这里选择一张 UI 图。</span>}
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

        <aside className="ui-slice-inspector">
          <div className="export-actions">
            <button onClick={addCandidate} disabled={!sourceUrl}>新增框</button>
            <button onClick={deleteSelected} disabled={!selected}>删除框</button>
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
    </section>
  );
}
