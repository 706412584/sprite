// 单一 Zustand 全局 store。所有 state 和 actions 都在这里。
//
// AppContext.tsx 现在是兼容包装层：useAppState/useAppActions 从这个 store 读取，
// 让面板代码不用一次性全部改写。新代码可以直接 useStore((s) => s.busy) 选取片段，
// 避免无关字段变化触发整组件重渲染。

import { create } from "zustand";
import { getDesktopApi, type RuntimeStatus, type SpriteDesktopApi } from "@/api/desktopApi";
import {
  exportJob,
  getAppVersion,
  getModelStatus,
  importAnimationFrames,
  importPath,
  openPath,
  previewFrame,
  previewGreenToBlack,
  previewSemitransparentToBlack,
  previewSemitransparentToOpaque,
  rematteJobFrames,
  savePreview,
  smartSelectJobFrames,
  startProcessVideo,
  uploadFile,
} from "@/api/spriteApi";
import type {
  ExportCompressionSettings,
  ExportInfo,
  JobInfo,
  ModelStatusInfo,
  PreviewInfo,
  ProcessSettings,
  UploadInfo,
} from "@/types/sprite";
import { TaskCancelledError, TaskStallError, TaskTimeoutError, waitForTaskResult } from "@/state/actions/waitForTask";

// ---------------------------------------------------------------------------
// Default factories
// ---------------------------------------------------------------------------
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
    matte_mode: "birefnet",
    matte_pipeline: ["birefnet"],
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
    decontaminate_enabled: true,
    decontaminate_radius: 2,
    decontaminate_strength: 1.0,
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

function normalizeProgress(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

// ---------------------------------------------------------------------------
// Module-level non-React state
// ---------------------------------------------------------------------------

// 浏览器模式下，AppProvider 注册一个 file input click trigger。store 的 chooseVideo
// action 直接调用它，无需通过 React ref。
let browserFileInputTrigger: (() => void) | null = null;

export function registerBrowserFileInputTrigger(fn: () => void) {
  browserFileInputTrigger = fn;
}

// 当前后台任务的取消控制器。null 表示没有可取消任务。
// 不放进 store state 是因为 AbortController 是非可序列化对象，
// 而 store 只跟踪 canCancelTask 这个布尔。
let currentTaskAbort: AbortController | null = null;

// ---------------------------------------------------------------------------
// State + Actions interface
// ---------------------------------------------------------------------------
export interface StoreState {
  desktopApi: SpriteDesktopApi | null;
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
  canCancelTask: boolean;
}

export interface StoreActions {
  // simple setters
  setLocalPath: (path: string) => void;
  setSelectedFile: (file: File | null) => void;
  setSettings: (fn: (prev: ProcessSettings) => ProcessSettings) => void;
  setSampleTime: (time: number) => void;
  setSheetColumns: (cols: number) => void;
  setVideoDurationMs: (ms: number) => void;
  setExportCompression: (fn: (prev: ExportCompressionSettings) => ExportCompressionSettings) => void;
  setSelectedFrameIndices: (
    indices: number[] | ((prev: number[]) => number[]),
  ) => void;
  setPreviewBackgroundMode: (mode: StoreState["previewBackgroundMode"]) => void;
  setPreviewBackgroundColor: (color: string) => void;
  setProcessPreviewZoom: (zoom: number) => void;
  setProcessPreviewPan: (pan: { x: number; y: number }) => void;
  setPreviewReverse: (reverse: boolean) => void;
  setPreviewPlaying: (playing: boolean) => void;
  setPreviewIntervalMs: (ms: number) => void;

  // async / complex actions
  chooseVideo: () => Promise<void>;
  chooseBrowserFile: (file: File | null) => void;
  importAnimationFiles: (files: File[]) => Promise<void>;
  importSourceFile: (file: File) => Promise<void>;
  registerPath: () => Promise<void>;
  runPreview: () => Promise<void>;
  runProcess: () => Promise<void>;
  rerunMatteForFrames: (indices: number[]) => Promise<void>;
  smartSelectFrames: (targetCount: number) => Promise<void>;
  runExport: () => Promise<void>;
  applyGreenToBlackPreview: () => Promise<void>;
  applySemitransparentToBlackPreview: () => Promise<void>;
  applySemitransparentToOpaquePreview: () => Promise<void>;
  saveCurrentPreview: () => Promise<void>;
  openPathTarget: (path: string) => Promise<void>;
  restartServer: () => Promise<void>;
  refreshRuntime: () => Promise<void>;
  readSelectedLog: (fileName?: string) => Promise<void>;
  openExportDir: () => Promise<void>;
  cancelCurrentTask: () => void;

  // bootstrap (called once by AppProvider)
  bootstrap: () => void;
}

export type Store = StoreState & StoreActions;

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------
export const useStore = create<Store>((set, get) => {
  // helpers used internally
  const getJobId = () => {
    const j = get().job;
    return j?.job_id || j?.id || "";
  };
  const getPreviewId = () => {
    const p = get().preview;
    return p?.preview_id || p?.id || "";
  };
  const getSourceDuration = () => {
    const u = get().upload;
    return typeof u?.duration === "number" && u.duration > 0 ? u.duration : null;
  };

  // After job changes, automatically select all frames. Mirrors the original
  // `useEffect(() => { ... }, [job])` behaviour.
  function syncSelectedFramesFromJob(job: JobInfo | null) {
    if (job?.frames) {
      set({ selectedFrameIndices: job.frames.map((f) => f.index) });
    } else {
      set({ selectedFrameIndices: [] });
    }
  }

  // The long-running batch task launcher with abort support.
  async function startAndTrackProcess(s: ProcessSettings) {
    const started = await startProcessVideo(s);
    const task = started.task;
    set({
      operationLabel: task.label || "批量处理素材",
      operationProgress: normalizeProgress(task.progress, 10),
      taskLogs: task.logs ?? [],
      message: task.message || "批量处理任务已启动。",
    });

    const controller = new AbortController();
    currentTaskAbort = controller;
    set({ canCancelTask: true });
    try {
      return await waitForTaskResult<JobInfo>(task.task_id, {
        signal: controller.signal,
        onProgress: (t) => {
          set({
            operationLabel: t.label || "处理中",
            operationProgress: normalizeProgress(t.progress, 0),
            taskLogs: t.logs ?? [],
            message: t.message,
          });
        },
      });
    } finally {
      set({ canCancelTask: false });
      if (currentTaskAbort === controller) currentTaskAbort = null;
    }
  }

  return {
    // ----- state defaults -----
    desktopApi: getDesktopApi() as SpriteDesktopApi | null,
    runtime: null,
    version: "未知",
    localPath: "",
    selectedFile: null,
    upload: null,
    sourcePreviewUrl: "",
    modelStatuses: [],
    modelCacheDir: "",
    settings: createDefaultSettings(),
    sampleTime: 0,
    sheetColumns: 4,
    videoDurationMs: 100,
    preview: null,
    job: null,
    exportResult: null,
    exportCompression: createDefaultExportCompression(),
    logFiles: [],
    selectedLog: "",
    logText: "",
    message: "准备就绪",
    busy: false,
    selectedFrameIndices: [],
    previewBackgroundMode: "checker",
    previewBackgroundColor: "#101827",
    processPreviewZoom: 1,
    processPreviewPan: { x: 0, y: 0 },
    previewReverse: false,
    previewPlaying: false,
    previewIntervalMs: 100,
    operationLabel: "准备就绪",
    operationProgress: null,
    taskLogs: [],
    canCancelTask: false,

    // ----- simple setters -----
    setLocalPath: (path) => set({ localPath: path }),
    setSelectedFile: (file) => set({ selectedFile: file }),
    setSettings: (fn) => set({ settings: fn(get().settings) }),
    setSampleTime: (time) => set({ sampleTime: time }),
    setSheetColumns: (cols) => set({ sheetColumns: cols }),
    setVideoDurationMs: (ms) => set({ videoDurationMs: ms }),
    setExportCompression: (fn) => set({ exportCompression: fn(get().exportCompression) }),
    setSelectedFrameIndices: (next) =>
      set({
        selectedFrameIndices:
          typeof next === "function" ? (next as (p: number[]) => number[])(get().selectedFrameIndices) : next,
      }),
    setPreviewBackgroundMode: (mode) => set({ previewBackgroundMode: mode }),
    setPreviewBackgroundColor: (color) => set({ previewBackgroundColor: color }),
    setProcessPreviewZoom: (zoom) => set({ processPreviewZoom: zoom }),
    setProcessPreviewPan: (pan) => set({ processPreviewPan: pan }),
    setPreviewReverse: (reverse) => set({ previewReverse: reverse }),
    setPreviewPlaying: (playing) => set({ previewPlaying: playing }),
    setPreviewIntervalMs: (ms) => set({ previewIntervalMs: ms }),

    cancelCurrentTask: () => {
      if (currentTaskAbort && !currentTaskAbort.signal.aborted) {
        currentTaskAbort.abort();
      }
    },

    // ----- file picker -----
    chooseVideo: async () => {
      const { desktopApi } = get();
      if (!desktopApi) {
        browserFileInputTrigger?.();
        return;
      }
      const picked = await desktopApi.chooseVideo();
      if (picked) set({ selectedFile: null, localPath: picked });
    },

    chooseBrowserFile: (file) => {
      set({ selectedFile: file });
      if (file) set({ localPath: file.name });
    },

    // ----- import -----
    importAnimationFiles: async (files) => {
      const imageFiles = files.filter(
        (file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name),
      );
      if (imageFiles.length === 0) {
        set({ message: "请选择图片帧。 " });
        return;
      }
      set({ busy: true, operationLabel: "导入动画帧", operationProgress: 20 });
      try {
        const result = await importAnimationFrames(
          [...imageFiles].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        );
        set({
          operationProgress: 100,
          job: result.job,
          upload: null,
          sourcePreviewUrl: "",
          preview: null,
          exportResult: null,
          message: `已导入动画帧：${result.job.frame_count ?? result.job.frames?.length ?? 0} 帧。`,
        });
        syncSelectedFramesFromJob(result.job);
      } catch (e) {
        set({ operationProgress: 100, message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    importSourceFile: async (file) => {
      set({ selectedFile: file, localPath: file.name });
      set({ busy: true, operationLabel: "导入素材", operationProgress: 20 });
      try {
        const result = await uploadFile(file);
        set({
          operationProgress: 100,
          upload: result.upload,
          sourcePreviewUrl: result.upload.url || "",
          settings: {
            ...get().settings,
            upload_id: result.upload.id,
            end_time:
              result.upload.duration && result.upload.duration > 0
                ? result.upload.duration
                : get().settings.end_time,
          },
          preview: null,
          job: null,
          exportResult: null,
          message: `已导入素材：${result.upload.name || result.upload.id}`,
        });
        syncSelectedFramesFromJob(null);
        if (result.upload.duration && result.upload.duration > 0) {
          set({ sampleTime: Math.min(result.upload.duration / 2, 1) });
        }
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    registerPath: async () => {
      const { selectedFile, localPath } = get();
      if (!selectedFile && !localPath.trim()) {
        set({ message: "请先选择或输入素材路径。" });
        return;
      }
      if (selectedFile) {
        await get().importSourceFile(selectedFile);
        return;
      }
      set({ busy: true, operationLabel: "导入素材", operationProgress: 20 });
      try {
        const result = await importPath(localPath.trim());
        set({
          operationProgress: 100,
          upload: result.upload,
          sourcePreviewUrl: result.upload.url || "",
          settings: {
            ...get().settings,
            upload_id: result.upload.id,
            end_time:
              result.upload.duration && result.upload.duration > 0
                ? result.upload.duration
                : get().settings.end_time,
          },
          preview: null,
          job: null,
          exportResult: null,
          message: `已导入素材：${result.upload.name || result.upload.id}`,
        });
        syncSelectedFramesFromJob(null);
        if (result.upload.duration && result.upload.duration > 0) {
          set({ sampleTime: Math.min(result.upload.duration / 2, 1) });
        }
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    // ----- preview / process -----
    runPreview: async () => {
      const { settings, sampleTime } = get();
      if (!settings.upload_id) {
        set({ message: "请先导入素材。" });
        return;
      }
      set({ busy: true, operationLabel: "生成单帧预览", operationProgress: 35 });
      try {
        const sd = getSourceDuration();
        const t = sd === null ? Math.max(0, sampleTime) : Math.min(Math.max(0, sampleTime), sd);
        set({ sampleTime: t, operationProgress: 70 });
        const result = await previewFrame({ ...settings, sample_time: t });
        set({ preview: result.preview, operationProgress: 100, message: "单帧预览已生成。" });
      } catch (e) {
        set({ operationProgress: 100, message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    runProcess: async () => {
      const { settings } = get();
      if (!settings.upload_id) {
        set({ message: "请先导入素材。" });
        return;
      }
      set({ busy: true, taskLogs: [], operationLabel: "批量处理素材", operationProgress: 12 });
      try {
        const s: ProcessSettings = {
          ...settings,
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
        set({ settings: s, operationLabel: "启动批量处理任务", operationProgress: 10 });
        const nextJob = await startAndTrackProcess(s);
        set({
          operationLabel: "整理处理结果",
          operationProgress: 96,
          job: nextJob,
          exportResult: null,
          message: `批处理完成：${nextJob.frame_count ?? nextJob.frames?.length ?? 0} 帧。`,
        });
        syncSelectedFramesFromJob(nextJob);
        getModelStatus()
          .then((r) => set({ modelStatuses: r.models, modelCacheDir: r.cache_dir }))
          .catch(() => undefined);
        set({ operationProgress: 100 });
      } catch (e) {
        let msg: string;
        if (e instanceof TaskCancelledError) msg = "批处理已取消。";
        else if (e instanceof TaskTimeoutError) msg = `批处理超时：${e.message}`;
        else if (e instanceof TaskStallError) msg = `批处理停滞：${e.message}（可重启 Python 服务后重试）`;
        else msg = e instanceof Error ? e.message : String(e);
        set({ operationProgress: 100, message: msg });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    rerunMatteForFrames: async (indices) => {
      const jobId = getJobId();
      const validIndices = Array.from(new Set(indices.filter((index) => Number.isFinite(index)))).sort((a, b) => a - b);
      if (!jobId || validIndices.length === 0) {
        set({ message: "请先选择需要重新去底的帧。" });
        return;
      }
      set({ busy: true, taskLogs: [], operationLabel: "重新去底帧", operationProgress: 20 });
      try {
        const { settings } = get();
        const result = await rematteJobFrames(jobId, validIndices, settings);
        set({
          operationProgress: 100,
          job: result.job,
          exportResult: null,
          message: `已重新去底 ${validIndices.length} 帧。`,
        });
        const nextFrameSet = new Set(result.job.frames?.map((frame) => frame.index) || []);
        set({
          selectedFrameIndices: get().selectedFrameIndices.filter((index) => nextFrameSet.has(index)),
        });
      } catch (e) {
        set({ operationProgress: 100, message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    smartSelectFrames: async (targetCount) => {
      const jobId = getJobId();
      if (!jobId) {
        set({ message: "请先完成批处理。" });
        return;
      }
      set({ busy: true, operationLabel: "智能选帧", operationProgress: 35 });
      try {
        const result = await smartSelectJobFrames(jobId, Math.max(1, Math.round(targetCount)));
        set({
          selectedFrameIndices: result.selected_indices,
          operationProgress: 100,
          message: `智能选帧完成：从 ${result.frame_count} 帧中选出 ${result.selected_indices.length} 帧。`,
        });
      } catch (e) {
        set({ operationProgress: 100, message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    runExport: async () => {
      const jobId = getJobId();
      const { selectedFrameIndices, sheetColumns, videoDurationMs, previewReverse, exportCompression } = get();
      if (!jobId || selectedFrameIndices.length === 0) {
        set({ message: "请先完成批处理。" });
        return;
      }
      set({ busy: true, operationLabel: "导出资源包", operationProgress: 24 });
      try {
        const cols = Math.max(1, Math.round(sheetColumns));
        const dur = Math.max(20, Math.round(videoDurationMs));
        set({ sheetColumns: cols, videoDurationMs: dur, operationProgress: 62 });
        const indices = previewReverse ? [...selectedFrameIndices].reverse() : selectedFrameIndices;
        const result = await exportJob(jobId, indices, cols, dur, exportCompression);
        set({
          operationProgress: 100,
          exportResult: result.export,
          message: `导出完成：${result.export.frame_count ?? selectedFrameIndices.length} 帧。`,
        });
      } catch (e) {
        set({ operationProgress: 100, message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false, operationLabel: "准备就绪" });
      }
    },

    // ----- preview alpha tweaks -----
    applyGreenToBlackPreview: async () => {
      const previewId = getPreviewId();
      if (!previewId) {
        set({ message: "请先生成单帧预览。" });
        return;
      }
      set({ busy: true });
      try {
        const result = await previewGreenToBlack(previewId);
        set({ preview: result.preview, message: "已对当前预览执行残绿涂黑。" });
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    applySemitransparentToBlackPreview: async () => {
      const previewId = getPreviewId();
      if (!previewId) {
        set({ message: "请先生成单帧预览。" });
        return;
      }
      set({ busy: true });
      try {
        const result = await previewSemitransparentToBlack(previewId);
        set({ preview: result.preview, message: "已对当前预览执行半透明涂黑。" });
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    applySemitransparentToOpaquePreview: async () => {
      const previewId = getPreviewId();
      if (!previewId) {
        set({ message: "请先生成单帧预览。" });
        return;
      }
      set({ busy: true });
      try {
        const result = await previewSemitransparentToOpaque(previewId);
        set({ preview: result.preview, message: "已对当前预览执行半透明变不透明。" });
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    saveCurrentPreview: async () => {
      const previewId = getPreviewId();
      if (!previewId) {
        set({ message: "请先生成单帧预览。" });
        return;
      }
      set({ busy: true });
      try {
        const result = await savePreview(previewId);
        set({ job: result.job, exportResult: null, message: "当前预览已保存为可导出的帧。" });
        syncSelectedFramesFromJob(result.job);
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    // ----- runtime / logs -----
    openPathTarget: async (path) => {
      if (!path) {
        set({ message: "没有目录可打开。" });
        return;
      }
      const { desktopApi } = get();
      if (desktopApi) await desktopApi.openPath(path);
      else await openPath(path);
    },

    restartServer: async () => {
      const { desktopApi } = get();
      if (!desktopApi) return;
      set({ busy: true });
      try {
        const next = await desktopApi.restartServer();
        set({
          runtime: next,
          message: next.serverRunning ? "Python 服务已重启。" : "已请求重启，但服务暂未就绪。",
        });
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    refreshRuntime: async () => {
      const { desktopApi } = get();
      if (!desktopApi) {
        try {
          const r = await getAppVersion();
          const s = await getModelStatus();
          set({ version: r.version, modelStatuses: s.models, modelCacheDir: s.cache_dir, message: "浏览器模式 API 连接正常。" });
        } catch (e) {
          set({ version: "Python 服务未连接", message: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      const next = await desktopApi.getRuntimeStatus();
      const s = await getModelStatus();
      const files = await desktopApi.listLogs();
      set({
        runtime: next,
        modelStatuses: s.models,
        modelCacheDir: s.cache_dir,
        logFiles: files,
        selectedLog: get().selectedLog || files[0] || "",
        message: "运行时状态已刷新。",
      });
      if (files.length === 0) set({ logText: "" });
    },

    readSelectedLog: async (fileName) => {
      const { desktopApi } = get();
      const target = fileName ?? get().selectedLog;
      if (!desktopApi || !target) {
        set({ message: "没有可读取的日志文件。" });
        return;
      }
      const text = await desktopApi.readLog(target, 160);
      set({ selectedLog: target, logText: text });
    },

    openExportDir: async () => {
      const { exportResult } = get();
      if (!exportResult?.output_dir) {
        set({ message: "没有导出目录可打开。" });
        return;
      }
      try {
        await get().openPathTarget(exportResult.output_dir);
      } catch (e) {
        set({ message: e instanceof Error ? e.message : String(e) });
      }
    },

    // ----- bootstrap (called once) -----
    bootstrap: () => {
      getAppVersion()
        .then((r) => set({ version: r.version }))
        .catch(() => set({ version: "Python 服务未连接" }));
      getModelStatus()
        .then((r) => set({ modelStatuses: r.models, modelCacheDir: r.cache_dir }))
        .catch(() => set({ modelStatuses: [], modelCacheDir: "" }));
      const desktopApi = get().desktopApi;
      desktopApi?.getRuntimeStatus().then((rt) => set({ runtime: rt })).catch(() => set({ runtime: null }));
      desktopApi
        ?.listLogs()
        .then((files) => {
          set({ logFiles: files, selectedLog: get().selectedLog || files[0] || "" });
        })
        .catch(() => set({ logFiles: [] }));
    },
  };
});
