"""并行抠图工作模块（供 server.py 通过 ProcessPoolExecutor 调用）。

设计要点：
- 该模块只依赖 PIL / numpy / sprite_lab.imaging，**不导入** server.py，
  这样在 Windows spawn 子进程里导入开销小、无副作用，pickling 稳定。
- `despill_alpha_edges` 与 `edge_decontaminate` 从 server.py 迁移到此处，
  作为唯一实现来源；server.py 再 import 回去，避免重复维护。
- 所有 worker 以「原始字节」(mode,size,tobytes) 形式传输图像，避免 PNG 压缩开销，
  且全部为模块级函数，可被子进程 pickle。
"""
from __future__ import annotations

import math
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Callable

from PIL import Image, ImageChops, ImageFilter

from sprite_lab.imaging.chroma import chroma_key_frame, spriteflow_key_frame
from sprite_lab.imaging.luma import luminance_alpha_mask, apply_alpha_mask


# --------------------------------------------------------------------------- #
# 从 server.py 迁移过来的纯像素后处理（唯一实现来源）
# --------------------------------------------------------------------------- #
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
    """边缘去污：把半透明边缘像素的 RGB 替换为最近不透明像素颜色，消除白色/背景色残留。"""
    if strength <= 0:
        return image
    strength = min(1.0, float(strength))
    radius = max(1, min(8, int(radius)))

    import numpy as np

    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    opaque_mask = alpha >= 250.0
    semi_mask = (alpha > 0) & (alpha < 250.0)

    if not np.any(semi_mask):
        return image

    weight_map = opaque_mask.astype(np.uint8) * 255
    color_sum = np.zeros((h, w, 3), dtype=np.uint8)
    color_sum[opaque_mask] = np.clip(arr[opaque_mask, :3], 0, 255).astype(np.uint8)

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

    safe_weight = np.maximum(weight_arr, 1e-6)
    filled_r = (filled_r / safe_weight) * 255.0
    filled_g = (filled_g / safe_weight) * 255.0
    filled_b = (filled_b / safe_weight) * 255.0

    blend = strength * (1.0 - alpha[semi_mask] / 250.0)
    blend = np.clip(blend, 0.0, 1.0)

    arr[semi_mask, 0] = arr[semi_mask, 0] * (1.0 - blend) + filled_r[semi_mask] * blend
    arr[semi_mask, 1] = arr[semi_mask, 1] * (1.0 - blend) + filled_g[semi_mask] * blend
    arr[semi_mask, 2] = arr[semi_mask, 2] * (1.0 - blend) + filled_b[semi_mask] * blend

    result = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    return result


# --------------------------------------------------------------------------- #
# 图像「原始字节」序列化（进程间传输用，避免 PNG 压缩开销）
# --------------------------------------------------------------------------- #
def dump_image(image: Image.Image) -> tuple[str, tuple[int, int], bytes]:
    return (image.mode, image.size, image.tobytes())


def load_image(blob: tuple[str, tuple[int, int], bytes]) -> Image.Image:
    mode, size, data = blob
    return Image.frombytes(mode, size, data)


def _maybe_erode(alpha: Image.Image, halo_pixels: int) -> Image.Image:
    if halo_pixels and halo_pixels > 0:
        filter_size = (halo_pixels * 2) + 1
        return alpha.filter(ImageFilter.MinFilter(filter_size))
    return alpha


# --------------------------------------------------------------------------- #
# 逐帧 worker（均为模块级、可 pickle；输入/输出都用 dump/load 字节）
# --------------------------------------------------------------------------- #
def worker_chroma(payload: dict) -> tuple[str, tuple[int, int], bytes]:
    raw = load_image(payload["raw"]).convert("RGBA")
    keyed = chroma_key_frame(
        image=raw,
        key_rgb=payload["key_rgb"],
        threshold=payload["threshold"],
        softness=payload["softness"],
        despill_strength=payload["despill_strength"],
        halo_pixels=payload["halo_pixels"],
    )
    return dump_image(keyed)


def worker_spriteflow(payload: dict) -> tuple[str, tuple[int, int], bytes]:
    raw = load_image(payload["raw"]).convert("RGBA")
    keyed = spriteflow_key_frame(
        raw,
        payload["key_rgb"],
        payload["sf_tolerance"],
        payload["sf_edge_blend"],
        payload["sf_blend_zone_ratio"],
        payload["sf_alpha_cutoff"],
        payload["sf_spill_removal"],
        payload["sf_spill_strength"],
    )
    keyed.putalpha(_maybe_erode(keyed.getchannel("A"), payload["halo_pixels"]))
    return dump_image(keyed)


def worker_luma(payload: dict) -> tuple[str, tuple[int, int], bytes]:
    raw = load_image(payload["raw"]).convert("RGBA")
    alpha = luminance_alpha_mask(
        raw,
        payload["luma_black"],
        max(payload["luma_black"] + 1, payload["luma_white"]),
        payload["luma_gamma"],
        payload["luma_strength"],
        key_rgb=payload["key_rgb"],
    )
    alpha = _maybe_erode(alpha, payload["halo_pixels"])
    keyed = apply_alpha_mask(raw, alpha)
    keyed = despill_alpha_edges(keyed, payload["key_rgb"], payload["despill_strength"])
    return dump_image(keyed)


def worker_finalize_alpha(payload: dict) -> tuple[str, tuple[int, int], bytes]:
    """给定原图 + 预先算好的 alpha（如 GPU 批量 BiRefNet 的结果），做 apply + despill。"""
    raw = load_image(payload["raw"]).convert("RGBA")
    alpha = load_image(payload["alpha"]).convert("L")
    alpha = _maybe_erode(alpha, payload["halo_pixels"])
    keyed = apply_alpha_mask(raw, alpha)
    keyed = despill_alpha_edges(keyed, payload["key_rgb"], payload["despill_strength"])
    return dump_image(keyed)


def worker_decontaminate(payload: dict) -> tuple[str, tuple[int, int], bytes]:
    frame = load_image(payload["frame"]).convert("RGBA")
    cleaned = edge_decontaminate(frame, payload["radius"], payload["strength"])
    return dump_image(cleaned)


# --------------------------------------------------------------------------- #
# 通用并行执行器：保持顺序、带进度回调、失败回退串行
# --------------------------------------------------------------------------- #
def _init_worker() -> None:
    """子进程初始化：限制底层数学库线程数，避免 N 进程 × M 线程 的超额订阅。"""
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ.setdefault(var, "1")


def resolve_worker_count(n_items: int) -> int:
    env = os.environ.get("SPRITE_MATTE_WORKERS")
    cap = 0
    if env:
        try:
            cap = max(1, int(env))
        except ValueError:
            cap = 0
    if cap <= 0:
        cpu = os.cpu_count() or 1
        cap = min(cpu, 8)
    return max(1, min(cap, n_items))


def run_parallel(
    worker: Callable[[dict], tuple],
    payloads: list[dict],
    *,
    min_items: int = 4,
    progress_cb: Callable[[int, int], None] | None = None,
) -> list[Image.Image]:
    """并行执行 worker(payload)，返回顺序一致的 PIL 图像列表。

    - 帧数 < min_items 或 worker 数 <= 1：直接串行。
    - 进程池创建/执行异常：自动回退到串行，保证不影响出图。
    """
    n = len(payloads)
    results: list[Image.Image | None] = [None] * n
    workers = resolve_worker_count(n)

    def _run_sequential() -> list[Image.Image]:
        for idx, payload in enumerate(payloads):
            results[idx] = load_image(worker(payload))
            if progress_cb:
                progress_cb(idx + 1, n)
        return [img for img in results]  # type: ignore[return-value]

    if n < max(2, min_items) or workers <= 1:
        return _run_sequential()

    try:
        with ProcessPoolExecutor(max_workers=workers, initializer=_init_worker) as executor:
            future_to_index = {executor.submit(worker, payload): idx for idx, payload in enumerate(payloads)}
            done = 0
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                results[idx] = load_image(future.result())
                done += 1
                if progress_cb:
                    progress_cb(done, n)
        return [img for img in results]  # type: ignore[return-value]
    except Exception:
        # 任意失败（spawn/pickle/worker 报错）都回退串行，确保产出正确
        for idx in range(n):
            results[idx] = None
        return _run_sequential()
