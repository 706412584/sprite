"""Canvas / alpha resampling helpers (isolated, pure image-in image-out)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

from ..config import LANCZOS


def open_rgba_image(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def enforce_hard_alpha(image: Image.Image, cutoff: int = 128) -> Image.Image:
    rgba = image.convert("RGBA")
    hardened_pixels: list[tuple[int, int, int, int]] = []
    for r_value, g_value, b_value, alpha in rgba.getdata():
        if alpha >= cutoff:
            hardened_pixels.append((r_value, g_value, b_value, 255))
        else:
            hardened_pixels.append((0, 0, 0, 0))
    hardened = Image.new("RGBA", rgba.size)
    hardened.putdata(hardened_pixels)
    return hardened


def resize_rgba_with_premultiplied_alpha(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    red, green, blue, alpha = rgba.split()
    premultiplied_red = ImageChops.multiply(red, alpha)
    premultiplied_green = ImageChops.multiply(green, alpha)
    premultiplied_blue = ImageChops.multiply(blue, alpha)

    resized_alpha = alpha.resize(size, LANCZOS)
    resized_red = premultiplied_red.resize(size, LANCZOS)
    resized_green = premultiplied_green.resize(size, LANCZOS)
    resized_blue = premultiplied_blue.resize(size, LANCZOS)

    pixels: list[tuple[int, int, int, int]] = []
    for r_value, g_value, b_value, alpha_value in zip(
        resized_red.getdata(),
        resized_green.getdata(),
        resized_blue.getdata(),
        resized_alpha.getdata(),
    ):
        if alpha_value <= 0:
            pixels.append((0, 0, 0, 0))
            continue
        pixels.append(
            (
                min(255, int((r_value * 255 + (alpha_value // 2)) / alpha_value)),
                min(255, int((g_value * 255 + (alpha_value // 2)) / alpha_value)),
                min(255, int((b_value * 255 + (alpha_value // 2)) / alpha_value)),
                alpha_value,
            )
        )

    resized = Image.new("RGBA", size)
    resized.putdata(pixels)
    return resized
