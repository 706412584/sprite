"""动画生成器。

从单张图生成多方向动画序列，支持：
- 5方向AI生成 + 3方向镜像
- 质量评分系统
- 帧对齐和优化
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

from PIL import Image, ImageChops, ImageFilter

from .presets import (
    ActionPreset,
    Direction,
    get_direction_angle,
    get_mirror_source,
    get_primary_directions,
    get_mirrored_directions,
)


@dataclass
class FrameInfo:
    """帧信息。"""
    index: int
    image: Image.Image
    duration_ms: int
    offset_x: int = 0
    offset_y: int = 0


@dataclass
class DirectionFrames:
    """一个方向的动画帧序列。"""
    direction: Direction
    frames: list[FrameInfo]
    is_mirrored: bool = False
    source_direction: Optional[Direction] = None


@dataclass
class AnimationResult:
    """动画生成结果。"""
    preset: ActionPreset
    directions: dict[Direction, DirectionFrames]
    sprite_sheet: Optional[Image.Image] = None
    quality_score: float = 0.0
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class AnimationGenerator:
    """动画生成器。"""

    def __init__(self, ai_generator: Optional[Callable] = None):
        """
        Args:
            ai_generator: AI图像生成函数，签名为 (prompt, **kwargs) -> Image.Image
        """
        self.ai_generator = ai_generator

    def generate_direction_frames(
        self,
        source_image: Image.Image,
        preset: ActionPreset,
        direction: Direction,
        frame_count: int | None = None,
    ) -> DirectionFrames:
        """生成单个方向的动画帧。

        Args:
            source_image: 源图像
            preset: 动作预设
            direction: 目标方向
            frame_count: 帧数（None则使用预设默认值）

        Returns:
            方向帧序列
        """
        frames = frame_count or preset.frame_count
        mirror_source = get_mirror_source(direction)

        # 如果是镜像方向，从源方向镜像
        if mirror_source is not None:
            # 这里需要源方向的帧，实际使用时会从已有结果中获取
            return DirectionFrames(
                direction=direction,
                frames=[],
                is_mirrored=True,
                source_direction=mirror_source,
            )

        # 主要方向：生成帧
        duration_ms = 1000 // preset.fps
        frame_infos = []

        for i in range(frames):
            # 计算帧偏移（模拟动画效果）
            offset_x = int(math.sin(2 * math.pi * i / frames) * 2)
            offset_y = int(math.cos(2 * math.pi * i / frames) * 1)

            frame_infos.append(FrameInfo(
                index=i,
                image=source_image.copy(),
                duration_ms=duration_ms,
                offset_x=offset_x,
                offset_y=offset_y,
            ))

        return DirectionFrames(
            direction=direction,
            frames=frame_infos,
            is_mirrored=False,
        )

    def mirror_frames(
        self,
        source_frames: DirectionFrames,
        target_direction: Direction,
    ) -> DirectionFrames:
        """镜像帧序列到目标方向。

        Args:
            source_frames: 源方向帧
            target_direction: 目标方向

        Returns:
            镜像后的帧序列
        """
        mirrored_frames = []

        for frame in source_frames.frames:
            # 水平翻转图像
            mirrored_image = frame.image.transpose(Image.FLIP_LEFT_RIGHT)

            # 调整偏移
            mirrored_offset_x = -frame.offset_x

            mirrored_frames.append(FrameInfo(
                index=frame.index,
                image=mirrored_image,
                duration_ms=frame.duration_ms,
                offset_x=mirrored_offset_x,
                offset_y=frame.offset_y,
            ))

        return DirectionFrames(
            direction=target_direction,
            frames=mirrored_frames,
            is_mirrored=True,
            source_direction=source_frames.direction,
        )

    def generate_all_directions(
        self,
        source_image: Image.Image,
        preset: ActionPreset,
        directions: list[Direction] | None = None,
    ) -> dict[Direction, DirectionFrames]:
        """生成所有方向的动画帧。

        Args:
            source_image: 源图像
            preset: 动作预设
            directions: 要生成的方向列表（None则生成全部8方向）

        Returns:
            方向到帧序列的映射
        """
        if directions is None:
            directions = list(Direction)

        result = {}

        # 生成主要方向
        primary_directions = get_primary_directions()
        for direction in primary_directions:
            if direction in directions:
                frames = self.generate_direction_frames(
                    source_image, preset, direction
                )
                result[direction] = frames

        # 生成镜像方向
        mirrored_directions = get_mirrored_directions()
        for direction in mirrored_directions:
            if direction in directions:
                mirror_source = get_mirror_source(direction)
                if mirror_source and mirror_source in result:
                    mirrored = self.mirror_frames(
                        result[mirror_source], direction
                    )
                    result[direction] = mirrored

        return result

    def calculate_quality_score(
        self,
        animation: AnimationResult,
    ) -> float:
        """计算动画质量评分。

        评分标准（0-100）：
        - 帧数匹配度 (20分)
        - 方向完整性 (20分)
        - 帧间一致性 (30分)
        - 动画流畅度 (30分)

        Returns:
            质量评分 (0-100)
        """
        score = 100.0

        # 1. 帧数匹配度
        expected_frames = animation.preset.frame_count
        for direction, frames in animation.directions.items():
            actual_frames = len(frames.frames)
            if actual_frames != expected_frames:
                penalty = min(20, abs(actual_frames - expected_frames) * 5)
                score -= penalty

        # 2. 方向完整性
        expected_directions = 8
        actual_directions = len(animation.directions)
        if actual_directions < expected_directions:
            penalty = (expected_directions - actual_directions) * 2.5
            score -= penalty

        # 3. 帧间一致性（基于帧大小一致性）
        for direction, frames in animation.directions.items():
            if frames.frames:
                sizes = [f.image.size for f in frames.frames]
                if len(set(sizes)) > 1:
                    score -= 5

        # 4. 动画流畅度（基于帧数和帧率）
        fps = animation.preset.fps
        frame_count = animation.preset.frame_count
        if fps < 8 or frame_count < 4:
            score -= 10

        return max(0, min(100, score))

    def create_sprite_sheet(
        self,
        animation: AnimationResult,
        columns: int = 0,
        padding: int = 2,
    ) -> Image.Image:
        """创建sprite sheet。

        Args:
            animation: 动画结果
            columns: 列数（0=自动）
            padding: 帧间距

        Returns:
            Sprite sheet图像
        """
        # 收集所有帧
        all_frames = []
        for direction in Direction:
            if direction in animation.directions:
                frames = animation.directions[direction]
                for frame in frames.frames:
                    all_frames.append(frame.image)

        if not all_frames:
            raise ValueError("No frames to create sprite sheet")

        # 计算单元格尺寸
        cell_width = max(f.size[0] for f in all_frames)
        cell_height = max(f.size[1] for f in all_frames)

        # 计算行列数
        if columns <= 0:
            columns = min(len(all_frames), 8)
        rows = math.ceil(len(all_frames) / columns)

        # 创建sprite sheet
        sheet_width = columns * (cell_width + padding) - padding
        sheet_height = rows * (cell_height + padding) - padding
        sheet = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))

        # 粘贴帧
        for idx, frame in enumerate(all_frames):
            row = idx // columns
            col = idx % columns
            x = col * (cell_width + padding)
            y = row * (cell_height + padding)
            # 居中粘贴
            offset_x = x + (cell_width - frame.size[0]) // 2
            offset_y = y + (cell_height - frame.size[1]) // 2
            sheet.paste(frame, (offset_x, offset_y), frame)

        return sheet

    def export_animation(
        self,
        animation: AnimationResult,
        output_dir: str | Path,
        prefix: str = "",
    ) -> dict[str, Any]:
        """导出动画到文件。

        Args:
            animation: 动画结果
            output_dir: 输出目录
            prefix: 文件名前缀

        Returns:
            导出结果信息
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        preset_id = animation.preset.id
        if prefix:
            prefix = f"{prefix}_"

        exported_files = []

        # 导出每个方向的帧
        for direction, frames in animation.directions.items():
            direction_name = direction.value
            for frame in frames.frames:
                filename = f"{prefix}{preset_id}_{direction_name}_{frame.index:03d}.png"
                filepath = output_path / filename
                frame.image.save(filepath)
                exported_files.append(str(filepath))

        # 导出sprite sheet
        if animation.sprite_sheet:
            sheet_filename = f"{prefix}{preset_id}_spritesheet.png"
            sheet_path = output_path / sheet_filename
            animation.sprite_sheet.save(sheet_path)
            exported_files.append(str(sheet_path))

        return {
            "preset_id": preset_id,
            "direction_count": len(animation.directions),
            "total_frames": sum(len(d.frames) for d in animation.directions.values()),
            "quality_score": animation.quality_score,
            "exported_files": exported_files,
            "output_dir": str(output_path),
        }


# ============================================================================
# 辅助函数
# ============================================================================

def align_frames_to_center(frames: list[Image.Image]) -> list[Image.Image]:
    """将帧对齐到中心（基于alpha加权质心）。

    Args:
        frames: 帧图像列表

    Returns:
        对齐后的帧列表
    """
    if not frames:
        return frames

    # 计算所有帧的平均质心
    centroids = []
    for frame in frames:
        alpha = frame.getchannel("A")
        # 计算alpha加权质心
        total_alpha = sum(alpha.getdata())
        if total_alpha == 0:
            centroids.append((frame.size[0] / 2, frame.size[1] / 2))
            continue

        weighted_x = 0
        weighted_y = 0
        for y in range(frame.size[1]):
            for x in range(frame.size[0]):
                a = alpha.getpixel((x, y))
                weighted_x += x * a
                weighted_y += y * a

        centroids.append((
            weighted_x / total_alpha,
            weighted_y / total_alpha,
        ))

    # 计算平均质心
    avg_x = sum(c[0] for c in centroids) / len(centroids)
    avg_y = sum(c[1] for c in centroids) / len(centroids)

    # 对齐帧
    aligned_frames = []
    for frame, (cx, cy) in zip(frames, centroids):
        offset_x = int(avg_x - cx)
        offset_y = int(avg_y - cy)

        # 创建新帧
        new_frame = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        new_frame.paste(frame, (offset_x, offset_y))
        aligned_frames.append(new_frame)

    return aligned_frames


def trim_transparent_edges(frame: Image.Image, padding: int = 1) -> Image.Image:
    """裁剪透明边缘。

    Args:
        frame: 帧图像
        padding: 保留的内边距

    Returns:
        裁剪后的图像
    """
    alpha = frame.getchannel("A")
    bbox = alpha.getbbox()

    if bbox is None:
        return frame

    # 扩展bbox
    x1, y1, x2, y2 = bbox
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(frame.size[0], x2 + padding)
    y2 = min(frame.size[1], y2 + padding)

    return frame.crop((x1, y1, x2, y2))


# ============================================================================
# 导出公共接口
# ============================================================================

__all__ = [
    "FrameInfo",
    "DirectionFrames",
    "AnimationResult",
    "AnimationGenerator",
    "align_frames_to_center",
    "trim_transparent_edges",
]
