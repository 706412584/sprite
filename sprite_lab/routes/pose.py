"""Pose / human-parse detection routes (image + or upload_id)."""
from __future__ import annotations

from ..imaging.canvas import open_rgba_image
from ..storage.uploads import source_media_entry
from ..validation.normalizers import normalize_ai_device
from .registry import post


def _resolve_image_input(http, payload):
    """Pick image source from payload; raises ValueError if missing.

    Used by both pose-detect and human-parse since they share input shape.
    """
    import server

    data_url = str(payload.get("image_data_url") or "").strip()
    if data_url:
        return server.decode_data_url_image(data_url)
    upload_id = str(payload.get("upload_id") or "").strip()
    if not upload_id:
        raise ValueError("需要 image_data_url 或 upload_id")
    path, media_type = source_media_entry(upload_id)
    if not str(media_type).startswith("image"):
        raise ValueError("仅支持图片来源；视频请先取帧后传 image_data_url")
    return open_rgba_image(path)


@post("/api/pose-detect")
def pose_detect(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    image = _resolve_image_input(http, payload)
    result = server.detect_pose_keypoints(image)
    http.send_json({"ok": True, **result})


@post("/api/human-parse")
def human_parse(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    image = _resolve_image_input(http, payload)
    ai_device = normalize_ai_device(str(payload.get("ai_device") or "auto"))
    result = server.human_parse_parts(image, ai_device)
    http.send_json({"ok": True, **result})
