"""Primitive value coercion and clamping helpers."""
from __future__ import annotations


def safe_int(value, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def safe_float(value, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def clamp_float(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def clamp_int(value: int, minimum: int, maximum: int) -> int:
    return min(maximum, max(minimum, value))
