import { useAppState, useAppActions, updateNumber } from "@/state/AppContext";
import { RemoteImage } from "@/components/media";
import { RemoteLink } from "@/components/media/RemoteLink";
import { SegmentControls } from "@/features/preview/SegmentControls";

export function PreviewPanel() {
  const { settings, sampleTime, preview, busy, previewBackgroundMode, previewBackgroundColor, processPreviewZoom, processPreviewPan } = useAppState();
  const { setSampleTime, setPreviewBackgroundMode, setPreviewBackgroundColor, setProcessPreviewZoom, setProcessPreviewPan, runPreview, applyGreenToBlackPreview, applySemitransparentToBlackPreview, applySemitransparentToOpaquePreview, saveCurrentPreview } = useAppActions();

  const previewUrl = preview?.processed_url || preview?.source_url || "";
  const previewStyle = {
    transform: `translate(${processPreviewPan.x}px, ${processPreviewPan.y}px) scale(${processPreviewZoom})`,
  };
  const processedCanvasClass = `preview-canvas preview-bg-${previewBackgroundMode}`;

  return (
    <section className="panel preview-panel">
      <h3>预览区</h3>
      <div className="control-row">
        <label>
          采样时间（秒）
          <input
            type="number"
            min="0"
            step="0.1"
            value={sampleTime}
            onChange={(e) => setSampleTime(updateNumber(e.target.value, 0))}
          />
        </label>
        <button onClick={runPreview} disabled={busy || !settings.upload_id}>单帧预览</button>
      </div>
      <SegmentControls />
      <div className="preview-toolbar">
        <select value={previewBackgroundMode} onChange={(e) => setPreviewBackgroundMode(e.target.value as typeof previewBackgroundMode)}>
          <option value="checker">棋盘格</option>
          <option value="dark">深色</option>
          <option value="light">浅色</option>
          <option value="custom">自定义</option>
        </select>
        <input type="color" value={previewBackgroundColor} onChange={(e) => setPreviewBackgroundColor(e.target.value)} disabled={previewBackgroundMode !== "custom"} />
        <button onClick={() => setProcessPreviewZoom(Math.max(0.25, processPreviewZoom - 0.25))}>缩小</button>
        <button onClick={() => setProcessPreviewZoom(processPreviewZoom + 0.25)}>放大</button>
        <button onClick={() => { setProcessPreviewZoom(1); setProcessPreviewPan({ x: 0, y: 0 }); }}>重置</button>
      </div>
      <div className="dual-preview-grid">
        <div>
          <strong>原始帧</strong>
          <div className="preview-canvas">
            {preview?.source_url ? (
              <div style={previewStyle}><RemoteImage src={preview.source_url} alt="原始帧预览" /></div>
            ) : (
              <span>生成预览后显示原始帧。</span>
            )}
          </div>
        </div>
        <div>
          <strong>处理后</strong>
          <div
            className={processedCanvasClass}
            style={previewBackgroundMode === "custom" ? { backgroundColor: previewBackgroundColor } : undefined}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startY = e.clientY;
              const startPan = processPreviewPan;
              const move = (event: MouseEvent) => setProcessPreviewPan({ x: startPan.x + event.clientX - startX, y: startPan.y + event.clientY - startY });
              const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          >
            {previewUrl ? (
              <div style={previewStyle}><RemoteImage src={previewUrl} alt="处理后预览" /></div>
            ) : (
              <span>导入素材后点击"单帧预览"查看透明抠图结果。</span>
            )}
          </div>
        </div>
      </div>
      <div className="export-actions">
        <button onClick={applyGreenToBlackPreview} disabled={busy || !previewUrl}>残绿涂黑</button>
        <button onClick={applySemitransparentToBlackPreview} disabled={busy || !previewUrl}>半透明涂黑</button>
        <button onClick={applySemitransparentToOpaquePreview} disabled={busy || !previewUrl}>半透明变不透明</button>
        <button onClick={saveCurrentPreview} disabled={busy || !previewUrl}>保存为帧</button>
        {previewUrl && <RemoteLink href={previewUrl}>下载处理图</RemoteLink>}
      </div>
      {preview && (
        <div className="info-box">
          <span>Preview ID：{preview.preview_id || preview.id}</span>
          {preview.key_color && <span>Key Color：{preview.key_color}</span>}
          {preview.source_url && <RemoteLink href={preview.source_url}>打开原始帧</RemoteLink>}
        </div>
      )}
    </section>
  );
}
