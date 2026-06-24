"""Single-frame extraction from a static image source."""
from __future__ import annotations

from pathlib import Path

from ..imaging.canvas import open_rgba_image
from .accel import static_image_payload


def extract_image_frame(source_path: Path, output_path: Path) -> tuple[Path, dict]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image = open_rgba_image(source_path)
    image.save(output_path)
    image.close()
    return output_path, static_image_payload()
