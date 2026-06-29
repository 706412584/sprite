"""Standard game engine sprite sheet manifest generators.

Each generator is a pure function: takes a normalized data dict, returns a
string (JSON or XML).  All dependencies are Python stdlib.

Supported formats:
- Phaser JSON Hash  (Phaser 3)
- Phaser JSON Array (Phaser 3, PixiJS)
- Sparrow XML       (TexturePacker, Godot 4, Starling, PixiJS)
- Cocos Creator plist
- Godot 4 SpriteFrames (.tres)
- Urho3D Sprite2D XML
"""
from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring


def _indent_xml(elem: Element, level: int = 0) -> None:
    """Add pretty-print indentation to an ElementTree in-place."""
    indent = "\n" + "  " * level
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = indent + "  "
        if not elem.tail or not elem.tail.strip():
            elem.tail = indent
        for child in elem:
            _indent_xml(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = indent
    else:
        if not elem.tail or not elem.tail.strip():
            elem.tail = indent


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

VALID_MANIFEST_FORMATS: set[str] = {
    "phaser_hash",
    "phaser_array",
    "sparrow_xml",
    "cocos_plist",
    "godot_tres",
    "sprite2d_xml",
}


def build_format_data(
    frame_positions: list[dict],
    sheet_width: int,
    sheet_height: int,
    sheet_image_name: str,
    fps: float,
) -> dict:
    """Build the normalized data dict consumed by all generators."""
    frames: list[dict] = []
    for i, pos in enumerate(frame_positions):
        frames.append({
            "name": f"frame_{i + 1:03d}",
            "x": pos["x"],
            "y": pos["y"],
            "w": pos["width"],
            "h": pos["height"],
        })
    return {
        "frames": frames,
        "sheet_width": sheet_width,
        "sheet_height": sheet_height,
        "sheet_image": sheet_image_name,
        "fps": fps,
    }


def generate_manifest_files(
    formats: list[str],
    data: dict,
    target_dir: Path,
) -> dict[str, str]:
    """Generate requested manifest files and return {format_key: url}."""
    export_dir_name = target_dir.name
    result: dict[str, str] = {}
    for fmt in formats:
        if fmt not in MANIFEST_GENERATORS:
            continue
        filename, generator = MANIFEST_GENERATORS[fmt]
        try:
            content = generator(data)
            (target_dir / filename).write_text(content, encoding="utf-8")
            result[f"{fmt}_url"] = f"/work/exports/{export_dir_name}/{filename}"
        except Exception as exc:
            print(f"[export] {fmt} manifest generation failed: {exc}")
    return result


# ---------------------------------------------------------------------------
# Phaser JSON Hash
# ---------------------------------------------------------------------------

def generate_phaser_hash(data: dict) -> str:
    frames = {}
    for f in data["frames"]:
        frames[f["name"]] = {
            "frame": {"x": f["x"], "y": f["y"], "w": f["w"], "h": f["h"]},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": f["w"], "h": f["h"]},
            "sourceSize": {"w": f["w"], "h": f["h"]},
        }
    return json.dumps({
        "frames": frames,
        "meta": _phaser_meta(data),
    }, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Phaser JSON Array
# ---------------------------------------------------------------------------

def generate_phaser_array(data: dict) -> str:
    frames = []
    for f in data["frames"]:
        frames.append({
            "filename": f["name"],
            "frame": {"x": f["x"], "y": f["y"], "w": f["w"], "h": f["h"]},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": f["w"], "h": f["h"]},
            "sourceSize": {"w": f["w"], "h": f["h"]},
        })
    return json.dumps({
        "frames": frames,
        "meta": _phaser_meta(data),
    }, ensure_ascii=False, indent=2)


def _phaser_meta(data: dict) -> dict:
    return {
        "app": "Sprite Video Lab",
        "version": "1.0",
        "image": data["sheet_image"],
        "format": "RGBA8888",
        "size": {"w": data["sheet_width"], "h": data["sheet_height"]},
        "scale": "1",
    }


# ---------------------------------------------------------------------------
# Sparrow XML (TexturePacker / Starling / Godot 4)
# ---------------------------------------------------------------------------

def generate_sparrow_xml(data: dict) -> str:
    atlas = Element("TextureAtlas", imagePath=data["sheet_image"])
    for f in data["frames"]:
        SubElement(atlas, "SubTexture", {
            "name": f["name"],
            "x": str(f["x"]),
            "y": str(f["y"]),
            "width": str(f["w"]),
            "height": str(f["h"]),
        })
    _indent_xml(atlas)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(atlas, encoding="unicode")


# ---------------------------------------------------------------------------
# Cocos Creator plist
# ---------------------------------------------------------------------------

def generate_cocos_plist(data: dict) -> str:
    lines: list[str] = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
                 '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">')
    lines.append('<plist version="1.0">')
    lines.append('<dict>')

    # frames
    lines.append('\t<key>frames</key>')
    lines.append('\t<dict>')
    for f in data["frames"]:
        lines.append(f'\t\t<key>{f["name"]}</key>')
        lines.append('\t\t<dict>')
        lines.append(f'\t\t\t<key>frame</key>')
        lines.append(f'\t\t\t<string>{{{{{f["x"]},{f["y"]}}},{{{f["w"]},{f["h"]}}}}}</string>')
        lines.append(f'\t\t\t<key>offset</key>')
        lines.append(f'\t\t\t<string>{{0,0}}</string>')
        lines.append(f'\t\t\t<key>rotated</key>')
        lines.append(f'\t\t\t<false/>')
        lines.append(f'\t\t\t<key>sourceColorRect</key>')
        lines.append(f'\t\t\t<string>{{{{0,0}},{{{f["w"]},{f["h"]}}}}}</string>')
        lines.append(f'\t\t\t<key>sourceSize</key>')
        lines.append(f'\t\t\t<string>{{{f["w"]},{f["h"]}}}</string>')
        lines.append('\t\t</dict>')
    lines.append('\t</dict>')

    # metadata
    lines.append('\t<key>metadata</key>')
    lines.append('\t<dict>')
    lines.append('\t\t<key>format</key>')
    lines.append('\t\t<integer>2</integer>')
    lines.append(f'\t\t<key>realTextureFileName</key>')
    lines.append(f'\t\t<string>{data["sheet_image"]}</string>')
    lines.append(f'\t\t<key>size</key>')
    lines.append(f'\t\t<string>{{{data["sheet_width"]},{data["sheet_height"]}}}</string>')
    lines.append(f'\t\t<key>textureFileName</key>')
    lines.append(f'\t\t<string>{data["sheet_image"]}</string>')
    lines.append('\t</dict>')

    lines.append('</dict>')
    lines.append('</plist>')
    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------------------
# Godot 4 SpriteFrames (.tres)
# ---------------------------------------------------------------------------

def generate_godot_tres(data: dict) -> str:
    """Generate a Godot 4 SpriteFrames .tres resource file.

    Uses AtlasTexture sub-resources to reference regions of the sprite sheet.
    The user must place the .tres and sprite sheet in the same Godot project
    directory and update the ext_resource path if needed.
    """
    frames = data["frames"]
    fps = data.get("fps", 10.0)
    sheet_image = data["sheet_image"]

    # ext_resource for the sheet texture (id=1)
    # AtlasTexture sub-resources: one per frame (ids 2..N+1)
    load_steps = 1 + len(frames)

    lines: list[str] = []
    lines.append(f'[gd_resource type="SpriteFrames" load_steps={load_steps} format=3]')
    lines.append('')
    lines.append(f'[ext_resource type="Texture2D" uid="uid://placeholder" '
                 f'path="res://{sheet_image}" id="1"]')
    lines.append('')

    # Sub-resources: AtlasTexture for each frame
    for i, f in enumerate(frames):
        rid = i + 2
        lines.append(f'[sub_resource type="AtlasTexture" id="AtlasTexture_{rid}"]')
        lines.append(f'atlas = ExtResource("1")')
        lines.append(f'regect = Rect2({f["x"]}, {f["y"]}, {f["w"]}, {f["h"]})')
        lines.append('')

    # Main resource
    lines.append('[resource]')
    lines.append('animations = [{')
    lines.append('"duration": 1.0,')
    lines.append('"frames": [')

    for i, f in enumerate(frames):
        rid = i + 2
        comma = ',' if i < len(frames) - 1 else ''
        lines.append('{"duration": 1.0, "texture": SubResource("AtlasTexture_' + str(rid) + '")}' + comma)

    lines.append('],')
    lines.append('"loop": true,')
    lines.append(f'"name": &"default",')
    lines.append(f'"speed": {fps:.1f}')
    lines.append('}]')

    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------------------
# Urho3D Sprite2D XML
# ---------------------------------------------------------------------------

def generate_sprite2d_xml(data: dict) -> str:
    """Generate Urho3D Sprite2D XML atlas.

    Each frame is a <sprite> element with rectangle="x y w h" defining its
    region on the sheet.  Hotspot defaults to center (0.5, 0.5).
    """
    root = Element("sprite2d")
    SubElement(root, "texture", {"name": data["sheet_image"]})
    for f in data["frames"]:
        SubElement(root, "sprite", {
            "name": f["name"],
            "rectangle": f'{f["x"]} {f["y"]} {f["w"]} {f["h"]}',
            "hotspot": "0.5 0.5",
        })
    _indent_xml(root)
    return '<?xml version="1.0"?>\n' + tostring(root, encoding="unicode")


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

MANIFEST_GENERATORS: dict[str, tuple[str, Callable[[dict], str]]] = {
    "phaser_hash":  ("phaser_hash.json",    generate_phaser_hash),
    "phaser_array": ("phaser_array.json",   generate_phaser_array),
    "sparrow_xml":  ("sparrow.xml",         generate_sparrow_xml),
    "cocos_plist":  ("cocos.plist",         generate_cocos_plist),
    "godot_tres":   ("sprite_frames.tres",  generate_godot_tres),
    "sprite2d_xml": ("sprite2d.xml",        generate_sprite2d_xml),
}
