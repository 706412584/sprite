"""Preview-only alpha post-processing routes.

These take a preview_id and return the modified preview without re-running
the heavy matting pipeline. All three share the same pattern.
"""
from __future__ import annotations

from ..validation.types import safe_int
from .registry import post


@post("/api/preview-green-to-black")
def preview_green_to_black(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.green_to_black_preview(
        str(payload.get("preview_id") or ""),
        threshold=max(0, min(255, safe_int(payload.get("threshold"), 42))),
        dominance=max(0, min(255, safe_int(payload.get("dominance"), 24))),
    )
    http.send_json({"ok": True, "preview": result})


@post("/api/preview-semitransparent-to-black")
def preview_semitransparent_to_black(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.semitransparent_to_black_preview(
        str(payload.get("preview_id") or ""),
        alpha_min=max(0, min(255, safe_int(payload.get("alpha_min"), 1))),
        alpha_max=max(0, min(255, safe_int(payload.get("alpha_max"), 254))),
    )
    http.send_json({"ok": True, "preview": result})


@post("/api/preview-semitransparent-to-opaque")
def preview_semitransparent_to_opaque(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.semitransparent_to_opaque_preview(
        str(payload.get("preview_id") or ""),
        alpha_min=max(0, min(255, safe_int(payload.get("alpha_min"), 1))),
        alpha_max=max(0, min(255, safe_int(payload.get("alpha_max"), 254))),
    )
    http.send_json({"ok": True, "preview": result})


@post("/api/save-preview")
def save_preview_route(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    result = server.save_preview_as_job(str(payload.get("preview_id") or ""))
    http.send_json({"ok": True, "job": result})
