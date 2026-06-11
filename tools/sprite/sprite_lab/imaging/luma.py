"""Luminance-based alpha mask and alpha-mask application helpers."""
from __future__ import annotations

import math

from PIL import Image

from ..config import LANCZOS
from ..validation.types import clamp_float


def luminance_alpha_mask(
    image: Image.Image,
    black_point: int,
    white_point: int,
    gamma: float,
    strength: float,
    key_rgb: tuple[int, int, int] | None = None,
    key_suppression: float = 0.95,
) -> Image.Image:
    black = max(0, min(254, int(black_point)))
    white = max(black + 1, min(255, int(white_point)))
    curve_gamma = max(0.05, float(gamma or 1.0))
    curve_strength = max(0.0, min(2.0, float(strength or 1.0)))
    key_strength = max(0.0, min(1.0, float(key_suppression)))
    rgb = image.convert("RGB")
    scale = white - black
    output = Image.new("L", rgb.size)
    output_pixels: list[int] = []
    for r_value, g_value, b_value in rgb.getdata():
        luma = int((0.2126 * r_value) + (0.7152 * g_value) + (0.0722 * b_value))
        normalized = clamp_float((luma - black) / scale, 0.0, 1.0)
        adjusted = normalized ** curve_gamma
        alpha = clamp_float(adjusted * curve_strength, 0.0, 1.0)
        if key_rgb is not None and key_strength > 0:
            k_r, k_g, k_b = key_rgb
            dist = math.sqrt((r_value - k_r) ** 2 + (g_value - k_g) ** 2 + (b_value - k_b) ** 2)
            closeness = 1.0 - min(dist / 180.0, 1.0)
            alpha *= 1.0 - ((closeness ** 2) * key_strength)
        output_pixels.append(round(alpha * 255))
    output.putdata(output_pixels)
    return output


def apply_alpha_mask(image: Image.Image, alpha_mask: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    mask = alpha_mask.convert("L")
    if mask.size != rgba.size:
        mask = mask.resize(rgba.size, LANCZOS)
    rgba.putalpha(mask)
    return rgba
