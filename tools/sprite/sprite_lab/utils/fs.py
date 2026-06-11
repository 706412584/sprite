"""Filesystem and filename helpers."""
from __future__ import annotations

import re
from pathlib import Path

from ..config import MOJIBAKE_REPLACEMENTS


def clean_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(name).name).strip(".-")
    return cleaned or "video"


def repair_mojibake_text(value: str) -> str:
    repaired = value
    for bad, good in MOJIBAKE_REPLACEMENTS.items():
        repaired = repaired.replace(bad, good)
    return repaired


def repair_mojibake_path(path: Path) -> Path:
    return Path(repair_mojibake_text(str(path)))


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-")
    return cleaned or "item"


def is_within_root(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False
