"""Preview manifest management."""
from __future__ import annotations

import json
from pathlib import Path

from ..paths import PREVIEWS_DIR


def preview_dir(preview_id: str) -> Path:
    return PREVIEWS_DIR / preview_id


def load_preview_manifest(preview_id: str) -> dict:
    preview_id = str(preview_id or "").strip()
    if not preview_id or Path(preview_id).name != preview_id:
        raise ValueError("invalid preview id")
    path = preview_dir(preview_id) / "preview.json"
    if not path.exists():
        raise FileNotFoundError(f"preview not found: {preview_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_preview_manifest(preview_id: str, manifest: dict) -> None:
    root = preview_dir(preview_id)
    root.mkdir(parents=True, exist_ok=True)
    (root / "preview.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
