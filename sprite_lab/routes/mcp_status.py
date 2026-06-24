"""MCP server status routes.

The MCP server (sprite_mcp_server.py) is a separate stdio process launched by
an MCP client. To make its startup state visible in the app's Runtime panel,
the MCP process posts a lightweight heartbeat here on startup and then
periodically while it runs. This module keeps the last heartbeat in memory
(the HTTP backend is a single long-lived process) and reports readiness.

Routes:
    POST /api/mcp/heartbeat   called by the MCP server; records liveness.
    GET  /api/mcp/status      called by the UI; reports readiness + liveness.
"""
from __future__ import annotations

import importlib.util
import time
from pathlib import Path

from ..paths import ROOT_DIR
from .registry import get, post

# How long after the last heartbeat we still consider the MCP server "running".
# The MCP server heartbeats every ~10s, so 30s tolerates a couple of misses.
_LIVENESS_WINDOW_S = 30.0

# In-memory record of the most recent heartbeat. Single-process backend, so a
# module-level dict is enough; it resets when the backend restarts.
_LAST_HEARTBEAT: dict | None = None

_MCP_SCRIPT = ROOT_DIR / "sprite_mcp_server.py"


@post("/api/mcp/heartbeat")
def mcp_heartbeat(http, _parsed) -> None:
    global _LAST_HEARTBEAT
    payload = http.read_json_body()
    _LAST_HEARTBEAT = {
        "pid": payload.get("pid"),
        "tool_count": payload.get("tool_count"),
        "api_base": payload.get("api_base"),
        "transport": payload.get("transport") or "stdio",
        "received_at": time.time(),
    }
    http.send_json({"ok": True})


@get("/api/mcp/status")
def mcp_status(http, _parsed) -> None:
    sdk_installed = importlib.util.find_spec("mcp") is not None
    script_exists = _MCP_SCRIPT.exists()

    # The address the MCP server connects to == where this backend listens.
    try:
        import server
        backend_api_base = f"http://{server.configured_host()}:{server.configured_port()}"
    except Exception:
        backend_api_base = None

    last = _LAST_HEARTBEAT
    running = False
    seconds_since = None
    if last is not None:
        seconds_since = round(time.time() - float(last["received_at"]), 1)
        running = seconds_since <= _LIVENESS_WINDOW_S

    if running:
        state = "running"
    elif sdk_installed and script_exists:
        state = "ready"  # installed and present, but no live session seen
    else:
        state = "unavailable"

    api_base = (last or {}).get("api_base") or backend_api_base

    http.send_json({
        "ok": True,
        "state": state,
        "running": running,
        "sdk_installed": sdk_installed,
        "script_exists": script_exists,
        "script_path": str(_MCP_SCRIPT),
        "api_base": api_base,
        "backend_api_base": backend_api_base,
        "seconds_since_heartbeat": seconds_since,
        "last_heartbeat": last,
    })
