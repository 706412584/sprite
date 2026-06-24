"""Job-level operations: smart frame selection and (the heavy) export."""
from __future__ import annotations

from ..validation.types import safe_int
from .registry import post


@post("/api/job/smart-select")
def job_smart_select(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.suggest_job_frames(
        job_id=str(payload.get("job_id") or ""),
        target_count=safe_int(payload.get("target_count"), 12),
    )
    http.send_json({"ok": True, **result})


@post("/api/export")
def job_export(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.export_job(
        job_id=str(payload.get("job_id") or ""),
        selected_indices=[safe_int(value, -1) for value in (payload.get("selected_indices") or [])],
        sheet_columns=max(1, safe_int(payload.get("sheet_columns"), 4)),
        video_duration_ms=safe_int(payload.get("video_duration_ms"), 100),
        compression=payload.get("compression"),
    )
    http.send_json({"ok": True, "export": result})
