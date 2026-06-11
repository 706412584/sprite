"""Chroma key and SpriteFlow edge-gradient keying (RGB-distance based)."""
from __future__ import annotations

import math

from PIL import Image, ImageFilter


def chroma_key_frame(
    image: Image.Image,
    key_rgb: tuple[int, int, int],
    threshold: int,
    softness: int,
    despill_strength: float,
    halo_pixels: int,
) -> Image.Image:
    rgba = image.convert("RGBA")
    output_pixels: list[tuple[int, int, int, int]] = []
    k_r, k_g, k_b = key_rgb
    if softness <= 0:
        max_distance = max(threshold, 1)
    else:
        max_distance = threshold + softness

    for r_value, g_value, b_value, _ in rgba.getdata():
        dist = math.sqrt(
            (r_value - k_r) ** 2
            + (g_value - k_g) ** 2
            + (b_value - k_b) ** 2
        )
        if dist <= threshold:
            alpha = 0
        elif softness <= 0 or dist >= max_distance:
            alpha = 255
        else:
            alpha = int(((dist - threshold) / softness) * 255)

        max_rb = max(r_value, b_value)
        spill = max(0, g_value - max_rb)
        closeness = max(0.0, 1.0 - min(dist / max_distance, 1.0))
        reduction = int(spill * despill_strength * max(closeness, 1.0 - (alpha / 255.0)))
        output_pixels.append(
            (
                r_value,
                max(0, g_value - reduction),
                b_value,
                alpha,
            )
        )

    keyed = Image.new("RGBA", rgba.size)
    keyed.putdata(output_pixels)

    if halo_pixels > 0:
        alpha_channel = keyed.getchannel("A")
        filter_size = (halo_pixels * 2) + 1
        eroded = alpha_channel.filter(ImageFilter.MinFilter(filter_size))
        keyed.putalpha(eroded)

    return keyed


def spriteflow_key_frame(
    image: Image.Image,
    key_rgb: tuple[int, int, int],
    tolerance: float,
    edge_blend: bool,
    blend_zone_ratio: float,
    alpha_cutoff: int,
    spill_removal: bool,
    spill_strength: float,
) -> Image.Image:
    """SpriteFlow 色键算法（完整移植自前端 slicer.ts 的 keyOutBackground）。

    以 key_rgb 为背景色，按欧氏色距做边缘渐变抠像：blendZone 内全透明、
    blendZone~maxDist 之间按比例衰减 alpha；可选去除主色溢色与低 alpha 截断。
    """
    import numpy as np

    rgba = image.convert("RGBA")
    arr = np.asarray(rgba).astype(np.float32)
    if arr.size == 0:
        return rgba
    rgb = arr[..., :3]
    alpha = arr[..., 3].copy()

    k_r, k_g, k_b = (float(key_rgb[0]), float(key_rgb[1]), float(key_rgb[2]))
    diff = rgb - np.array([k_r, k_g, k_b], dtype=np.float32)
    dist_sq = np.sum(diff * diff, axis=-1)
    dist = np.sqrt(dist_sq)

    tolerance = max(1.0, float(tolerance))
    blend_zone_ratio = min(0.95, max(0.05, float(blend_zone_ratio)))
    alpha_cutoff = max(0, min(255, int(alpha_cutoff)))
    spill_strength = min(1.0, max(0.0, float(spill_strength)))

    if edge_blend:
        max_dist = tolerance * math.sqrt(3.0)
        blend_zone = tolerance * blend_zone_ratio
        # blendZone 内完全透明
        alpha[dist <= blend_zone] = 0.0
        # blendZone~maxDist 之间按比例衰减
        mid = (dist > blend_zone) & (dist <= max_dist)
        ratio = (dist - blend_zone) / max(1.0, (max_dist - blend_zone))
        alpha[mid] = alpha[mid] * ratio[mid]

        if spill_removal:
            spill_band = (alpha > 0) & (dist <= max_dist * 1.35)
            if np.any(spill_band):
                closeness = np.clip(1.0 - dist / max(1.0, max_dist * 1.35), 0.0, 1.0)
                # 取背景色的主导通道，向另外两通道的最大值收敛
                if k_r >= k_g and k_r >= k_b:
                    dominant = 0
                elif k_g >= k_b:
                    dominant = 1
                else:
                    dominant = 2
                a_idx = 1 if dominant == 0 else 0
                b_idx = 1 if dominant == 2 else 2
                neutral = np.maximum(rgb[..., a_idx], rgb[..., b_idx])
                dom_channel = rgb[..., dominant]
                target = spill_band & (dom_channel > neutral)
                reduction = (dom_channel - neutral) * spill_strength * closeness
                rgb[..., dominant] = np.where(target, dom_channel - reduction, dom_channel)
    else:
        tol2 = tolerance * tolerance * 3.0
        alpha[dist_sq <= tol2] = 0.0

    if alpha_cutoff > 0:
        alpha[alpha <= alpha_cutoff] = 0.0

    out = np.empty_like(arr)
    out[..., :3] = np.clip(rgb, 0.0, 255.0)
    out[..., 3] = np.clip(alpha, 0.0, 255.0)
    return Image.fromarray(out.astype(np.uint8), "RGBA")
