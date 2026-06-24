"""Global constants and configuration for Sprite Video Lab."""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Environment variable names
# ---------------------------------------------------------------------------
HOST_ENV = "SPRITE_VIDEO_LAB_HOST"
PORT_ENV = "SPRITE_VIDEO_LAB_PORT"
FFMPEG_DIR_ENV = "SPRITE_VIDEO_LAB_FFMPEG_DIR"
FFMPEG_ACCEL_ENV = "SPRITE_VIDEO_LAB_FFMPEG_ACCEL"
AI_MODEL_CACHE_ENV = "SPRITE_VIDEO_LAB_AI_MODEL_CACHE"
CORRIDORKEY_ROOT_ENV = "SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8894
DEFAULT_FFMPEG_FALLBACK_ROOT = Path(r"I:\FF\Flowframes\FlowframesData\pkgs\av")
APP_VERSION_POLL_MS = 1200

# ---------------------------------------------------------------------------
# Pillow resampling constant (central definition)
# ---------------------------------------------------------------------------
from PIL import Image  # noqa: E402
LANCZOS = Image.Resampling.LANCZOS

# ---------------------------------------------------------------------------
# File extension sets
# ---------------------------------------------------------------------------
VIDEO_EXTENSIONS: set[str] = {".mp4", ".mov", ".mkv", ".webm"}
IMAGE_EXTENSIONS: set[str] = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
ANIMATION_FRAME_EXTENSIONS: set[str] = IMAGE_EXTENSIONS

CONTENT_TYPE_EXTENSIONS: dict[str, str] = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}

# ---------------------------------------------------------------------------
# ffmpeg hardware acceleration
# ---------------------------------------------------------------------------
FFMPEG_ACCEL_PRIORITY: tuple[str, ...] = ("cuda", "qsv", "d3d11va", "dxva2")

FFMPEG_ACCEL_ALIASES: dict[str, str] = {
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

# ---------------------------------------------------------------------------
# AI matting models
# ---------------------------------------------------------------------------
AI_MATTE_MODEL_REPOS: dict[str, str] = {
    "birefnet-hr-matting": "ZhengPeng7/BiRefNet_HR-matting",
    "birefnet-lite-2k": "ZhengPeng7/BiRefNet_lite-2K",
    "birefnet-general": "ZhengPeng7/BiRefNet",
}

AI_MATTE_MODEL_LABELS: dict[str, str] = {
    "birefnet-hr-matting": "BiRefNet HR-matting",
    "birefnet-lite-2k": "BiRefNet lite-2K",
    "birefnet-general": "BiRefNet general",
}

AI_MATTE_MODES: set[str] = {
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

ATOMIC_KEYING_MODES: set[str] = {"chroma", "spriteflow", "birefnet", "corridorkey", "luma"}

AI_MATTE_DEVICE_ALIASES: dict[str, str] = {
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

# ---------------------------------------------------------------------------
# CorridorKey
# ---------------------------------------------------------------------------
CORRIDORKEY_REPO_URL = "https://github.com/nikopueringer/CorridorKey"
CORRIDORKEY_IMG_SIZE = 2048
CORRIDORKEY_GPU_DESPECKLE_PIXEL_LIMIT = 2**24
CORRIDORKEY_SCREEN_COLORS: set[str] = {"auto", "green", "blue"}

# ---------------------------------------------------------------------------
# Canvas modes
# ---------------------------------------------------------------------------
CANVAS_MODES: set[str] = {"auto", "square_bottom", "square_center"}

# ---------------------------------------------------------------------------
# Pose detection (MediaPipe)
# ---------------------------------------------------------------------------
POSE_MODEL_KEY = "mediapipe-pose-full"
POSE_MODEL_LABEL = "MediaPipe Pose Landmarker (full)"
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
POSE_MODEL_FILENAME = "pose_landmarker_full.task"

# ---------------------------------------------------------------------------
# LaMa inpainting
# ---------------------------------------------------------------------------
LAMA_MODEL_REPO = "smilyluke/lama-large"
LAMA_MODEL_LABEL = "LaMa Large (inpainting)"
LAMA_MODEL_KEY = "lama-large"
LAMA_DEFAULT_RESOLUTION = 512

POSE_LANDMARK_NAMES: dict[int, str] = {
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

# ---------------------------------------------------------------------------
# Mojibake
# ---------------------------------------------------------------------------
MOJIBAKE_REPLACEMENTS: dict[str, str] = {
    "\u677b\ufe40\u75c2": "\u8f66\u5b9d",
}
