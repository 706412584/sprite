"""Input normalization: matte modes, model keys, devices, canvas modes, resolution.

All functions coerce loosely-typed request payloads into a known whitelist of
values, falling back to safe defaults.
"""
from __future__ import annotations

from ..config import (
    AI_MATTE_DEVICE_ALIASES,
    AI_MATTE_MAX_RESOLUTION,
    AI_MATTE_MIN_RESOLUTION,
    AI_MATTE_MODEL_REPOS,
    AI_MATTE_MODES,
    AI_MATTE_RESOLUTION_MULTIPLE,
    ATOMIC_KEYING_MODES,
    CANVAS_MODES,
    CORRIDORKEY_SCREEN_COLORS,
    DEFAULT_AI_MATTE_MODEL,
    DEFAULT_AI_MATTE_RESOLUTION,
)
from .types import safe_int


def normalize_ai_resolution(value) -> int:
    resolution = safe_int(value, DEFAULT_AI_MATTE_RESOLUTION)
    resolution = max(AI_MATTE_MIN_RESOLUTION, min(AI_MATTE_MAX_RESOLUTION, resolution))
    half_step = AI_MATTE_RESOLUTION_MULTIPLE // 2
    aligned = ((resolution + half_step) // AI_MATTE_RESOLUTION_MULTIPLE) * AI_MATTE_RESOLUTION_MULTIPLE
    return max(AI_MATTE_MIN_RESOLUTION, min(AI_MATTE_MAX_RESOLUTION, aligned))


def normalize_matte_mode(raw: str, chroma_enabled: bool) -> str:
    value = str(raw or "").strip().lower().replace("-", "_")
    aliases = {
        "": "chroma" if chroma_enabled else "none",
        "off": "none",
        "disabled": "none",
        "no": "none",
        "key": "chroma",
        "color": "chroma",
        "green": "chroma",
        "green_screen": "chroma",
        "greenscreen": "chroma",
        "green_key": "chroma",
        "chroma_key": "chroma",
        "spriteflow": "spriteflow",
        "sprite_flow": "spriteflow",
        "spriteflow_key": "spriteflow",
        "colorkey": "spriteflow",
        "color_key": "spriteflow",
        "ai": "birefnet",
        "birefnet": "birefnet",
        "corridor": "corridorkey",
        "corridor_key": "corridorkey",
        "corridorkey": "corridorkey",
        "luma": "luma",
        "luma_key": "luma",
        "luminance": "luma",
        "birefnet_corridor": "birefnet_corridorkey",
        "birefnet_corridor_key": "birefnet_corridorkey",
        "birefnet_corridorkey": "birefnet_corridorkey",
        "birefnet+corridor": "birefnet_corridorkey",
        "birefnet+corridorkey": "birefnet_corridorkey",
        "birefnet_luma": "birefnet_luma",
        "birefnet+luma": "birefnet_luma",
        "birefnet_luma_corridorkey": "birefnet_luma_corridorkey",
        "birefnet_luma_corridor": "birefnet_luma_corridorkey",
        "birefnet_luma_corridor_key": "birefnet_luma_corridorkey",
        "birefnet_corridorkey_luma": "birefnet_luma_corridorkey",
        "birefnet_corridor_luma": "birefnet_luma_corridorkey",
        "birefnet+luma+corridor": "birefnet_luma_corridorkey",
        "birefnet+luma+corridorkey": "birefnet_luma_corridorkey",
        "birefnet+corridor+luma": "birefnet_luma_corridorkey",
        "birefnet+corridorkey+luma": "birefnet_luma_corridorkey",
        "ai_luma": "birefnet_luma",
        "ai_glow": "birefnet_luma",
    }
    mode = aliases.get(value, value)
    return mode if mode in AI_MATTE_MODES else ("chroma" if chroma_enabled else "none")


# 组合模式到原子管线的拆解映射
_COMBO_TO_PIPELINE: dict[str, list[str]] = {
    "birefnet_corridorkey": ["birefnet", "corridorkey"],
    "birefnet_luma": ["birefnet", "luma"],
    "birefnet_luma_corridorkey": ["birefnet", "luma", "corridorkey"],
}


def normalize_matte_pipeline(payload: dict) -> list[str]:
    """从 payload 提取有效的原子模式管线列表。优先用 matte_pipeline 字段，回退到 matte_mode 拆解。"""
    raw_pipeline = payload.get("matte_pipeline")
    if isinstance(raw_pipeline, list) and raw_pipeline:
        return [str(m) for m in raw_pipeline if str(m) in ATOMIC_KEYING_MODES]
    # 回退：从 matte_mode 字符串拆解
    mode_str = str(payload.get("matte_mode") or "").strip().lower().replace("-", "_")
    if mode_str in _COMBO_TO_PIPELINE:
        return list(_COMBO_TO_PIPELINE[mode_str])
    if mode_str in ATOMIC_KEYING_MODES:
        return [mode_str]
    return []


def normalize_ai_model_key(raw: str) -> str:
    value = str(raw or DEFAULT_AI_MATTE_MODEL).strip().lower()
    aliases = {
        "hr": "birefnet-hr-matting",
        "hr-matting": "birefnet-hr-matting",
        "matting": "birefnet-hr-matting",
        "lite": "birefnet-lite-2k",
        "lite-2k": "birefnet-lite-2k",
        "2k": "birefnet-lite-2k",
        "general": "birefnet-general",
        "default": "birefnet-general",
    }
    value = aliases.get(value, value)
    return value if value in AI_MATTE_MODEL_REPOS else DEFAULT_AI_MATTE_MODEL


def normalize_ai_device(raw: str) -> str:
    value = str(raw or "auto").strip().lower()
    return AI_MATTE_DEVICE_ALIASES.get(value, "auto")


def normalize_corridorkey_screen(raw: str) -> str:
    value = str(raw or "auto").strip().lower()
    return value if value in CORRIDORKEY_SCREEN_COLORS else "auto"


def normalize_canvas_mode(raw: str) -> str:
    value = str(raw or "auto").strip().lower().replace("-", "_")
    aliases = {
        "": "auto",
        "auto_width": "auto",
        "auto_center": "auto",
        "rect": "auto",
        "rectangle": "auto",
        "center": "square_center",
        "square": "square_bottom",
        "bottom": "square_bottom",
    }
    value = aliases.get(value, value)
    return value if value in CANVAS_MODES else "auto"


def resolve_corridorkey_screen(raw: str, key_rgb: tuple[int, int, int]) -> str:
    normalized = normalize_corridorkey_screen(raw)
    if normalized != "auto":
        return normalized
    return "blue" if key_rgb[2] > key_rgb[1] and key_rgb[2] >= key_rgb[0] else "green"
