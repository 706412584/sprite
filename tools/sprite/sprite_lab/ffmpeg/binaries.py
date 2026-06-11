"""ffmpeg/ffprobe binary resolution and subprocess execution."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from ..config import DEFAULT_FFMPEG_FALLBACK_ROOT, FFMPEG_DIR_ENV


def ffmpeg_fallback_root() -> Path | None:
    configured = str(os.environ.get(FFMPEG_DIR_ENV, "")).strip()
    if configured:
        return Path(configured).expanduser()
    if DEFAULT_FFMPEG_FALLBACK_ROOT.exists():
        return DEFAULT_FFMPEG_FALLBACK_ROOT
    return None


def resolve_ffmpeg_binary(name: str) -> str:
    direct = shutil.which(name)
    if direct:
        return direct
    fallback_root = ffmpeg_fallback_root()
    if fallback_root is not None:
        candidate = fallback_root / f"{name}.exe"
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError(f"could not resolve {name}")


def run_process(args: list[str]) -> str:
    completed = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="ignore")
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(detail or f"command failed: {' '.join(args)}")
    return completed.stdout
