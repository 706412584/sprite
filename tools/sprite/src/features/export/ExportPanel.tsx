import { useEffect, useState } from "react";
import { useAppState, useAppActions, updateNumber } from "@/state/AppContext";
import { RemoteImage } from "@/components/media/RemoteImage";
import { RemoteLink } from "@/components/media/RemoteLink";
import { AnimationPreview } from "@/features/export/AnimationPreview";

export function ExportPanel() {
  const { settings, job, exportResult, exportCompression, sheetColumns, videoDurationMs, busy, selectedFrameIndices, previewReverse, previewBackgroundColor } = useAppState();
  const { setSheetColumns, setVideoDurationMs, setExportCompression, setSelectedFrameIndices, setPreviewReverse, setPreviewIntervalMs, setPreviewBackgroundColor, runProcess, rerunMatteForFrames, smartSelectFrames, runExport, openExportDir, openPathTarget } = useAppActions();
  const [smartTargetCount, setSmartTargetCount] = useState(12);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; frameIndex: number } | null>(null);

  const jobId = job?.job_id || job?.id || "";
  const frames = job?.frames || [];
  const allIndices = frames.map((f) => f.index);
  const allSelected = selectedFrameIndices.length === allIndices.length;

  useEffect(() => {
    if (frames.length > 0) {
      setSmartTargetCount((current) => Math.max(1, Math.min(current || 12, frames.length)));
    }
  }, [frames.length]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  function toggleFrame(index: number) {
    setSelectedFrameIndices(
      selectedFrameIndices.includes(index)
        ? selectedFrameIndices.filter((i) => i !== index)
        : [...selectedFrameIndices, index].sort((a, b) => a - b)
    );
  }

  function toggleAll() {
    setSelectedFrameIndices(allSelected ? [] : [...allIndices]);
  }

  function selectOdd() {
    setSelectedFrameIndices(allIndices.filter((_, i) => i % 2 === 0));
  }

  function selectEven() {
    setSelectedFrameIndices(allIndices.filter((_, i) => i % 2 === 1));
  }

  function invertSelection() {
    setSelectedFrameIndices(allIndices.filter((index) => !selectedFrameIndices.includes(index)));
  }

  async function runSmartSelect() {
    await smartSelectFrames(Math.max(1, Math.min(frames.length, Math.round(smartTargetCount))));
  }

  async function rerunContextFrame(indices: number[]) {
    setContextMenu(null);
    await rerunMatteForFrames(indices);
  }

  function openFrameContextMenu(event: React.MouseEvent<HTMLLabelElement>, frameIndex: number) {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, frameIndex });
  }

  function updateCompressionNumber(key: "png_compress_level" | "zip_compress_level" | "webp_quality" | "sheet_max_dimension" | "sheet_target_kb", value: string, fallback: number, min: number, max: number) {
    const next = Math.max(min, Math.min(max, Math.round(updateNumber(value, fallback))));
    setExportCompression((c) => ({ ...c, [key]: next }));
  }

  function updateCompressionFlag(key: "include_sheet" | "include_zip" | "include_mov" | "include_manifest", checked: boolean) {
    setExportCompression((c) => ({ ...c, [key]: checked }));
  }

  const outputDir = (job?.output_dir || job?.frames_dir) as string | undefined;

  return (
    <section className="panel">
      <h3>批处理与导出</h3>

      <div className="export-actions">
        <button onClick={runProcess} disabled={busy || !settings.upload_id}>批量处理</button>
        <button onClick={runExport} disabled={busy || !jobId || selectedFrameIndices.length === 0}>导出 Sprite Sheet / zip</button>
        {exportResult?.output_dir && (
          <button onClick={openExportDir}>打开导出目录</button>
        )}
        {outputDir && (
          <button onClick={() => openPathTarget(outputDir)}>打开处理目录</button>
        )}
      </div>

      <div className="settings-grid compact">
        <label>
          Sheet 列数
          <input type="number" min="1" value={sheetColumns}
            onChange={(e) => setSheetColumns(updateNumber(e.target.value, 4))} />
        </label>
        <label>
          单帧时长（ms）
          <input type="number" min="20" value={videoDurationMs}
            onChange={(e) => { const next = updateNumber(e.target.value, 100); setVideoDurationMs(next); setPreviewIntervalMs(next); }} />
        </label>
        <label>
          预览背景
          <input type="color" value={previewBackgroundColor}
            onChange={(e) => setPreviewBackgroundColor(e.target.value)} />
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={previewReverse} onChange={(e) => setPreviewReverse(e.target.checked)} />
          <span>倒序预览/导出</span>
        </label>
        <label>
          Sheet 格式
          <select value={exportCompression.sheet_format}
            onChange={(e) => setExportCompression((c) => ({ ...c, sheet_format: e.target.value as "png" | "webp" | "both" }))}>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="both">PNG + WebP</option>
          </select>
        </label>
        <label>
          PNG 压缩等级（0-9）
          <input type="number" min="0" max="9" value={exportCompression.png_compress_level}
            onChange={(e) => updateCompressionNumber("png_compress_level", e.target.value, 6, 0, 9)} />
        </label>
        <label>
          ZIP 压缩等级（0-9）
          <input type="number" min="0" max="9" value={exportCompression.zip_compress_level}
            onChange={(e) => updateCompressionNumber("zip_compress_level", e.target.value, 6, 0, 9)} />
        </label>
        <label>
          WebP 质量（1-100）
          <input type="number" min="1" max="100" value={exportCompression.webp_quality}
            onChange={(e) => updateCompressionNumber("webp_quality", e.target.value, 90, 1, 100)} />
        </label>
        <label>
          Sheet 最大边长（px，0=不限）
          <input type="number" min="0" max="16384" step="64" value={exportCompression.sheet_max_dimension}
            onChange={(e) => updateCompressionNumber("sheet_max_dimension", e.target.value, 0, 0, 16384)} />
        </label>
        <label>
          Sheet 目标大小（KB，0=不限）
          <input type="number" min="0" max="200000" step="64" value={exportCompression.sheet_target_kb}
            onChange={(e) => updateCompressionNumber("sheet_target_kb", e.target.value, 0, 0, 200000)} />
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={exportCompression.include_sheet} onChange={(e) => updateCompressionFlag("include_sheet", e.target.checked)} />
          <span>导出 Sprite Sheet</span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={exportCompression.include_zip} onChange={(e) => updateCompressionFlag("include_zip", e.target.checked)} />
          <span>导出 PNG zip</span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={exportCompression.include_mov} onChange={(e) => updateCompressionFlag("include_mov", e.target.checked)} />
          <span>导出 Alpha MOV</span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={exportCompression.include_manifest} onChange={(e) => updateCompressionFlag("include_manifest", e.target.checked)} />
          <span>导出 JSON manifest</span>
        </label>
      </div>

      {/* 帧选择网格 */}
      {frames.length > 0 && (
        <div className="frame-grid-section">
          <div className="frame-grid-header">
            <span>已处理 {frames.length} 帧，已选 {selectedFrameIndices.length} 帧</span>
            <div className="frame-actions">
              <button onClick={toggleAll}>{allSelected ? "取消全选" : "全选"}</button>
              <button onClick={() => setSelectedFrameIndices([])}>全不选</button>
              <button onClick={selectOdd}>奇数帧</button>
              <button onClick={selectEven}>偶数帧</button>
              <button onClick={invertSelection}>反选</button>
              <label className="smart-select-control">
                目标帧数
                <input
                  type="number"
                  min="1"
                  max={frames.length}
                  value={smartTargetCount}
                  onChange={(e) => setSmartTargetCount(Math.max(1, Math.min(frames.length, updateNumber(e.target.value, smartTargetCount))))}
                />
              </label>
              <button onClick={runSmartSelect} disabled={busy || !jobId}>智能选帧</button>
            </div>
          </div>
          <div className="frame-grid">
            {frames.map((frame) => (
              <label
                key={frame.index}
                className={`frame-cell ${selectedFrameIndices.includes(frame.index) ? "selected" : ""}`}
                onContextMenu={(event) => openFrameContextMenu(event, frame.index)}
              >
                <input
                  type="checkbox"
                  checked={selectedFrameIndices.includes(frame.index)}
                  onChange={() => toggleFrame(frame.index)}
                />
                <RemoteImage src={frame.thumb_url || frame.url} alt={`帧 ${frame.index + 1}`} />
                <span className="frame-index">{frame.index + 1}</span>
              </label>
            ))}
          </div>
          {contextMenu && (
            <div
              className="frame-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button onClick={() => rerunContextFrame([contextMenu.frameIndex])} disabled={busy}>重新去底此帧</button>
              <button
                onClick={() => rerunContextFrame(selectedFrameIndices)}
                disabled={busy || !selectedFrameIndices.includes(contextMenu.frameIndex) || selectedFrameIndices.length === 0}
              >
                重新去底选中帧
              </button>
            </div>
          )}
        </div>
      )}

      {frames.length > 0 && <AnimationPreview />}

      {exportResult && (
        <div className="export-links">
          {exportResult.sheet_width && exportResult.sheet_height && (
            <span className="export-sheet-dims">Sheet 尺寸 {exportResult.sheet_width}×{exportResult.sheet_height}px</span>
          )}
          {exportResult.sheet_url && <RemoteLink href={exportResult.sheet_url}>Sprite Sheet</RemoteLink>}
          {exportResult.webp_sheet_url && <RemoteLink href={exportResult.webp_sheet_url}>WebP Sheet</RemoteLink>}
          {exportResult.zip_url && <RemoteLink href={exportResult.zip_url}>PNG zip</RemoteLink>}
          {exportResult.video_url && <RemoteLink href={exportResult.video_url}>Alpha MOV</RemoteLink>}
          {exportResult.manifest_url && <RemoteLink href={exportResult.manifest_url}>JSON manifest</RemoteLink>}
        </div>
      )}
    </section>
  );
}
