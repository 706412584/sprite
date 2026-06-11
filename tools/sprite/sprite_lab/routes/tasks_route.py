"""Task progress polling endpoint."""
from __future__ import annotations

from http import HTTPStatus

from ..tasks.runner import task_progress_payload
from .registry import get


@get("/api/tasks/", prefix=True)
def get_task_progress(http, parsed) -> None:
    task_id = parsed.path.removeprefix("/api/tasks/").strip("/")
    try:
        http.send_json({"ok": True, "task": task_progress_payload(task_id)})
    except FileNotFoundError as exc:
        http.send_error_json(str(exc), status=HTTPStatus.NOT_FOUND)
