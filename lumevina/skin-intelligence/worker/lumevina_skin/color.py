"""Colour: CIE L*a*b*, colour differences, and the white-balance correction
used when a grey or white reference card is in the frame."""

from __future__ import annotations

import numpy as np
from skimage import color as skcolor


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB uint8 → CIE L*a*b* (D65), float32."""
    return skcolor.rgb2lab(rgb.astype(np.float32) / 255.0).astype(np.float32)


def delta_e(lab1, lab2) -> np.ndarray:
    """CIEDE2000 between two Lab colours or arrays of them."""
    return skcolor.deltaE_ciede2000(np.asarray(lab1, dtype=np.float64), np.asarray(lab2, dtype=np.float64))


def gray_card_gains(rgb: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """Per-channel gains that make the card at box (x, y, w, h) neutral."""
    x, y, w, h = box
    patch = rgb[y:y + h, x:x + w].reshape(-1, 3).astype(np.float64)
    mean = patch.mean(axis=0)
    return mean.mean() / np.maximum(mean, 1e-6)


def apply_gains(rgb: np.ndarray, gains: np.ndarray) -> np.ndarray:
    return np.clip(rgb.astype(np.float64) * gains, 0, 255).astype(np.uint8)


def cast_index(rgb: np.ndarray, mask: np.ndarray | None = None) -> float:
    """The same colour-cast rule as js/skin/core/quality.js: how far the average
    colour sits outside the range every skin tone falls in (0 inside it)."""
    px = rgb[mask] if mask is not None else rgb.reshape(-1, 3)
    if px.size == 0:
        return 0.0
    r, g, b = px.astype(np.float64).mean(axis=0)
    if g <= 0:
        return 0.0
    bg = b / g
    gm = g / max((r + b) / 2, 1e-6)
    return float(max(0.0, abs(bg - 0.82) / 0.82 - 0.18, abs(gm - 0.96) / 0.96 - 0.085))
