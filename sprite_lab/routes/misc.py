"""Miscellaneous lightweight routes: app version, open path."""
from __future__ import annotations

from http import HTTPStatus
from pathlib import Path

from .registry import get, post


@get("/api/app-version")
def get_app_version(http, _parsed) -> None:
    # Lazy import to avoid circular dependency: misc routes are loaded by
    # server.py during module initialization, but the helpers below live in
    # server.py itself for now.
    import server

    http.send_json({
        "ok": True,
        "version": server.current_app_version(),
        "poll_ms": server.APP_VERSION_POLL_MS,
    })


@post("/api/open-path")
def open_path_route(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    target = Path(str(payload.get("path") or "").strip()).expanduser().resolve()
    if not target.exists():
        raise FileNotFoundError(target)
    server.open_path_in_file_browser(target)
    http.send_json({"ok": True})
