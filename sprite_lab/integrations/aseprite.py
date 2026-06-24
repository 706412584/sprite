"""Aseprite CLI 集成（可选）。

当 Aseprite 安装且可用时，提供以下功能：
- 导出 sprite sheet
- 批量转换格式
- 调色板管理
- 帧动画处理

需要：
- Aseprite 1.3+ 安装
- 设置 ASEPRITE_PATH 环境变量（或确保 aseprite 在 PATH 中）
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

# Aseprite 可执行文件路径
ASEPRITE_PATH = os.environ.get("ASEPRITE_PATH", "aseprite")

def is_available() -> bool:
    """检查 Aseprite 是否可用。"""
    try:
        result = subprocess.run(
            [ASEPRITE_PATH, "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

def get_version() -> str | None:
    """获取 Aseprite 版本号。"""
    try:
        result = subprocess.run(
            [ASEPRITE_PATH, "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return None

def export_sprite_sheet(
    input_files: list[str | Path],
    output_path: str | Path,
    columns: int = 0,
    rows: int = 0,
    width: int = 0,
    height: int = 0,
    pack: bool = True,
    merge_duplicates: bool = True,
    border_padding: int = 0,
    shape_padding: int = 0,
    inner_padding: int = 0,
    trim: bool = False,
    crop: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    """导出 sprite sheet。

    Args:
        input_files: 输入文件列表
        output_path: 输出文件路径
        columns: 列数（0=自动）
        rows: 行数（0=自动）
        width: 最大宽度（0=不限）
        height: 最大高度（0=不限）
        pack: 使用 bin packing 算法
        merge_duplicates: 合并重复帧
        border_padding: 边框内边距
        shape_padding: 形状内边距
        inner_padding: 内部内边距
        trim: 裁剪透明边缘
        crop: 裁剪区域 (x, y, w, h)

    Returns:
        包含输出路径和尺寸的字典
    """
    if not input_files:
        raise ValueError("No input files provided")

    cmd = [ASEPRITE_PATH, "-b"]

    # 添加输入文件
    for f in input_files:
        cmd.extend(["--filename", str(f)])

    # 设置输出
    cmd.extend(["--sheet", str(output_path)])

    # 设置选项
    if columns > 0:
        cmd.extend(["--columns", str(columns)])
    if rows > 0:
        cmd.extend(["--rows", str(rows)])
    if width > 0:
        cmd.extend(["--width", str(width)])
    if height > 0:
        cmd.extend(["--height", str(height)])
    if pack:
        cmd.append("--sheet-pack")
    if merge_duplicates:
        cmd.append("--merge-duplicates")
    if border_padding > 0:
        cmd.extend(["--border-padding", str(border_padding)])
    if shape_padding > 0:
        cmd.extend(["--shape-padding", str(shape_padding)])
    if inner_padding > 0:
        cmd.extend(["--inner-padding", str(inner_padding)])
    if trim:
        cmd.append("--trim")
    if crop:
        cmd.extend(["--crop", f"{crop[0]},{crop[1]},{crop[2]},{crop[3]}"])

    # 执行命令
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        raise RuntimeError(f"Aseprite export failed: {result.stderr}")

    # 获取输出文件信息
    output = Path(output_path)
    if output.exists():
        # 使用 Aseprite 获取尺寸信息
        info_cmd = [ASEPRITE_PATH, "-b", str(output_path), "--list-slices"]
        info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=10)

        return {
            "output_path": str(output_path),
            "exists": True,
            "size_bytes": output.stat().st_size,
        }

    return {"output_path": str(output_path), "exists": False}

def batch_convert(
    input_dir: str | Path,
    output_dir: str | Path,
    input_format: str = "aseprite",
    output_format: str = "png",
    recursive: bool = False,
) -> dict[str, Any]:
    """批量转换格式。

    Args:
        input_dir: 输入目录
        output_dir: 输出目录
        input_format: 输入格式（aseprite, png, gif 等）
        output_format: 输出格式（png, gif, webp 等）
        recursive: 是否递归处理子目录

    Returns:
        包含转换结果的字典
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise ValueError(f"Input directory does not exist: {input_dir}")

    # 查找输入文件
    pattern = f"**/*.{input_format}" if recursive else f"*.{input_format}"
    input_files = list(input_path.glob(pattern))

    if not input_files:
        return {"converted": 0, "files": []}

    converted = []
    for input_file in input_files:
        relative = input_file.relative_to(input_path)
        output_file = output_path / relative.with_suffix(f".{output_format}")
        output_file.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            ASEPRITE_PATH, "-b",
            str(input_file),
            "--save-as", str(output_file),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0 and output_file.exists():
            converted.append({
                "input": str(input_file),
                "output": str(output_file),
                "size_bytes": output_file.stat().st_size,
            })

    return {
        "converted": len(converted),
        "files": converted,
    }

def create_animation(
    input_files: list[str | Path],
    output_path: str | Path,
    frame_duration: int = 100,
    loop: bool = True,
) -> dict[str, Any]:
    """创建动画文件。

    Args:
        input_files: 输入帧文件列表
        output_path: 输出文件路径
        frame_duration: 帧时长（毫秒）
        loop: 是否循环

    Returns:
        包含输出信息的字典
    """
    if not input_files:
        raise ValueError("No input files provided")

    # 创建临时 Aseprite 脚本
    script_content = f"""
local spr = app.open("{input_files[0]}")
if spr then
    -- 添加额外帧
    for i = 2, #{input_files} do
        local frame = spr:newEmptyFrame()
        local image = Image{{
            width = spr.width,
            height = spr.height,
            colorMode = spr.colorMode
        }}
        image:loadImage("{input_files[i-1]}")
        spr.cels[frame].image = image
        frame.duration = {frame_duration}
    end

    -- 设置循环
    if {"true" if loop else "false"} then
        spr.properties.loop = true
    end

    -- 保存
    spr:saveAs("{output_path}")
    spr:close()
end
"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.lua', delete=False) as f:
        f.write(script_content)
        script_path = f.name

    try:
        cmd = [ASEPRITE_PATH, "-b", "--script", script_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        if result.returncode != 0:
            raise RuntimeError(f"Aseprite animation creation failed: {result.stderr}")

        output = Path(output_path)
        return {
            "output_path": str(output_path),
            "exists": output.exists(),
            "size_bytes": output.stat().st_size if output.exists() else 0,
            "frame_count": len(input_files),
            "frame_duration": frame_duration,
            "loop": loop,
        }
    finally:
        os.unlink(script_path)

def extract_palette(
    input_file: str | Path,
    output_path: str | Path | None = None,
    max_colors: int = 256,
) -> dict[str, Any]:
    """提取调色板。

    Args:
        input_file: 输入文件
        output_path: 输出调色板文件路径（.pal 或 .gpl）
        max_colors: 最大颜色数

    Returns:
        包含调色板信息的字典
    """
    cmd = [
        ASEPRITE_PATH, "-b",
        str(input_file),
        "--palette", str(max_colors),
    ]

    if output_path:
        cmd.extend(["--save-as", str(output_path)])

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        raise RuntimeError(f"Aseprite palette extraction failed: {result.stderr}")

    output = Path(output_path) if output_path else None
    return {
        "input": str(input_file),
        "output": str(output_path) if output_path else None,
        "exists": output.exists() if output else False,
        "max_colors": max_colors,
    }

# 导出公共接口
__all__ = [
    "is_available",
    "get_version",
    "export_sprite_sheet",
    "batch_convert",
    "create_animation",
    "extract_palette",
]
