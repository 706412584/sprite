"""ffmpeg hardware-acceleration detection and CPU-fallback execution."""
from __future__ import annotations

import os
import re
import sys

from ..config import FFMPEG_ACCEL_ALIASES, FFMPEG_ACCEL_ENV, FFMPEG_ACCEL_PRIORITY
from .binaries import resolve_ffmpeg_binary, run_process

_FFMPEG_HWACCELS_CACHE: set[str] | None = None


def configured_ffmpeg_accel_mode() -> str:
    raw = str(os.environ.get(FFMPEG_ACCEL_ENV, "auto") or "auto").strip().lower()
    return FFMPEG_ACCEL_ALIASES.get(raw, "auto")


def available_ffmpeg_hwaccels() -> set[str]:
    global _FFMPEG_HWACCELS_CACHE
    if _FFMPEG_HWACCELS_CACHE is not None:
        return _FFMPEG_HWACCELS_CACHE

    ffmpeg = resolve_ffmpeg_binary("ffmpeg")
    try:
        output = run_process([ffmpeg, "-hide_banner", "-hwaccels"])
    except Exception:
        _FFMPEG_HWACCELS_CACHE = set()
        return _FFMPEG_HWACCELS_CACHE

    available: set[str] = set()
    for line in output.splitlines():
        value = line.strip().lower()
        if not value or value.endswith(":"):
            continue
        if re.fullmatch(r"[a-z0-9_]+", value):
            available.add(value)
    _FFMPEG_HWACCELS_CACHE = available
    return _FFMPEG_HWACCELS_CACHE


def preferred_ffmpeg_hwaccel() -> tuple[str, str | None]:
    requested = configured_ffmpeg_accel_mode()
    if requested == "cpu":
        return requested, None

    available = available_ffmpeg_hwaccels()
    if requested == "auto":
        for candidate in FFMPEG_ACCEL_PRIORITY:
            if candidate in available:
                return requested, candidate
        return requested, None

    if requested in available:
        return requested, requested
    return requested, None


def ffmpeg_accel_label(mode: str) -> str:
    return "CPU" if mode == "cpu" else f"GPU ({mode})"


def ffmpeg_accel_payload(
    requested_mode: str,
    selected_mode: str | None,
    used_mode: str,
    fallback_reason: str | None = None,
) -> dict:
    return {
        "requested_mode": requested_mode,
        "selected_mode": selected_mode,
        "used_mode": used_mode,
        "used_label": ffmpeg_accel_label(used_mode),
        "fallback_to_cpu": bool(selected_mode and used_mode == "cpu"),
        "fallback_reason": fallback_reason or "",
    }


def static_image_payload() -> dict:
    return {
        "requested_mode": "image",
        "selected_mode": "",
        "used_mode": "image",
        "used_label": "Static image",
        "fallback_to_cpu": False,
        "fallback_reason": "",
    }


def custom_animation_payload() -> dict:
    return {
        "requested_mode": "animation",
        "selected_mode": "",
        "used_mode": "animation",
        "used_label": "Custom animation frames",
        "fallback_to_cpu": False,
        "fallback_reason": "",
    }


def run_ffmpeg_with_auto_accel(args_builder) -> dict:
    requested_mode, selected_mode = preferred_ffmpeg_hwaccel()
    if selected_mode:
        try:
            run_process(args_builder(selected_mode))
            return ffmpeg_accel_payload(requested_mode, selected_mode, selected_mode)
        except RuntimeError as exc:
            detail = str(exc).strip()
            print(
                f"[ffmpeg] {selected_mode} decode failed, falling back to CPU: {detail}",
                file=sys.stderr,
            )
            run_process(args_builder(None))
            return ffmpeg_accel_payload(
                requested_mode,
                selected_mode,
                "cpu",
                fallback_reason=detail,
            )

    run_process(args_builder(None))
    return ffmpeg_accel_payload(requested_mode, None, "cpu")
