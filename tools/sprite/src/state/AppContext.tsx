import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getDesktopApi, type RuntimeStatus } from "@/api/desktopApi";
import { exportJob, getAppVersion, getModelStatus, getTaskProgress, importAnimationFrames, importPath, openPath, previewFrame, previewGreenToBlack, previewSemitransparentToBlack, previewSemitransparentToOpaque, rematteJobFrames, savePreview, smartSelectJobFrames, startProcessVideo, uploadFile } from "@/api/spriteApi";
import type { ExportCompressionSettings, ExportInfo, JobInfo, KeyingMode, ModelStatusInfo, PreviewInfo, ProcessSettings, UploadInfo } from "@/types/sprite";

export const keyingModes: Array<{ value: KeyingMode; label: string; description: string }> = [
  { value: "chroma", label: "绿幕 / 纯色", description: "适合可控纯色背景，速度最快。" },
  { value: "spriteflow", label: "SpriteFlow 色键", description: "SpriteFlow 边缘渐变色键，含混合区与去溢色。" },
  { value: "birefnet", label: "BiRefNet", description: "AI 主体抠图，适合复杂背景。" },
  { value: "corridorkey", label: "CorridorKey", description: "重建绿/蓝幕边缘，适合走廊式背景。" },
  { value: "luma", label: "Luma", description: "按亮度保留火焰、闪电、粒子等特效。" },
  { value: "birefnet_corridorkey", label: "BiRefNet + CorridorKey", description: "AI 主体加边缘颜色重建。" },
  { value: "birefnet_luma", label: "BiRefNet + Luma", description: "主体与亮部特效一起保留。" },
  { value: "birefnet_luma_corridorkey", label: "三管齐下", description: "主体、亮部、边缘颜色重建组合模式。" },
  { value: "none", label: "不抠图", description: "素材已有透明通道时使用。" },
];

function createDefaultSettings(uploadId = ""): ProcessSettings {
  return {
    upload_id: uploadId,
    start_time: 0,
    end_time: 0,
    keep_every: 1,
    target_size: 512,
    reduce_px: 20,
    canvas_mode: "auto",
    chroma_enabled: true,
    matte_mode: "chroma",
    key_mode: "auto",
    manual_key_hex: "#00FF00",
    threshold: 80,
    softness: 32,
    despill_strength: 0.85,
    halo_pixels: 1,
    ai_model: "birefnet-hr-matting",
    ai_device: "auto",
    ai_resolution: 1024,
    luma_black: 24,
    luma_white: 230,
    luma_gamma: 1,
    luma_strength: 1,
    corridorkey_enabled: false,
    corridorkey_screen: "auto",
    sf_tolerance: 120,
    sf_edge_blend: true,
    sf_blend_zone_ratio: 0.6,
    sf_alpha_cutoff: 8,
    sf_spill_removal: true,
    sf_spill_strength: 0.45,
    batch_green_to_black: false,
    batch_semitransparent_to_black: false,
    batch_semitransparent_to_opaque: false,
  };
}

function createDefaultExportCompression(): ExportCompressionSettings {
  return {
    include_sheet: true,
    include_zip: true,
    include_mov: true,
    include_manifest: true,
    sheet_format: "png",
    png_compress_level: 6,
    zip_compress_level: 6,
    webp_quality: 90,
    sheet_max_dimension: 0,
    sheet_target_kb: 0,
  };
}

function updateNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeProgress(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export interface AppState {
  desktopApi: ReturnType<typeof getDesktopApi>;
  runtime: RuntimeStatus | null;
  version: string;
  localPath: string;
  selectedFile: File | null;
  upload: UploadInfo | null;
  sourcePreviewUrl: string;
  modelStatuses: ModelStatusInfo[];
  modelCacheDir: string;
  settings: ProcessSettings;
  sampleTime: number;
  sheetColumns: number;
  videoDurationMs: number;
  preview: PreviewInfo | null;
  job: JobInfo | null;
  exportResult: ExportInfo | null;
  exportCompression: ExportCompressionSettings;
  logFiles: string[];
  selectedLog: string;
  logText: string;
  message: string;
  busy: boolean;
  // 帧选择
  selectedFrameIndices: number[];
  previewBackgroundMode: "checker" | "dark" | "light" | "custom";
  previewBackgroundColor: string;
  processPreviewZoom: number;
  processPreviewPan: { x: number; y: number };
  previewReverse: boolean;
  previewPlaying: boolean;
  previewIntervalMs: number;
  operationLabel: string;
  operationProgress: number | null;
  taskLogs: string[];
}

export interface AppActions {
  setLocalPath: (path: string) => void;
  setSelectedFile: (file: File | null) => void;
  setSettings: (fn: (prev: ProcessSettings) => ProcessSettings) => void;
  setSampleTime: (time: number) => void;
  setSheetColumns: (cols: number) => void;
  setVideoDurationMs: (ms: number) => void;
  setExportCompression: (fn: (prev: ExportCompressionSettings) => ExportCompressionSettings) => void;
  setSelectedFrameIndices: (indices: number[]) => void;
  setPreviewBackgroundMode: (mode: AppState["previewBackgroundMode"]) => void;
  setPreviewBackgroundColor: (color: string) => void;
  setProcessPreviewZoom: (zoom: number) => void;
  setProcessPreviewPan: (pan: { x: number; y: number }) => void;
  setPreviewReverse: (reverse: boolean) => void;
  setPreviewPlaying: (playing: boolean) => void;
  setPreviewIntervalMs: (ms: number) => void;
  importAnimationFiles: (files: File[]) => Promise<void>;
  applyGreenToBlackPreview: () => Promise<void>;
  applySemitransparentToBlackPreview: () => Promise<void>;
  applySemitransparentToOpaquePreview: () => Promise<void>;
  saveCurrentPreview: () => Promise<void>;
  openPathTarget: (path: string) => Promise<void>;
  chooseVideo: () => Promise<void>;
  chooseBrowserFile: (file: File | null) => void;
  importSourceFile: (file: File) => Promise<void>;
  registerPath: () => Promise<void>;
  runPreview: () => Promise<void>;
  runProcess: () => Promise<void>;
  rerunMatteForFrames: (indices: number[]) => Promise<void>;
  smartSelectFrames: (targetCount: number) => Promise<void>;
  runExport: () => Promise<void>;
  restartServer: () => Promise<void>;
  refreshRuntime: () => Promise<void>;
  readSelectedLog: (fileName?: string) => Promise<void>;
  openExportDir: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);
const AppActionsContext = createContext<AppActions | null>(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be inside AppProvider");
  return ctx;
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions must be inside AppProvider");
  return ctx;
}

export { updateNumber };

export function AppProvider({ children }: { children: ReactNode }) {
  const desktopApi = getDesktopApi();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [version, setVersion] = useState("未知");
  const [localPath, setLocalPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadInfo | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState("");
  const [modelStatuses, setModelStatuses] = useState<ModelStatusInfo[]>([]);
  const [modelCacheDir, setModelCacheDir] = useState("");
  const [settings, setSettings] = useState<ProcessSettings>(() => createDefaultSettings());
  const [sampleTime, setSampleTime] = useState(0);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [videoDurationMs, setVideoDurationMs] = useState(100);
  const [preview, setPreview] = useState<PreviewInfo | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [exportResult, setExportResult] = useState<ExportInfo | null>(null);
  const [exportCompression, setExportCompression] = useState<ExportCompressionSettings>(() => createDefaultExportCompression());
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState("");
  const [logText, setLogText] = useState("");
  const [message, setMessage] = useState("准备就绪");
  const [busy, setBusy] = useState(false);
  const [selectedFrameIndices, setSelectedFrameIndices] = useState<number[]>([]);
  const [previewBackgroundMode, setPreviewBackgroundMode] = useState<AppState["previewBackgroundMode"]>("checker");
  const [previewBackgroundColor, setPreviewBackgroundColor] = useState("#101827");
  const [processPreviewZoom, setProcessPreviewZoom] = useState(1);
  const [processPreviewPan, setProcessPreviewPan] = useState({ x: 0, y: 0 });
  const [previewReverse, setPreviewReverse] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewIntervalMs, setPreviewIntervalMs] = useState(100);
  const [operationLabel, setOperationLabel] = useState("准备就绪");
  const [operationProgress, setOperationProgress] = useState<number | null>(null);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);

  useEffect(() => {
    getAppVersion()
      .then((r) => setVersion(r.version))
      .catch(() => setVersion("Python 服务未连接"));
    getModelStatus()
      .then((r) => { setModelStatuses(r.models); setModelCacheDir(r.cache_dir); })
      .catch(() => { setModelStatuses([]); setModelCacheDir(""); });
    desktopApi?.getRuntimeStatus().then(setRuntime).catch(() => setRuntime(null));
    desktopApi?.listLogs().then((files) => {
      setLogFiles(files);
      setSelectedLog((c) => c || files[0] || "");
    }).catch(() => setLogFiles([]));
  }, [desktopApi]);

  // 当 job 变化时自动全选帧
  useEffect(() => {
    if (job?.frames) setSelectedFrameIndices(job.frames.map((f) => f.index));
    else setSelectedFrameIndices([]);
  }, [job]);

  const sourceDuration = typeof upload?.duration === "number" && upload.duration > 0 ? upload.duration : null;

  async function chooseVideo() {
    if (!desktopApi) {
      fileInputRef.current?.click();
      return;
    }
    const picked = await desktopApi.chooseVideo();
    if (picked) { setSelectedFile(null); setLocalPath(picked); }
  }

  function chooseBrowserFile(file: File | null) {
    setSelectedFile(file);
    if (file) setLocalPath(file.name);
  }

  async function importAnimationFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name));
    if (imageFiles.length === 0) { setMessage("请选择图片帧。 "); return; }
    setBusy(true);
    setOperationLabel("导入动画帧");
    setOperationProgress(20);
    try {
      const result = await importAnimationFrames([...imageFiles].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
      setOperationProgress(100);
      setJob(result.job);
      setUpload(null);
      setSourcePreviewUrl("");
      setPreview(null);
      setExportResult(null);
      setSelectedFrameIndices(result.job.frames?.map((f) => f.index) || []);
      setMessage(`已导入动画帧：${result.job.frame_count ?? result.job.frames?.length ?? 0} 帧。`);
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function importSourceFile(file: File) {
    setSelectedFile(file);
    setLocalPath(file.name);
    setBusy(true);
    setOperationLabel("导入素材");
    setOperationProgress(20);
    try {
      const result = await uploadFile(file);
      setOperationProgress(100);
      setUpload(result.upload);
      setSourcePreviewUrl(result.upload.url || "");
      setSettings((c) => ({
        ...c,
        upload_id: result.upload.id,
        end_time: result.upload.duration && result.upload.duration > 0 ? result.upload.duration : c.end_time,
      }));
      if (result.upload.duration && result.upload.duration > 0)
        setSampleTime(Math.min(result.upload.duration / 2, 1));
      setPreview(null); setJob(null); setExportResult(null);
      setMessage(`已导入素材：${result.upload.name || result.upload.id}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function registerPath() {
    if (!selectedFile && !localPath.trim()) { setMessage("请先选择或输入素材路径。"); return; }
    if (selectedFile) {
      await importSourceFile(selectedFile);
      return;
    }
    setBusy(true);
    setOperationLabel("导入素材");
    setOperationProgress(20);
    try {
      const result = await importPath(localPath.trim());
      setOperationProgress(100);
      setUpload(result.upload);
      setSourcePreviewUrl(result.upload.url || "");
      setSettings((c) => ({
        ...c, upload_id: result.upload.id,
        end_time: result.upload.duration && result.upload.duration > 0 ? result.upload.duration : c.end_time,
      }));
      if (result.upload.duration && result.upload.duration > 0)
        setSampleTime(Math.min(result.upload.duration / 2, 1));
      setPreview(null); setJob(null); setExportResult(null);
      setMessage(`已导入素材：${result.upload.name || result.upload.id}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function runPreview() {
    if (!settings.upload_id) { setMessage("请先导入素材。"); return; }
    setBusy(true);
    setOperationLabel("生成单帧预览");
    setOperationProgress(35);
    try {
      const t = sourceDuration === null ? Math.max(0, sampleTime) : Math.min(Math.max(0, sampleTime), sourceDuration);
      setSampleTime(t);
      setOperationProgress(70);
      const result = await previewFrame({ ...settings, sample_time: t });
      setPreview(result.preview);
      setOperationProgress(100);
      setMessage("单帧预览已生成。");
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function waitForTaskResult<T>(taskId: string) {
    for (;;) {
      const result = await getTaskProgress<T>(taskId);
      const task = result.task;
      setOperationLabel(task.label || "处理中");
      setOperationProgress(normalizeProgress(task.progress, 0));
      setTaskLogs(task.logs ?? []);
      setMessage(task.message);
      if (task.status === "completed") {
        if (task.result === null) throw new Error("任务完成但没有返回结果。");
        return task.result;
      }
      if (task.status === "failed") {
        throw new Error(task.error || task.message || "任务失败");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
  }

  async function startAndTrackProcess(s: ProcessSettings) {
    const started = await startProcessVideo(s);
    const task = started.task;
    setOperationLabel(task.label || "批量处理素材");
    setOperationProgress(normalizeProgress(task.progress, 10));
    setTaskLogs(task.logs ?? []);
    setMessage(task.message || "批量处理任务已启动。");
    return waitForTaskResult<JobInfo>(task.task_id);
  }

  async function runProcess() {
    if (!settings.upload_id) { setMessage("请先导入素材。"); return; }
    setBusy(true);
    setTaskLogs([]);
    setOperationLabel("批量处理素材");
    setOperationProgress(12);
    try {
      const s = { ...settings,
        keep_every: Math.max(1, Math.round(settings.keep_every)),
        target_size: Math.max(32, Math.round(settings.target_size)),
        reduce_px: Math.max(0, Math.round(settings.reduce_px)),
        halo_pixels: Math.max(0, Math.round(settings.halo_pixels)),
        ai_resolution: Math.max(256, Math.round(settings.ai_resolution)),
        threshold: Math.max(0, Math.round(settings.threshold)),
        softness: Math.max(0, Math.round(settings.softness)),
        luma_black: Math.max(0, Math.min(254, Math.round(settings.luma_black))),
        luma_white: Math.max(1, Math.min(255, Math.round(settings.luma_white))),
        luma_gamma: Math.max(0.05, settings.luma_gamma),
        luma_strength: Math.max(0, Math.min(2, settings.luma_strength)),
        despill_strength: Math.max(0, settings.despill_strength),
        start_time: Math.max(0, settings.start_time),
        end_time: Math.max(0, settings.end_time),
      };
      setSettings(s);
      setOperationLabel("启动批量处理任务");
      setOperationProgress(10);
      const nextJob = await startAndTrackProcess(s);
      setOperationLabel("整理处理结果");
      setOperationProgress(96);
      setJob(nextJob); setExportResult(null);
      getModelStatus().then((r) => { setModelStatuses(r.models); setModelCacheDir(r.cache_dir); }).catch(() => undefined);
      setMessage(`批处理完成：${nextJob.frame_count ?? nextJob.frames?.length ?? 0} 帧。`);
      setOperationProgress(100);
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function rerunMatteForFrames(indices: number[]) {
    const jobId = getJobId(job);
    const validIndices = Array.from(new Set(indices.filter((index) => Number.isFinite(index)))).sort((a, b) => a - b);
    if (!jobId || validIndices.length === 0) { setMessage("请先选择需要重新去底的帧。"); return; }
    setBusy(true);
    setTaskLogs([]);
    setOperationLabel("重新去底帧");
    setOperationProgress(20);
    try {
      const result = await rematteJobFrames(jobId, validIndices, settings);
      setOperationProgress(100);
      setJob(result.job);
      setExportResult(null);
      const nextFrameSet = new Set(result.job.frames?.map((frame) => frame.index) || []);
      setSelectedFrameIndices((current) => current.filter((index) => nextFrameSet.has(index)));
      setMessage(`已重新去底 ${validIndices.length} 帧。`);
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function smartSelectFrames(targetCount: number) {
    const jobId = getJobId(job);
    if (!jobId) { setMessage("请先完成批处理。"); return; }
    setBusy(true);
    setOperationLabel("智能选帧");
    setOperationProgress(35);
    try {
      const result = await smartSelectJobFrames(jobId, Math.max(1, Math.round(targetCount)));
      setSelectedFrameIndices(result.selected_indices);
      setOperationProgress(100);
      setMessage(`智能选帧完成：从 ${result.frame_count} 帧中选出 ${result.selected_indices.length} 帧。`);
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function runExport() {
    if (!getJobId(job) || selectedFrameIndices.length === 0) { setMessage("请先完成批处理。"); return; }
    setBusy(true);
    setOperationLabel("导出资源包");
    setOperationProgress(24);
    try {
      const cols = Math.max(1, Math.round(sheetColumns));
      const dur = Math.max(20, Math.round(videoDurationMs));
      setSheetColumns(cols); setVideoDurationMs(dur);
      const indices = previewReverse ? [...selectedFrameIndices].reverse() : selectedFrameIndices;
      setOperationProgress(62);
      const result = await exportJob(getJobId(job), indices, cols, dur, exportCompression);
      setOperationProgress(100);
      setExportResult(result.export);
      setMessage(`导出完成：${result.export.frame_count ?? selectedFrameIndices.length} 帧。`);
    } catch (e) { setOperationProgress(100); setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setOperationLabel("准备就绪"); }
  }

  async function applyGreenToBlackPreview() {
    const previewId = getPreviewId(preview);
    if (!previewId) { setMessage("请先生成单帧预览。"); return; }
    setBusy(true);
    try {
      const result = await previewGreenToBlack(previewId);
      setPreview(result.preview);
      setMessage("已对当前预览执行残绿涂黑。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function applySemitransparentToBlackPreview() {
    const previewId = getPreviewId(preview);
    if (!previewId) { setMessage("请先生成单帧预览。"); return; }
    setBusy(true);
    try {
      const result = await previewSemitransparentToBlack(previewId);
      setPreview(result.preview);
      setMessage("已对当前预览执行半透明涂黑。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function applySemitransparentToOpaquePreview() {
    const previewId = getPreviewId(preview);
    if (!previewId) { setMessage("请先生成单帧预览。"); return; }
    setBusy(true);
    try {
      const result = await previewSemitransparentToOpaque(previewId);
      setPreview(result.preview);
      setMessage("已对当前预览执行半透明变不透明。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function saveCurrentPreview() {
    const previewId = getPreviewId(preview);
    if (!previewId) { setMessage("请先生成单帧预览。"); return; }
    setBusy(true);
    try {
      const result = await savePreview(previewId);
      setJob(result.job);
      setExportResult(null);
      setMessage("当前预览已保存为可导出的帧。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function openPathTarget(path: string) {
    if (!path) { setMessage("没有目录可打开。"); return; }
    if (desktopApi) await desktopApi.openPath(path);
    else await openPath(path);
  }

  async function restartServer() {
    if (!desktopApi) return;
    setBusy(true);
    try {
      const next = await desktopApi.restartServer();
      setRuntime(next);
      setMessage(next.serverRunning ? "Python 服务已重启。" : "已请求重启，但服务暂未就绪。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function refreshRuntime() {
    if (!desktopApi) {
      try {
        const r = await getAppVersion();
        const s = await getModelStatus();
        setVersion(r.version); setModelStatuses(s.models); setModelCacheDir(s.cache_dir);
        setMessage("浏览器模式 API 连接正常。");
      } catch (e) { setVersion("Python 服务未连接"); setMessage(e instanceof Error ? e.message : String(e)); }
      return;
    }
    const next = await desktopApi.getRuntimeStatus();
    const s = await getModelStatus();
    const files = await desktopApi.listLogs();
    setRuntime(next); setModelStatuses(s.models); setModelCacheDir(s.cache_dir);
    setLogFiles(files); setSelectedLog((c) => c || files[0] || "");
    if (files.length === 0) setLogText("");
    setMessage("运行时状态已刷新。");
  }

  async function readSelectedLog(fileName = selectedLog) {
    if (!desktopApi || !fileName) { setMessage("没有可读取的日志文件。"); return; }
    const text = await desktopApi.readLog(fileName, 160);
    setSelectedLog(fileName); setLogText(text);
  }

  async function openExportDir() {
    if (!exportResult?.output_dir) { setMessage("没有导出目录可打开。"); return; }
    try {
      await openPathTarget(exportResult.output_dir);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  const state: AppState = {
    desktopApi, runtime, version, localPath, selectedFile, upload, sourcePreviewUrl,
    modelStatuses, modelCacheDir, settings, sampleTime, sheetColumns, videoDurationMs,
    preview, job, exportResult, exportCompression, logFiles, selectedLog, logText, message, busy,
    selectedFrameIndices, previewBackgroundMode, previewBackgroundColor, processPreviewZoom,
    processPreviewPan, previewReverse, previewPlaying, previewIntervalMs,
    operationLabel, operationProgress, taskLogs,
  };

  const actions: AppActions = useMemo(() => ({
    setLocalPath, setSelectedFile, setSettings, setSampleTime, setSheetColumns,
    setVideoDurationMs, setExportCompression, setSelectedFrameIndices, setPreviewBackgroundMode, setPreviewBackgroundColor,
    setProcessPreviewZoom, setProcessPreviewPan, setPreviewReverse, setPreviewPlaying,
    setPreviewIntervalMs, importAnimationFiles, applyGreenToBlackPreview,
    applySemitransparentToBlackPreview, applySemitransparentToOpaquePreview,
    saveCurrentPreview, openPathTarget, chooseVideo, chooseBrowserFile, importSourceFile,
    registerPath, runPreview, runProcess, rerunMatteForFrames, smartSelectFrames, runExport, restartServer, refreshRuntime,
    readSelectedLog, openExportDir,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [desktopApi, localPath, selectedFile, settings, sampleTime, sheetColumns, videoDurationMs, exportCompression, selectedFrameIndices, job, exportResult, selectedLog, upload, sourceDuration, busy, preview, previewReverse]);

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>
        {/* 隐藏文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,.mp4,.mov,.mkv,.webm,.png,.jpg,.jpeg,.webp,.bmp"
          style={{ display: "none" }}
          onChange={(e) => chooseBrowserFile(e.target.files?.[0] || null)}
        />
        {children}
      </AppActionsContext.Provider>
    </AppStateContext.Provider>
  );
}

function getJobId(job: JobInfo | null) {
  return job?.job_id || job?.id || "";
}

function getPreviewId(preview: PreviewInfo | null) {
  return preview?.preview_id || preview?.id || "";
}
