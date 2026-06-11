"""Material import routes: by path / by upload / by frame sequence."""
from __future__ import annotations

from pathlib import Path

from ..storage.uploads import register_video_from_path, register_uploaded_file
from ..utils.multipart import parse_multipart_upload, parse_multipart_uploads
from .registry import post


@post("/api/import-path")
def import_path(http, _parsed) -> None:
    payload = http.read_json_body()
    raw_path = str(payload.get("path") or "").strip().strip("\"'")
    result = register_video_from_path(Path(raw_path))
    http.send_json({"ok": True, "upload": result})


@post("/api/upload")
def upload(http, _parsed) -> None:
    import server

    if server.cgi is None:
        length = int(http.headers.get("Content-Length", "0") or "0")
        file_item = parse_multipart_upload(http.headers, http.rfile.read(length), "video")
    else:
        form = server.cgi.FieldStorage(
            fp=http.rfile,
            headers=http.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": http.headers.get("Content-Type", ""),
                "CONTENT_LENGTH": http.headers.get("Content-Length", "0"),
            },
        )
        file_item = form["video"] if "video" in form else None
    if file_item is None or not getattr(file_item, "file", None):
        raise ValueError("media file missing")
    result = register_uploaded_file(file_item)
    http.send_json({"ok": True, "upload": result})


@post("/api/import-animation")
def import_animation(http, _parsed) -> None:
    import server

    if server.cgi is None:
        body = http.rfile.read(int(http.headers.get("Content-Length", "0") or 0))
        file_items = parse_multipart_uploads(http.headers, body, "frames")
    else:
        form = server.cgi.FieldStorage(
            fp=http.rfile,
            headers=http.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": http.headers.get("Content-Type", ""),
                "CONTENT_LENGTH": http.headers.get("Content-Length", "0"),
            },
        )
        file_items = server.field_storage_items(form, "frames")
    result = server.import_animation_frames_to_job(file_items)
    http.send_json({"ok": True, "job": result})
