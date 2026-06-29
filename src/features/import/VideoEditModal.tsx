import { useEffect, useRef, useState } from "react";
import { useAppState, useAppActions } from "@/state/AppContext";
import { resolveMediaUrl } from "@/api/spriteApi";

interface VideoEditModalProps {
  onClose: () => void;
}

export function VideoEditModal({ onClose }: VideoEditModalProps) {
  const { upload, settings, sourcePreviewUrl } = useAppState();
  const { setSettings } = useAppActions();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [startTime, setStartTime] = useState(settings.start_time);
  const [endTime, setEndTime] = useState(settings.end_time);
  const [currentTime, setCurrentTime] = useState(0);
  const [cropX, setCropX] = useState(settings.crop_x);
  const [cropY, setCropY] = useState(settings.crop_y);
  const [cropW, setCropW] = useState(settings.crop_w);
  const [cropH, setCropH] = useState(settings.crop_h);
  const [videoSrc, setVideoSrc] = useState("");

  const duration = upload?.duration ?? 0;
  const sourceW = upload?.width ?? 0;
  const sourceH = upload?.height ?? 0;

  useEffect(() => {
    if (!sourcePreviewUrl) return;
    let cancelled = false;
    resolveMediaUrl(sourcePreviewUrl).then((url) => {
      if (!cancelled) setVideoSrc(url);
    }).catch(() => setVideoSrc(sourcePreviewUrl));
    return () => { cancelled = true; };
  }, [sourcePreviewUrl]);

  // 首次打开时，如果 crop 全为 0，自动填充源尺寸
  useEffect(() => {
    if (cropW === 0 && cropH === 0 && sourceW > 0 && sourceH > 0) {
      setCropW(sourceW);
      setCropH(sourceH);
    }
  }, [sourceW, sourceH]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTimeUpdate() {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }

  function seekTo(time: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }

  function handleConfirm() {
    setSettings((prev) => ({
      ...prev,
      start_time: Math.max(0, startTime),
      end_time: Math.max(0, endTime),
      crop_x: Math.max(0, Math.round(cropX)),
      crop_y: Math.max(0, Math.round(cropY)),
      crop_w: Math.max(0, Math.round(cropW)),
      crop_h: Math.max(0, Math.round(cropH)),
    }));
    onClose();
  }

  function resetCrop() {
    setCropX(0);
    setCropY(0);
    setCropW(sourceW);
    setCropH(sourceH);
  }

  return (
    <div className="video-edit-overlay" onClick={onClose}>
      <div className="video-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-edit-header">
          <h3>编辑视频</h3>
          <button onClick={onClose}>&times;</button>
        </div>

        <div className="video-edit-body">
          {/* 视频播放器 + 裁切覆盖层 */}
          <div className="video-edit-player-wrap">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              muted
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
            />
            {cropW > 0 && cropH > 0 && sourceW > 0 && sourceH > 0 && (
              <div
                className="video-crop-overlay"
                style={{
                  left: `${(cropX / sourceW) * 100}%`,
                  top: `${(cropY / sourceH) * 100}%`,
                  width: `${(cropW / sourceW) * 100}%`,
                  height: `${(cropH / sourceH) * 100}%`,
                }}
              />
            )}
          </div>

          {/* 时间裁切 */}
          <fieldset className="video-edit-section">
            <legend>时间裁切</legend>
            <div className="video-edit-row">
              <label>
                起点（秒）
                <input type="number" min="0" max={duration} step="0.1" value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))} />
              </label>
              <button onClick={() => setStartTime(parseFloat(currentTime.toFixed(2)))} disabled={duration === 0}>
                设为起点
              </button>
              <span className="video-edit-current">当前：{currentTime.toFixed(2)}s</span>
              <button onClick={() => setEndTime(parseFloat(currentTime.toFixed(2)))} disabled={duration === 0}>
                设为终点
              </button>
              <label>
                终点（秒）
                <input type="number" min="0" max={duration} step="0.1" value={endTime}
                  onChange={(e) => setEndTime(Number(e.target.value))} />
              </label>
            </div>
            <div className="video-edit-row">
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.01"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>
          </fieldset>

          {/* 空间裁切 */}
          <fieldset className="video-edit-section">
            <legend>空间裁切</legend>
            <p className="video-edit-hint">源尺寸：{sourceW} × {sourceH}。宽高建议为偶数。</p>
            <div className="video-edit-row">
              <label>
                X
                <input type="number" min="0" step="1" value={cropX}
                  onChange={(e) => setCropX(Number(e.target.value))} />
              </label>
              <label>
                Y
                <input type="number" min="0" step="1" value={cropY}
                  onChange={(e) => setCropY(Number(e.target.value))} />
              </label>
              <label>
                宽
                <input type="number" min="0" step="1" value={cropW}
                  onChange={(e) => setCropW(Number(e.target.value))} />
              </label>
              <label>
                高
                <input type="number" min="0" step="1" value={cropH}
                  onChange={(e) => setCropH(Number(e.target.value))} />
              </label>
              <button onClick={resetCrop}>重置</button>
            </div>
          </fieldset>
        </div>

        <div className="video-edit-footer">
          <button onClick={onClose}>取消</button>
          <button onClick={handleConfirm} className="primary">确认</button>
        </div>
      </div>
    </div>
  );
}
