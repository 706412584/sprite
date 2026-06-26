"""Background task registry: progress updates, threaded execution, polling.

Single source of truth for the in-process TASKS dict + lock. The original
server.py used module-level globals; we keep that semantic but put them
in one well-defined module so callers in routes/* can import them safely.
"""
from __future__ import annotations

import threading
from datetime import datetime

from ..utils.json_io import iso_now, timestamped_id
from ..validation.types import clamp_int

TASKS: dict[str, dict] = {}
TASKS_LOCK = threading.Lock()


def append_task_log(task_id: str, message: str) -> None:
    if not task_id:
        return
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if not task:
            return
        logs = task.setdefault("logs", [])
        logs.append(f"[{datetime.now():%H:%M:%S}] {message}")
        if len(logs) > 200:
            del logs[:-200]
        task["updated_at"] = iso_now()


def update_task_progress(task_id: str, progress: int, message: str) -> None:
    if not task_id:
        return
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if not task or task.get("status") != "running":
            return
        task["progress"] = clamp_int(progress, 0, 99)
        task["message"] = message
        logs = task.setdefault("logs", [])
        logs.append(f"[{datetime.now():%H:%M:%S}] {message}")
        if len(logs) > 200:
            del logs[:-200]
        task["updated_at"] = iso_now()


def task_progress_payload(task_id: str) -> dict:
    with TASKS_LOCK:
        task = TASKS.get(task_id)
        if not task:
            raise FileNotFoundError(f"task not found: {task_id}")
        payload = dict(task)
        payload["logs"] = list(task.get("logs") or [])
        return payload


def run_background_task(label: str, target, *args, **kwargs) -> dict:
    task_id = timestamped_id()
    start_message = f"{label}已开始。"
    with TASKS_LOCK:
        TASKS[task_id] = {
            "task_id": task_id,
            "label": label,
            "status": "running",
            "progress": 5,
            "message": start_message,
            "logs": [f"[{datetime.now():%H:%M:%S}] {start_message}"],
            "result": None,
            "error": None,
            "created_at": iso_now(),
            "updated_at": iso_now(),
        }

    def worker() -> None:
        # 兜底：worker 线程绝不把异常抛回解释器，避免拖垮其它线程/主进程。
        try:
            update_task_progress(task_id, 10, f"{label}处理中。")
            try:
                if "task_id" not in kwargs:
                    kwargs["task_id"] = task_id
                result = target(*args, **kwargs)
                append_task_log(task_id, f"{label}已完成。")
                with TASKS_LOCK:
                    task = TASKS[task_id]
                    task.update({
                        "status": "completed",
                        "progress": 100,
                        "message": f"{label}已完成。",
                        "result": result,
                        "updated_at": iso_now(),
                    })
            except Exception as exc:
                try:
                    append_task_log(task_id, f"{label}失败：{exc}")
                except Exception:
                    pass
                with TASKS_LOCK:
                    task = TASKS.get(task_id)
                    if task is not None:
                        task.update({
                            "status": "failed",
                            "progress": 100,
                            "message": f"{label}失败。",
                            "error": str(exc),
                            "updated_at": iso_now(),
                        })
        except BaseException:
            # 连失败处理本身都出错时的最后一道防线：尽量把任务标记为失败，绝不向外抛。
            try:
                with TASKS_LOCK:
                    task = TASKS.get(task_id)
                    if task is not None and task.get("status") == "running":
                        task.update({
                            "status": "failed",
                            "progress": 100,
                            "message": f"{label}异常终止。",
                            "error": "internal error",
                            "updated_at": iso_now(),
                        })
            except Exception:
                pass

    threading.Thread(target=worker, daemon=True).start()
    return task_progress_payload(task_id)
