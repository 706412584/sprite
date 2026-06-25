"""动画生成系统。

提供100+动作预设、8方向系统、质量评分和sprite sheet生成。
"""
from .presets import (
    Direction,
    ActionCategory,
    ActionPreset,
    PRESETS,
    get_preset,
    get_presets_by_category,
    get_presets_by_tag,
    search_presets,
    get_all_presets,
    get_preset_count,
    get_direction_angle,
    get_primary_directions,
    get_mirrored_directions,
    get_mirror_source,
)
from .generator import (
    FrameInfo,
    DirectionFrames,
    AnimationResult,
    AnimationGenerator,
    align_frames_to_center,
    trim_transparent_edges,
)

__all__ = [
    # presets
    "Direction",
    "ActionCategory",
    "ActionPreset",
    "PRESETS",
    "get_preset",
    "get_presets_by_category",
    "get_presets_by_tag",
    "search_presets",
    "get_all_presets",
    "get_preset_count",
    "get_direction_angle",
    "get_primary_directions",
    "get_mirrored_directions",
    "get_mirror_source",
    # generator
    "FrameInfo",
    "DirectionFrames",
    "AnimationResult",
    "AnimationGenerator",
    "align_frames_to_center",
    "trim_transparent_edges",
]
