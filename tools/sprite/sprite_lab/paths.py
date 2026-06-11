"""Runtime directory layout for Sprite Video Lab.

ROOT_DIR points at the project root (the folder that contains server.py),
not the package folder. This keeps the work/ and dist/ locations identical
to the original single-file server.
"""
from __future__ import annotations

from pathlib import Path

# server.py lives in the project root; this package sits one level below it.
ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
WORK_DIR = ROOT_DIR / "work"
UPLOADS_DIR = WORK_DIR / "uploads"
JOBS_DIR = WORK_DIR / "jobs"
EXPORTS_DIR = WORK_DIR / "exports"
PREVIEWS_DIR = WORK_DIR / "previews"
DOWNLOADS_DIR = WORK_DIR / "downloads"


def ensure_runtime_dirs() -> None:
    for directory in (WORK_DIR, UPLOADS_DIR, JOBS_DIR, EXPORTS_DIR, PREVIEWS_DIR, DOWNLOADS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
