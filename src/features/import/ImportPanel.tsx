import { useEffect, useRef, useState } from "react";
import { useAppState, useAppActions } from "@/state/AppContext";
import { RemoteImage, RemoteVideo, RemoteLink } from "@/components/media";

export function ImportPanel() {
  const { desktopApi, localPath, upload, sourcePreviewUrl, busy, selectedFile } = useAppState();
  const { setLocalPath, setSelectedFile, chooseVideo, registerPath, importAnimationFiles } = useAppActions();
  const [dragging, setDragging] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const animationInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const sourceDuration = typeof upload?.duration === "number" && upload.duration > 0 ? upload.duration : null;
  const localPreviewIsImage = Boolean(selectedFile && (selectedFile.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(selectedFile.name)));
  const localPreviewIsVideo = Boolean(selectedFile && selectedFile.type.startsWith("video/"));
  const sourceIsImage = upload?.media_type === "image" || (!upload && localPreviewIsImage);
  const sourceIsVideo = upload?.media_type === "video" || (!upload && localPreviewIsVideo);
  const previewUrl = sourcePreviewUrl || localPreviewUrl;

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handleDroppedFiles(files: FileList | null) {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const images = list.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name));
    if (images.length > 1) {
      void importAnimationFiles(images);
      return;
    }
    setSelectedFile(list[0]);
    setLocalPath(list[0].name);
  }

  function handleAnimationFiles(files: FileList | null) {
    const list = Array.from(files || []);
    if (list.length > 0) void importAnimationFiles(list);
  }

  return (
    <section className="panel">
      <h3>导入素材</h3>
      <p>桌面版优先传本地路径给 Python，避免大视频走浏览器上传。</p>
      <div className="path-row">
        <input
          value={localPath}
          onChange={(e) => { setSelectedFile(null); setLocalPath(e.target.value); }}
          placeholder={desktopApi ? "选择或输入本地视频/图片路径" : "选择本地视频/图片文件上传"}
        />
        <button onClick={chooseVideo}>选择</button>
        <button onClick={registerPath} disabled={busy}>导入</button>
      </div>
      <div
        className={`upload-dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleDroppedFiles(e.dataTransfer.files); }}
      >
        <strong>拖拽导入</strong>
        <span>拖入单个视频/图片作为素材；拖入多张图片会按文件名导入为帧动画。</span>
      </div>
      <div className="export-actions">
        <button onClick={() => animationInputRef.current?.click()} disabled={busy}>导入图片帧</button>
        <button onClick={() => folderInputRef.current?.click()} disabled={busy}>导入帧文件夹</button>
      </div>
      <input
        ref={animationInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => { handleAnimationFiles(e.target.files); e.currentTarget.value = ""; }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        multiple
        {...({ webkitdirectory: "" } as Record<string, string>)}
        style={{ display: "none" }}
        onChange={(e) => { handleAnimationFiles(e.target.files); e.currentTarget.value = ""; }}
      />
      {upload && (
        <div className="info-box">
          <span>ID：{upload.id}</span>
          <span>名称：{upload.name}</span>
          {upload.width && upload.height && <span>尺寸：{upload.width} × {upload.height}</span>}
          {sourceDuration !== null && <span>时长：{sourceDuration.toFixed(2)} 秒</span>}
          {upload.fps && <span>FPS：{upload.fps}</span>}
        </div>
      )}
      {(upload || previewUrl) && (
        <div className="source-preview-card">
          <strong>{upload ? "原素材预览" : "待导入素材预览"}</strong>
          <div className="source-preview-window">
            {sourceIsImage ? (
              <RemoteImage src={previewUrl} alt="原图片素材" />
            ) : sourceIsVideo ? (
              <RemoteVideo src={previewUrl} />
            ) : (
              <RemoteLink href={previewUrl}>打开原素材</RemoteLink>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
