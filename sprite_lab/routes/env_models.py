"""Environment / model installation routes."""
from __future__ import annotations

from ..config import AI_MATTE_MODEL_LABELS, DEFAULT_AI_MATTE_MODEL, POSE_MODEL_LABEL
from ..tasks.runner import run_background_task
from ..validation.normalizers import normalize_ai_model_key
from .registry import post


@post("/api/env/install")
def env_install(http, _parsed) -> None:
    import server

    http.send_json({"ok": True, **server.install_missing_env_packages()})


@post("/api/env/install-corridorkey")
def env_install_corridorkey(http, _parsed) -> None:
    import server

    task = run_background_task("安装 CorridorKey", server.install_corridorkey)
    http.send_json({"ok": True, "task": task})


@post("/api/models/download")
def models_download(http, _parsed) -> None:
    import server

    payload = http.read_json_body()
    model_key = normalize_ai_model_key(str(payload.get("model_key") or DEFAULT_AI_MATTE_MODEL))
    task = run_background_task(
        f"下载 {AI_MATTE_MODEL_LABELS.get(model_key, model_key)}",
        server.install_model_from_download,
        model_key,
    )
    http.send_json({"ok": True, "task": task})


@post("/api/models/download-pose")
def models_download_pose(http, _parsed) -> None:
    import server

    task = run_background_task(POSE_MODEL_LABEL, server.install_pose_model_from_download)
    http.send_json({"ok": True, "task": task})
