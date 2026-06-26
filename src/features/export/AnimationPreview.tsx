import { useEffect, useRef } from "react";
import { useAppState, useAppActions } from "@/state/AppContext";
import { resolveMediaUrl } from "@/api/spriteApi";
import { RemoteImage } from "@/components/media";

export function AnimationPreview() {
  const { job, selectedFrameIndices, previewReverse, previewPlaying, previewIntervalMs, previewBackgroundColor } = useAppState();
  const { setPreviewPlaying } = useAppActions();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const frames = job?.frames || [];
  const selected = frames.filter((frame) => selectedFrameIndices.includes(frame.index));
  const playbackFrames = previewReverse ? [...selected].reverse() : selected;

  useEffect(() => {
    frameRef.current = 0;
    drawFrame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, selectedFrameIndices, previewReverse, previewBackgroundColor]);

  useEffect(() => {
    if (!previewPlaying || playbackFrames.length === 0) return;
    timerRef.current = window.setInterval(() => {
      frameRef.current = (frameRef.current + 1) % playbackFrames.length;
      drawFrame();
    }, Math.max(20, previewIntervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPlaying, playbackFrames.length, previewIntervalMs, previewReverse]);

  function drawFrame() {
    const canvas = canvasRef.current;
    const frame = playbackFrames[frameRef.current];
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawToken = frameRef.current;
    const image = new Image();
    image.onload = () => {
      if (frameRef.current !== drawToken) return;
      canvas.width = image.naturalWidth || 256;
      canvas.height = image.naturalHeight || 256;
      ctx.fillStyle = previewBackgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
    };
    resolveMediaUrl(frame.url)
      .then((url) => { image.src = url; })
      .catch(() => { image.src = frame.url; });
  }

  if (frames.length === 0) return null;

  return (
    <div className="animation-preview-card">
      <div className="frame-grid-header">
        <strong>帧动画预览</strong>
        <span>{playbackFrames.length} 帧</span>
      </div>
      <div className="animation-canvas-wrap">
        <canvas ref={canvasRef} className="animation-canvas" />
        {playbackFrames.length === 0 && <span>请选择要预览的帧。</span>}
      </div>
      <div className="export-actions">
        <button onClick={() => { frameRef.current = 0; drawFrame(); setPreviewPlaying(false); }}>从头</button>
        <button onClick={() => setPreviewPlaying(!previewPlaying)} disabled={playbackFrames.length === 0}>
          {previewPlaying ? "暂停" : "播放"}
        </button>
      </div>
      <div className="thumb-strip">
        {playbackFrames.slice(0, 12).map((frame) => (
          <RemoteImage key={frame.index} src={frame.thumb_url || frame.url} alt={`预览帧 ${frame.index + 1}`} />
        ))}
      </div>
    </div>
  );
}
