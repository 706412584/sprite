import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type BrushTool = "remove" | "keep";
type ViewMode = "result" | "mask" | "overlay";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: BrushTool;
  size: number;
  points: Point[];
}

export interface MattingRefineModalProps {
  sourceDataUrl: string;
  previewBackground: string;
  onClose: () => void;
  onApply: (dataUrl: string) => void | Promise<void>;
}

const buttonStyle: CSSProperties = {
  border: "1px solid #3a3f4a",
  borderRadius: 8,
  padding: "7px 10px",
  background: "#242830",
  color: "#e5e7eb",
  cursor: "pointer",
  fontSize: 13,
};

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#2f8bd8",
  background: "#0e639c",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function drawChecker(ctx: CanvasRenderingContext2D, w: number, h: number, base: string) {
  ctx.fillStyle = base || "#0d0f12";
  ctx.fillRect(0, 0, w, h);
  const size = Math.max(8, Math.round(Math.min(w, h) / 64));
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) ctx.fillRect(x, y, size, size);
    }
  }
}

function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
  if (stroke.points.length === 1) {
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function drawMaskStroke(maskCtx: CanvasRenderingContext2D, stroke: Stroke) {
  maskCtx.save();
  maskCtx.strokeStyle = "#fff";
  maskCtx.fillStyle = "#fff";
  drawStrokePath(maskCtx, stroke);
  maskCtx.restore();
}

async function applyStrokes(sourceDataUrl: string, strokes: Stroke[]): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;
  ctx.drawImage(img, 0, 0);

  const removeMask = document.createElement("canvas");
  const keepMask = document.createElement("canvas");
  removeMask.width = keepMask.width = w;
  removeMask.height = keepMask.height = h;
  const removeCtx = removeMask.getContext("2d");
  const keepCtx = keepMask.getContext("2d");
  if (!removeCtx || !keepCtx) return sourceDataUrl;

  for (const stroke of strokes) {
    drawMaskStroke(stroke.tool === "remove" ? removeCtx : keepCtx, stroke);
  }

  const image = ctx.getImageData(0, 0, w, h);
  const remove = removeCtx.getImageData(0, 0, w, h).data;
  const keep = keepCtx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < image.data.length; i += 4) {
    const removeAlpha = remove[i + 3];
    const keepAlpha = keep[i + 3];
    if (removeAlpha > 0) image.data[i + 3] = Math.max(0, image.data[i + 3] - removeAlpha);
    if (keepAlpha > 0) image.data[i + 3] = Math.max(image.data[i + 3], keepAlpha);
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export function MattingRefineModal({ sourceDataUrl, previewBackground, onClose, onApply }: MattingRefineModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<BrushTool>("remove");
  const [viewMode, setViewMode] = useState<ViewMode>("overlay");
  const [brushSize, setBrushSize] = useState(24);
  const [strokeCount, setStrokeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;

    if (viewMode === "mask") {
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < data.data.length; i += 4) {
        const a = data.data[i + 3];
        data.data[i] = a;
        data.data[i + 1] = a;
        data.data[i + 2] = a;
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
    } else {
      drawChecker(ctx, w, h, previewBackground);
      ctx.drawImage(img, 0, 0);
    }

    if (viewMode === "overlay") {
      for (const stroke of strokesRef.current) {
        ctx.save();
        ctx.strokeStyle = stroke.tool === "remove" ? "rgba(239,68,68,0.82)" : "rgba(34,197,94,0.82)";
        ctx.fillStyle = ctx.strokeStyle;
        drawStrokePath(ctx, stroke);
        ctx.restore();
      }
    }
  }, [previewBackground, viewMode]);

  useEffect(() => {
    let cancelled = false;
    loadImage(sourceDataUrl)
      .then((img) => {
        if (cancelled) return;
        imageRef.current = img;
        strokesRef.current = [];
        setStrokeCount(0);
        draw();
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [draw, sourceDataUrl]);

  useEffect(() => draw(), [draw, strokeCount, viewMode]);

  const toImagePoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return { x, y };
  }, []);

  const beginStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toImagePoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = { tool, size: brushSize, points: [point] };
    draw();
  }, [brushSize, draw, toImagePoint, tool]);

  const moveStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const point = toImagePoint(event);
    if (!point) return;
    currentStrokeRef.current.points.push(point);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || viewMode !== "overlay") return;
    draw();
    ctx.save();
    ctx.strokeStyle = tool === "remove" ? "rgba(239,68,68,0.82)" : "rgba(34,197,94,0.82)";
    ctx.fillStyle = ctx.strokeStyle;
    drawStrokePath(ctx, currentStrokeRef.current);
    ctx.restore();
  }, [draw, toImagePoint, tool, viewMode]);

  const endStroke = useCallback(() => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
    currentStrokeRef.current = null;
    drawingRef.current = false;
    setStrokeCount(strokesRef.current.length);
  }, []);

  const undo = useCallback(() => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
  }, []);

  const apply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await applyStrokes(sourceDataUrl, strokesRef.current);
      await onApply(next);
      onClose();
    } catch (e) {
      setError((e as Error).message || "Apply failed");
    } finally {
      setBusy(false);
    }
  }, [onApply, onClose, sourceDataUrl]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.58)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(980px, 96vw)", maxHeight: "92vh", overflow: "auto", background: "#18191b", border: "1px solid #343842", borderRadius: 14, padding: 14, color: "#e5e7eb", boxShadow: "0 22px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <strong>抠图修正</strong>
          <span style={{ fontSize: 12, color: "#aab0bc" }}>红笔删除背景，绿笔恢复角色；应用后会重新切帧。</span>
          <button style={{ ...buttonStyle, marginLeft: "auto" }} onClick={onClose} disabled={busy}>关闭</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <button style={tool === "remove" ? activeButtonStyle : buttonStyle} onClick={() => setTool("remove")}>红笔删除</button>
          <button style={tool === "keep" ? activeButtonStyle : buttonStyle} onClick={() => setTool("keep")}>绿笔保留</button>
          <button style={viewMode === "overlay" ? activeButtonStyle : buttonStyle} onClick={() => setViewMode("overlay")}>标注层</button>
          <button style={viewMode === "result" ? activeButtonStyle : buttonStyle} onClick={() => setViewMode("result")}>结果</button>
          <button style={viewMode === "mask" ? activeButtonStyle : buttonStyle} onClick={() => setViewMode("mask")}>Alpha 蒙版</button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            笔刷
            <input type="range" min="4" max="96" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            <span style={{ color: "#60a5fa", minWidth: 28 }}>{brushSize}</span>
          </label>
          <button style={buttonStyle} onClick={undo} disabled={busy || strokeCount === 0}>撤销</button>
          <button style={buttonStyle} onClick={() => { strokesRef.current = []; setStrokeCount(0); }} disabled={busy || strokeCount === 0}>清空标注</button>
          <button style={{ ...activeButtonStyle, marginLeft: "auto" }} onClick={apply} disabled={busy}>{busy ? "应用中..." : "应用修正"}</button>
        </div>
        {error ? <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
        <div style={{ border: "1px solid #343842", borderRadius: 10, overflow: "auto", background: "#0d0f12", maxHeight: "70vh", display: "grid", placeItems: "center", padding: 10 }}>
          <canvas
            ref={canvasRef}
            onPointerDown={beginStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            style={{ maxWidth: "100%", maxHeight: "68vh", imageRendering: "pixelated", cursor: tool === "remove" ? "crosshair" : "cell", touchAction: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
