from __future__ import annotations

import argparse
import base64
try:
    import cgi
except ModuleNotFoundError:
    cgi = None
from email.parser import BytesParser
from email.policy import default as email_policy
from io import BytesIO
from types import SimpleNamespace
import json
import math
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
import zipfile
from datetime import datetime
from fractions import Fraction
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from collections.abc import Callable

def _dbg(msg: str) -> None:
    """调试日志：输出到 stderr。"""
    import sys
    print(f"[DBG] {msg}", file=sys.stderr, flush=True)

from PIL import Image, ImageChops, ImageFilter
try:
    from rectpack import newPacker
    from rectpack.maxrects import MaxRectsBssf
    HAS_RECTPACK = True
except ImportError:
    HAS_RECTPACK = False

# --- Migrated to sprite_lab package (single source of truth). ---
# Pure helpers, validators and isolated imaging routines now live in modules.
# server.py re-imports them so existing references keep working unchanged.
from sprite_lab.imaging.canvas import (
    open_rgba_image,
    enforce_hard_alpha,
    resize_rgba_with_premultiplied_alpha,
)
from sprite_lab.imaging.chroma import chroma_key_frame, spriteflow_key_frame
from sprite_lab.imaging.luma import luminance_alpha_mask, apply_alpha_mask
from sprite_lab.imaging.color import parse_hex_color, rgb_to_hex, auto_key_color
from sprite_lab.utils.fs import (
    clean_filename,
    repair_mojibake_text,
    repair_mojibake_path,
    slugify,
    is_within_root,
)
from sprite_lab.utils.json_io import json_bytes, iso_now, timestamped_id
from sprite_lab.utils.multipart import parse_multipart_uploads, parse_multipart_upload
from sprite_lab.validation.types import safe_int, safe_float, clamp_int, clamp_float
from sprite_lab.validation.normalizers import (
    normalize_ai_resolution,
    normalize_matte_mode,
    normalize_matte_pipeline,
    normalize_ai_model_key,
    normalize_ai_device,
    normalize_canvas_mode,
    normalize_corridorkey_screen,
    resolve_corridorkey_screen,
)
from sprite_lab.ffmpeg.binaries import (
    ffmpeg_fallback_root,
    resolve_ffmpeg_binary,
    run_process,
)
from sprite_lab.ffmpeg.accel import (
    configured_ffmpeg_accel_mode,
    available_ffmpeg_hwaccels,
    preferred_ffmpeg_hwaccel,
    ffmpeg_accel_label,
    ffmpeg_accel_payload,
    static_image_payload,
    custom_animation_payload,
    run_ffmpeg_with_auto_accel,
)
from sprite_lab.ffmpeg.extract import extract_image_frame
from sprite_lab.storage.media import (
    ffprobe_json,
    parse_frame_rate,
    video_info,
    image_info,
    content_type_extension,
    sniff_media_extension,
    detect_media_type,
    preferred_media_extension,
    media_info,
)
from sprite_lab.storage.uploads import (
    upload_dir,
    upload_manifest_path,
    load_upload_manifest,
    save_upload_manifest,
    source_media_entry,
    source_video_path,
    build_upload_payload,
    register_video_from_path,
    register_uploaded_file,
)
from sprite_lab.storage.jobs import (
    job_dir,
    job_manifest_path,
    save_job_manifest,
    load_job_manifest,
    job_raw_frame_path,
)
from sprite_lab.storage.previews import (
    preview_dir,
    load_preview_manifest,
    save_preview_manifest,
)
from sprite_lab.tasks.runner import (
    TASKS,
    TASKS_LOCK,
    append_task_log,
    update_task_progress,
    task_progress_payload,
    run_background_task,
)
import sprite_lab.routes as _routes  # noqa: F401  registers route handlers


ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"
WORK_DIR = ROOT_DIR / "work"
UPLOADS_DIR = WORK_DIR / "uploads"
JOBS_DIR = WORK_DIR / "jobs"
EXPORTS_DIR = WORK_DIR / "exports"
PREVIEWS_DIR = WORK_DIR / "previews"
DOWNLOADS_DIR = WORK_DIR / "downloads"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8894
DEFAULT_FFMPEG_FALLBACK_ROOT = Path(r"I:\FF\Flowframes\FlowframesData\pkgs\av")
HOST_ENV = "SPRITE_VIDEO_LAB_HOST"
PORT_ENV = "SPRITE_VIDEO_LAB_PORT"
FFMPEG_DIR_ENV = "SPRITE_VIDEO_LAB_FFMPEG_DIR"
AI_MODEL_CACHE_ENV = "SPRITE_VIDEO_LAB_AI_MODEL_CACHE"
CORRIDORKEY_ROOT_ENV = "SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT"
LANCZOS = Image.Resampling.LANCZOS
APP_VERSION_POLL_MS = 1200

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
ANIMATION_FRAME_EXTENSIONS = IMAGE_EXTENSIONS
CONTENT_TYPE_EXTENSIONS = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}
MOJIBAKE_REPLACEMENTS = {
    "\u677b\ufe40\u75c2": "\u8f66\u5b9d",
}
FFMPEG_ACCEL_ENV = "SPRITE_VIDEO_LAB_FFMPEG_ACCEL"
FFMPEG_ACCEL_PRIORITY = ("cuda", "qsv", "d3d11va", "dxva2")
FFMPEG_ACCEL_ALIASES = {
    "": "auto",
    "auto": "auto",
    "default": "auto",
    "gpu": "auto",
    "cpu": "cpu",
    "off": "cpu",
    "none": "cpu",
    "disabled": "cpu",
    "cuda": "cuda",
    "nvdec": "cuda",
    "qsv": "qsv",
    "d3d11va": "d3d11va",
    "dxva2": "dxva2",
}
AI_MATTE_MODEL_REPOS = {
    "birefnet-hr-matting": "ZhengPeng7/BiRefNet_HR-matting",
    "birefnet-lite-2k": "ZhengPeng7/BiRefNet_lite-2K",
    "birefnet-general": "ZhengPeng7/BiRefNet",
}
AI_MATTE_MODEL_LABELS = {
    "birefnet-hr-matting": "BiRefNet HR-matting",
    "birefnet-lite-2k": "BiRefNet lite-2K",
    "birefnet-general": "BiRefNet general",
}
# 姿态关键点模型：MediaPipe Pose Landmarker（单文件 .task 权重，CPU 友好，33 个 landmark）
POSE_MODEL_KEY = "mediapipe-pose-full"
POSE_MODEL_LABEL = "MediaPipe Pose Landmarker (full)"
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
POSE_MODEL_FILENAME = "pose_landmarker_full.task"
# MediaPipe Pose 33 个 landmark 的官方索引名（仅保留映射部件需要的关节）
POSE_LANDMARK_NAMES = {
    0: "nose",
    2: "left_eye",
    5: "right_eye",
    7: "left_ear",
    8: "right_ear",
    11: "left_shoulder",
    12: "right_shoulder",
    13: "left_elbow",
    14: "right_elbow",
    15: "left_wrist",
    16: "right_wrist",
    23: "left_hip",
    24: "right_hip",
    25: "left_knee",
    26: "right_knee",
    27: "left_ankle",
    28: "right_ankle",
}
# 人体语义解析模型：SegFormer（ATR 18 类），像素级分出头发/脸/上衣/裤/裙/手臂/腿/鞋等。
# 纯 transformers + HF 缓存，CPU 可跑，复用 BiRefNet 的缓存/设备机制，无需单独下 .task。
HUMAN_PARSE_MODEL_KEY = "segformer-b2-clothes"
HUMAN_PARSE_MODEL_REPO = "mattmdjaga/segformer_b2_clothes"
HUMAN_PARSE_MODEL_LABEL = "SegFormer B2 Clothes (ATR 18 类)"
# ATR 标签索引 → (语义部件名 camelCase, 中文名)。Background(0) 不导出。
# 注意：Left/Right 是“图像视角”，与 humanoid 模板的角色视角相反，前端按 mirror 处理。
HUMAN_PARSE_LABELS = {
    0: None,  # Background
    1: ("hat", "帽子"),
    2: ("hair", "头发"),
    3: ("sunglasses", "墨镜"),
    4: ("upperClothes", "上衣"),
    5: ("skirt", "裙子"),
    6: ("pants", "裤子"),
    7: ("dress", "连衣裙"),
    8: ("belt", "腰带"),
    9: ("shoeL", "左鞋"),
    10: ("shoeR", "右鞋"),
    11: ("face", "脸"),
    12: ("legL", "左腿"),
    13: ("legR", "右腿"),
    14: ("armL", "左臂"),
    15: ("armR", "右臂"),
    16: ("bag", "包"),
    17: ("scarf", "围巾"),
}
HUMAN_PARSE_MIN_AREA = 64  # 小于该像素数的语义块视为噪声丢弃
AI_MATTE_MODES = {
    "none",
    "chroma",
    "spriteflow",
    "birefnet",
    "corridorkey",
    "luma",
    "birefnet_corridorkey",
    "birefnet_luma",
    "birefnet_luma_corridorkey",
}
AI_MATTE_DEVICE_ALIASES = {
    "": "auto",
    "auto": "auto",
    "gpu": "cuda",
    "cuda": "cuda",
    "cuda:0": "cuda",
    "cpu": "cpu",
}
DEFAULT_AI_MATTE_MODEL = "birefnet-hr-matting"
DEFAULT_AI_MATTE_RESOLUTION = 1024
AI_MATTE_MIN_RESOLUTION = 256
AI_MATTE_MAX_RESOLUTION = 2560
AI_MATTE_RESOLUTION_MULTIPLE = 32
CORRIDORKEY_REPO_URL = "https://github.com/nikopueringer/CorridorKey"
CORRIDORKEY_IMG_SIZE = 2048
CORRIDORKEY_GPU_DESPECKLE_PIXEL_LIMIT = 2**24
CORRIDORKEY_SCREEN_COLORS = {"auto", "green", "blue"}
CANVAS_MODES = {"auto", "square_bottom", "square_center"}

_BIREFNET_MODEL_CACHE: dict[tuple[str, str], object] = {}
_POSE_MODEL_CACHE: dict[str, object] = {}
_HUMAN_PARSE_MODEL_CACHE: dict[str, object] = {}
_CORRIDORKEY_ENGINE_CACHE: dict[tuple[str, str], object] = {}
_LAMA_MODEL_CACHE: dict[str, object] = {}


def ensure_runtime_dirs() -> None:
    for directory in (WORK_DIR, UPLOADS_DIR, JOBS_DIR, EXPORTS_DIR, PREVIEWS_DIR, DOWNLOADS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def configured_host(cli_host: str | None = None) -> str:
    value = str(cli_host or os.environ.get(HOST_ENV, DEFAULT_HOST)).strip()
    return value or DEFAULT_HOST


def configured_port(cli_port: int | None = None) -> int:
    if cli_port is not None:
        return cli_port
    raw = str(os.environ.get(PORT_ENV, DEFAULT_PORT)).strip()
    try:
        port = int(raw)
    except ValueError:
        return DEFAULT_PORT
    return port if 1 <= port <= 65535 else DEFAULT_PORT


def default_ai_model_cache_dir() -> Path:
    configured = str(os.environ.get(AI_MODEL_CACHE_ENV, "")).strip()
    if configured:
        return Path(configured).expanduser()
    e_drive = Path("E:/")
    if e_drive.exists():
        return e_drive / "sprite-video-lab-models" / "huggingface"
    return WORK_DIR / "models" / "huggingface"


def default_corridorkey_root() -> Path:
    configured = str(os.environ.get(CORRIDORKEY_ROOT_ENV, "")).strip()
    if configured:
        return Path(configured).expanduser()
    e_drive = Path("E:/")
    if e_drive.exists():
        return e_drive / "sprite-video-lab-models" / "CorridorKey"
    return WORK_DIR / "models" / "CorridorKey"


def configure_ai_model_cache() -> Path:
    cache_dir = default_ai_model_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)
    hub_cache = cache_dir / "hub"
    hub_cache.mkdir(parents=True, exist_ok=True)
    modules_cache = cache_dir / "modules"
    modules_cache.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(cache_dir))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(hub_cache))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(cache_dir / "transformers"))
    os.environ.setdefault("HF_MODULES_CACHE", str(modules_cache))
    os.environ.setdefault("HF_XET_CACHE", str(cache_dir / "xet"))
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    return cache_dir


def hf_repo_cache_dir(cache_dir: Path, repo_id: str) -> Path:
    """规范的 HF 仓库缓存目录：<cache_dir>/hub/models--<owner>--<name>。

    这是 from_pretrained / 标准 HF 缓存使用的布局，也是检测与下载应当一致的位置。
    """
    return cache_dir / "hub" / f"models--{repo_id.replace('/', '--')}"


def hf_repo_cached(cache_dir: Path, repo_id: str) -> tuple[bool, Path]:
    """判断某 HF 仓库是否已缓存，返回 (是否已缓存, 规范缓存目录)。

    同时兼容历史错位：早期下载把 snapshot_download(cache_dir=...) 写到了
    <cache_dir>/models--<repo>（缺少 hub 层）。这里两个位置都认，避免已下载的
    模型被反复判为"未下载"。
    """
    name = f"models--{repo_id.replace('/', '--')}"
    primary = cache_dir / "hub" / name
    for candidate in (primary, cache_dir / name):
        try:
            if candidate.exists() and any(candidate.iterdir()):
                return True, primary
        except OSError:
            continue
    return False, primary


def watch_targets() -> list[Path]:
    targets = [ROOT_DIR / "server.py"]
    if DIST_DIR.exists():
        targets.extend(path for path in DIST_DIR.rglob("*") if path.is_file())
    return sorted(set(path.resolve() for path in targets))


def current_app_version() -> str:
    mtimes = [str(path.stat().st_mtime_ns) for path in watch_targets() if path.exists()]
    if not mtimes:
        return "0"
    return max(mtimes)


def watch_snapshot() -> dict[str, int]:
    snapshot: dict[str, int] = {}
    for path in watch_targets():
        try:
            snapshot[str(path)] = path.stat().st_mtime_ns
        except FileNotFoundError:
            continue
    return snapshot


def open_path_in_file_browser(target: Path) -> None:
    resolved = target.resolve()
    if sys.platform.startswith("win"):
        os.startfile(str(resolved))
        return
    if sys.platform == "darwin":
        subprocess.run(["open", str(resolved)], check=True)
        return
    subprocess.run(["xdg-open", str(resolved)], check=True)


def import_ai_matte_dependencies():
    configure_ai_model_cache()
    try:
        import torch
        from torchvision import transforms
        from transformers import AutoModelForImageSegmentation
    except ModuleNotFoundError as exc:
        missing_name = getattr(exc, "name", "AI matting dependency")
        raise RuntimeError(
            f"{missing_name} is not installed. Run: python -m pip install -r requirements-ai.txt"
        ) from exc
    return torch, transforms, AutoModelForImageSegmentation


def resolve_ai_runtime_device(torch_module, requested_device: str) -> str:
    requested = normalize_ai_device(requested_device)
    cuda_available = bool(torch_module.cuda.is_available())
    if requested == "cuda":
        if not cuda_available:
            print("[SpriteVideoLab] CUDA was requested for BiRefNet, but torch cannot see an NVIDIA GPU. Falling back to CPU.", file=sys.stderr)
            return "cpu"
        return "cuda"
    if requested == "cpu":
        return "cpu"
    return "cuda" if cuda_available else "cpu"


def load_birefnet_model(model_key: str, requested_device: str):
    torch_module, _transforms, auto_model = import_ai_matte_dependencies()
    normalized_model_key = normalize_ai_model_key(model_key)
    repo_id = AI_MATTE_MODEL_REPOS[normalized_model_key]
    device = resolve_ai_runtime_device(torch_module, requested_device)
    cache_key = (repo_id, device)
    if cache_key in _BIREFNET_MODEL_CACHE:
        return _BIREFNET_MODEL_CACHE[cache_key], device, normalized_model_key, repo_id

    if hasattr(torch_module, "set_float32_matmul_precision"):
        try:
            torch_module.set_float32_matmul_precision("high")
        except Exception:
            pass

    cache_dir = configure_ai_model_cache()
    model = auto_model.from_pretrained(repo_id, trust_remote_code=True, cache_dir=str(cache_dir))
    model.to(device)
    model.eval()
    _BIREFNET_MODEL_CACHE[cache_key] = model
    return model, device, normalized_model_key, repo_id


def pose_model_weight_path() -> Path:
    """姿态模型 .task 权重缓存路径，复用 AI 模型缓存根目录。"""
    cache_dir = configure_ai_model_cache()
    return cache_dir / "pose" / POSE_MODEL_FILENAME


def import_pose_dependencies():
    """懒加载 mediapipe，镜像 import_ai_matte_dependencies 的缺包报错风格。"""
    try:
        import mediapipe as mp  # noqa: F401
    except ModuleNotFoundError as exc:
        missing_name = getattr(exc, "name", "mediapipe")
        raise RuntimeError(
            f"{missing_name} is not installed. Run: python -m pip install -r requirements-ai.txt"
        ) from exc
    return mp


def load_pose_model():
    """懒加载并缓存 MediaPipe Pose Landmarker。权重缺失时给出明确下载提示。"""
    if POSE_MODEL_KEY in _POSE_MODEL_CACHE:
        return _POSE_MODEL_CACHE[POSE_MODEL_KEY]

    mp = import_pose_dependencies()
    weight_path = pose_model_weight_path()
    if not weight_path.exists():
        raise RuntimeError(
            f"姿态模型权重未下载：{weight_path}。请在环境检测中点击下载，或手动下载 {POSE_MODEL_URL}。"
        )

    base_options = mp.tasks.BaseOptions(model_asset_path=str(weight_path))
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
    _POSE_MODEL_CACHE[POSE_MODEL_KEY] = landmarker
    return landmarker


def detect_pose_keypoints(image: Image.Image) -> dict:
    """对单张图做人体姿态检测，输出归一化关键点（x/y ∈ [0,1]）+ 整体置信度。"""
    import numpy as np

    mp = import_pose_dependencies()
    landmarker = load_pose_model()

    rgba = image.convert("RGBA")
    width, height = rgba.size
    rgb_array = np.array(rgba.convert("RGB"), dtype=np.uint8)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_array)
    result = landmarker.detect(mp_image)

    keypoints: list[dict] = []
    score = 0.0
    if result.pose_landmarks:
        landmarks = result.pose_landmarks[0]
        visibilities: list[float] = []
        for index, name in POSE_LANDMARK_NAMES.items():
            if index >= len(landmarks):
                continue
            lm = landmarks[index]
            visibility = float(getattr(lm, "visibility", 0.0) or 0.0)
            keypoints.append(
                {
                    "name": name,
                    "x": float(min(1.0, max(0.0, lm.x))),
                    "y": float(min(1.0, max(0.0, lm.y))),
                    "score": visibility,
                }
            )
            visibilities.append(visibility)
        if visibilities:
            score = float(sum(visibilities) / len(visibilities))

    return {
        "keypoints": keypoints,
        "score": score,
        "width": int(width),
        "height": int(height),
    }


def import_human_parse_dependencies():
    """懒加载 SegFormer 解析所需依赖，镜像 import_ai_matte_dependencies 的缺包报错风格。"""
    configure_ai_model_cache()
    try:
        import torch
        from transformers import AutoModelForSemanticSegmentation, SegformerImageProcessor
    except ModuleNotFoundError as exc:
        missing_name = getattr(exc, "name", "human parsing dependency")
        raise RuntimeError(
            f"{missing_name} is not installed. Run: python -m pip install -r requirements-ai.txt"
        ) from exc
    return torch, AutoModelForSemanticSegmentation, SegformerImageProcessor


def load_human_parse_model(requested_device: str):
    """懒加载并缓存 SegFormer 人体解析模型 + 预处理器。复用 BiRefNet 的设备/缓存策略。"""
    torch_module, auto_model, image_processor_cls = import_human_parse_dependencies()
    device = resolve_ai_runtime_device(torch_module, requested_device)
    cache_key = f"{HUMAN_PARSE_MODEL_REPO}@{device}"
    if cache_key in _HUMAN_PARSE_MODEL_CACHE:
        return _HUMAN_PARSE_MODEL_CACHE[cache_key], device

    cache_dir = configure_ai_model_cache()
    processor = image_processor_cls.from_pretrained(HUMAN_PARSE_MODEL_REPO, cache_dir=str(cache_dir))
    model = auto_model.from_pretrained(HUMAN_PARSE_MODEL_REPO, cache_dir=str(cache_dir))
    model.to(device)
    model.eval()
    bundle = {"model": model, "processor": processor}
    _HUMAN_PARSE_MODEL_CACHE[cache_key] = bundle
    return bundle, device


def human_parse_label_map(image: Image.Image, requested_device: str):
    """对单张图做像素级人体解析，返回每像素的 ATR 标签数组（numpy int，尺寸同原图）。"""
    import numpy as np

    torch_module, _auto_model, _proc_cls = import_human_parse_dependencies()
    bundle, _device = load_human_parse_model(requested_device)
    model = bundle["model"]
    processor = bundle["processor"]

    rgb = image.convert("RGB")
    width, height = rgb.size
    inputs = processor(images=rgb, return_tensors="pt")
    pixel_values = inputs["pixel_values"].to(model.device)

    with torch_module.no_grad():
        outputs = model(pixel_values=pixel_values)
        logits = outputs.logits  # [1, C, h', w']
        # 上采样回原图尺寸（双线性），再 argmax 取每像素标签
        upsampled = torch_module.nn.functional.interpolate(
            logits,
            size=(height, width),
            mode="bilinear",
            align_corners=False,
        )
        seg = upsampled.argmax(dim=1)[0].to("cpu").numpy().astype(np.int32)
    return seg, width, height


# 复合件定义：把若干 ATR 语义类按 mask 并集合成一个部件，使名称对齐 humanoid 槽位让 autoRig 命中。
# head = 头发 + 脸 + 帽子 + 墨镜；torso = 上衣 + 连衣裙 + 腰带 + 围巾。
# 四肢（upperArm/forearm/thigh/shin）仍交给 MediaPipe poseToParts，两者互补。
HUMAN_PARSE_COMPOSITES: list[dict] = [
    {"name": "head", "displayName": "head_头", "labels": [1, 2, 3, 11], "label_id": -1},
    {"name": "torso", "displayName": "torso_躯干", "labels": [4, 7, 8, 17], "label_id": -2},
]


def _human_parse_mask_to_part(
    mask,
    src,
    base_alpha,
    name: str,
    display_name: str,
    label_index: int,
) -> dict | None:
    """把单个 bool mask 裁成 bbox + 不规则透明 PNG 的 part 字典。

    alpha = 源图 alpha × 解析 mask（mask 外透明 → 贴合轮廓）。
    mask 面积或 bbox 过小返回 None。
    """
    import numpy as np

    area = int(mask.sum())
    if area < HUMAN_PARSE_MIN_AREA:
        return None

    ys, xs = np.where(mask)
    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    box_w = max_x - min_x + 1
    box_h = max_y - min_y + 1
    if box_w < 4 or box_h < 4:
        return None

    crop = src[min_y : max_y + 1, min_x : max_x + 1, :].copy()
    crop_mask = mask[min_y : max_y + 1, min_x : max_x + 1]
    crop_base_alpha = base_alpha[min_y : max_y + 1, min_x : max_x + 1]
    final_alpha = np.where(crop_mask, crop_base_alpha, 0.0)
    crop[..., 3] = np.clip(final_alpha * 255.0, 0, 255).astype(np.uint8)

    part_img = Image.fromarray(crop, "RGBA")
    buffer = BytesIO()
    part_img.save(buffer, format="PNG")
    png_data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    return {
        "name": name,
        "displayName": display_name,
        "label": label_index,
        "bbox": {"x": min_x, "y": min_y, "w": box_w, "h": box_h},
        "area": area,
        "pngDataUrl": png_data_url,
        "width": box_w,
        "height": box_h,
    }


def human_parse_parts(image: Image.Image, requested_device: str) -> dict:
    """像素级人体解析 → 语义部件的 bbox + 不规则透明 PNG（用解析 mask 裁 alpha）。

    除每个 ATR 单类外，额外合成 head / torso 复合件对齐 humanoid 槽位，让 autoRig 自动命中；
    四肢交给 MediaPipe poseToParts，两者互补。若源图已是去底 RGBA，会与原 alpha 相乘保留抠图边缘。
    返回 {parts: [...], width, height, labels_present}。
    """
    import numpy as np

    seg, width, height = human_parse_label_map(image, requested_device)
    rgba = image.convert("RGBA")
    src = np.array(rgba, dtype=np.uint8)  # [H, W, 4]
    base_alpha = src[..., 3].astype(np.float32) / 255.0  # 源图自带 alpha（去底结果）

    parts: list[dict] = []
    labels_present: list[str] = []

    # 1) 先合成 head / torso 复合件（mask 并集），让槽位名对齐 humanoid 模板。
    for composite in HUMAN_PARSE_COMPOSITES:
        union_mask = np.zeros((height, width), dtype=bool)
        for label_index in composite["labels"]:
            union_mask |= seg == label_index
        part = _human_parse_mask_to_part(
            union_mask, src, base_alpha, composite["name"], composite["displayName"], composite["label_id"]
        )
        if part is not None:
            labels_present.append(composite["name"])
            parts.append(part)

    # 2) 再输出每个 ATR 单类（保留原名供手动绑定，复合件已覆盖的类也单独导出便于细调）。
    for label_index, meta in HUMAN_PARSE_LABELS.items():
        if meta is None:
            continue
        name, display_cn = meta
        mask = seg == label_index
        part = _human_parse_mask_to_part(mask, src, base_alpha, name, f"{name}_{display_cn}", label_index)
        if part is not None:
            labels_present.append(name)
            parts.append(part)

    return {
        "parts": parts,
        "width": int(width),
        "height": int(height),
        "labels_present": labels_present,
    }


def decode_data_url_image(data_url: str) -> Image.Image:
    """把前端传来的 base64 data URL 解码成 PIL 图。"""
    raw = data_url.strip()
    if raw.startswith("data:"):
        comma = raw.find(",")
        if comma < 0:
            raise ValueError("invalid data url")
        raw = raw[comma + 1 :]
    binary = base64.b64decode(raw)
    with Image.open(BytesIO(binary)) as image:
        return image.convert("RGBA")


# ---------------------------------------------------------------------------
# LaMa inpainting
# ---------------------------------------------------------------------------

def import_lama_dependencies():
    """懒加载 torch，镜像 import_ai_matte_dependencies 的缺包报错风格。"""
    configure_ai_model_cache()
    try:
        import torch  # noqa: F401
    except ModuleNotFoundError as exc:
        missing_name = getattr(exc, "name", "torch")
        raise RuntimeError(
            f"{missing_name} is not installed. Run: python -m pip install -r requirements-ai.txt"
        ) from exc


def load_lama_model(requested_device: str, task_id: str = ""):
    """加载并缓存 LaMa inpainting 模型。"""
    import_lama_dependencies()
    import torch

    device = resolve_ai_runtime_device(torch, requested_device)
    if device in _LAMA_MODEL_CACHE:
        return _LAMA_MODEL_CACHE[device], device

    try:
        from simple_lama_inpainting import SimpleLama
    except ModuleNotFoundError:
        SimpleLama = None

    from sprite_lab.tasks.runner import update_task_progress
    update_task_progress(task_id, 30, "正在加载背景补全引擎…")

    if SimpleLama is not None:
        model = SimpleLama()
        _LAMA_MODEL_CACHE[device] = ("lama", model)
        return _LAMA_MODEL_CACHE[device], device

    _LAMA_MODEL_CACHE[device] = ("opencv", None)
    return _LAMA_MODEL_CACHE[device], device


def create_mask_from_rects(width: int, height: int, rects: list[dict]) -> Image.Image:
    """根据矩形框列表生成二值遮罩。白色(255)=待填充区域，黑色(0)=保留区域。"""
    from PIL import ImageDraw

    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    for rect in rects:
        x, y, w, h = rect["x"], rect["y"], rect["w"], rect["h"]
        draw.rectangle([x, y, x + w, y + h], fill=255)
    return mask


def run_bg_inpaint(
    image_data_url: str = "",
    upload_id: str = "",
    rects: list[dict] | None = None,
    ai_device: str = "auto",
    task_id: str = "",
) -> dict:
    """执行背景补全：优先 LaMa，缺失时回退到 OpenCV inpaint。"""
    from sprite_lab.tasks.runner import update_task_progress
    import numpy as np
    import cv2

    update_task_progress(task_id, 10, "正在准备图像和遮罩…")

    # 解析输入图片
    data_url = str(image_data_url or "").strip()
    if data_url:
        image = decode_data_url_image(data_url)
    else:
        uid = str(upload_id or "").strip()
        if not uid:
            raise ValueError("需要 image_data_url 或 upload_id")
        from sprite_lab.storage.uploads import source_media_entry
        from sprite_lab.imaging.canvas import open_rgba_image
        path, media_type = source_media_entry(uid)
        if not str(media_type).startswith("image"):
            raise ValueError("仅支持图片来源")
        image = open_rgba_image(path)

    if rects is None:
        rects = []

    width, height = image.size
    mask = create_mask_from_rects(width, height, rects)

    update_task_progress(task_id, 20, "正在加载背景补全引擎…")

    model_info, device = load_lama_model(ai_device, task_id)
    engine = model_info[0]

    update_task_progress(task_id, 50, "正在执行背景补全推理…")

    if engine == "lama":
        result_image = model_info[1](image.convert("RGB"), mask).convert("RGBA")
    else:
        rgba = image.convert("RGBA")
        src = np.array(rgba.convert("RGB"), dtype=np.uint8)
        mask_np = np.array(mask, dtype=np.uint8)
        result_bgr = cv2.inpaint(src[:, :, ::-1], mask_np, 3, cv2.INPAINT_TELEA)
        result_rgb = Image.fromarray(result_bgr[:, :, ::-1]).convert("RGBA")
        result_rgb.putalpha(rgba.getchannel("A"))
        result_image = result_rgb

    update_task_progress(task_id, 85, "正在编码结果图像…")

    # 结果转 base64 data URL
    buf = BytesIO()
    result_image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    result_data_url = f"data:image/png;base64,{b64}"

    # 遮罩预览（调试用）
    mask_buf = BytesIO()
    mask.save(mask_buf, format="PNG")
    mask_b64 = base64.b64encode(mask_buf.getvalue()).decode("ascii")
    mask_data_url = f"data:image/png;base64,{mask_b64}"

    update_task_progress(task_id, 95, "背景补全完成。")

    return {
        "result_data_url": result_data_url,
        "mask_data_url": mask_data_url,
        "width": width,
        "height": height,
    }


def import_corridorkey_dependencies():
    configure_ai_model_cache()
    root = default_corridorkey_root()
    module_dir = root / "CorridorKeyModule"
    if not module_dir.exists():
        raise RuntimeError(
            f"CorridorKey is not installed at {root}. Run setup_ai_runtime.bat or clone {CORRIDORKEY_REPO_URL}."
        )

    root_text = str(root)
    if root_text not in sys.path:
        sys.path.insert(0, root_text)

    os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
    os.environ.setdefault("CORRIDORKEY_SKIP_COMPILE", "1")

    try:
        import importlib
        import numpy as np
        import torch
    except ModuleNotFoundError as exc:
        missing_name = getattr(exc, "name", "CorridorKey dependency")
        raise RuntimeError(
            f"{missing_name} is not installed. Run: python -m pip install -r requirements-ai.txt"
        ) from exc

    try:
        corridor_backend = importlib.import_module("CorridorKeyModule.backend")
    except ModuleNotFoundError as exc:
        raise RuntimeError(f"CorridorKey could not be imported from {root}.") from exc

    try:
        corridor_inference = importlib.import_module("CorridorKeyModule.inference_engine")
    except ModuleNotFoundError as exc:
        raise RuntimeError(f"CorridorKey inference engine could not be imported from {root}.") from exc

    patch_corridorkey_gpu_despeckle(corridor_inference, torch)

    checkpoint_dir = module_dir / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    corridor_backend.CHECKPOINT_DIR = str(checkpoint_dir)
    return np, torch, corridor_backend, root


def patch_corridorkey_gpu_despeckle(corridor_inference, torch_module) -> None:
    try:
        color_utils = corridor_inference.cu
        transforms_functional = corridor_inference.TF
    except Exception:
        return
    if getattr(color_utils.clean_matte_torch, "_sprite_video_lab_safe", False):
        return

    original_clean_matte_torch = color_utils.clean_matte_torch
    functional = torch_module.nn.functional

    def safe_clean_matte_torch(alpha, area_threshold: int, dilation: int = 15, blur_size: int = 5):
        _batch, _channels, height, width = alpha.shape
        if (height * width) <= CORRIDORKEY_GPU_DESPECKLE_PIXEL_LIMIT:
            return original_clean_matte_torch(alpha, area_threshold, dilation=dilation, blur_size=blur_size)

        mask = (alpha > 0.25).to(dtype=alpha.dtype)
        if area_threshold > 0:
            opening_radius = max(1, min(4, area_threshold // 100))
            kernel_size = (opening_radius * 2) + 1
            for _ in range(2):
                mask = -functional.max_pool2d(-mask, kernel_size, stride=1, padding=opening_radius)
                mask = functional.max_pool2d(mask, kernel_size, stride=1, padding=opening_radius)
        if dilation > 0:
            repeats = max(1, dilation // 2)
            for _ in range(repeats):
                mask = functional.max_pool2d(mask, 5, stride=1, padding=2)
        if blur_size > 0:
            kernel_size = int(blur_size * 2 + 1)
            mask = transforms_functional.gaussian_blur(mask, [kernel_size, kernel_size])
        return alpha * mask

    safe_clean_matte_torch._sprite_video_lab_safe = True
    color_utils.clean_matte_torch = safe_clean_matte_torch


def load_corridorkey_engine(requested_device: str, screen_color: str):
    _np, torch_module, corridor_backend, root = import_corridorkey_dependencies()
    device = resolve_ai_runtime_device(torch_module, requested_device)
    cache_key = (device, screen_color)
    if cache_key in _CORRIDORKEY_ENGINE_CACHE:
        return _CORRIDORKEY_ENGINE_CACHE[cache_key], device, root

    engine = corridor_backend.create_engine(
        backend="torch",
        device=device,
        img_size=CORRIDORKEY_IMG_SIZE,
        screen_color=screen_color,
    )
    _CORRIDORKEY_ENGINE_CACHE[cache_key] = engine
    return engine, device, root


def linear_to_srgb_array(values):
    import numpy as np

    clipped = np.clip(values, 0.0, None)
    return np.where(clipped <= 0.0031308, clipped * 12.92, 1.055 * np.power(clipped, 1.0 / 2.4) - 0.055)


def corridorkey_processed_to_image(processed) -> Image.Image:
    import numpy as np

    alpha = np.clip(processed[..., 3:4], 0.0, 1.0)
    premul_rgb = np.clip(processed[..., :3], 0.0, None)
    straight_linear = np.zeros_like(premul_rgb)
    np.divide(premul_rgb, np.maximum(alpha, 1e-6), out=straight_linear, where=alpha > 1e-6)
    straight_srgb = linear_to_srgb_array(straight_linear)
    rgba = np.concatenate([straight_srgb, alpha], axis=-1)
    rgba_u8 = (np.clip(rgba, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
    return Image.fromarray(rgba_u8, "RGBA")


def corridorkey_auto_despeckle_on_gpu(image: Image.Image) -> bool:
    return True


def corridorkey_postprocess_on_gpu(device: str) -> bool:
    return str(device).startswith("cuda")


def corridorkey_process_arrays(
    engine,
    rgb,
    mask,
    screen_channel: int,
    despill_strength: float,
    post_process_on_gpu: bool,
    auto_despeckle: bool,
):
    result = engine.process_frame(
        rgb,
        mask,
        input_is_linear=False,
        fg_is_straight=True,
        despill_strength=max(0.0, min(1.0, float(despill_strength or 0.0))),
        auto_despeckle=auto_despeckle,
        despeckle_size=400,
        generate_comp=False,
        post_process_on_gpu=post_process_on_gpu,
        screen_channel=screen_channel,
    )
    return result


def corridorkey_alpha_to_image(alpha) -> Image.Image:
    import numpy as np

    alpha_array = np.asarray(alpha)
    if alpha_array.ndim == 3:
        alpha_array = alpha_array[..., 0]
    alpha_u8 = (np.clip(alpha_array, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
    return Image.fromarray(alpha_u8, "L")


def corridorkey_refine_frame(
    image: Image.Image,
    alpha_mask: Image.Image,
    requested_device: str,
    screen_color: str,
    despill_strength: float,
) -> tuple[Image.Image, dict]:
    import numpy as np

    engine, device, root = load_corridorkey_engine(requested_device, screen_color)
    screen_channel = 2 if screen_color == "blue" else 1
    post_process_on_gpu = corridorkey_postprocess_on_gpu(device)
    auto_despeckle = not post_process_on_gpu or corridorkey_auto_despeckle_on_gpu(image)
    uses_safe_despeckle = post_process_on_gpu and (image.size[0] * image.size[1]) > CORRIDORKEY_GPU_DESPECKLE_PIXEL_LIMIT
    rgb = np.array(image.convert("RGB"), dtype=np.uint8, copy=True)
    mask = np.array(alpha_mask.convert("L"), dtype=np.uint8, copy=True)
    result = corridorkey_process_arrays(
        engine,
        rgb,
        mask,
        screen_channel,
        despill_strength,
        post_process_on_gpu,
        auto_despeckle,
    )
    alpha = corridorkey_alpha_to_image(result["processed"][..., 3:4])
    refined = apply_alpha_mask(image, alpha)
    refined = despill_alpha_edges(refined, auto_key_color(image), despill_strength)

    info = {
        "corridorkey_enabled": True,
        "corridorkey_color_source": "original",
        "corridorkey_screen_color": screen_color,
        "corridorkey_device": device,
        "corridorkey_resolution": CORRIDORKEY_IMG_SIZE,
        "corridorkey_post_process": "gpu" if post_process_on_gpu else "cpu",
        "corridorkey_auto_despeckle": auto_despeckle,
        "corridorkey_safe_despeckle": uses_safe_despeckle,
        "corridorkey_tiled": False,
        "corridorkey_root": str(root),
    }
    return refined, info


def fit_image_to_square(image: Image.Image, size: int) -> tuple[Image.Image, tuple[int, int, int, int]]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    if width <= 0 or height <= 0:
        raise ValueError("invalid image size for BiRefNet inference")

    scale = min(size / width, size / height)
    resized_size = (
        max(1, round(width * scale)),
        max(1, round(height * scale)),
    )
    resized = rgb.resize(resized_size, LANCZOS)
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    left = (size - resized_size[0]) // 2
    top = (size - resized_size[1]) // 2
    canvas.paste(resized, (left, top))
    return canvas, (left, top, left + resized_size[0], top + resized_size[1])


def birefnet_alpha_mask(
    image: Image.Image,
    model_key: str,
    requested_device: str,
    inference_resolution: int,
) -> tuple[Image.Image, dict]:
    torch_module, transforms, _auto_model = import_ai_matte_dependencies()
    model, device, normalized_model_key, repo_id = load_birefnet_model(model_key, requested_device)
    resolution = normalize_ai_resolution(inference_resolution)
    fitted_image, fitted_box = fit_image_to_square(image, resolution)
    transform = transforms.Compose(
        [
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    input_tensor = transform(fitted_image).unsqueeze(0).to(device)
    try:
        model_dtype = next(model.parameters()).dtype
    except StopIteration:
        model_dtype = input_tensor.dtype
    if str(device).startswith("cuda") and model_dtype in {torch_module.float16, torch_module.bfloat16}:
        input_tensor = input_tensor.to(dtype=model_dtype)
    with torch_module.no_grad():
        prediction = model(input_tensor)[-1].sigmoid().to("cpu")
    mask = transforms.ToPILImage()(prediction[0].squeeze()).convert("L")
    mask = mask.crop(fitted_box).resize(image.size, LANCZOS)
    return mask, {
        "model_key": normalized_model_key,
        "model_label": AI_MATTE_MODEL_LABELS[normalized_model_key],
        "repo_id": repo_id,
        "device": device,
        "resolution": resolution,
    }


def despill_alpha_edges(
    image: Image.Image,
    key_rgb: tuple[int, int, int],
    strength: float,
) -> Image.Image:
    normalized_strength = max(0.0, min(2.5, float(strength or 0.0)))
    if normalized_strength <= 0:
        return image

    rgba = image.convert("RGBA")
    k_r, k_g, k_b = key_rgb
    key_channels = (k_r, k_g, k_b)
    spill_channel = max(range(3), key=lambda index: key_channels[index])
    output_pixels: list[tuple[int, int, int, int]] = []
    for r_value, g_value, b_value, alpha in rgba.getdata():
        channels = [r_value, g_value, b_value]
        spill_value = channels[spill_channel]
        other_values = [value for index, value in enumerate(channels) if index != spill_channel]
        spill = max(0, spill_value - max(other_values))
        if spill <= 0:
            output_pixels.append((r_value, g_value, b_value, alpha))
            continue

        dist = math.sqrt((r_value - k_r) ** 2 + (g_value - k_g) ** 2 + (b_value - k_b) ** 2)
        key_closeness = 1.0 - min(dist / 220.0, 1.0)
        edge_factor = 1.0 - (alpha / 255.0)
        cleanup_factor = max(edge_factor, key_closeness * 0.7)
        reduction = int(spill * normalized_strength * cleanup_factor)
        channels[spill_channel] = max(0, spill_value - reduction)
        output_pixels.append((channels[0], channels[1], channels[2], alpha))

    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(output_pixels)
    return cleaned


def edge_decontaminate(image: Image.Image, radius: int = 2, strength: float = 1.0) -> Image.Image:
    """边缘去污：把半透明边缘像素的 RGB 替换为最近不透明像素颜色，消除白色/背景色残留。

    原理类似 Photoshop「Defringe / Remove White Matte」：
    1. 找到半透明区域（alpha 在 1-254 之间）；
    2. 用邻域完全不透明像素的颜色做加权平均，替换这些半透明像素的 RGB；
    3. 保留原始 alpha 不变。

    Args:
        image: RGBA 图像
        radius: 扩散搜索半径（像素），越大越能填充较宽的白边
        strength: 替换强度（0-1），1.0 = 完全替换，0.5 = 与原色混合
    """
    if strength <= 0:
        return image
    strength = min(1.0, float(strength))
    radius = max(1, min(8, int(radius)))

    import numpy as np

    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    # 不透明蒙版：alpha >= 250 视为完全不透明
    opaque_mask = alpha >= 250.0
    # 半透明蒙版：需要去污的区域
    semi_mask = (alpha > 0) & (alpha < 250.0)

    if not np.any(semi_mask):
        return image

    # 为不透明像素建立颜色场，然后用 box blur 扩散到半透明区域
    weight_map = opaque_mask.astype(np.uint8) * 255
    color_sum = np.zeros((h, w, 3), dtype=np.uint8)
    color_sum[opaque_mask] = np.clip(arr[opaque_mask, :3], 0, 255).astype(np.uint8)

    # 多次 box blur 迭代实现扩散；Pillow 的 BoxBlur 不支持 F 模式，使用 L 模式再转回 float 归一化
    blur_radius = max(1, radius)
    iterations = max(1, radius)

    weight_img = Image.fromarray(weight_map, mode="L")
    r_img = Image.fromarray(color_sum[:, :, 0], mode="L")
    g_img = Image.fromarray(color_sum[:, :, 1], mode="L")
    b_img = Image.fromarray(color_sum[:, :, 2], mode="L")

    box_filter = ImageFilter.BoxBlur(blur_radius)
    for _ in range(iterations):
        weight_img = weight_img.filter(box_filter)
        r_img = r_img.filter(box_filter)
        g_img = g_img.filter(box_filter)
        b_img = b_img.filter(box_filter)

    weight_arr = np.array(weight_img, dtype=np.float32) / 255.0
    filled_r = np.array(r_img, dtype=np.float32) / 255.0
    filled_g = np.array(g_img, dtype=np.float32) / 255.0
    filled_b = np.array(b_img, dtype=np.float32) / 255.0

    # 归一化
    safe_weight = np.maximum(weight_arr, 1e-6)
    filled_r = (filled_r / safe_weight) * 255.0
    filled_g = (filled_g / safe_weight) * 255.0
    filled_b = (filled_b / safe_weight) * 255.0

    # 只替换半透明像素的 RGB，越透明替换越强
    blend = strength * (1.0 - alpha[semi_mask] / 250.0)
    blend = np.clip(blend, 0.0, 1.0)

    arr[semi_mask, 0] = arr[semi_mask, 0] * (1.0 - blend) + filled_r[semi_mask] * blend
    arr[semi_mask, 1] = arr[semi_mask, 1] * (1.0 - blend) + filled_g[semi_mask] * blend
    arr[semi_mask, 2] = arr[semi_mask, 2] * (1.0 - blend) + filled_b[semi_mask] * blend

    result = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    return result


def apply_matte_pipeline(
    raw_images: list[Image.Image],
    chroma_enabled: bool,
    matte_mode: str,
    key_mode: str,
    manual_key_hex: str,
    threshold: int,
    softness: int,
    despill_strength: float,
    halo_pixels: int,
    ai_model: str,
    ai_device: str,
    ai_resolution: int,
    luma_black: int,
    luma_white: int,
    luma_gamma: float,
    luma_strength: float,
    corridorkey_enabled: bool,
    corridorkey_screen: str,
    sf_tolerance: float = 120.0,
    sf_edge_blend: bool = True,
    sf_blend_zone_ratio: float = 0.6,
    sf_alpha_cutoff: int = 8,
    sf_spill_removal: bool = True,
    sf_spill_strength: float = 0.45,
    decontaminate_enabled: bool = True,
    decontaminate_radius: int = 2,
    decontaminate_strength: float = 1.0,
    pipeline: list[str] | None = None,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[list[Image.Image], tuple[int, int, int], dict]:
    if not raw_images:
        raise ValueError("no frames to matte")

    mode = normalize_matte_mode(matte_mode, chroma_enabled)
    key_rgb = auto_key_color(raw_images[0])
    if key_mode == "manual":
        key_rgb = parse_hex_color(manual_key_hex)
    normalized_luma_black = max(0, min(254, int(luma_black)))
    normalized_luma_white = max(normalized_luma_black + 1, min(255, int(luma_white)))
    matte_info = {
        "mode": mode,
        "model_key": "",
        "model_label": "",
        "repo_id": "",
        "device": "",
        "resolution": 0,
        "luma_enabled": mode in {"luma", "birefnet_luma", "birefnet_luma_corridorkey"},
        "luma_black": normalized_luma_black,
        "luma_white": normalized_luma_white,
        "luma_gamma": max(0.05, float(luma_gamma or 1.0)),
        "luma_strength": max(0.0, min(2.0, float(luma_strength or 1.0))),
        "despill_strength": max(0.0, min(2.5, float(despill_strength or 0.0))),
        "halo_pixels": max(0, int(halo_pixels)),
        "corridorkey_enabled": False,
        "corridorkey_screen_color": "",
        "corridorkey_device": "",
        "corridorkey_resolution": 0,
        "sf_tolerance": max(1.0, float(sf_tolerance or 120.0)),
        "sf_edge_blend": bool(sf_edge_blend),
        "sf_blend_zone_ratio": min(0.95, max(0.05, float(sf_blend_zone_ratio if sf_blend_zone_ratio is not None else 0.6))),
        "sf_alpha_cutoff": max(0, min(255, int(sf_alpha_cutoff))),
        "sf_spill_removal": bool(sf_spill_removal),
        "sf_spill_strength": min(1.0, max(0.0, float(sf_spill_strength if sf_spill_strength is not None else 0.45))),
        "decontaminate_enabled": bool(decontaminate_enabled),
        "decontaminate_radius": max(1, min(8, int(decontaminate_radius))),
        "decontaminate_strength": max(0.0, min(1.0, float(decontaminate_strength))),
    }
    mode_uses_corridorkey = mode in {"corridorkey", "birefnet_corridorkey", "birefnet_luma_corridorkey"}
    use_corridorkey = bool((corridorkey_enabled or mode_uses_corridorkey) and mode != "none")
    resolved_corridorkey_screen = resolve_corridorkey_screen(corridorkey_screen, key_rgb)

    if mode == "none" and not pipeline:
        return raw_images, key_rgb, matte_info

    _dbg(f"apply_matte_pipeline 开始: mode={mode}, pipeline={pipeline}, 帧数={len(raw_images)}, on_progress={'有' if on_progress else '无'}")

    # 新管线路径：pipeline 非空时走 alpha 合并逻辑
    if pipeline and len(pipeline) > 0:
        matte_info["mode"] = "+".join(pipeline)
        matte_info["pipeline"] = list(pipeline)
        keyed_frames: list[Image.Image] = []
        ai_info: dict | None = None
        corridor_info: dict | None = None
        pipe_has_corridorkey = "corridorkey" in pipeline

        for raw_index, raw_image in enumerate(raw_images):
            accumulated_alpha: Image.Image | None = None
            for step_index, step_mode in enumerate(pipeline):
                step_alpha: Image.Image | None = None
                if step_mode == "birefnet":
                    step_alpha, ai_info = birefnet_alpha_mask(raw_image, ai_model, ai_device, ai_resolution)
                elif step_mode == "luma":
                    step_alpha = luminance_alpha_mask(
                        raw_image,
                        matte_info["luma_black"],
                        max(matte_info["luma_black"] + 1, matte_info["luma_white"]),
                        matte_info["luma_gamma"],
                        matte_info["luma_strength"],
                        key_rgb=key_rgb,
                    )
                elif step_mode == "chroma":
                    chroma_result = chroma_key_frame(
                        image=raw_image,
                        key_rgb=key_rgb,
                        threshold=threshold,
                        softness=softness,
                        despill_strength=0.0,
                        halo_pixels=0,
                    )
                    step_alpha = chroma_result.getchannel("A")
                elif step_mode == "spriteflow":
                    sf_result = spriteflow_key_frame(
                        raw_image.convert("RGBA"),
                        key_rgb,
                        matte_info["sf_tolerance"],
                        matte_info["sf_edge_blend"],
                        matte_info["sf_blend_zone_ratio"],
                        matte_info["sf_alpha_cutoff"],
                        matte_info["sf_spill_removal"],
                        matte_info["sf_spill_strength"],
                    )
                    step_alpha = sf_result.getchannel("A")
                elif step_mode == "corridorkey":
                    # corridorkey 需要一个初始 alpha 做输入；用当前累积的或全白
                    base_alpha = accumulated_alpha if accumulated_alpha else Image.new("L", raw_image.size, 255)
                    refined_frame, corridor_info = corridorkey_refine_frame(
                        raw_image, base_alpha, ai_device, resolved_corridorkey_screen, matte_info["despill_strength"]
                    )
                    step_alpha = refined_frame.getchannel("A")

                if step_alpha is not None:
                    accumulated_alpha = ImageChops.lighter(accumulated_alpha, step_alpha) if accumulated_alpha else step_alpha

                if on_progress:
                    done_units = (raw_index * len(pipeline)) + (step_index + 1)
                    total_units = max(1, len(raw_images) * len(pipeline))
                    percent = 40 + (done_units * 23 // total_units)
                    on_progress(percent, f"执行抠图流水线：{raw_index + 1}/{len(raw_images)} 帧")

            # 应用 halo_pixels MinFilter
            if matte_info["halo_pixels"] > 0:
                filter_size = (matte_info["halo_pixels"] * 2) + 1
                accumulated_alpha = accumulated_alpha.filter(ImageFilter.MinFilter(filter_size))

            # 最终合成：corridorkey 已产生完整帧；否则用 alpha mask + despill
            if pipe_has_corridorkey and corridor_info:
                # corridorkey_refine_frame 的结果已有 despill，直接用最终 alpha
                keyed_frame = apply_alpha_mask(raw_image, accumulated_alpha)
            else:
                keyed_frame = apply_alpha_mask(raw_image, accumulated_alpha)
                keyed_frame = despill_alpha_edges(keyed_frame, key_rgb, matte_info["despill_strength"])
            keyed_frames.append(keyed_frame)

        if ai_info:
            matte_info.update(ai_info)
        if corridor_info:
            matte_info.update(corridor_info)
        if matte_info["decontaminate_enabled"]:
            keyed_frames = [edge_decontaminate(f, matte_info["decontaminate_radius"], matte_info["decontaminate_strength"]) for f in keyed_frames]
        return keyed_frames, key_rgb, matte_info

    # 以下为旧单模式兼容路径
    if mode in {"chroma", "corridorkey"}:
        keyed_frames = []
        corridor_info: dict | None = None
        for raw_index, raw_image in enumerate(raw_images):
            chroma_frame = chroma_key_frame(
                image=raw_image,
                key_rgb=key_rgb,
                threshold=threshold,
                softness=softness,
                despill_strength=despill_strength,
                halo_pixels=halo_pixels,
            )
            if use_corridorkey:
                refined_frame, corridor_info = corridorkey_refine_frame(
                    raw_image,
                    chroma_frame.getchannel("A"),
                    ai_device,
                    resolved_corridorkey_screen,
                    matte_info["despill_strength"],
                )
                keyed_frames.append(refined_frame)
            else:
                keyed_frames.append(chroma_frame)
            if on_progress:
                percent = 40 + ((raw_index + 1) * 23 // max(1, len(raw_images)))
                on_progress(percent, f"执行抠图流水线：{raw_index + 1}/{len(raw_images)} 帧")
        if corridor_info:
            matte_info.update(corridor_info)
        if matte_info["decontaminate_enabled"]:
            keyed_frames = [edge_decontaminate(f, matte_info["decontaminate_radius"], matte_info["decontaminate_strength"]) for f in keyed_frames]
        return keyed_frames, key_rgb, matte_info

    if mode == "spriteflow":
        _dbg(f"进入 spriteflow 分支: 帧数={len(raw_images)}")
        keyed_frames: list[Image.Image] = []
        for raw_index, raw_image in enumerate(raw_images):
            if on_progress:
                percent = 40 + ((raw_index + 1) * 23 // max(1, len(raw_images)))
                on_progress(percent, f"执行抠图流水线：{raw_index + 1}/{len(raw_images)} 帧")
            keyed_frame = spriteflow_key_frame(
                raw_image.convert("RGBA"),
                key_rgb,
                matte_info["sf_tolerance"],
                matte_info["sf_edge_blend"],
                matte_info["sf_blend_zone_ratio"],
                matte_info["sf_alpha_cutoff"],
                matte_info["sf_spill_removal"],
                matte_info["sf_spill_strength"],
            )
            if matte_info["halo_pixels"] > 0:
                filter_size = (matte_info["halo_pixels"] * 2) + 1
                eroded = keyed_frame.getchannel("A").filter(ImageFilter.MinFilter(filter_size))
                keyed_frame.putalpha(eroded)
            keyed_frames.append(keyed_frame)
        if matte_info["decontaminate_enabled"]:
            keyed_frames = [edge_decontaminate(f, matte_info["decontaminate_radius"], matte_info["decontaminate_strength"]) for f in keyed_frames]
        return keyed_frames, key_rgb, matte_info

    if mode == "luma":
        _dbg(f"进入 luma 分支: 帧数={len(raw_images)}")
        keyed_frames: list[Image.Image] = []
        for raw_index, raw_image in enumerate(raw_images):
            if on_progress:
                percent = 40 + ((raw_index + 1) * 23 // max(1, len(raw_images)))
                on_progress(percent, f"执行抠图流水线：{raw_index + 1}/{len(raw_images)} 帧")
            alpha = luminance_alpha_mask(
                raw_image,
                matte_info["luma_black"],
                max(matte_info["luma_black"] + 1, matte_info["luma_white"]),
                matte_info["luma_gamma"],
                matte_info["luma_strength"],
                key_rgb=key_rgb,
            )
            if matte_info["halo_pixels"] > 0:
                filter_size = (matte_info["halo_pixels"] * 2) + 1
                alpha = alpha.filter(ImageFilter.MinFilter(filter_size))
            keyed_frame = apply_alpha_mask(raw_image, alpha)
            keyed_frame = despill_alpha_edges(keyed_frame, key_rgb, matte_info["despill_strength"])
            keyed_frames.append(keyed_frame)
        if matte_info["decontaminate_enabled"]:
            keyed_frames = [edge_decontaminate(f, matte_info["decontaminate_radius"], matte_info["decontaminate_strength"]) for f in keyed_frames]
        return keyed_frames, key_rgb, matte_info

    _dbg(f"进入 birefnet 默认分支: mode={mode}, 帧数={len(raw_images)}")
    keyed_frames: list[Image.Image] = []
    ai_info: dict | None = None
    corridor_info: dict | None = None
    for raw_index, raw_image in enumerate(raw_images):
        if on_progress:
            percent = 40 + ((raw_index + 1) * 23 // max(1, len(raw_images)))
            on_progress(percent, f"执行抠图流水线：{raw_index + 1}/{len(raw_images)} 帧")
        ai_alpha, ai_info = birefnet_alpha_mask(raw_image, ai_model, ai_device, ai_resolution)
        if matte_info["halo_pixels"] > 0:
            filter_size = (matte_info["halo_pixels"] * 2) + 1
            ai_alpha = ai_alpha.filter(ImageFilter.MinFilter(filter_size))
        if mode in {"birefnet_luma", "birefnet_luma_corridorkey"}:
            luma_alpha = luminance_alpha_mask(
                raw_image,
                matte_info["luma_black"],
                max(matte_info["luma_black"] + 1, matte_info["luma_white"]),
                matte_info["luma_gamma"],
                matte_info["luma_strength"],
                key_rgb=key_rgb,
            )
            alpha = ImageChops.lighter(ai_alpha, luma_alpha)
        else:
            alpha = ai_alpha
        if use_corridorkey:
            keyed_frame, corridor_info = corridorkey_refine_frame(
                raw_image,
                alpha,
                ai_device,
                resolved_corridorkey_screen,
                matte_info["despill_strength"],
            )
        else:
            keyed_frame = apply_alpha_mask(raw_image, alpha)
            keyed_frame = despill_alpha_edges(keyed_frame, key_rgb, matte_info["despill_strength"])
        keyed_frames.append(keyed_frame)

    if ai_info:
        matte_info.update(ai_info)
    if corridor_info:
        matte_info.update(corridor_info)
    if matte_info["decontaminate_enabled"]:
        keyed_frames = [edge_decontaminate(f, matte_info["decontaminate_radius"], matte_info["decontaminate_strength"]) for f in keyed_frames]
    return keyed_frames, key_rgb, matte_info


def stable_resize_frames(
    keyed_frames: list[Image.Image],
    target_size: int,
    reduce_px: int,
    canvas_mode: str = "auto",
    hard_alpha: bool = False,
) -> tuple[list[Image.Image], list[tuple[int, int, int, int] | None], float, tuple[int, int]]:
    bboxes = [frame.getchannel("A").getbbox() for frame in keyed_frames]
    valid_boxes = [box for box in bboxes if box is not None]
    if not valid_boxes:
        raise RuntimeError("all frames became transparent after chroma key")

    stable_box = (
        min(box[0] for box in valid_boxes),
        min(box[1] for box in valid_boxes),
        max(box[2] for box in valid_boxes),
        max(box[3] for box in valid_boxes),
    )
    stable_width = stable_box[2] - stable_box[0]
    stable_height = stable_box[3] - stable_box[1]
    canvas_mode = normalize_canvas_mode(canvas_mode)
    canvas_height = max(8, target_size)
    margin = max(0, min(reduce_px, max(0, (canvas_height - 8) // 2)))

    if canvas_mode == "auto":
        inner_height = max(8, canvas_height - (margin * 2))
        scale = inner_height / max(stable_height, 1)
        resized_stable_size = (
            max(1, round(stable_width * scale)),
            max(1, round(stable_height * scale)),
        )
        canvas_width = max(8, resized_stable_size[0] + (margin * 2))
        paste_x = (canvas_width - resized_stable_size[0]) // 2
        paste_y = (canvas_height - resized_stable_size[1]) // 2
    else:
        inner_size = max(8, canvas_height - (margin * 2))
        scale = min(inner_size / max(stable_width, 1), inner_size / max(stable_height, 1))
        resized_stable_size = (
            max(1, round(stable_width * scale)),
            max(1, round(stable_height * scale)),
        )
        canvas_width = canvas_height
        paste_x = (canvas_width - resized_stable_size[0]) // 2
        if canvas_mode == "square_center":
            paste_y = (canvas_height - resized_stable_size[1]) // 2
        else:
            paste_y = canvas_height - margin - resized_stable_size[1]

    canvas_size = (canvas_width, canvas_height)

    rendered: list[Image.Image] = []
    for frame in keyed_frames:
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        cropped = frame.crop(stable_box)
        resized = resize_rgba_with_premultiplied_alpha(
            cropped,
            resized_stable_size,
        )
        if hard_alpha:
            resized = enforce_hard_alpha(resized)
        canvas.paste(resized, (paste_x, paste_y), resized)
        if hard_alpha:
            canvas = enforce_hard_alpha(canvas)
        rendered.append(canvas)

    return rendered, bboxes, scale, canvas_size


def rematte_job_frames(
    job_id: str,
    frame_indices: list[int],
    target_size: int,
    reduce_px: int,
    canvas_mode: str,
    chroma_enabled: bool,
    matte_mode: str,
    key_mode: str,
    manual_key_hex: str,
    threshold: int,
    softness: int,
    despill_strength: float,
    halo_pixels: int,
    ai_model: str,
    ai_device: str,
    ai_resolution: int,
    luma_black: int,
    luma_white: int,
    luma_gamma: float,
    luma_strength: float,
    corridorkey_enabled: bool,
    corridorkey_screen: str,
    batch_green_to_black: bool = False,
    batch_semitransparent_to_black: bool = False,
    batch_semitransparent_to_opaque: bool = False,
    sf_tolerance: float = 120.0,
    sf_edge_blend: bool = True,
    sf_blend_zone_ratio: float = 0.6,
    sf_alpha_cutoff: int = 8,
    sf_spill_removal: bool = True,
    sf_spill_strength: float = 0.45,
    decontaminate_enabled: bool = True,
    decontaminate_radius: int = 2,
    decontaminate_strength: float = 1.0,
    pipeline: list[str] | None = None,
) -> dict:
    manifest = load_job_manifest(job_id)
    frames = manifest.get("frames") or []
    frame_map = {safe_int(entry.get("index"), -1): entry for entry in frames}
    indices: list[int] = []
    seen: set[int] = set()
    for index in frame_indices:
        normalized = safe_int(index, -1)
        if normalized in frame_map and normalized not in seen:
            indices.append(normalized)
            seen.add(normalized)
    if not indices:
        raise ValueError("no valid frames selected")

    raw_dir = Path(str(manifest.get("raw_dir") or job_dir(job_id) / "raw"))
    processed_dir = Path(str(manifest.get("processed_dir") or job_dir(job_id) / "processed"))
    thumbs_dir = job_dir(job_id) / "thumbs"
    processed_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    raw_images = [open_rgba_image(job_raw_frame_path(raw_dir, index)) for index in indices]
    try:
        keyed_frames, key_rgb, matte_info = apply_matte_pipeline(
            raw_images=raw_images,
            chroma_enabled=chroma_enabled,
            matte_mode=matte_mode,
            key_mode=key_mode,
            manual_key_hex=manual_key_hex,
            threshold=threshold,
            softness=softness,
            despill_strength=despill_strength,
            halo_pixels=halo_pixels,
            ai_model=ai_model,
            ai_device=ai_device,
            ai_resolution=ai_resolution,
            luma_black=luma_black,
            luma_white=luma_white,
            luma_gamma=luma_gamma,
            luma_strength=luma_strength,
            corridorkey_enabled=corridorkey_enabled,
            corridorkey_screen=corridorkey_screen,
            sf_tolerance=sf_tolerance,
            sf_edge_blend=sf_edge_blend,
            sf_blend_zone_ratio=sf_blend_zone_ratio,
            sf_alpha_cutoff=sf_alpha_cutoff,
            sf_spill_removal=sf_spill_removal,
            sf_spill_strength=sf_spill_strength,
            decontaminate_enabled=decontaminate_enabled,
            decontaminate_radius=decontaminate_radius,
            decontaminate_strength=decontaminate_strength,
            pipeline=pipeline,
        )
        rendered_frames, bboxes, scale, canvas_size = stable_resize_frames(
            keyed_frames,
            target_size,
            reduce_px,
            canvas_mode,
            hard_alpha=matte_info["mode"] == "chroma" and softness == 0 and not matte_info["corridorkey_enabled"],
        )
    finally:
        for image in raw_images:
            image.close()

    revision = int(time.time() * 1000)
    postprocess_changed = {"green_to_black": 0, "semitransparent_to_black": 0, "semitransparent_to_opaque": 0}
    for offset, frame_index in enumerate(indices):
        entry = frame_map[frame_index]
        frame = rendered_frames[offset]
        if batch_green_to_black:
            frame, changed = green_to_black_image(frame)
            postprocess_changed["green_to_black"] += changed
        if batch_semitransparent_to_black:
            frame, changed = semitransparent_to_black_image(frame)
            postprocess_changed["semitransparent_to_black"] += changed
        if batch_semitransparent_to_opaque:
            frame, changed = semitransparent_to_opaque_image(frame)
            postprocess_changed["semitransparent_to_opaque"] += changed

        frame_name = str(entry.get("name") or f"frame_{frame_index + 1:03d}.png")
        thumb_name = f"thumb_{frame_index + 1:03d}.png"
        frame_path = processed_dir / frame_name
        thumb_path = thumbs_dir / thumb_name
        frame.save(frame_path)
        thumb = frame.copy()
        thumb.thumbnail((128, 128))
        thumb.save(thumb_path)
        thumb.close()
        entry.update(
            {
                "bbox": list(bboxes[offset]) if bboxes[offset] else None,
                "width": frame.size[0],
                "height": frame.size[1],
                "url": f"/work/jobs/{job_id}/processed/{frame_name}?v={revision}",
                "thumb_url": f"/work/jobs/{job_id}/thumbs/{thumb_name}?v={revision}",
                "rematte_updated_at": iso_now(),
            }
        )
        frame.close()

    options = manifest.setdefault("options", {})
    options.update(
        {
            "target_size": target_size,
            "reduce_px": reduce_px,
            "canvas_mode": normalize_canvas_mode(canvas_mode),
            "output_width": canvas_size[0],
            "output_height": canvas_size[1],
            "chroma_enabled": chroma_enabled,
            "matte_mode": matte_info["mode"],
            "matte": matte_info,
            "key_mode": key_mode,
            "key_color": rgb_to_hex(key_rgb),
            "threshold": threshold,
            "softness": softness,
            "despill_strength": despill_strength,
            "halo_pixels": halo_pixels,
            "corridorkey_enabled": matte_info["corridorkey_enabled"],
            "corridorkey_screen": matte_info["corridorkey_screen_color"],
            "batch_green_to_black": bool(batch_green_to_black),
            "batch_semitransparent_to_black": bool(batch_semitransparent_to_black),
            "batch_semitransparent_to_opaque": bool(batch_semitransparent_to_opaque),
            "postprocess_changed_pixels": postprocess_changed,
            "scale": scale,
        }
    )
    save_job_manifest(job_id, manifest)
    return manifest


def frame_similarity_signature(image: Image.Image) -> list[float]:
    resized = image.convert("RGBA").resize((32, 32), LANCZOS)
    signature: list[float] = []
    for r_value, g_value, b_value, alpha in resized.getdata():
        alpha_weight = alpha / 255.0
        gray = ((r_value * 0.299) + (g_value * 0.587) + (b_value * 0.114)) / 255.0
        signature.append(gray * alpha_weight)
        signature.append(alpha_weight)
    resized.close()
    return signature


def frame_difference_score(first: list[float], second: list[float]) -> float:
    if not first or not second or len(first) != len(second):
        return 1.0
    return sum(abs(a - b) for a, b in zip(first, second)) / len(first)


def suggest_job_frames(job_id: str, target_count: int) -> dict:
    manifest = load_job_manifest(job_id)
    frames = sorted(manifest.get("frames") or [], key=lambda entry: safe_int(entry.get("index"), -1))
    frames = [entry for entry in frames if safe_int(entry.get("index"), -1) >= 0]
    frame_count = len(frames)
    target_count = clamp_int(target_count, 1, max(1, frame_count))
    if frame_count == 0:
        raise ValueError("no frames available")
    if target_count >= frame_count:
        return {"selected_indices": [entry["index"] for entry in frames], "target_count": target_count, "frame_count": frame_count}

    thumbs_dir = job_dir(job_id) / "thumbs"
    processed_dir = job_dir(job_id) / "processed"
    signatures: dict[int, list[float]] = {}
    for entry in frames:
        index = safe_int(entry.get("index"), -1)
        thumb_path = thumbs_dir / f"thumb_{index + 1:03d}.png"
        frame_path = processed_dir / str(entry.get("name") or f"frame_{index + 1:03d}.png")
        image_path = thumb_path if thumb_path.exists() else frame_path
        with Image.open(image_path) as image:
            signatures[index] = frame_similarity_signature(image)

    def difference(a: int, b: int) -> float:
        return frame_difference_score(signatures[a], signatures[b])

    selected: list[int] = []
    selected_set: set[int] = set()
    similarity_threshold = 0.018
    for slot in range(target_count):
        if target_count == 1:
            start_pos = end_pos = frame_count // 2
        else:
            start_pos = round(slot * (frame_count - 1) / target_count)
            end_pos = round((slot + 1) * (frame_count - 1) / target_count)
        center_pos = round(slot * (frame_count - 1) / max(1, target_count - 1))
        candidate_positions = range(max(0, start_pos), min(frame_count - 1, end_pos) + 1)
        candidate_indices = [safe_int(frames[position].get("index"), -1) for position in candidate_positions]
        center_index = safe_int(frames[center_pos].get("index"), -1)
        best_index = center_index
        if selected:
            last_index = selected[-1]
            best_score = difference(last_index, best_index)
            if best_score < similarity_threshold:
                for candidate_index in candidate_indices:
                    if candidate_index in selected_set:
                        continue
                    score = difference(last_index, candidate_index)
                    if score > best_score:
                        best_index = candidate_index
                        best_score = score
        if best_index not in selected_set:
            selected.append(best_index)
            selected_set.add(best_index)

    while len(selected) < target_count:
        best_index = -1
        best_score = -1.0
        for entry in frames:
            index = safe_int(entry.get("index"), -1)
            if index in selected_set:
                continue
            nearest = min(difference(index, selected_index) for selected_index in selected)
            if nearest > best_score:
                best_index = index
                best_score = nearest
        if best_index < 0:
            break
        selected.append(best_index)
        selected_set.add(best_index)

    selected.sort()
    return {"selected_indices": selected, "target_count": target_count, "frame_count": frame_count}


def extract_raw_frames(
    source_path: Path,
    raw_dir: Path,
    start_time: float,
    end_time: float,
    keep_every: int,
) -> tuple[list[Path], dict]:
    ffmpeg = resolve_ffmpeg_binary("ffmpeg")
    if raw_dir.exists():
        shutil.rmtree(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    def build_args(hwaccel: str | None) -> list[str]:
        args = [ffmpeg, "-y"]
        if hwaccel:
            args += ["-hwaccel", hwaccel]
        args += [
            "-ss",
            f"{start_time:.3f}",
            "-to",
            f"{end_time:.3f}",
            "-i",
            str(source_path),
        ]
        if keep_every > 1:
            args += ["-vf", f"select=not(mod(n\\,{keep_every}))"]
        args += ["-vsync", "0", str(raw_dir / "frame_%05d.png")]
        return args

    accel = run_ffmpeg_with_auto_accel(build_args)
    frames = sorted(raw_dir.glob("frame_*.png"))
    if not frames:
        raise RuntimeError("no frames extracted from the selected segment")
    return frames, accel


def extract_single_frame(source_path: Path, output_path: Path, sample_time: float) -> tuple[Path, dict]:
    ffmpeg = resolve_ffmpeg_binary("ffmpeg")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    def build_args(hwaccel: str | None) -> list[str]:
        args = [ffmpeg, "-y"]
        if hwaccel:
            args += ["-hwaccel", hwaccel]
        args += [
            "-ss",
            f"{sample_time:.3f}",
            "-i",
            str(source_path),
            "-frames:v",
            "1",
            str(output_path),
        ]
        return args

    accel = run_ffmpeg_with_auto_accel(build_args)
    if not output_path.exists():
        raise RuntimeError("failed to extract preview frame")
    return output_path, accel


def process_video_to_job(
    upload_id: str,
    start_time: float,
    end_time: float,
    keep_every: int,
    target_size: int,
    reduce_px: int,
    canvas_mode: str,
    chroma_enabled: bool,
    matte_mode: str,
    key_mode: str,
    manual_key_hex: str,
    threshold: int,
    softness: int,
    despill_strength: float,
    halo_pixels: int,
    ai_model: str,
    ai_device: str,
    ai_resolution: int,
    luma_black: int,
    luma_white: int,
    luma_gamma: float,
    luma_strength: float,
    corridorkey_enabled: bool,
    corridorkey_screen: str,
    batch_green_to_black: bool = False,
    batch_semitransparent_to_black: bool = False,
    batch_semitransparent_to_opaque: bool = False,
    sf_tolerance: float = 120.0,
    sf_edge_blend: bool = True,
    sf_blend_zone_ratio: float = 0.6,
    sf_alpha_cutoff: int = 8,
    sf_spill_removal: bool = True,
    sf_spill_strength: float = 0.45,
    decontaminate_enabled: bool = True,
    decontaminate_radius: int = 2,
    decontaminate_strength: float = 1.0,
    pipeline: list[str] | None = None,
    task_id: str = "",
) -> dict:
    update_task_progress(task_id, 8, "读取素材信息。")
    source_path, media_type = source_media_entry(upload_id)
    info = media_info(source_path, media_type)
    start_time = max(0.0, start_time)
    duration = safe_float(info.get("duration"), 0.0)
    if media_type == "video" and duration > 0:
        end_time = min(end_time, duration)
    elif media_type == "image":
        start_time = 0.0
        end_time = 0.0
    if media_type == "video" and end_time <= start_time:
        raise ValueError("end time must be greater than start time")

    job_id = timestamped_id()
    root = job_dir(job_id)
    raw_dir = root / "raw"
    processed_dir = root / "processed"
    thumbs_dir = root / "thumbs"
    for directory in (processed_dir, thumbs_dir):
        directory.mkdir(parents=True, exist_ok=True)

    if media_type == "image":
        update_task_progress(task_id, 20, "读取图片帧。")
        raw_path = raw_dir / "frame_00001.png"
        _, ffmpeg_accel = extract_image_frame(source_path, raw_path)
        raw_paths = [raw_path]
    else:
        update_task_progress(task_id, 18, "抽取视频帧。")
        raw_paths, ffmpeg_accel = extract_raw_frames(source_path, raw_dir, start_time, end_time, max(1, keep_every))
    update_task_progress(task_id, 28, f"已读取 {len(raw_paths)} 帧，准备抠图。")
    raw_images = [open_rgba_image(path) for path in raw_paths]

    update_task_progress(task_id, 40, "执行抠图流水线。")
    _dbg(f"process_video_to_job: 调用 apply_matte_pipeline 前, 帧数={len(raw_images)}, task_id={task_id}")
    keyed_frames, key_rgb, matte_info = apply_matte_pipeline(
        raw_images=raw_images,
        chroma_enabled=chroma_enabled,
        matte_mode=matte_mode,
        key_mode=key_mode,
        manual_key_hex=manual_key_hex,
        threshold=threshold,
        softness=softness,
        despill_strength=despill_strength,
        halo_pixels=halo_pixels,
        ai_model=ai_model,
        ai_device=ai_device,
        ai_resolution=ai_resolution,
        luma_black=luma_black,
        luma_white=luma_white,
        luma_gamma=luma_gamma,
        luma_strength=luma_strength,
        corridorkey_enabled=corridorkey_enabled,
        corridorkey_screen=corridorkey_screen,
        sf_tolerance=sf_tolerance,
        sf_edge_blend=sf_edge_blend,
        sf_blend_zone_ratio=sf_blend_zone_ratio,
        sf_alpha_cutoff=sf_alpha_cutoff,
        sf_spill_removal=sf_spill_removal,
        sf_spill_strength=sf_spill_strength,
        decontaminate_enabled=decontaminate_enabled,
        decontaminate_radius=decontaminate_radius,
        decontaminate_strength=decontaminate_strength,
        pipeline=pipeline,
        on_progress=lambda percent, message: update_task_progress(task_id, percent, message),
    )
    _dbg(f"process_video_to_job: apply_matte_pipeline 完成, 结果帧数={len(keyed_frames)}")

    update_task_progress(task_id, 64, "稳定裁切并缩放帧。")
    rendered_frames, bboxes, scale, canvas_size = stable_resize_frames(
        keyed_frames,
        target_size,
        reduce_px,
        canvas_mode,
        hard_alpha=matte_info["mode"] == "chroma" and softness == 0 and not matte_info["corridorkey_enabled"],
    )
    frame_entries: list[dict] = []
    postprocess_changed = {
        "green_to_black": 0,
        "semitransparent_to_black": 0,
        "semitransparent_to_opaque": 0,
    }
    update_task_progress(task_id, 78, "保存处理帧与缩略图。")
    total_frames = max(1, len(rendered_frames))
    for index, frame in enumerate(rendered_frames):
        frame_name = f"frame_{index + 1:03d}.png"
        thumb_name = f"thumb_{index + 1:03d}.png"
        frame_path = processed_dir / frame_name
        thumb_path = thumbs_dir / thumb_name
        if batch_green_to_black:
            frame, changed = green_to_black_image(frame)
            postprocess_changed["green_to_black"] += changed
        if batch_semitransparent_to_black:
            frame, changed = semitransparent_to_black_image(frame)
            postprocess_changed["semitransparent_to_black"] += changed
        if batch_semitransparent_to_opaque:
            frame, changed = semitransparent_to_opaque_image(frame)
            postprocess_changed["semitransparent_to_opaque"] += changed
        frame.save(frame_path)
        thumb = frame.copy()
        thumb.thumbnail((128, 128))
        thumb.save(thumb_path)
        frame_entries.append(
            {
                "index": index,
                "name": frame_name,
                "url": f"/work/jobs/{job_id}/processed/{frame_name}",
                "thumb_url": f"/work/jobs/{job_id}/thumbs/{thumb_name}",
                "bbox": list(bboxes[index]) if bboxes[index] else None,
                "width": frame.size[0],
                "height": frame.size[1],
            }
        )
        if (index + 1) == total_frames or (index + 1) % 5 == 0:
            progress = 78 + round(((index + 1) / total_frames) * 14)
            update_task_progress(task_id, progress, f"已保存 {index + 1}/{total_frames} 帧。")

    update_task_progress(task_id, 94, "写入处理 manifest。")
    manifest = {
        "job_id": job_id,
        "upload_id": upload_id,
        "job_dir": str(root),
        "processed_dir": str(processed_dir),
        "raw_dir": str(raw_dir),
        "source_path": str(source_path),
        "source_media_type": media_type,
        "ffmpeg_accel": ffmpeg_accel,
        "video_info": info,
        "options": {
            "start_time": start_time,
            "end_time": end_time,
            "keep_every": keep_every,
            "target_size": target_size,
            "reduce_px": reduce_px,
            "canvas_mode": normalize_canvas_mode(canvas_mode),
            "output_width": canvas_size[0],
            "output_height": canvas_size[1],
            "chroma_enabled": chroma_enabled,
            "matte_mode": matte_info["mode"],
            "matte": matte_info,
            "key_mode": key_mode,
            "key_color": rgb_to_hex(key_rgb),
            "threshold": threshold,
            "softness": softness,
            "despill_strength": despill_strength,
            "halo_pixels": halo_pixels,
            "corridorkey_enabled": matte_info["corridorkey_enabled"],
            "corridorkey_screen": matte_info["corridorkey_screen_color"],
            "batch_green_to_black": bool(batch_green_to_black),
            "batch_semitransparent_to_black": bool(batch_semitransparent_to_black),
            "batch_semitransparent_to_opaque": bool(batch_semitransparent_to_opaque),
            "postprocess_changed_pixels": postprocess_changed,
            "scale": scale,
        },
        "frame_count": len(frame_entries),
        "frames": frame_entries,
    }
    save_job_manifest(job_id, manifest)
    update_task_progress(task_id, 98, f"处理完成，共 {len(frame_entries)} 帧。")
    return manifest


def green_to_black_image(
    image: Image.Image,
    threshold: int = 42,
    dominance: int = 24,
    alpha_floor: int = 1,
) -> tuple[Image.Image, int]:
    rgba = image.convert("RGBA")
    output_pixels: list[tuple[int, int, int, int]] = []
    changed = 0
    threshold = max(0, min(255, int(threshold)))
    dominance = max(0, min(255, int(dominance)))
    alpha_floor = max(0, min(255, int(alpha_floor)))

    for r_value, g_value, b_value, alpha in rgba.getdata():
        raw_green_excess = g_value - max(r_value, b_value)
        is_raw_green = g_value >= threshold and raw_green_excess >= dominance
        is_alpha_scaled_green = False
        if alpha > 0:
            alpha_scale = 255.0 / alpha
            scaled_r = min(255, round(r_value * alpha_scale))
            scaled_g = min(255, round(g_value * alpha_scale))
            scaled_b = min(255, round(b_value * alpha_scale))
            scaled_green_excess = scaled_g - max(scaled_r, scaled_b)
            is_alpha_scaled_green = scaled_g >= threshold and scaled_green_excess >= dominance
        is_green = alpha >= alpha_floor and (is_raw_green or is_alpha_scaled_green)
        if is_green:
            output_pixels.append((0, 0, 0, alpha))
            changed += 1
        else:
            output_pixels.append((r_value, g_value, b_value, alpha))

    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(output_pixels)
    return cleaned, changed


def green_to_black_preview(preview_id: str, threshold: int = 42, dominance: int = 24) -> dict:
    preview = load_preview_manifest(preview_id)
    root = preview_dir(preview["preview_id"])
    processed_path = root / "processed.png"
    if not processed_path.exists():
        raise FileNotFoundError(f"processed preview missing: {processed_path}")

    image = open_rgba_image(processed_path)
    cleaned, changed = green_to_black_image(image, threshold=threshold, dominance=dominance)
    image.close()
    cleaned.save(processed_path)
    cleaned.close()

    postprocess = preview.setdefault("postprocess", {})
    green_black = postprocess.setdefault("green_to_black", {})
    green_black["enabled"] = True
    green_black["threshold"] = max(0, min(255, int(threshold)))
    green_black["dominance"] = max(0, min(255, int(dominance)))
    green_black["changed_pixels"] = changed
    green_black["updated_at"] = iso_now()
    preview["processed_url"] = f"/work/previews/{preview['preview_id']}/processed.png?ts={int(time.time() * 1000)}"
    save_preview_manifest(preview["preview_id"], preview)
    return preview


def semitransparent_to_black_image(
    image: Image.Image,
    alpha_min: int = 1,
    alpha_max: int = 254,
) -> tuple[Image.Image, int]:
    rgba = image.convert("RGBA")
    output_pixels: list[tuple[int, int, int, int]] = []
    changed = 0
    alpha_min = max(0, min(255, int(alpha_min)))
    alpha_max = max(alpha_min, min(255, int(alpha_max)))

    for r_value, g_value, b_value, alpha in rgba.getdata():
        if alpha_min <= alpha <= alpha_max:
            output_pixels.append((0, 0, 0, alpha))
            changed += 1
        else:
            output_pixels.append((r_value, g_value, b_value, alpha))

    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(output_pixels)
    return cleaned, changed


def semitransparent_to_black_preview(preview_id: str, alpha_min: int = 1, alpha_max: int = 254) -> dict:
    preview = load_preview_manifest(preview_id)
    root = preview_dir(preview["preview_id"])
    processed_path = root / "processed.png"
    if not processed_path.exists():
        raise FileNotFoundError(f"processed preview missing: {processed_path}")

    image = open_rgba_image(processed_path)
    cleaned, changed = semitransparent_to_black_image(image, alpha_min=alpha_min, alpha_max=alpha_max)
    image.close()
    cleaned.save(processed_path)
    cleaned.close()

    postprocess = preview.setdefault("postprocess", {})
    semitransparent_black = postprocess.setdefault("semitransparent_to_black", {})
    semitransparent_black["enabled"] = True
    semitransparent_black["alpha_min"] = max(0, min(255, int(alpha_min)))
    semitransparent_black["alpha_max"] = max(0, min(255, int(alpha_max)))
    semitransparent_black["changed_pixels"] = changed
    semitransparent_black["updated_at"] = iso_now()
    preview["processed_url"] = f"/work/previews/{preview['preview_id']}/processed.png?ts={int(time.time() * 1000)}"
    save_preview_manifest(preview["preview_id"], preview)
    return preview


def semitransparent_to_opaque_image(
    image: Image.Image,
    alpha_min: int = 1,
    alpha_max: int = 254,
) -> tuple[Image.Image, int]:
    rgba = image.convert("RGBA")
    output_pixels: list[tuple[int, int, int, int]] = []
    changed = 0
    alpha_min = max(0, min(255, int(alpha_min)))
    alpha_max = max(alpha_min, min(255, int(alpha_max)))

    for r_value, g_value, b_value, alpha in rgba.getdata():
        if alpha_min <= alpha <= alpha_max:
            output_pixels.append((r_value, g_value, b_value, 255))
            changed += 1
        else:
            output_pixels.append((r_value, g_value, b_value, alpha))

    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(output_pixels)
    return cleaned, changed


def semitransparent_to_opaque_preview(preview_id: str, alpha_min: int = 1, alpha_max: int = 254) -> dict:
    preview = load_preview_manifest(preview_id)
    root = preview_dir(preview["preview_id"])
    processed_path = root / "processed.png"
    if not processed_path.exists():
        raise FileNotFoundError(f"processed preview missing: {processed_path}")

    image = open_rgba_image(processed_path)
    cleaned, changed = semitransparent_to_opaque_image(image, alpha_min=alpha_min, alpha_max=alpha_max)
    image.close()
    cleaned.save(processed_path)
    cleaned.close()

    postprocess = preview.setdefault("postprocess", {})
    semitransparent_opaque = postprocess.setdefault("semitransparent_to_opaque", {})
    semitransparent_opaque["enabled"] = True
    semitransparent_opaque["alpha_min"] = max(0, min(255, int(alpha_min)))
    semitransparent_opaque["alpha_max"] = max(0, min(255, int(alpha_max)))
    semitransparent_opaque["changed_pixels"] = changed
    semitransparent_opaque["updated_at"] = iso_now()
    preview["processed_url"] = f"/work/previews/{preview['preview_id']}/processed.png?ts={int(time.time() * 1000)}"
    save_preview_manifest(preview["preview_id"], preview)
    return preview


def preview_frame(
    upload_id: str,
    sample_time: float,
    target_size: int,
    reduce_px: int,
    canvas_mode: str,
    chroma_enabled: bool,
    matte_mode: str,
    key_mode: str,
    manual_key_hex: str,
    threshold: int,
    softness: int,
    despill_strength: float,
    halo_pixels: int,
    ai_model: str,
    ai_device: str,
    ai_resolution: int,
    luma_black: int,
    luma_white: int,
    luma_gamma: float,
    luma_strength: float,
    corridorkey_enabled: bool,
    corridorkey_screen: str,
    batch_green_to_black: bool = False,
    batch_semitransparent_to_black: bool = False,
    batch_semitransparent_to_opaque: bool = False,
    sf_tolerance: float = 120.0,
    sf_edge_blend: bool = True,
    sf_blend_zone_ratio: float = 0.6,
    sf_alpha_cutoff: int = 8,
    sf_spill_removal: bool = True,
    sf_spill_strength: float = 0.45,
    decontaminate_enabled: bool = True,
    decontaminate_radius: int = 2,
    decontaminate_strength: float = 1.0,
    pipeline: list[str] | None = None,
) -> dict:
    source_path, media_type = source_media_entry(upload_id)
    info = media_info(source_path, media_type)
    duration = safe_float(info.get("duration"), 0.0)
    if media_type == "video" and duration > 0:
        sample_time = clamp_float(sample_time, 0.0, duration)
    else:
        sample_time = 0.0

    preview_id = timestamped_id()
    root = preview_dir(preview_id)
    raw_path = root / "raw.png"
    source_preview_path = root / "source.png"
    processed_path = root / "processed.png"

    if media_type == "image":
        _, ffmpeg_accel = extract_image_frame(source_path, raw_path)
    else:
        _, ffmpeg_accel = extract_single_frame(source_path, raw_path, sample_time)
    raw_image = open_rgba_image(raw_path)

    raw_image.save(source_preview_path)

    keyed_frames, key_rgb, matte_info = apply_matte_pipeline(
        raw_images=[raw_image],
        chroma_enabled=chroma_enabled,
        matte_mode=matte_mode,
        key_mode=key_mode,
        manual_key_hex=manual_key_hex,
        threshold=threshold,
        softness=softness,
        despill_strength=despill_strength,
        halo_pixels=halo_pixels,
        ai_model=ai_model,
        ai_device=ai_device,
        ai_resolution=ai_resolution,
        luma_black=luma_black,
        luma_white=luma_white,
        luma_gamma=luma_gamma,
        luma_strength=luma_strength,
        corridorkey_enabled=corridorkey_enabled,
        corridorkey_screen=corridorkey_screen,
        sf_tolerance=sf_tolerance,
        sf_edge_blend=sf_edge_blend,
        sf_blend_zone_ratio=sf_blend_zone_ratio,
        sf_alpha_cutoff=sf_alpha_cutoff,
        sf_spill_removal=sf_spill_removal,
        sf_spill_strength=sf_spill_strength,
        decontaminate_enabled=decontaminate_enabled,
        decontaminate_radius=decontaminate_radius,
        decontaminate_strength=decontaminate_strength,
        pipeline=pipeline,
    )
    keyed_image = keyed_frames[0]

    rendered_frames, _, scale, canvas_size = stable_resize_frames(
        [keyed_image],
        target_size,
        reduce_px,
        canvas_mode,
        hard_alpha=matte_info["mode"] == "chroma" and softness == 0 and not matte_info["corridorkey_enabled"],
    )
    rendered_frame = rendered_frames[0]
    postprocess_changed = {
        "green_to_black": 0,
        "semitransparent_to_black": 0,
        "semitransparent_to_opaque": 0,
    }
    if batch_green_to_black:
        rendered_frame, changed = green_to_black_image(rendered_frame)
        postprocess_changed["green_to_black"] += changed
    if batch_semitransparent_to_black:
        rendered_frame, changed = semitransparent_to_black_image(rendered_frame)
        postprocess_changed["semitransparent_to_black"] += changed
    if batch_semitransparent_to_opaque:
        rendered_frame, changed = semitransparent_to_opaque_image(rendered_frame)
        postprocess_changed["semitransparent_to_opaque"] += changed
    rendered_frame.save(processed_path)

    manifest = {
        "preview_id": preview_id,
        "upload_id": upload_id,
        "sample_time": sample_time,
        "source_path": str(source_path),
        "source_media_type": media_type,
        "source_url": f"/work/previews/{preview_id}/source.png",
        "processed_url": f"/work/previews/{preview_id}/processed.png",
        "key_color": rgb_to_hex(key_rgb),
        "matte": matte_info,
        "ffmpeg_accel": ffmpeg_accel,
        "scale": scale,
        "postprocess_changed": postprocess_changed,
        "options": {
            "target_size": target_size,
            "reduce_px": reduce_px,
            "canvas_mode": normalize_canvas_mode(canvas_mode),
            "output_width": canvas_size[0],
            "output_height": canvas_size[1],
            "chroma_enabled": chroma_enabled,
            "matte_mode": matte_info["mode"],
            "key_mode": key_mode,
            "threshold": threshold,
            "softness": softness,
            "despill_strength": despill_strength,
            "halo_pixels": halo_pixels,
            "corridorkey_enabled": matte_info["corridorkey_enabled"],
            "corridorkey_screen": matte_info["corridorkey_screen_color"],
            "batch_green_to_black": bool(batch_green_to_black),
            "batch_semitransparent_to_black": bool(batch_semitransparent_to_black),
            "batch_semitransparent_to_opaque": bool(batch_semitransparent_to_opaque),
            "postprocess_changed_pixels": postprocess_changed,
        },
    }
    (root / "preview.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def save_preview_as_job(preview_id: str) -> dict:
    preview = load_preview_manifest(preview_id)
    if str(preview.get("source_media_type") or "").lower() != "image":
        raise ValueError("direct preview save is only available for image uploads")

    source_preview_path = preview_dir(preview["preview_id"]) / "source.png"
    raw_preview_path = preview_dir(preview["preview_id"]) / "raw.png"
    processed_preview_path = preview_dir(preview["preview_id"]) / "processed.png"
    if not processed_preview_path.exists():
        raise FileNotFoundError(f"processed preview missing: {processed_preview_path}")

    source_path = repair_mojibake_path(Path(preview["source_path"]))
    media_type = str(preview.get("source_media_type") or "image").lower()
    info = media_info(source_path, media_type)
    options = preview.get("options") or {}
    matte_info = preview.get("matte") or {"mode": options.get("matte_mode") or "chroma"}

    job_id = timestamped_id()
    root = job_dir(job_id)
    raw_dir = root / "raw"
    processed_dir = root / "processed"
    thumbs_dir = root / "thumbs"
    for directory in (raw_dir, processed_dir, thumbs_dir):
        directory.mkdir(parents=True, exist_ok=True)

    if raw_preview_path.exists():
        shutil.copy2(raw_preview_path, raw_dir / "frame_00001.png")
    elif source_preview_path.exists():
        shutil.copy2(source_preview_path, raw_dir / "frame_00001.png")

    frame_name = "frame_001.png"
    thumb_name = "thumb_001.png"
    frame_path = processed_dir / frame_name
    thumb_path = thumbs_dir / thumb_name
    shutil.copy2(processed_preview_path, frame_path)

    frame = open_rgba_image(frame_path)
    thumb = frame.copy()
    thumb.thumbnail((128, 128))
    thumb.save(thumb_path)
    bbox = frame.getchannel("A").getbbox()
    canvas_size = frame.size

    manifest = {
        "job_id": job_id,
        "upload_id": preview.get("upload_id") or "",
        "job_dir": str(root),
        "processed_dir": str(processed_dir),
        "raw_dir": str(raw_dir),
        "source_path": str(source_path),
        "source_media_type": media_type,
        "ffmpeg_accel": preview.get("ffmpeg_accel") or {},
        "video_info": info,
        "options": {
            "start_time": 0,
            "end_time": 0,
            "keep_every": 1,
            "target_size": options.get("target_size") or canvas_size[1],
            "reduce_px": options.get("reduce_px") or 0,
            "canvas_mode": normalize_canvas_mode(str(options.get("canvas_mode") or "auto")),
            "output_width": options.get("output_width") or canvas_size[0],
            "output_height": options.get("output_height") or canvas_size[1],
            "chroma_enabled": bool(options.get("chroma_enabled", True)),
            "matte_mode": matte_info.get("mode") or options.get("matte_mode") or "chroma",
            "matte": matte_info,
            "key_mode": options.get("key_mode") or "auto",
            "key_color": preview.get("key_color") or "#000000",
            "threshold": options.get("threshold") or 0,
            "softness": options.get("softness") or 0,
            "despill_strength": options.get("despill_strength") or 0,
            "halo_pixels": options.get("halo_pixels") or 0,
            "corridorkey_enabled": bool(options.get("corridorkey_enabled", False)),
            "corridorkey_screen": options.get("corridorkey_screen") or "auto",
            "scale": preview.get("scale") or 1,
        },
        "frame_count": 1,
        "frames": [
            {
                "index": 0,
                "name": frame_name,
                "url": f"/work/jobs/{job_id}/processed/{frame_name}",
                "thumb_url": f"/work/jobs/{job_id}/thumbs/{thumb_name}",
                "bbox": list(bbox) if bbox else None,
                "width": canvas_size[0],
                "height": canvas_size[1],
            }
        ],
    }
    save_job_manifest(job_id, manifest)
    return manifest


def natural_sort_key(value: str) -> list[object]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def field_storage_items(form: cgi.FieldStorage, key: str) -> list:
    if key not in form:
        return []
    value = form[key]
    return value if isinstance(value, list) else [value]


def import_animation_frames_to_job(file_items: list) -> dict:
    candidates = []
    for item in file_items:
        raw_filename = str(getattr(item, "filename", "") or "frame")
        display_name = Path(raw_filename.replace("\\", "/")).name or "frame"
        if not getattr(item, "file", None):
            continue
        suffix = Path(display_name).suffix.lower()
        content_type = str(getattr(item, "type", "") or "")
        if suffix not in ANIMATION_FRAME_EXTENSIONS and not content_type.startswith("image/"):
            continue
        candidates.append((raw_filename, display_name, item))

    candidates.sort(key=lambda pair: natural_sort_key(pair[0]))
    if not candidates:
        raise ValueError("no supported image frames found")

    job_id = timestamped_id()
    root = job_dir(job_id)
    raw_dir = root / "raw"
    processed_dir = root / "processed"
    thumbs_dir = root / "thumbs"
    for directory in (raw_dir, processed_dir, thumbs_dir):
        directory.mkdir(parents=True, exist_ok=True)

    frame_entries: list[dict] = []
    max_width = 0
    max_height = 0
    for index, (_, display_name, item) in enumerate(candidates):
        frame_name = f"frame_{index + 1:03d}.png"
        thumb_name = f"thumb_{index + 1:03d}.png"
        raw_path = raw_dir / frame_name
        frame_path = processed_dir / frame_name
        thumb_path = thumbs_dir / thumb_name

        with Image.open(item.file) as source_image:
            image = source_image.convert("RGBA")
            image.save(raw_path)
            image.save(frame_path)
            thumb = image.copy()
            thumb.thumbnail((128, 128))
            thumb.save(thumb_path)
            bbox = image.getchannel("A").getbbox()
            max_width = max(max_width, image.size[0])
            max_height = max(max_height, image.size[1])

            frame_entries.append(
                {
                    "index": index,
                    "name": frame_name,
                    "original_name": display_name,
                    "url": f"/work/jobs/{job_id}/processed/{frame_name}",
                    "thumb_url": f"/work/jobs/{job_id}/thumbs/{thumb_name}",
                    "bbox": list(bbox) if bbox else None,
                    "width": image.size[0],
                    "height": image.size[1],
                }
            )
            image.close()

    manifest = {
        "job_id": job_id,
        "upload_id": "",
        "job_dir": str(root),
        "processed_dir": str(processed_dir),
        "raw_dir": str(raw_dir),
        "source_path": "",
        "source_media_type": "animation",
        "ffmpeg_accel": custom_animation_payload(),
        "video_info": {
            "media_type": "animation",
            "duration": 0,
            "fps": 0,
            "width": max_width,
            "height": max_height,
        },
        "options": {
            "start_time": 0,
            "end_time": 0,
            "keep_every": 1,
            "target_size": max_height,
            "reduce_px": 0,
            "canvas_mode": "custom",
            "output_width": max_width,
            "output_height": max_height,
            "chroma_enabled": False,
            "matte_mode": "none",
            "matte": {"mode": "none", "source": "custom_animation"},
            "key_mode": "none",
            "key_color": "#000000",
            "threshold": 0,
            "softness": 0,
            "despill_strength": 0,
            "halo_pixels": 0,
            "corridorkey_enabled": False,
            "corridorkey_screen": "auto",
            "scale": 1,
            "source_order": "filename",
        },
        "frame_count": len(frame_entries),
        "frames": frame_entries,
    }
    save_job_manifest(job_id, manifest)
    return manifest


def save_alpha_mov(
    frame_paths: list[Path],
    frame_sizes: list[tuple[int, int]],
    output_path: Path,
    cell_width: int,
    cell_height: int,
    duration_ms: int,
) -> None:
    if not frame_paths:
        raise ValueError("no frames selected for alpha video export")
    ffmpeg = resolve_ffmpeg_binary("ffmpeg")
    duration_ms = clamp_int(duration_ms, 20, 5000)
    video_frames_dir = output_path.parent / "video_frames_tmp"
    if video_frames_dir.exists():
        shutil.rmtree(video_frames_dir)
    video_frames_dir.mkdir(parents=True, exist_ok=True)
    try:
        for index, frame_path in enumerate(frame_paths, start=1):
            frame = open_rgba_image(frame_path)
            frame_width, frame_height = frame_sizes[index - 1]
            canvas = Image.new("RGBA", (cell_width, cell_height), (0, 0, 0, 0))
            offset_x = (cell_width - frame_width) // 2
            offset_y = (cell_height - frame_height) // 2
            canvas.paste(frame, (offset_x, offset_y), frame)
            frame.close()
            canvas.save(video_frames_dir / f"frame_{index:03d}.png")
            canvas.close()

        input_pattern = video_frames_dir / "frame_%03d.png"
        run_process(
            [
                ffmpeg,
                "-y",
                "-framerate",
                f"1000/{duration_ms}",
                "-start_number",
                "1",
                "-i",
                str(input_pattern),
                "-frames:v",
                str(len(frame_paths)),
                "-c:v",
                "qtrle",
                "-pix_fmt",
                "argb",
                str(output_path),
            ]
        )
    finally:
        shutil.rmtree(video_frames_dir, ignore_errors=True)


def normalize_export_compression(compression: dict | None) -> dict:
    compression = compression if isinstance(compression, dict) else {}
    sheet_format = str(compression.get("sheet_format") or "png").lower()
    if sheet_format not in {"png", "webp", "both"}:
        sheet_format = "png"
    return {
        "include_sheet": bool(compression.get("include_sheet", True)),
        "include_zip": bool(compression.get("include_zip", True)),
        "include_mov": bool(compression.get("include_mov", True)),
        "include_manifest": bool(compression.get("include_manifest", True)),
        "sheet_format": sheet_format,
        "png_compress_level": clamp_int(safe_int(compression.get("png_compress_level"), 6), 0, 9),
        "zip_compress_level": clamp_int(safe_int(compression.get("zip_compress_level"), 6), 0, 9),
        "webp_quality": clamp_int(safe_int(compression.get("webp_quality"), 90), 1, 100),
        # Sheet 尺寸/体积约束：0 表示不限制
        "sheet_max_dimension": clamp_int(safe_int(compression.get("sheet_max_dimension"), 0), 0, 16384),
        "sheet_target_kb": clamp_int(safe_int(compression.get("sheet_target_kb"), 0), 0, 200000),
    }


def _scale_sheet_to_max_dimension(sheet: "Image.Image", max_dimension: int) -> "Image.Image":
    """将 sheet 等比缩放到最长边不超过 max_dimension（像素级上限）；不放大。"""
    if not max_dimension:
        return sheet
    width, height = sheet.size
    longest = max(width, height)
    if longest <= max_dimension:
        return sheet
    ratio = max_dimension / longest
    new_size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    return sheet.resize(new_size, LANCZOS)


def save_sheet_within_budget(sheet: "Image.Image", image_format: str, path: Path, target_bytes: int, save_kwargs: dict) -> tuple[tuple[int, int], int]:
    """保存 sheet 到 path；当 target_bytes>0 时，按文件体积迭代等比缩小到不超过目标体积。

    返回 (最终像素尺寸, 实际字节数)。PNG 为无损，仅靠缩小尺寸控制体积；
    WebP 已由质量参数控制，必要时同样缩小尺寸。
    """
    base = sheet
    scale = 1.0
    last_bytes = b""
    final_size = base.size
    for _ in range(16):
        if scale >= 0.999:
            candidate = base
        else:
            candidate = base.resize(
                (max(1, round(base.size[0] * scale)), max(1, round(base.size[1] * scale))),
                LANCZOS,
            )
        buffer = BytesIO()
        candidate.save(buffer, format=image_format, **save_kwargs)
        data = buffer.getvalue()
        final_size = candidate.size
        last_bytes = data
        if not target_bytes or len(data) <= target_bytes or max(candidate.size) <= 16:
            path.write_bytes(data)
            if candidate is not base:
                candidate.close()
            return final_size, len(data)
        # 体积近似与像素数（scale^2）成正比，据此估算下一次缩放系数
        adjust = (target_bytes / len(data)) ** 0.5
        scale = max(0.04, min(0.96, scale * adjust * 0.96))
        if candidate is not base:
            candidate.close()
    path.write_bytes(last_bytes)
    return final_size, len(last_bytes)


def export_job(job_id: str, selected_indices: list[int], sheet_columns: int, video_duration_ms: int, compression: dict | None = None) -> dict:
    compression_settings = normalize_export_compression(compression)
    if not any([compression_settings["include_sheet"], compression_settings["include_zip"], compression_settings["include_mov"], compression_settings["include_manifest"]]):
        raise ValueError("select at least one export output")

    manifest = load_job_manifest(job_id)
    processed_dir = job_dir(job_id) / "processed"
    target_dir = EXPORTS_DIR / f"{timestamped_id()}-export"
    frames_dir = target_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frame_map = {entry["index"]: entry for entry in manifest["frames"]}
    seen_indices: set[int] = set()
    indices: list[int] = []
    for index in selected_indices:
        if index in frame_map and index not in seen_indices:
            indices.append(index)
            seen_indices.add(index)
    if not indices:
        raise ValueError("no frames selected for export")

    copied_paths: list[Path] = []
    for output_index, frame_index in enumerate(indices, start=1):
        entry = frame_map[frame_index]
        source_path = processed_dir / entry["name"]
        target_path = frames_dir / f"frame_{output_index:03d}.png"
        shutil.copy2(source_path, target_path)
        copied_paths.append(target_path)

    zip_path = target_dir / "frames.zip"
    if compression_settings["include_zip"]:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=compression_settings["zip_compress_level"]) as archive:
            for frame_path in copied_paths:
                archive.write(frame_path, arcname=frame_path.name)
    else:
        zip_path = None

    cell_width = 0
    cell_height = 0
    frame_sizes: list[tuple[int, int]] = []
    for frame_path in copied_paths:
        frame = open_rgba_image(frame_path)
        frame_sizes.append(frame.size)
        cell_width = max(cell_width, frame.size[0])
        cell_height = max(cell_height, frame.size[1])
        frame.close()

    # 使用 rectpack 进行更紧凑的 bin packing
    if HAS_RECTPACK and len(copied_paths) > 1:
        packer = newPacker(mode=1, bin_algo=2, pack_algo=MaxRectsBssf, rotation=False)
        padding = 2
        for idx, (w, h) in enumerate(frame_sizes):
            packer.add_rect(w + padding, h + padding, idx)
        # 计算最优 bin 尺寸
        total_area = sum((w + padding) * (h + padding) for w, h in frame_sizes)
        max_w = max(w for w, h in frame_sizes) + padding
        max_h = max(h for w, h in frame_sizes) + padding
        # 尝试不同的 bin 尺寸
        best_sheet = None
        best_rects = None
        for cols in range(1, len(copied_paths) + 1):
            rows = math.ceil(len(copied_paths) / cols)
            bin_w = cols * cell_width + padding * cols
            bin_h = rows * cell_height + padding * rows
            bin_w = max(bin_w, max_w)
            bin_h = max(bin_h, max_h)
            test_packer = newPacker(mode=1, bin_algo=2, pack_algo=MaxRectsBssf, rotation=False)
            for idx, (w, h) in enumerate(frame_sizes):
                test_packer.add_rect(w + padding, h + padding, idx)
            test_packer.add_bin(bin_w, bin_h)
            test_packer.pack()
            if len(test_packer[0]) == len(copied_paths):
                if best_sheet is None or (bin_w * bin_h < best_sheet[0] * best_sheet[1]):
                    best_sheet = (bin_w, bin_h)
                    best_rects = list(test_packer[0])
        if best_sheet and best_rects:
            sheet = Image.new("RGBA", best_sheet, (0, 0, 0, 0))
            for rect in best_rects:
                idx = rect.rid
                frame = open_rgba_image(copied_paths[idx])
                sheet.paste(frame, (rect.x, rect.y), frame)
                frame.close()
        else:
            # fallback to simple grid
            columns = max(1, sheet_columns or round(math.sqrt(len(copied_paths))))
            rows = math.ceil(len(copied_paths) / columns)
            sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
            for index, frame_path in enumerate(copied_paths):
                row = index // columns
                column = index % columns
                frame = open_rgba_image(frame_path)
                offset_x = column * cell_width
                offset_y = row * cell_height
                sheet.paste(frame, (offset_x, offset_y), frame)
                frame.close()
    else:
        # 简单网格布局
        columns = max(1, sheet_columns or round(math.sqrt(len(copied_paths))))
        rows = math.ceil(len(copied_paths) / columns)
        sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
        for index, frame_path in enumerate(copied_paths):
            row = index // columns
            column = index % columns
            frame = open_rgba_image(frame_path)
            frame_width, frame_height = frame_sizes[index]
            offset_x = column * cell_width + (cell_width - frame_width) // 2
            offset_y = row * cell_height + (cell_height - frame_height) // 2
            sheet.paste(frame, (offset_x, offset_y), frame)
            frame.close()
    sheet_path = None
    webp_sheet_path = None
    sheet_pixel_size: tuple[int, int] | None = None
    if compression_settings["include_sheet"]:
        # 先按最大边长做像素级上限缩放，作为两种格式的共同基准
        budget_sheet = _scale_sheet_to_max_dimension(sheet, compression_settings["sheet_max_dimension"])
        target_bytes = compression_settings["sheet_target_kb"] * 1024
        if compression_settings["sheet_format"] in {"png", "both"}:
            sheet_path = target_dir / "sprite_sheet.png"
            sheet_pixel_size, _ = save_sheet_within_budget(
                budget_sheet,
                "PNG",
                sheet_path,
                target_bytes,
                {"compress_level": compression_settings["png_compress_level"]},
            )
        if compression_settings["sheet_format"] in {"webp", "both"}:
            webp_sheet_path = target_dir / "sprite_sheet.webp"
            webp_size, _ = save_sheet_within_budget(
                budget_sheet,
                "WEBP",
                webp_sheet_path,
                target_bytes,
                {"quality": compression_settings["webp_quality"], "lossless": False, "method": 6},
            )
            if sheet_pixel_size is None:
                sheet_pixel_size = webp_size
        if budget_sheet is not sheet:
            budget_sheet.close()
    sheet.close()

    video_duration_ms = clamp_int(video_duration_ms, 20, 5000)
    video_path = target_dir / "animation.mov"
    if compression_settings["include_mov"]:
        save_alpha_mov(copied_paths, frame_sizes, video_path, cell_width, cell_height, video_duration_ms)
    else:
        video_path = None

    export_manifest = {
        "job_id": job_id,
        "selected_indices": indices,
        "sheet_columns": columns,
        "cell_width": cell_width,
        "cell_height": cell_height,
        "sheet_width": sheet_pixel_size[0] if sheet_pixel_size else None,
        "sheet_height": sheet_pixel_size[1] if sheet_pixel_size else None,
        "frame_count": len(copied_paths),
        "frames_dir": str(frames_dir),
        "zip_path": str(zip_path) if zip_path else None,
        "sheet_path": str(sheet_path) if sheet_path else None,
        "webp_sheet_path": str(webp_sheet_path) if webp_sheet_path else None,
        "video_path": str(video_path) if video_path else None,
        "video_duration_ms": video_duration_ms,
        "compression": compression_settings,
    }
    manifest_path = target_dir / "export.json"
    if compression_settings["include_manifest"]:
        manifest_path.write_text(json.dumps(export_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    result = {
        "output_dir": str(target_dir),
        "frames_dir": str(frames_dir),
        "zip_url": f"/work/exports/{target_dir.name}/frames.zip" if zip_path else None,
        "sheet_url": f"/work/exports/{target_dir.name}/sprite_sheet.png" if sheet_path else None,
        "webp_sheet_url": f"/work/exports/{target_dir.name}/sprite_sheet.webp" if webp_sheet_path else None,
        "video_url": f"/work/exports/{target_dir.name}/animation.mov" if video_path else None,
        "manifest_url": f"/work/exports/{target_dir.name}/export.json" if compression_settings["include_manifest"] else None,
        "frame_count": len(copied_paths),
        "video_duration_ms": video_duration_ms,
        "sheet_width": sheet_pixel_size[0] if sheet_pixel_size else None,
        "sheet_height": sheet_pixel_size[1] if sheet_pixel_size else None,
    }
    return {key: value for key, value in result.items() if value is not None}


def env_check_payload() -> dict:
    """检查运行环境：Python 包、ffmpeg、模型缓存文件。"""
    py = sys.executable
    REQUIRED_PACKAGES = [
        ("PIL",           "Pillow",           f'"{py}" -m pip install Pillow'),
        ("torch",         "torch",            f'"{py}" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121'),
        ("transformers",  "transformers",     f'"{py}" -m pip install transformers'),
        ("einops",        "einops",           f'"{py}" -m pip install einops'),
        ("kornia",        "kornia",           f'"{py}" -m pip install kornia'),
        ("timm",          "timm",             f'"{py}" -m pip install timm'),
        ("huggingface_hub","huggingface_hub", f'"{py}" -m pip install huggingface_hub'),
        ("cv2",           "opencv-python",    f'"{py}" -m pip install opencv-python'),
        ("mediapipe",     "mediapipe",        f'"{py}" -m pip install mediapipe'),
    ]
    packages = []
    for import_name, display_name, install_cmd in REQUIRED_PACKAGES:
        try:
            mod = __import__(import_name)
            version = getattr(mod, "__version__", None) or getattr(mod, "VERSION", None) or "已安装"
            packages.append({"name": display_name, "ok": True, "version": str(version), "install": install_cmd})
        except ImportError:
            packages.append({"name": display_name, "ok": False, "version": None, "install": install_cmd})

    # torch 设备检查
    torch_device = None
    try:
        import torch
        if torch.cuda.is_available():
            torch_device = f"CUDA ({torch.cuda.get_device_name(0)})"
        else:
            torch_device = "CPU only"
    except Exception:
        torch_device = "torch 未安装"

    # ffmpeg 检查
    ffmpeg_items = []
    for bin_name in ("ffmpeg", "ffprobe"):
        try:
            path = resolve_ffmpeg_binary(bin_name)
            out = run_process([path, "-version"])
            ver_line = out.splitlines()[0] if out else ""
            ffmpeg_items.append({"name": bin_name, "ok": True, "path": path, "version": ver_line})
        except Exception as exc:
            ffmpeg_items.append({"name": bin_name, "ok": False, "path": None, "version": str(exc)})

    # 外部工具/源码依赖检查
    corridorkey_root = default_corridorkey_root()
    corridorkey_module_dir = corridorkey_root / "CorridorKeyModule"
    tool_items = [
        {
            "name": "CorridorKey",
            "ok": corridorkey_module_dir.exists(),
            "path": str(corridorkey_root),
            "install": f"git clone {CORRIDORKEY_REPO_URL} {corridorkey_root}",
            "description": "第三方绿/蓝幕边缘重建和精细抠像源码工具，用于 corridorkey 及组合模式；不是 Python 包，也不是 HuggingFace 模型。",
            "size_hint": "仓库本体通常几十 MB；依赖、git 缓存和生成文件会额外占用空间。",
        }
    ]

    # 模型文件检查（直接下载链接指向 model.safetensors）
    HF_DIRECT = "https://huggingface.co/{repo}/resolve/main/model.safetensors"
    cache_dir = configure_ai_model_cache()
    model_items = []
    for key, repo_id in AI_MATTE_MODEL_REPOS.items():
        cached, repo_dir = hf_repo_cached(cache_dir, repo_id)
        model_items.append({
            "key": key,
            "label": AI_MATTE_MODEL_LABELS.get(key, key),
            "repo": repo_id,
            "cached": cached,
            "cache_path": str(repo_dir),
            "hf_url": f"https://huggingface.co/{repo_id}",
            "direct_url": HF_DIRECT.format(repo=repo_id),
            "downloadable": True,
            "size_hint": "通常几百 MB 到 1GB+，以 HuggingFace 实际文件为准。",
        })

    # 姿态关键点模型（单文件 .task 权重，用于骨骼切片的语义部件识别）
    pose_weight = cache_dir / "pose" / POSE_MODEL_FILENAME
    pose_cached = pose_weight.exists() and pose_weight.stat().st_size > 0
    model_items.append({
        "key": POSE_MODEL_KEY,
        "label": POSE_MODEL_LABEL,
        "repo": "google/mediapipe-pose-landmarker",
        "cached": pose_cached,
        "cache_path": str(pose_weight),
        "hf_url": "https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker",
        "direct_url": POSE_MODEL_URL,
        "downloadable": True,
        "download_endpoint": "/api/models/download-pose",
        "size_hint": "约 9 MB（full 版 .task 单文件）。",
    })

    missing_pkgs = [p for p in packages if not p["ok"]]
    batch_install = f'"{py}" -m pip install ' + " ".join(p["name"] for p in missing_pkgs) if missing_pkgs else ""
    all_ok = not missing_pkgs and all(f["ok"] for f in ffmpeg_items) and all(t["ok"] for t in tool_items)
    return {
        "all_ok": all_ok,
        "packages": packages,
        "batch_install": batch_install,
        "torch_device": torch_device,
        "ffmpeg": ffmpeg_items,
        "tools": tool_items,
        "models": model_items,
        "cache_dir": str(cache_dir),
    }


def install_resource_path_guard(path: Path, root: Path) -> Path:
    resolved = path.expanduser().resolve()
    root_resolved = root.expanduser().resolve()
    try:
        resolved.relative_to(root_resolved)
    except ValueError as exc:
        raise ValueError(f"unsafe install path: {resolved}") from exc
    return resolved


def download_file_with_progress(url: str, target_path: Path, task_id: str, progress_start: int, progress_end: int) -> Path:
    target_path = install_resource_path_guard(target_path, DOWNLOADS_DIR)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = target_path.with_suffix(target_path.suffix + ".part")
    request = Request(url, headers={"User-Agent": "SpriteVideoLab/0.1"})
    update_task_progress(task_id, progress_start, "开始下载资源。")
    with urlopen(request, timeout=60) as response:
        total = safe_int(response.headers.get("Content-Length"), 0)
        downloaded = 0
        last_progress = progress_start
        with part_path.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    next_progress = progress_start + int((downloaded / total) * (progress_end - progress_start))
                    if next_progress >= last_progress + 2:
                        last_progress = min(progress_end, next_progress)
                        update_task_progress(task_id, last_progress, f"正在下载：{downloaded / 1024 / 1024:.1f} / {total / 1024 / 1024:.1f} MB")
                elif downloaded % (8 * 1024 * 1024) < len(chunk):
                    append_task_log(task_id, f"已下载 {downloaded / 1024 / 1024:.1f} MB")
    if target_path.exists():
        target_path.unlink()
    part_path.replace(target_path)
    update_task_progress(task_id, progress_end, "下载完成，正在安装。")
    return target_path


def install_model_from_download(model_key: str, task_id: str = "") -> dict:
    normalized_key = normalize_ai_model_key(model_key)
    repo_id = AI_MATTE_MODEL_REPOS[normalized_key]
    cache_dir = configure_ai_model_cache()
    label = AI_MATTE_MODEL_LABELS.get(normalized_key, normalized_key)

    already_cached, repo_dir = hf_repo_cached(cache_dir, repo_id)
    install_resource_path_guard(repo_dir, cache_dir)
    if already_cached:
        update_task_progress(task_id, 100, f"{label} 已缓存。")
        return {"model_key": normalized_key, "cache_path": str(repo_dir), "after": env_check_payload()}

    try:
        from huggingface_hub import snapshot_download
    except ModuleNotFoundError as exc:
        raise RuntimeError("huggingface_hub 未安装。请先在环境检测中安装缺失 Python 包。") from exc

    # 进度条默认写 stderr；打包版 stderr 被 Electron 重定向到日志管道，
    # Windows 下频繁回车写入可能触发 [Errno 22]，所以关掉进度条。
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

    # 关键：下载目标用 <cache_dir>/hub，与检测路径（hf_repo_cached 的规范位置）
    # 以及 from_pretrained 的 HUGGINGFACE_HUB_CACHE 完全一致，避免下完仍判"未下载"。
    hub_cache = cache_dir / "hub"
    hub_cache.mkdir(parents=True, exist_ok=True)

    update_task_progress(task_id, 15, "开始下载 HuggingFace 模型快照。")
    append_task_log(task_id, f"仓库：{repo_id}")
    append_task_log(task_id, f"缓存目录：{hub_cache}")

    download_error: Exception | None = None
    try:
        snapshot_download(repo_id=repo_id, cache_dir=str(hub_cache), local_files_only=False)
    except Exception as exc:  # noqa: BLE001 — 收尾步骤可能在文件已落盘后失败
        download_error = exc
        append_task_log(task_id, f"下载收尾出现异常：{exc}")
        append_task_log(task_id, traceback.format_exc())

    # 不依赖 snapshot_download 的返回值：直接复查规范缓存位置是否已落盘。
    # 这样即便收尾步骤（设置 mtime / 符号链接等）在 Windows 上抛错，
    # 只要文件已就位也按成功处理。
    cached_now, repo_dir = hf_repo_cached(cache_dir, repo_id)
    if not cached_now:
        if download_error is not None:
            raise RuntimeError(f"模型下载失败：{download_error}") from download_error
        raise RuntimeError(f"模型快照为空或未落盘：{repo_dir}")

    if download_error is not None:
        append_task_log(task_id, "文件已落盘，忽略收尾异常，按成功处理。")
    update_task_progress(task_id, 95, "模型安装完成，正在刷新检测。")
    append_task_log(task_id, f"已安装到 {repo_dir}")
    return {"model_key": normalized_key, "cache_path": str(repo_dir), "after": env_check_payload()}


def install_pose_model_from_download(task_id: str = "") -> dict:
    """下载 MediaPipe Pose Landmarker 的 .task 权重到 AI 缓存目录。"""
    cache_dir = configure_ai_model_cache()
    target_path = pose_model_weight_path()
    install_resource_path_guard(target_path, cache_dir)
    if target_path.exists() and target_path.stat().st_size > 0:
        update_task_progress(task_id, 100, f"{POSE_MODEL_LABEL} 已缓存。")
        return {"model_key": POSE_MODEL_KEY, "weight_path": str(target_path), "after": env_check_payload()}

    target_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = target_path.with_suffix(target_path.suffix + ".part")
    request = Request(POSE_MODEL_URL, headers={"User-Agent": "SpriteVideoLab/0.1"})
    update_task_progress(task_id, 10, "开始下载姿态模型权重。")
    with urlopen(request, timeout=60) as response:
        total = safe_int(response.headers.get("Content-Length"), 0)
        downloaded = 0
        last_progress = 10
        with part_path.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    next_progress = 10 + int((downloaded / total) * 85)
                    if next_progress >= last_progress + 2:
                        last_progress = min(95, next_progress)
                        update_task_progress(task_id, last_progress, f"正在下载：{downloaded / 1024 / 1024:.1f} / {total / 1024 / 1024:.1f} MB")
    if target_path.exists():
        target_path.unlink()
    part_path.replace(target_path)
    update_task_progress(task_id, 98, "姿态模型权重下载完成。")
    return {"model_key": POSE_MODEL_KEY, "weight_path": str(target_path), "after": env_check_payload()}


def install_corridorkey(task_id: str = "") -> dict:
    root = default_corridorkey_root().expanduser().resolve()
    module_dir = root / "CorridorKeyModule"
    if module_dir.exists():
        update_task_progress(task_id, 100, "CorridorKey 已安装。")
        return {"path": str(root), "after": env_check_payload()}

    parent = root.parent
    parent.mkdir(parents=True, exist_ok=True)
    install_resource_path_guard(root, parent)
    git_path = shutil.which("git")
    if not git_path:
        raise RuntimeError(f"未找到 git。请安装 Git，或手动下载 {CORRIDORKEY_REPO_URL} 并解压到 {root}")
    if root.exists() and any(root.iterdir()):
        raise RuntimeError(f"目标目录已存在且不为空：{root}。请清空该目录，或设置 {CORRIDORKEY_ROOT_ENV} 指向新的目录。")

    update_task_progress(task_id, 15, "正在 clone CorridorKey 仓库。")
    process = subprocess.Popen(
        [git_path, "clone", "--depth", "1", CORRIDORKEY_REPO_URL, str(root)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    assert process.stdout is not None
    for line in process.stdout:
        cleaned = line.strip()
        if cleaned:
            append_task_log(task_id, cleaned[-500:])
    code = process.wait()
    if code != 0:
        shutil.rmtree(root, ignore_errors=True)
        raise RuntimeError(f"CorridorKey clone 失败（退出码 {code}）。请检查网络/Git，或手动下载 {CORRIDORKEY_REPO_URL}。")
    if not module_dir.exists():
        raise RuntimeError(f"CorridorKey 下载完成但未找到 CorridorKeyModule：{module_dir}")
    update_task_progress(task_id, 95, "CorridorKey 安装完成，正在刷新检测。")
    return {"path": str(root), "after": env_check_payload()}


def install_missing_env_packages() -> dict:
    """安装环境检测中缺失的白名单 Python 包。"""
    allowed_packages = {"einops", "kornia", "timm", "transformers", "huggingface_hub", "opencv-python", "Pillow", "mediapipe"}
    before = env_check_payload()
    missing = [p["name"] for p in before["packages"] if not p["ok"] and p["name"] in allowed_packages]
    if not missing:
        return {"installed": [], "stdout": "", "stderr": "", "after": before}

    cmd = [sys.executable, "-m", "pip", "install", *missing]
    completed = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "pip install failed").strip())
    return {
        "installed": missing,
        "stdout": completed.stdout[-4000:],
        "stderr": completed.stderr[-4000:],
        "after": env_check_payload(),
    }


def model_status_payload() -> dict:
    cache_dir = configure_ai_model_cache()
    loaded_repos = {repo_id for repo_id, _device in _BIREFNET_MODEL_CACHE.keys()}
    models = []
    for key, repo_id in AI_MATTE_MODEL_REPOS.items():
        cached, repo_cache_dir = hf_repo_cached(cache_dir, repo_id)
        models.append(
            {
                "key": key,
                "label": AI_MATTE_MODEL_LABELS.get(key, key),
                "repo": repo_id,
                "cached": cached,
                "loaded": repo_id in loaded_repos,
                "cache_path": str(repo_cache_dir),
            }
        )
    return {"cache_dir": str(cache_dir), "loaded_count": len(_BIREFNET_MODEL_CACHE), "models": models}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "SpriteVideoLab/0.1"

    def log_message(self, format, *args) -> None:
        return

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
        self.send_json({"ok": False, "error": message}, status=status)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        # Try the route registry first (sprite_lab.routes). Routes that have
        # been migrated will be dispatched here; legacy if/elif handles the
        # rest until they get migrated too.
        if _routes.dispatch_get(self, parsed):
            return
        if parsed.path == "/api/env/check":
            self.send_json({"ok": True, **env_check_payload()})
            return
        if parsed.path == "/api/models/status":
            self.send_json({"ok": True, **model_status_payload()})
            return
        if parsed.path == "/":
            self.serve_dist_file(DIST_DIR / "index.html", content_type="text/html; charset=utf-8")
            return
        if parsed.path.startswith("/assets/"):
            relative = parsed.path.removeprefix("/")
            self.serve_dist_file(DIST_DIR / relative)
            return
        if parsed.path.startswith("/media/upload/"):
            upload_id = parsed.path.removeprefix("/media/upload/")
            self.serve_media_file(source_video_path(upload_id), allow_range=True)
            return
        if parsed.path.startswith("/work/"):
            relative = parsed.path.removeprefix("/work/")
            self.serve_work_file((WORK_DIR / relative).resolve())
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            # dev-only：把 PNG 二进制直接写到 work/_psd_test/ 下，供 MCP 自动化复测使用。
            # 严格白名单：只允许 work/_psd_test/ 内、.png 后缀；防滥用。
            if parsed.path == "/api/dev-canvas":
                target_rel = parse_qs(parsed.query).get("path", [""])[0]
                if not target_rel.startswith("work/_psd_test/") or not target_rel.endswith(".png"):
                    self.send_json({"ok": False, "error": "path 必须落在 work/_psd_test/*.png"}, status=400)
                    return
                length = int(self.headers.get("Content-Length") or 0)
                if length <= 0 or length > 50 * 1024 * 1024:
                    self.send_json({"ok": False, "error": "missing or oversize body"}, status=400)
                    return
                data = self.rfile.read(length)
                full = (Path(__file__).parent / target_rel).resolve()
                # 二次检查：解析后仍在 work/_psd_test/ 下，防 ../ 穿越
                root = (Path(__file__).parent / "work" / "_psd_test").resolve()
                if root not in full.parents:
                    self.send_json({"ok": False, "error": "path 越界"}, status=400)
                    return
                full.parent.mkdir(parents=True, exist_ok=True)
                full.write_bytes(data)
                self.send_json({"ok": True, "path": target_rel, "bytes": len(data)})
                return
            # Try the route registry first; falls through to the legacy
            # if/elif chain when the route hasn't been migrated yet.
            if _routes.dispatch_post(self, parsed):
                return
            if parsed.path == "/api/process":
                payload = self.read_json_body()
                process_kwargs = {
                    "upload_id": str(payload.get("upload_id") or ""),
                    "start_time": safe_float(payload.get("start_time"), 0.0),
                    "end_time": safe_float(payload.get("end_time"), 0.0),
                    "keep_every": max(1, safe_int(payload.get("keep_every"), 1)),
                    "target_size": max(32, safe_int(payload.get("target_size"), 256)),
                    "reduce_px": max(0, safe_int(payload.get("reduce_px"), 20)),
                    "canvas_mode": normalize_canvas_mode(str(payload.get("canvas_mode") or "auto")),
                    "chroma_enabled": bool(payload.get("chroma_enabled", True)),
                    "matte_mode": str(payload.get("matte_mode") or ""),
                    "pipeline": normalize_matte_pipeline(payload),
                    "key_mode": str(payload.get("key_mode") or "auto"),
                    "manual_key_hex": str(payload.get("manual_key_hex") or "#00FF00"),
                    "threshold": max(0, safe_int(payload.get("threshold"), 80)),
                    "softness": max(0, safe_int(payload.get("softness"), 32)),
                    "despill_strength": max(0.0, safe_float(payload.get("despill_strength"), 0.85)),
                    "halo_pixels": max(0, safe_int(payload.get("halo_pixels"), 1)),
                    "ai_model": normalize_ai_model_key(str(payload.get("ai_model") or DEFAULT_AI_MATTE_MODEL)),
                    "ai_device": normalize_ai_device(str(payload.get("ai_device") or "auto")),
                    "ai_resolution": normalize_ai_resolution(payload.get("ai_resolution")),
                    "luma_black": max(0, min(254, safe_int(payload.get("luma_black"), 24))),
                    "luma_white": max(1, min(255, safe_int(payload.get("luma_white"), 230))),
                    "luma_gamma": max(0.05, safe_float(payload.get("luma_gamma"), 1.0)),
                    "luma_strength": max(0.0, min(2.0, safe_float(payload.get("luma_strength"), 1.0))),
                    "corridorkey_enabled": bool(payload.get("corridorkey_enabled", False)),
                    "corridorkey_screen": normalize_corridorkey_screen(str(payload.get("corridorkey_screen") or "auto")),
                    "batch_green_to_black": bool(payload.get("batch_green_to_black", False)),
                    "batch_semitransparent_to_black": bool(payload.get("batch_semitransparent_to_black", False)),
                    "batch_semitransparent_to_opaque": bool(payload.get("batch_semitransparent_to_opaque", False)),
                    "sf_tolerance": max(1.0, safe_float(payload.get("sf_tolerance"), 120.0)),
                    "sf_edge_blend": bool(payload.get("sf_edge_blend", True)),
                    "sf_blend_zone_ratio": max(0.05, min(0.95, safe_float(payload.get("sf_blend_zone_ratio"), 0.6))),
                    "sf_alpha_cutoff": max(0, min(255, safe_int(payload.get("sf_alpha_cutoff"), 8))),
                    "sf_spill_removal": bool(payload.get("sf_spill_removal", True)),
                    "sf_spill_strength": max(0.0, min(1.0, safe_float(payload.get("sf_spill_strength"), 0.45))),
                    "decontaminate_enabled": bool(payload.get("decontaminate_enabled", True)),
                    "decontaminate_radius": max(1, min(8, safe_int(payload.get("decontaminate_radius"), 2))),
                    "decontaminate_strength": max(0.0, min(1.0, safe_float(payload.get("decontaminate_strength"), 1.0))),
                }
                if bool(payload.get("async", False)):
                    task = run_background_task("批量处理素材", process_video_to_job, **process_kwargs)
                    self.send_json({"ok": True, "task": task})
                    return
                result = process_video_to_job(**process_kwargs)
                self.send_json({"ok": True, "job": result})
                return
            if parsed.path == "/api/job/rematte-frames":
                payload = self.read_json_body()
                result = rematte_job_frames(
                    job_id=str(payload.get("job_id") or ""),
                    frame_indices=[safe_int(value, -1) for value in (payload.get("frame_indices") or [])],
                    target_size=max(32, safe_int(payload.get("target_size"), 256)),
                    reduce_px=max(0, safe_int(payload.get("reduce_px"), 20)),
                    canvas_mode=normalize_canvas_mode(str(payload.get("canvas_mode") or "auto")),
                    chroma_enabled=bool(payload.get("chroma_enabled", True)),
                    matte_mode=str(payload.get("matte_mode") or ""),
                    pipeline=normalize_matte_pipeline(payload),
                    key_mode=str(payload.get("key_mode") or "auto"),
                    manual_key_hex=str(payload.get("manual_key_hex") or "#00FF00"),
                    threshold=max(0, safe_int(payload.get("threshold"), 80)),
                    softness=max(0, safe_int(payload.get("softness"), 32)),
                    despill_strength=max(0.0, safe_float(payload.get("despill_strength"), 0.85)),
                    halo_pixels=max(0, safe_int(payload.get("halo_pixels"), 1)),
                    ai_model=normalize_ai_model_key(str(payload.get("ai_model") or DEFAULT_AI_MATTE_MODEL)),
                    ai_device=normalize_ai_device(str(payload.get("ai_device") or "auto")),
                    ai_resolution=normalize_ai_resolution(payload.get("ai_resolution")),
                    luma_black=max(0, min(254, safe_int(payload.get("luma_black"), 24))),
                    luma_white=max(1, min(255, safe_int(payload.get("luma_white"), 230))),
                    luma_gamma=max(0.05, safe_float(payload.get("luma_gamma"), 1.0)),
                    luma_strength=max(0.0, min(2.0, safe_float(payload.get("luma_strength"), 1.0))),
                    corridorkey_enabled=bool(payload.get("corridorkey_enabled", False)),
                    corridorkey_screen=normalize_corridorkey_screen(str(payload.get("corridorkey_screen") or "auto")),
                    batch_green_to_black=bool(payload.get("batch_green_to_black", False)),
                    batch_semitransparent_to_black=bool(payload.get("batch_semitransparent_to_black", False)),
                    batch_semitransparent_to_opaque=bool(payload.get("batch_semitransparent_to_opaque", False)),
                    sf_tolerance=max(1.0, safe_float(payload.get("sf_tolerance"), 120.0)),
                    sf_edge_blend=bool(payload.get("sf_edge_blend", True)),
                    sf_blend_zone_ratio=max(0.05, min(0.95, safe_float(payload.get("sf_blend_zone_ratio"), 0.6))),
                    sf_alpha_cutoff=max(0, min(255, safe_int(payload.get("sf_alpha_cutoff"), 8))),
                    sf_spill_removal=bool(payload.get("sf_spill_removal", True)),
                    sf_spill_strength=max(0.0, min(1.0, safe_float(payload.get("sf_spill_strength"), 0.45))),
                    decontaminate_enabled=bool(payload.get("decontaminate_enabled", True)),
                    decontaminate_radius=max(1, min(8, safe_int(payload.get("decontaminate_radius"), 2))),
                    decontaminate_strength=max(0.0, min(1.0, safe_float(payload.get("decontaminate_strength"), 1.0))),
                )
                self.send_json({"ok": True, "job": result})
                return
            if parsed.path == "/api/preview-frame":
                payload = self.read_json_body()
                result = preview_frame(
                    upload_id=str(payload.get("upload_id") or ""),
                    sample_time=safe_float(payload.get("sample_time"), 0.0),
                    target_size=max(32, safe_int(payload.get("target_size"), 256)),
                    reduce_px=max(0, safe_int(payload.get("reduce_px"), 20)),
                    canvas_mode=normalize_canvas_mode(str(payload.get("canvas_mode") or "auto")),
                    chroma_enabled=bool(payload.get("chroma_enabled", True)),
                    matte_mode=str(payload.get("matte_mode") or ""),
                    pipeline=normalize_matte_pipeline(payload),
                    key_mode=str(payload.get("key_mode") or "auto"),
                    manual_key_hex=str(payload.get("manual_key_hex") or "#00FF00"),
                    threshold=max(0, safe_int(payload.get("threshold"), 80)),
                    softness=max(0, safe_int(payload.get("softness"), 32)),
                    despill_strength=max(0.0, safe_float(payload.get("despill_strength"), 0.85)),
                    halo_pixels=max(0, safe_int(payload.get("halo_pixels"), 1)),
                    ai_model=normalize_ai_model_key(str(payload.get("ai_model") or DEFAULT_AI_MATTE_MODEL)),
                    ai_device=normalize_ai_device(str(payload.get("ai_device") or "auto")),
                    ai_resolution=normalize_ai_resolution(payload.get("ai_resolution")),
                    luma_black=max(0, min(254, safe_int(payload.get("luma_black"), 24))),
                    luma_white=max(1, min(255, safe_int(payload.get("luma_white"), 230))),
                    luma_gamma=max(0.05, safe_float(payload.get("luma_gamma"), 1.0)),
                    luma_strength=max(0.0, min(2.0, safe_float(payload.get("luma_strength"), 1.0))),
                    corridorkey_enabled=bool(payload.get("corridorkey_enabled", False)),
                    corridorkey_screen=normalize_corridorkey_screen(str(payload.get("corridorkey_screen") or "auto")),
                    batch_green_to_black=bool(payload.get("batch_green_to_black", False)),
                    batch_semitransparent_to_black=bool(payload.get("batch_semitransparent_to_black", False)),
                    batch_semitransparent_to_opaque=bool(payload.get("batch_semitransparent_to_opaque", False)),
                    sf_tolerance=max(1.0, safe_float(payload.get("sf_tolerance"), 120.0)),
                    sf_edge_blend=bool(payload.get("sf_edge_blend", True)),
                    sf_blend_zone_ratio=max(0.05, min(0.95, safe_float(payload.get("sf_blend_zone_ratio"), 0.6))),
                    sf_alpha_cutoff=max(0, min(255, safe_int(payload.get("sf_alpha_cutoff"), 8))),
                    sf_spill_removal=bool(payload.get("sf_spill_removal", True)),
                    sf_spill_strength=max(0.0, min(1.0, safe_float(payload.get("sf_spill_strength"), 0.45))),
                    decontaminate_enabled=bool(payload.get("decontaminate_enabled", True)),
                    decontaminate_radius=max(1, min(8, safe_int(payload.get("decontaminate_radius"), 2))),
                    decontaminate_strength=max(0.0, min(1.0, safe_float(payload.get("decontaminate_strength"), 1.0))),
                )
                self.send_json({"ok": True, "preview": result})
                return
        except FileNotFoundError as exc:
            self.send_error_json(str(exc), status=HTTPStatus.NOT_FOUND)
            return
        except Exception as exc:
            self.send_error_json(str(exc), status=HTTPStatus.BAD_REQUEST)
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def serve_dist_file(self, path: Path, content_type: str | None = None, allow_range: bool = False) -> None:
        if not is_within_root(path, DIST_DIR):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        self.serve_file(path, content_type=content_type, allow_range=allow_range)

    def serve_work_file(self, path: Path, content_type: str | None = None, allow_range: bool = False) -> None:
        if not is_within_root(path, WORK_DIR):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        self.serve_file(path, content_type=content_type, allow_range=allow_range)

    def serve_media_file(self, path: Path, content_type: str | None = None, allow_range: bool = False) -> None:
        self.serve_file(path, content_type=content_type, allow_range=allow_range)

    def serve_file(self, path: Path, content_type: str | None = None, allow_range: bool = False) -> None:
        path = path.resolve()
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        guessed_type = content_type or mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        file_size = path.stat().st_size
        range_header = self.headers.get("Range") if allow_range else None

        if range_header and range_header.startswith("bytes="):
            start_text, _, end_text = range_header.removeprefix("bytes=").partition("-")
            start = int(start_text or "0")
            end = int(end_text or file_size - 1)
            end = min(end, file_size - 1)
            if start > end:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
            length = (end - start) + 1
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", guessed_type)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(length))
            self.end_headers()
            with path.open("rb") as handle:
                handle.seek(start)
                self.wfile.write(handle.read(length))
            return

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", guessed_type)
        self.send_header("Content-Length", str(file_size))
        if allow_range:
            self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        with path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile)


def serve_once(host: str, port: int) -> None:
    ensure_runtime_dirs()
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Sprite Video Lab running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def stop_child_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_with_reloader(host: str, port: int) -> None:
    ensure_runtime_dirs()
    watch_state = watch_snapshot()
    child: subprocess.Popen | None = None
    print(f"Sprite Video Lab reloader watching {len(watch_state)} files.")
    try:
        while True:
            if child is None or child.poll() is not None:
                child = subprocess.Popen(
                    [
                        sys.executable,
                        str(ROOT_DIR / "server.py"),
                        "--serve",
                        "--host",
                        host,
                        "--port",
                        str(port),
                    ],
                    cwd=str(ROOT_DIR),
                )
            time.sleep(0.8)
            next_snapshot = watch_snapshot()
            if next_snapshot != watch_state:
                print("Changes detected. Reloading Sprite Video Lab...")
                watch_state = next_snapshot
                stop_child_process(child)
                child = None
    except KeyboardInterrupt:
        pass
    finally:
        stop_child_process(child)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Sprite Video Lab.")
    parser.add_argument("--serve", action="store_true", help="Run the HTTP server once without file watching.")
    parser.add_argument("--host", default=None, help=f"Host to bind. Defaults to ${HOST_ENV} or {DEFAULT_HOST}.")
    parser.add_argument("--port", type=int, default=None, help=f"Port to bind. Defaults to ${PORT_ENV} or {DEFAULT_PORT}.")
    args = parser.parse_args()
    host = configured_host(args.host)
    port = configured_port(args.port)
    if args.serve:
        serve_once(host, port)
        return
    run_with_reloader(host, port)


if __name__ == "__main__":
    main()
