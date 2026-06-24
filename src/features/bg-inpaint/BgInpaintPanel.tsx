import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMediaUrl, startBgInpaint, type BgInpaintRect, type BgInpaintResult } from "@/api/spriteApi";
import { useStore } from "@/state/store";
import {
  waitForTaskResult,
  TaskCancelledError,
  TaskTimeoutError,
  TaskStallError,
} from "@/state/actions/waitForTask";
import { loadImageElement } from "@/features/smart-slice/uiSmartSlice";

type BgInpaintStep = "source" | "rects" | "run" | "result";

interface DisplayMetrics {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export function BgInpaintPanel() {
  // ---- 全局状态 ----
  const sharedSliceRects = useStore((s) => s.sharedSliceRects);
  const upload = useStore((s) => s.upload);
  const sourcePreviewUrl = useStore((s) => s.sourcePreviewUrl);
  const preview = useStore((s) => s.preview);
  const importSourceFile = useStore((s) => s.importSourceFile);
  const busy = useStore((s) => s.busy);

  // ---- 本地状态 ----
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState<BgInpaintRect[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [result, setResult] = useState<BgInpaintResult | null>(null);
  const [activeStep, setActiveStep] = useState<BgInpaintStep>("source");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [displayMetrics, setDisplayMetrics] = useState<DisplayMetrics>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  const [dragState, setDragState] = useState<{ idx: number; mode: "move" | "resize-se"; startX: number; startY: number; origin: BgInpaintRect } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSource = preview?.processed_url || sourcePreviewUrl;

  // ---- 步骤定义 ----
  const steps: ReadonlyArray<{ key: BgInpaintStep; label: string; done: boolean; suggested: boolean }> = [
    { key: "source", label: "选择来源", done: Boolean(sourceUrl), suggested: !sourceUrl },
    { key: "rects", label: "框选区域", done: rects.length > 0, suggested: Boolean(sourceUrl) && rects.length === 0 },
    { key: "run", label: "执行补全", done: Boolean(result), suggested: rects.length > 0 && !result },
    { key: "result", label: "查看结果", done: Boolean(result), suggested: Boolean(result) },
  ];

  // ---- 显示缩放 ----
  const updateDisplayMetrics = useCallback(() => {
    const stage = stageRef.current;
    const img = imageRef.current;
    if (!stage || !img || sourceSize.width === 0 || sourceSize.height === 0) return;
    const stageRect = stage.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    setDisplayMetrics({
      x: imageRect.left - stageRect.left,
      y: imageRect.top - stageRect.top,
      scaleX: imageRect.width / sourceSize.width,
      scaleY: imageRect.height / sourceSize.height,
    });
  }, [sourceSize]);

  useEffect(() => {
    updateDisplayMetrics();
    window.addEventListener("resize", updateDisplayMetrics);
    return () => window.removeEventListener("resize", updateDisplayMetrics);
  }, [sourceUrl, rects.length, updateDisplayMetrics]);

  // ---- 来源图加载 ----
  useEffect(() => {
    let cancelled = false;
    if (!activeSource) {
      setSourceUrl("");
      return;
    }
    resolveMediaUrl(activeSource)
      .then((url) => { if (!cancelled) void loadSource(url); })
      .catch(() => { if (!cancelled) void loadSource(activeSource); });
    return () => { cancelled = true; };
  }, [activeSource]);

  async function loadSource(url: string) {
    const img = await loadImageElement(url);
    setSourceUrl(url);
    setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    await importSourceFile(file);
  }

  // ---- 矩形操作 ----
  function addRect() {
    const w = Math.round(sourceSize.width * 0.2);
    const h = Math.round(sourceSize.height * 0.2);
    const x = Math.round((sourceSize.width - w) / 2);
    const y = Math.round((sourceSize.height - h) / 2);
    const next = [...rects, { x, y, w, h }];
    setRects(next);
    setSelectedIdx(next.length - 1);
  }

  function updateRect(idx: number, patch: Partial<BgInpaintRect>) {
    setRects((current) => current.map((r, i) => {
      if (i !== idx) return r;
      const merged = { ...r, ...patch };
      merged.x = Math.max(0, Math.min(sourceSize.width - merged.w, Math.round(merged.x)));
      merged.y = Math.max(0, Math.min(sourceSize.height - merged.h, Math.round(merged.y)));
      merged.w = Math.max(1, Math.min(sourceSize.width, Math.round(merged.w)));
      merged.h = Math.max(1, Math.min(sourceSize.height, Math.round(merged.h)));
      return merged;
    }));
  }

  function deleteRect(idx: number) {
    setRects((current) => current.filter((_, i) => i !== idx));
    setSelectedIdx(-1);
  }

  function importFromSmartSlice() {
    if (sharedSliceRects.length === 0) return;
    setRects(sharedSliceRects);
    setSelectedIdx(0);
  }

  // ---- 拖拽 ----
  function onMouseDown(e: React.MouseEvent, idx: number, mode: "move" | "resize-se") {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIdx(idx);
    setDragState({ idx, mode, startX: e.clientX, startY: e.clientY, origin: rects[idx] });
  }

  useEffect(() => {
    if (!dragState) return;
    const currentDrag = dragState;

    function onWindowMouseMove(e: MouseEvent) {
      if (currentDrag.idx >= rects.length) return;
      const dx = (e.clientX - currentDrag.startX) / displayMetrics.scaleX;
      const dy = (e.clientY - currentDrag.startY) / displayMetrics.scaleY;
      const r = currentDrag.origin;
      if (currentDrag.mode === "move") {
        updateRect(currentDrag.idx, { x: r.x + dx, y: r.y + dy });
      } else {
        updateRect(currentDrag.idx, {
          w: Math.max(1, r.w + dx),
          h: Math.max(1, r.h + dy),
        });
      }
    }

    function onWindowMouseUp() {
      setDragState(null);
    }

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
    };
  }, [dragState, displayMetrics, rects.length]);

  function onMouseUp() {
    setDragState(null);
  }

  // ---- 执行推理 ----
  const runInpaint = useCallback(async () => {
    if (!sourceUrl || rects.length === 0) return;
    setRunning(true);
    setError("");
    setProgress(5);
    setProgressMsg("正在发送请求…");
    try {
      const response = await fetch(sourceUrl);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const started = await startBgInpaint(dataUrl, rects);
      const taskResult = await waitForTaskResult<BgInpaintResult>(
        started.task.task_id,
        {
          onProgress: (t) => {
            setProgress(t.progress);
            setProgressMsg(t.message || "");
          },
        },
      );
      setResult(taskResult);
      setActiveStep("result");
    } catch (e) {
      if (e instanceof TaskCancelledError) setError("已取消");
      else if (e instanceof TaskTimeoutError) setError(`超时：${e.message}`);
      else if (e instanceof TaskStallError) setError(`停滞：${e.message}`);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [sourceUrl, rects]);

  // ---- 导出 ----
  function exportResult() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.result_data_url;
    a.download = "背景补全结果.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- 键盘微调 ----
  function onNudge(e: React.KeyboardEvent) {
    if (selectedIdx < 0 || selectedIdx >= rects.length) return;
    const step = e.shiftKey ? 10 : 1;
    const r = rects[selectedIdx];
    const patch: Partial<BgInpaintRect> = {};
    if (e.key === "ArrowLeft") patch.x = r.x - step;
    else if (e.key === "ArrowRight") patch.x = r.x + step;
    else if (e.key === "ArrowUp") patch.y = r.y - step;
    else if (e.key === "ArrowDown") patch.y = r.y + step;
    else if (e.key === "Delete") { deleteRect(selectedIdx); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    updateRect(selectedIdx, patch);
  }

  // ---- 渲染 ----
  return (
    <section className="panel bg-inpaint-panel">
      <div className="ui-smart-slice-header">
        <div>
          <h3>背景补全</h3>
          <p>用 AI 补全被切片挖空的背景区域。可从「UI 智能切片」导入检测结果，或手动框选要移除的区域。</p>
        </div>
      </div>

      <nav className="tool-stepper" aria-label="背景补全步骤">
        {steps.map((step, index) => (
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
        onChange={(e) => { void handleFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>来源：{activeSource ? "已接入" : "未选择"}</span>
        <span>尺寸：{sourceSize.width || "-"} × {sourceSize.height || "-"}</span>
        <span>补全区域：{rects.length} 个</span>
      </div>

      {error && <div className="info-box warn"><span>{error}</span></div>}

      <div className="tool-stage-host smart-slice-stage-host">
        {/* Step 1: 选择来源 */}
        {activeStep === "source" && (
          <section className="panel compact-panel">
            <div className="action-group-grid single-row">
              <div className="action-group">
                <strong>选择来源图</strong>
                <button onClick={() => fileInputRef.current?.click()} disabled={busy}>选择单图</button>
                <span>{activeSource ? "已接入当前图像" : "从本页导入或复用制作流水线素材"}</span>
              </div>
              <div className="action-group">
                <strong>来源检查</strong>
                <span>来源图：{sourceUrl ? "已准备" : "未选择"}</span>
                <span>尺寸：{sourceSize.width || "-"} × {sourceSize.height || "-"}</span>
              </div>
            </div>
          </section>
        )}

        {/* Step 2: 框选区域 */}
        {activeStep === "rects" && (
          <div className="ui-smart-slice-grid detect-only">
            <div className="ui-slice-main-column">
              <section className="panel compact-panel">
                <div className="action-group-grid single-row">
                  <div className="action-group">
                    <strong>框选要补全的区域</strong>
                    <button onClick={importFromSmartSlice} disabled={sharedSliceRects.length === 0}>
                      从智能切片导入 ({sharedSliceRects.length})
                    </button>
                    <button onClick={addRect} disabled={!sourceUrl}>新增框</button>
                    <button onClick={() => { setRects([]); setSelectedIdx(-1); }} disabled={rects.length === 0}>清空</button>
                  </div>
                </div>
                {rects.length > 0 && (
                  <div className="settings-grid compact" style={{ maxHeight: 120, overflowY: "auto" }}>
                    {rects.map((r, i) => (
                      <div
                        key={i}
                        className={`slice-list-item ${i === selectedIdx ? "selected" : ""}`}
                        onClick={() => setSelectedIdx(i)}
                        style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer", padding: "2px 4px", fontSize: 12 }}
                      >
                        <span style={{ flex: 1 }}>区域 {i + 1}: ({r.x}, {r.y}) {r.w}×{r.h}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteRect(i); }} style={{ fontSize: 11, padding: "1px 4px" }}>删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div
                ref={stageRef}
                className="ui-slice-stage"
                tabIndex={0}
                onKeyDown={onNudge}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {sourceUrl ? (
                  <img ref={imageRef} src={sourceUrl} alt="背景补全源图" onLoad={updateDisplayMetrics} />
                ) : (
                  <span>先在「选择来源」步骤导入图片。</span>
                )}
                {sourceUrl && rects.map((r, i) => (
                  <div
                    key={i}
                    className={`ui-slice-box ${i === selectedIdx ? "selected" : ""}`}
                    style={{
                      left: displayMetrics.x + r.x * displayMetrics.scaleX,
                      top: displayMetrics.y + r.y * displayMetrics.scaleY,
                      width: r.w * displayMetrics.scaleX,
                      height: r.h * displayMetrics.scaleY,
                    }}
                    onMouseDown={(e) => onMouseDown(e, i, "move")}
                  >
                    <span className="ui-slice-label">区域 {i + 1}</span>
                    <div className="ui-slice-resize-handle" onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, i, "resize-se"); }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 执行补全 */}
        {activeStep === "run" && (
          <section className="panel compact-panel">
            <div className="action-group-grid single-row">
              <div className="action-group">
                <strong>执行背景补全</strong>
                <button onClick={runInpaint} disabled={running || !sourceUrl || rects.length === 0}>
                  {running ? "补全中…" : "执行补全"}
                </button>
                <span>{rects.length > 0 ? `将补全 ${rects.length} 个区域` : "请先框选要补全的区域"}</span>
              </div>
            </div>
            {running && (
              <div className="bg-inpaint-progress">
                <progress value={progress} max={100} />
                <span>{progressMsg || "处理中…"}</span>
              </div>
            )}
          </section>
        )}

        {/* Step 4: 查看结果 */}
        {activeStep === "result" && result && (
          <section className="panel compact-panel">
            <div className="action-group-grid single-row">
              <div className="action-group">
                <strong>补全结果</strong>
                <button onClick={exportResult}>导出 PNG</button>
                <button onClick={() => { setResult(null); setActiveStep("run"); }}>重新执行</button>
              </div>
            </div>
            <div className="bg-inpaint-compare">
              <figure>
                <img src={sourceUrl} alt="原图" style={{ maxWidth: "100%", height: "auto" }} />
                <figcaption>原图</figcaption>
              </figure>
              <figure>
                <img src={result.result_data_url} alt="补全结果" style={{ maxWidth: "100%", height: "auto" }} />
                <figcaption>补全结果</figcaption>
              </figure>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
