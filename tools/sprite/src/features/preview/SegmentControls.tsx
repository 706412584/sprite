import { useAppState, useAppActions, updateNumber } from "@/state/AppContext";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SegmentControls() {
  const { upload, settings, sampleTime } = useAppState();
  const { setSettings, setSampleTime } = useAppActions();

  const duration = typeof upload?.duration === "number" && upload.duration > 0 ? upload.duration : 0;
  const fps = typeof upload?.fps === "number" && upload.fps > 0 ? upload.fps : 24;
  const maxFrame = duration > 0 ? Math.max(0, Math.floor(duration * fps)) : 0;
  const startFrame = Math.round(settings.start_time * fps);
  const endFrame = settings.end_time > 0 ? Math.round(settings.end_time * fps) : maxFrame;
  const currentFrame = Math.round(sampleTime * fps);

  function setStartFrame(frame: number) {
    const nextFrame = clamp(Math.round(frame), 0, Math.max(0, endFrame));
    const nextTime = nextFrame / fps;
    setSettings((c) => ({ ...c, start_time: nextTime }));
    if (sampleTime < nextTime) setSampleTime(nextTime);
  }

  function setEndFrame(frame: number) {
    const nextFrame = clamp(Math.round(frame), startFrame, maxFrame);
    const nextTime = nextFrame / fps;
    setSettings((c) => ({ ...c, end_time: nextTime }));
    if (sampleTime > nextTime) setSampleTime(nextTime);
  }

  function setCurrentFrame(frame: number) {
    const nextFrame = clamp(Math.round(frame), startFrame, endFrame || maxFrame);
    setSampleTime(nextFrame / fps);
  }

  if (!upload) return null;

  return (
    <div className="segment-controls">
      <div className="frame-grid-header">
        <strong>区间与帧控制</strong>
        <span>{duration > 0 ? `${maxFrame + 1} 帧 · ${fps.toFixed(2)} FPS` : "单帧素材"}</span>
      </div>
      <div className="settings-grid advanced-grid">
        <label>
          起始帧
          <input type="number" min="0" max={maxFrame} value={startFrame}
            onChange={(e) => setStartFrame(updateNumber(e.target.value, startFrame))} />
        </label>
        <label>
          结束帧
          <input type="number" min="0" max={maxFrame} value={endFrame}
            onChange={(e) => setEndFrame(updateNumber(e.target.value, endFrame))} />
        </label>
        <label>
          当前帧
          <input type="number" min={startFrame} max={endFrame || maxFrame} value={currentFrame}
            onChange={(e) => setCurrentFrame(updateNumber(e.target.value, currentFrame))} />
        </label>
      </div>
      <input
        className="frame-range"
        type="range"
        min={startFrame}
        max={endFrame || maxFrame}
        value={clamp(currentFrame, startFrame, endFrame || maxFrame)}
        onChange={(e) => setCurrentFrame(updateNumber(e.target.value, currentFrame))}
      />
    </div>
  );
}
