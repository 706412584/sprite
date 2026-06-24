"""JSON serialization and id/time helpers."""
from __future__ import annotations

import json
import uuid
from datetime import datetime


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def iso_now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def timestamped_id() -> str:
    return f"{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:4]}"
