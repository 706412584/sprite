"""Color parsing and key-color sampling helpers."""
from __future__ import annotations

from PIL import Image


def parse_hex_color(raw: str) -> tuple[int, int, int]:
    value = raw.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"invalid color: {raw}")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"


def auto_key_color(image: Image.Image) -> tuple[int, int, int]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    sample_size = max(4, min(width, height) // 16)
    boxes = [
        (0, 0, sample_size, sample_size),
        (width - sample_size, 0, width, sample_size),
        (0, height - sample_size, sample_size, height),
        (width - sample_size, height - sample_size, width, height),
    ]
    totals = [0, 0, 0]
    count = 0
    for left, top, right, bottom in boxes:
        for y in range(top, bottom):
            for x in range(left, right):
                r_value, g_value, b_value, _ = rgba.getpixel((x, y))
                totals[0] += r_value
                totals[1] += g_value
                totals[2] += b_value
                count += 1
    if count <= 0:
        return (0, 255, 0)
    return tuple(int(value / count) for value in totals)
