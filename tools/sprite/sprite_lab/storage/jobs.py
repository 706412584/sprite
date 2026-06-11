"""Job manifest management and frame-path resolution."""
from __future__ import annotations

import json
from pathlib import Path

from ..paths import JOBS_DIR


def job_dir(job_id: str) -> Path:
    return JOBS_DIR / job_id


def job_manifest_path(job_id: str) -> Path:
    return job_dir(job_id) / "manifest.json"


def save_job_manifest(job_id: str, payload: dict) -> None:
    path = job_manifest_path(job_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_job_manifest(job_id: str) -> dict:
    path = job_manifest_path(job_id)
    if not path.exists():
        raise FileNotFoundError(f"job not found: {job_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def job_raw_frame_path(raw_dir: Path, frame_index: int) -> Path:
    candidates = [
        raw_dir / f"frame_{frame_index + 1:05d}.png",
        raw_dir / f"frame_{frame_index + 1:03d}.png",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(f"raw frame not found: {frame_index + 1}")
