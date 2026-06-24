"""背景补全路由：图片 + 矩形框列表 → LaMa inpainting 补全。"""
from __future__ import annotations

from ..tasks.runner import run_background_task
from ..validation.normalizers import normalize_ai_device
from .registry import post


@post("/api/bg-inpaint")
def bg_inpaint(http, _parsed) -> None:
    import server

    payload = http.read_json_body()

    # 校验 rects
    rects_raw = payload.get("rects") or []
    if not isinstance(rects_raw, list) or len(rects_raw) == 0:
        http.send_error_json("需要至少一个 rect ({x, y, w, h})", status=400)
        return

    rects = []
    for index, r in enumerate(rects_raw):
        if not isinstance(r, dict):
            http.send_error_json(f"第 {index + 1} 个 rect 不是对象", status=400)
            return
        try:
            rect = {
                "x": int(r.get("x", 0)),
                "y": int(r.get("y", 0)),
                "w": int(r.get("w", 0)),
                "h": int(r.get("h", 0)),
            }
        except (TypeError, ValueError):
            http.send_error_json(f"第 {index + 1} 个 rect 坐标必须是数字", status=400)
            return
        if rect["w"] <= 0 or rect["h"] <= 0:
            http.send_error_json(f"第 {index + 1} 个 rect 的宽高必须大于 0", status=400)
            return
        rects.append(rect)

    ai_device = normalize_ai_device(str(payload.get("ai_device") or "auto"))

    task = run_background_task(
        "背景补全",
        server.run_bg_inpaint,
        image_data_url=str(payload.get("image_data_url") or ""),
        upload_id=str(payload.get("upload_id") or ""),
        rects=rects,
        ai_device=ai_device,
    )
    http.send_json({"ok": True, "task": task})
