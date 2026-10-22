"""Authoritative image quality checks, on the original.

passed      usable at all (not blurred, not badly under- or over-exposed)
comparable  usable for measurements and comparisons (also: no strong colour
            cast, no motion blur, the face at the right angle for the region,
            a microscope or dermatoscope image calibrated)

The thresholds mirror js/skin/core/quality.js (the on-device pre-check)
and are fair across skin tones: exposure is judged by clipping, colour by
excess beyond the natural range of skin (tests/test_quality_register.py
runs the ten Monk Skin Tone colours).

Blur. How sharp a photo of skin looks depends mostly on how much texture
the skin has: smooth, perfectly sharp skin can score lower than textured
skin slightly out of focus, so no absolute threshold separates them (the
tests show it). The authoritative check is therefore relative: a capture
is blurred when it is less than half as sharp as the same client's earlier
passed captures of the same region (reference_sharpness), with only a low
absolute floor that catches gross blur on a first capture. The practitioner
reviews every first capture.
"""

from __future__ import annotations

import cv2
import numpy as np

from .color import cast_index
from .imageio import resize_max
from .landmarks import pose as pose_of

QUALITY_VERSION = "q-0.1.0"

# yaw ranges (degrees, positive = the client's right cheek towards the camera), as in js/skin/core/regions.js
YAW = {
    "front": (-8, 8), "forehead": (-12, 12), "nose": (-12, 12), "chin": (-12, 12),
    "left_cheek": (-35, 5), "right_cheek": (-5, 35), "left_profile": (-90, -45), "right_profile": (45, 90),
}
LIMITS = {
    "sharpness_floor": {"camera": 2.0, "upload": 2.0, "microscope": 1.0, "dermatoscope": 1.0, "pro_export": 2.0},
    "sharpness_relative": 0.5,
    "clip_dark": 0.08, "clip_bright": 0.06, "mean_low": 0.05, "mean_high": 0.97, "cast": 0.05, "motion": 0.55,
}


def _luma(rgb: np.ndarray) -> np.ndarray:
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]).astype(np.float32)


def sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_32F, ksize=1).var())


def motion_anisotropy(gray: np.ndarray) -> float:
    """0 when edges run every way; towards 1 when they all run one way (motion blur smears one direction)."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    jxx, jyy, jxy = float((gx * gx).mean()), float((gy * gy).mean()), float((gx * gy).mean())
    tr = jxx + jyy
    if tr <= 1e-9:
        return 0.0
    disc = np.sqrt(max(0.0, (jxx - jyy) ** 2 + 4 * jxy * jxy))
    return float(disc / tr)


def assess(rgb: np.ndarray, *, source: str, region: str, calibrated: bool, points=None, reference_sharpness: float | None = None) -> dict:
    work = resize_max(rgb, 1024)
    gray = _luma(work)
    s = sharpness(gray)
    motion = motion_anisotropy(gray)
    dark = float((gray < 10).mean())
    bright = float((gray > 250).mean())
    mean_l = float(gray.mean() / 255)
    cast = cast_index(work)
    flags: list[str] = []
    floor = LIMITS["sharpness_floor"].get(source, 2.0)
    lim = max(floor, LIMITS["sharpness_relative"] * reference_sharpness) if reference_sharpness else floor
    if s < lim:
        flags.append("blur")
    if motion > LIMITS["motion"] and s < max(lim * 2.5, floor * 4):
        flags.append("motion")
    if dark > LIMITS["clip_dark"] or mean_l < LIMITS["mean_low"]:
        flags.append("underexposed")
    if bright > LIMITS["clip_bright"] or mean_l > LIMITS["mean_high"]:
        flags.append("overexposed")
    if cast > LIMITS["cast"]:
        flags.append("color_cast")
    p = pose_of(points) if points is not None else None
    if p and region in YAW:
        lo, hi = YAW[region]
        if not (lo <= p["yaw"] <= hi) or abs(p["roll"]) > 10 or abs(p["pitch"]) > 20:
            flags.append("angle")
    if source in ("microscope", "dermatoscope") and not calibrated:
        flags.append("no_calibration")
    passed = not any(f in flags for f in ("blur", "underexposed", "overexposed"))
    comparable = passed and not any(f in flags for f in ("color_cast", "motion", "angle", "no_calibration"))
    return {
        "version": QUALITY_VERSION, "passed": passed, "comparable": comparable, "flags": flags,
        "metrics": {
            "sharpness": round(s, 2), "motion": round(motion, 3), "clip_dark": round(dark, 4), "clip_bright": round(bright, 4),
            "mean_l": round(mean_l, 4), "cast": round(cast, 4), "face": points is not None,
            "sharpness_reference": round(reference_sharpness, 2) if reference_sharpness else None,
            **({"yaw": p["yaw"], "pitch": p["pitch"], "roll": p["roll"]} if p else {}),
        },
    }
