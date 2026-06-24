"""Sprite Video Lab — MCP server.

A thin Model Context Protocol wrapper over the local Sprite Video Lab HTTP API
(server.py). It does not re-implement any image logic: every tool forwards to
the running HTTP backend, which already normalizes parameters and applies
defaults. Start the backend first (`python server.py`, default port 8894).

Transport: stdio (the standard for local MCP servers).

Environment:
    SPRITE_VIDEO_LAB_API_BASE  Override the backend base URL.
                               Defaults to http://127.0.0.1:8894.
    SPRITE_VIDEO_LAB_PORT      Used to build the default base URL if API_BASE
                               is not set (defaults to 8894).

Run:
    python sprite_mcp_server.py
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_PORT = int(os.environ.get("SPRITE_VIDEO_LAB_PORT", "8894") or "8894")
API_BASE = (
    os.environ.get("SPRITE_VIDEO_LAB_API_BASE")
    or f"http://127.0.0.1:{DEFAULT_PORT}"
).rstrip("/")

# Cap how much of a base64 data: URL we ever surface to the model. These blobs
# (PSD layers, pose masks) can be megabytes and would blow the context budget.
_DATA_URL_KEEP = 96

mcp = FastMCP("sprite-video-lab")


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only)
# ---------------------------------------------------------------------------
class ApiError(RuntimeError):
    """Raised when the backend returns ok=false or a non-2xx status."""


def _request(method: str, path: str, body: dict | None = None, timeout: float = 120.0) -> dict:
    url = path if path.startswith("http") else f"{API_BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:  # 4xx/5xx still carry a JSON body
        raw = exc.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            raise ApiError(f"HTTP {exc.code} from {path}: {raw[:300]}") from exc
        raise ApiError(payload.get("error") or f"HTTP {exc.code} from {path}")
    except urllib.error.URLError as exc:
        raise ApiError(
            f"无法连接后端 {API_BASE}（请先启动 server.py）：{exc.reason}"
        ) from exc
    payload = json.loads(raw)
    if isinstance(payload, dict) and payload.get("ok") is False:
        raise ApiError(payload.get("error") or f"请求失败：{path}")
    return payload


def _get(path: str, timeout: float = 30.0) -> dict:
    return _request("GET", path, None, timeout)


def _post(path: str, body: dict, timeout: float = 600.0) -> dict:
    return _request("POST", path, body, timeout)


def _abs_url(value: Any) -> Any:
    """Turn a work-relative URL (/work/...) into an absolute one for the caller."""
    if isinstance(value, str) and value.startswith("/"):
        return f"{API_BASE}{value}"
    return value


def _trim(obj: Any) -> Any:
    """Recursively shrink huge base64 data: URLs so responses stay small."""
    if isinstance(obj, dict):
        return {k: _trim(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_trim(v) for v in obj]
    if isinstance(obj, str) and obj.startswith("data:") and len(obj) > _DATA_URL_KEEP:
        return f"{obj[:_DATA_URL_KEEP]}…<{len(obj)} bytes data-url omitted>"
    return obj


# ---------------------------------------------------------------------------
# Tools — discovery / environment
# ---------------------------------------------------------------------------
@mcp.tool()
def health_check() -> dict:
    """检查 Sprite Video Lab 后端是否在线，并返回版本与运行环境概况。

    返回后端版本、AI/ffmpeg/依赖检测结果（all_ok 表示核心环境就绪）。
    在调用其它工具前先确认后端可达。
    """
    version = _get("/api/app-version")
    # First env probe can be slow (torch import + ffmpeg -version), so allow more time.
    env = _get("/api/env/check", timeout=120.0)
    return {
        "api_base": API_BASE,
        "online": True,
        "version": version.get("version"),
        "env_all_ok": env.get("all_ok"),
        "torch_device": env.get("torch_device"),
        "missing_packages": [p["name"] for p in env.get("packages", []) if not p.get("ok")],
        "ffmpeg_ok": all(f.get("ok") for f in env.get("ffmpeg", [])) if env.get("ffmpeg") else False,
    }


@mcp.tool()
def list_models() -> dict:
    """列出可用的 AI 抠图模型（BiRefNet 等）及其缓存/加载状态。"""
    return _trim(_get("/api/models/status"))


# ---------------------------------------------------------------------------
# Tools — import
# ---------------------------------------------------------------------------
@mcp.tool()
def import_media(path: str) -> dict:
    """从本地路径导入素材（视频、单张图片）。

    path: 服务器本机可访问的绝对路径。
    返回 upload_id，以及尺寸/时长/帧率等信息，供后续预览、处理使用。
    """
    result = _post("/api/import-path", {"path": path})
    up = result.get("upload", {})
    return {
        "upload_id": up.get("id") or up.get("upload_id"),
        "name": up.get("name") or up.get("display_name"),
        "media_type": up.get("media_type"),
        "width": up.get("width"),
        "height": up.get("height"),
        "duration": up.get("duration"),
        "fps": up.get("fps"),
        "url": _abs_url(up.get("url") or up.get("media_url")),
    }


@mcp.tool()
def split_psd(path: str, only_visible: bool = True) -> dict:
    """把 Photoshop 分层立绘 (PSD) 按图层拆成部件，保留每层画布坐标。

    path: PSD 文件的本地绝对路径。
    only_visible: 仅导出可见图层。
    返回每个部件的名称、bbox、尺寸（base64 图像数据已省略以控制体积）。
    """
    result = _post("/api/psd-split", {"psd_path": path, "only_visible": only_visible})
    parts = [
        {
            "name": p.get("name"),
            "displayName": p.get("displayName"),
            "bbox": p.get("bbox"),
            "width": p.get("width"),
            "height": p.get("height"),
            "opacity": p.get("opacity"),
            "visible": p.get("visible"),
        }
        for p in result.get("parts", [])
    ]
    return {
        "width": result.get("width"),
        "height": result.get("height"),
        "part_count": len(parts),
        "parts": parts,
        "filtered": result.get("filtered"),
    }


# ---------------------------------------------------------------------------
# Tools — preview / process / export (the core pipeline)
# ---------------------------------------------------------------------------
def _job_summary(job: dict) -> dict:
    frames = job.get("frames") or []
    return {
        "job_id": job.get("id") or job.get("job_id"),
        "upload_id": job.get("upload_id"),
        "frame_count": job.get("frame_count") or len(frames),
        "source_media_type": job.get("source_media_type"),
        "frames": [
            {
                "index": f.get("index"),
                "name": f.get("name"),
                "url": _abs_url(f.get("url")),
                "width": f.get("width"),
                "height": f.get("height"),
            }
            for f in frames[:12]
        ],
        "frames_truncated": max(0, len(frames) - 12),
    }


@mcp.tool()
def preview_frame(upload_id: str, sample_time: float = 0.0, settings: dict | None = None) -> dict:
    """对单帧预览去底/抠图效果（不批量处理），用于调参。

    upload_id: import_media 返回的 ID。
    sample_time: 视频取样时间（秒），图片忽略。
    settings: 可选的处理参数对象，未提供的字段后端自动取默认值。常用键：
        matte_mode ('chroma'|'birefnet'|'luma'|'birefnet_luma'|'none' 等),
        matte_pipeline (原子模式数组), target_size, canvas_mode
        ('auto'|'square_bottom'|'square_center'), key_mode ('auto'|'manual'),
        manual_key_hex, threshold, softness, ai_model, ai_device, luma_* 等。
    返回处理前后图像的 URL 与识别到的 key_color。
    """
    body = {"upload_id": upload_id, "sample_time": sample_time, **(settings or {})}
    result = _post("/api/preview-frame", body)
    p = result.get("preview", {})
    return {
        "preview_id": p.get("id") or p.get("preview_id"),
        "source_url": _abs_url(p.get("source_url")),
        "processed_url": _abs_url(p.get("processed_url")),
        "key_color": p.get("key_color"),
        "sample_time": p.get("sample_time"),
    }


@mcp.tool()
def process_video(
    upload_id: str,
    start_time: float = 0.0,
    end_time: float = 0.0,
    settings: dict | None = None,
    wait: bool = True,
    timeout_s: float = 600.0,
) -> dict:
    """批量抽帧并去底，生成透明序列帧任务 (job)。这是核心处理工具。

    upload_id: import_media 返回的 ID。
    start_time / end_time: 视频处理区间（秒）；end_time<=0 表示到结尾；图片忽略。
    settings: 同 preview_frame 的参数对象（keep_every 控制抽帧间隔等）。
    wait: True 时阻塞轮询直到任务完成再返回 job；False 立即返回 task_id，
          之后用 get_task 轮询。
    timeout_s: wait=True 时的最长等待秒数。
    返回 job 摘要（job_id + 帧列表，用于 smart_select / export_job）。
    """
    body = {
        "upload_id": upload_id,
        "start_time": start_time,
        "end_time": end_time,
        "async": True,
        **(settings or {}),
    }
    started = _post("/api/process", body)
    task = started.get("task", {})
    task_id = task.get("task_id")
    if not wait:
        return {"task_id": task_id, "status": task.get("status"), "label": task.get("label")}
    final = _wait_for_task(task_id, timeout_s)
    if final.get("status") != "completed":
        return {"task_id": task_id, "status": final.get("status"), "error": final.get("error"),
                "message": final.get("message")}
    return {"task_id": task_id, "status": "completed", "job": _job_summary(final.get("result") or {})}


def _wait_for_task(task_id: str, timeout_s: float, poll_s: float = 0.8) -> dict:
    deadline = time.monotonic() + timeout_s
    while True:
        task = _get(f"/api/tasks/{task_id}").get("task", {})
        if task.get("status") in ("completed", "failed"):
            return task
        if time.monotonic() > deadline:
            return {"status": "running", "message": f"等待超时（{timeout_s}s），任务仍在进行",
                    "task_id": task_id}
        time.sleep(poll_s)


@mcp.tool()
def get_task(task_id: str) -> dict:
    """查询异步任务进度（process_video(wait=False) 或模型下载等返回的 task_id）。"""
    task = _get(f"/api/tasks/{task_id}").get("task", {})
    out = {
        "task_id": task.get("task_id"),
        "label": task.get("label"),
        "status": task.get("status"),
        "progress": task.get("progress"),
        "message": task.get("message"),
        "error": task.get("error"),
    }
    if task.get("status") == "completed" and isinstance(task.get("result"), dict):
        result = task["result"]
        out["job"] = _job_summary(result) if result.get("frames") is not None else _trim(result)
    return out


@mcp.tool()
def smart_select_frames(job_id: str, target_count: int) -> dict:
    """从已处理 job 中智能挑选有代表性的若干帧（差异度采样）。

    返回建议保留的帧索引，可直接传给 export_job 的 selected_indices。
    """
    return _post("/api/job/smart-select", {"job_id": job_id, "target_count": target_count})


@mcp.tool()
def export_job(
    job_id: str,
    selected_indices: list[int] | None = None,
    sheet_columns: int = 0,
    video_duration_ms: int = 0,
    compression: dict | None = None,
) -> dict:
    """导出 job 结果为 PNG 序列帧、Sprite Sheet、zip 和 JSON manifest。

    job_id: process_video 生成的 job。
    selected_indices: 要导出的帧索引；空表示全部。
    sheet_columns: Sprite Sheet 列数；0 让后端自动决定。
    video_duration_ms: 用于 manifest/视频导出的总时长，0 表示自动。
    compression: 可选导出选项对象（include_sheet/include_zip/include_manifest/
        sheet_format 'png'|'webp'|'both' 等），缺省由后端取默认值。
    返回各产物的可访问 URL 与输出目录。
    """
    body = {
        "job_id": job_id,
        "selected_indices": selected_indices or [],
        "sheet_columns": sheet_columns,
        "video_duration_ms": video_duration_ms,
    }
    if compression is not None:
        body["compression"] = compression
    result = _post("/api/export", body)
    exp = result.get("export", {})
    return {
        "output_dir": exp.get("output_dir"),
        "frame_count": exp.get("frame_count"),
        "sheet_size": [exp.get("sheet_width"), exp.get("sheet_height")],
        "zip_url": _abs_url(exp.get("zip_url")),
        "sheet_url": _abs_url(exp.get("sheet_url")),
        "webp_sheet_url": _abs_url(exp.get("webp_sheet_url")),
        "video_url": _abs_url(exp.get("video_url")),
        "manifest_url": _abs_url(exp.get("manifest_url")),
    }


@mcp.tool()
def open_in_file_browser(path: str) -> dict:
    """在系统文件管理器中打开指定路径（例如导出目录 output_dir）。"""
    _post("/api/open-path", {"path": path})
    return {"opened": path}


# ---------------------------------------------------------------------------
# Tools — Aseprite integration (optional)
# ---------------------------------------------------------------------------
@mcp.tool()
def aseprite_status() -> dict:
    """检查 Aseprite 是否可用，返回版本信息。"""
    try:
        from sprite_lab.integrations.aseprite import is_available, get_version
        available = is_available()
        version = get_version() if available else None
        return {
            "available": available,
            "version": version,
            "path": os.environ.get("ASEPRITE_PATH", "aseprite"),
        }
    except ImportError:
        return {"available": False, "error": "Aseprite integration not installed"}


@mcp.tool()
def aseprite_export_sheet(
    input_files: list[str],
    output_path: str,
    columns: int = 0,
    pack: bool = True,
    trim: bool = False,
) -> dict:
    """使用 Aseprite 导出 sprite sheet（需要 Aseprite 安装）。

    input_files: 输入文件路径列表
    output_path: 输出文件路径
    columns: 列数（0=自动）
    pack: 使用 bin packing 算法
    trim: 裁剪透明边缘
    """
    try:
        from sprite_lab.integrations.aseprite import export_sprite_sheet, is_available
        if not is_available():
            return {"error": "Aseprite not available. Install Aseprite and set ASEPRITE_PATH."}
        return export_sprite_sheet(
            input_files=input_files,
            output_path=output_path,
            columns=columns,
            pack=pack,
            trim=trim,
        )
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def aseprite_batch_convert(
    input_dir: str,
    output_dir: str,
    output_format: str = "png",
) -> dict:
    """使用 Aseprite 批量转换格式（需要 Aseprite 安装）。

    input_dir: 输入目录
    output_dir: 输出目录
    output_format: 输出格式（png, gif, webp 等）
    """
    try:
        from sprite_lab.integrations.aseprite import batch_convert, is_available
        if not is_available():
            return {"error": "Aseprite not available. Install Aseprite and set ASEPRITE_PATH."}
        return batch_convert(
            input_dir=input_dir,
            output_dir=output_dir,
            output_format=output_format,
        )
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Heartbeat — lets the app's Runtime panel show MCP startup/liveness status.
# ---------------------------------------------------------------------------
_HEARTBEAT_INTERVAL_S = 10.0


def _send_heartbeat() -> None:
    try:
        _post(
            "/api/mcp/heartbeat",
            {
                "pid": os.getpid(),
                "tool_count": len(mcp._tool_manager.list_tools()),
                "api_base": API_BASE,
                "transport": "stdio",
            },
            timeout=5.0,
        )
    except Exception:
        # Backend may be down or starting; heartbeat is best-effort only.
        pass


def _start_heartbeat() -> None:
    """Fire an immediate heartbeat, then keep one going in a daemon thread."""
    _send_heartbeat()

    def loop() -> None:
        while True:
            time.sleep(_HEARTBEAT_INTERVAL_S)
            _send_heartbeat()

    threading.Thread(target=loop, name="mcp-heartbeat", daemon=True).start()


if __name__ == "__main__":
    _start_heartbeat()
    mcp.run()
