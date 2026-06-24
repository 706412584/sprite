// 通用任务轮询：带超时、进度停滞检测、AbortSignal 取消。
// 原 AppContext.tsx 内的死循环 for(;;) 在服务端任务卡死时会让前端永远 busy=true，
// 这里把所有终止条件集中到一个工具里，让上层 action 可以放心使用。

import { getTaskProgress } from "@/api/spriteApi";
import type { TaskProgressInfo } from "@/types/sprite";

export interface WaitForTaskOptions<T> {
  /** 整体超时上限。默认 10 分钟，超过即抛 TaskTimeoutError。 */
  timeoutMs?: number;
  /** 轮询间隔。默认 800ms。 */
  pollIntervalMs?: number;
  /** 进度无变化的最大允许时长。默认 60 秒。设为 0 关闭检测。 */
  stallTimeoutMs?: number;
  /** 每次拿到新进度时回调，UI 用来更新 label/progress/logs。 */
  onProgress?: (task: TaskProgressInfo<T>) => void;
  /** 外部取消信号。abort 后会抛 TaskCancelledError 并停止轮询。 */
  signal?: AbortSignal;
}

export class TaskTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskTimeoutError";
  }
}

export class TaskCancelledError extends Error {
  constructor(message = "任务已取消") {
    super(message);
    this.name = "TaskCancelledError";
  }
}

export class TaskStallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskStallError";
  }
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_POLL_MS = 800;
const DEFAULT_STALL_MS = 60 * 1000;

/**
 * 轮询服务端任务直到 completed/failed/超时/停滞/取消。
 *
 * 返回 task.result（已确保非 null）。
 * 失败时抛带语义化 name 的 Error，调用方可以用 instanceof 区分。
 */
export async function waitForTaskResult<T>(taskId: string, opts: WaitForTaskOptions<T> = {}): Promise<T> {
  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const stallMs = opts.stallTimeoutMs ?? DEFAULT_STALL_MS;

  let lastProgress = -1;
  let lastChangeAt = startedAt;

  // 立即响应外部 abort，无需等到下一次 poll。
  if (opts.signal?.aborted) throw new TaskCancelledError();

  while (true) {
    if (opts.signal?.aborted) throw new TaskCancelledError();

    const elapsed = Date.now() - startedAt;
    if (elapsed > timeoutMs) {
      throw new TaskTimeoutError(`任务超时（>${Math.round(timeoutMs / 1000)} 秒）`);
    }

    const { task } = await getTaskProgress<T>(taskId);
    opts.onProgress?.(task);

    if (task.status === "completed") {
      if (task.result === null || task.result === undefined) {
        throw new Error("任务完成但没有返回结果。");
      }
      return task.result;
    }
    if (task.status === "failed") {
      throw new Error(task.error || task.message || "任务失败");
    }

    // 停滞检测：进度数值不变达到 stallMs 即视为卡死。
    if (stallMs > 0) {
      if (task.progress !== lastProgress) {
        lastProgress = task.progress;
        lastChangeAt = Date.now();
      } else if (Date.now() - lastChangeAt > stallMs) {
        throw new TaskStallError(`任务停滞（${Math.round(stallMs / 1000)} 秒无进度变化）`);
      }
    }

    // 轮询间隙也响应取消，避免最后一次 sleep 浪费时间。
    await sleepAbortable(pollMs, opts.signal);
  }
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new TaskCancelledError());
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new TaskCancelledError());
    };
    function cleanup() {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
