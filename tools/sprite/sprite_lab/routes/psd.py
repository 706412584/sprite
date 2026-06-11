"""PSD 分层解析路由：把 Photoshop 分层立绘一比一拆成部件。

每个像素图层导出贴合自身 bbox 的透明 PNG + 在画布上的绝对坐标（offset），
形态与 /api/human-parse 的 part 一致，额外带 canvasWidth/canvasHeight 供前端一比一还原。
"""
from __future__ import annotations

import base64
import re
from io import BytesIO
from pathlib import Path

from .registry import post

# 名称规范化成 atlas / 文件系统安全的 ASCII 名（与前端 safeName 对齐）。
_SAFE_RE = re.compile(r"[^a-zA-Z0-9_-]+")
# 过小的图层（噪点 / 空层）跳过。
_MIN_SIDE = 2
_MIN_AREA = 16


def _safe_name(raw: str, fallback: str) -> str:
    cleaned = _SAFE_RE.sub("_", raw or "").strip("_")
    return cleaned or fallback


def _resolve_psd_bytes(payload: dict) -> bytes:
    """从 payload 取 PSD 二进制：优先本地路径，其次 base64 data url。"""
    raw_path = str(payload.get("psd_path") or "").strip().strip("\"'")
    if raw_path:
        path = Path(raw_path)
        if not path.is_file():
            raise ValueError(f"PSD 文件不存在：{raw_path}")
        if path.suffix.lower() not in (".psd", ".psb"):
            raise ValueError("仅支持 .psd / .psb 文件")
        return path.read_bytes()

    data_url = str(payload.get("psd_data_url") or "").strip()
    if data_url:
        body = data_url
        if body.startswith("data:"):
            comma = body.find(",")
            if comma < 0:
                raise ValueError("invalid psd data url")
            body = body[comma + 1:]
        return base64.b64decode(body)

    raise ValueError("需要 psd_path 或 psd_data_url")


def _layer_to_part(layer, canvas_w: int, canvas_h: int, used: set[str]) -> dict | None:
    """把单个像素图层导出成 part 字典（贴合 bbox 的透明 PNG + 绝对坐标）。"""
    composite = layer.composite()
    if composite is None:
        return None
    if composite.mode != "RGBA":
        composite = composite.convert("RGBA")
    width, height = composite.size
    if width < _MIN_SIDE or height < _MIN_SIDE or width * height < _MIN_AREA:
        return None

    left, top = layer.offset  # 该层左上角在画布的绝对像素坐标

    # 重名加后缀，保证部件名唯一（atlas / 槽位绑定按 name 索引）。
    base = _safe_name(layer.name, "layer")
    name = base
    suffix = 2
    while name in used:
        name = f"{base}_{suffix}"
        suffix += 1
    used.add(name)

    buffer = BytesIO()
    composite.save(buffer, format="PNG")
    png_data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    return {
        "name": name,
        "displayName": layer.name or name,
        "bbox": {"x": int(left), "y": int(top), "w": int(width), "h": int(height)},
        "pngDataUrl": png_data_url,
        "width": int(width),
        "height": int(height),
        "opacity": int(getattr(layer, "opacity", 255)),
        "visible": bool(getattr(layer, "visible", True)),
        "canvasWidth": int(canvas_w),
        "canvasHeight": int(canvas_h),
    }


def _walk_layers(layers, canvas_w: int, canvas_h: int, used: set[str], parts: list[dict]) -> None:
    """深度遍历图层树，分组只下钻不输出，像素层导出为 part。"""
    for layer in layers:
        if layer.is_group():
            _walk_layers(layer, canvas_w, canvas_h, used, parts)
            continue
        part = _layer_to_part(layer, canvas_w, canvas_h, used)
        if part is not None:
            parts.append(part)


def psd_split_parts(psd_bytes: bytes) -> dict:
    """解析 PSD → 部件列表（含画布尺寸，供一比一还原）。返回 {parts, width, height}。"""
    from psd_tools import PSDImage

    psd = PSDImage.open(BytesIO(psd_bytes))
    canvas_w, canvas_h = psd.width, psd.height
    parts: list[dict] = []
    used: set[str] = set()
    _walk_layers(psd, canvas_w, canvas_h, used, parts)

    return {
        "parts": parts,
        "width": int(canvas_w),
        "height": int(canvas_h),
    }


@post("/api/psd-split")
def psd_split(http, _parsed) -> None:
    payload = http.read_json_body()
    psd_bytes = _resolve_psd_bytes(payload)
    result = psd_split_parts(psd_bytes)
    http.send_json({"ok": True, **result})
