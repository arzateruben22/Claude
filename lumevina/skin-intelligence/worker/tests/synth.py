"""Synthetic, non-clinical skin-like images with known properties, for the
tests and the demo. Never photographs of people."""

from __future__ import annotations

import cv2
import numpy as np


def skin(h=900, w=1200, *, tone=(205, 160, 135), pores=250, pore_r=(2.5, 5.0), redness=0.0, spots=0, lines=0,
         grain=6.0, seed=1, blur=0.0, shading=0.06, spot_strength=1.0, line_strength=1.0) -> np.ndarray:
    """Each feature has its own random stream, so the same seed with fewer pores
    keeps the same skin, the same spots and the same lines: one person's skin
    changing between visits, not a different person."""
    rng = np.random.default_rng(seed)
    rng_pores, rng_spots, rng_lines = (np.random.default_rng(seed * 1000 + k) for k in (1, 2, 3))
    base = np.empty((h, w, 3), np.float32)
    base[:] = tone
    # low-frequency unevenness and lighting falloff
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    shade = 1 - shading * (((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2) * 4
    base *= shade[..., None]
    lowf = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 40) * 60
    base += lowf[..., None] * np.array([1.0, 0.9, 0.85], np.float32)
    # fine grain
    base += cv2.GaussianBlur(rng.normal(0, grain, (h, w)).astype(np.float32), (0, 0), 0.8)[..., None]
    # redness: a soft red patch towards the centre
    if redness:
        patch = np.exp(-(((xx - w * 0.55) / (w * 0.25)) ** 2 + ((yy - h * 0.5) / (h * 0.3)) ** 2))
        base[..., 0] += redness * 30 * patch
        base[..., 1] -= redness * 12 * patch
        base[..., 2] -= redness * 6 * patch
    # pore-like dark dots, each drawn in its own small window
    dots = np.zeros((h, w), np.float32)
    for _ in range(pores):
        cx, cy = rng_pores.uniform(20, w - 20), rng_pores.uniform(20, h - 20)
        r = rng_pores.uniform(*pore_r)
        k = int(r * 3) + 4
        x0, y0 = int(cx) - k, int(cy) - k
        patch = np.zeros((2 * k + 1, 2 * k + 1), np.float32)
        cv2.circle(patch, (k, k), max(1, int(round(r))), 1.0, -1, lineType=cv2.LINE_AA)
        patch = cv2.GaussianBlur(patch, (0, 0), r / 3 + 0.3)
        ys, xs = slice(max(0, y0), min(h, y0 + 2 * k + 1)), slice(max(0, x0), min(w, x0 + 2 * k + 1))
        dots[ys, xs] = np.maximum(dots[ys, xs], patch[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0])
    base -= (dots * 22)[..., None] * np.array([1.0, 1.05, 1.0], np.float32)
    # brown spots
    blots = np.zeros((h, w), np.float32)
    for _ in range(spots):
        cx, cy = rng_spots.uniform(80, w - 80), rng_spots.uniform(80, h - 80)
        r = rng_spots.uniform(14, 30)
        cv2.ellipse(blots, (int(cx), int(cy)), (int(r), int(r * rng_spots.uniform(0.6, 1.0))), rng_spots.uniform(0, 180), 0, 360, 1.0, -1)
    if spots:
        blots = cv2.GaussianBlur(blots, (0, 0), 4)
        base -= blots[..., None] * np.array([28, 38, 48], np.float32) * spot_strength
    # fine lines
    creases = np.zeros((h, w), np.float32)
    for _ in range(lines):
        x0, y0 = rng_lines.uniform(50, w - 300), rng_lines.uniform(50, h - 50)
        ang = rng_lines.uniform(-0.4, 0.4)
        pts = np.array([[x0 + t * 250 * np.cos(ang), y0 + t * 250 * np.sin(ang) + 6 * np.sin(t * 6)] for t in np.linspace(0, 1, 40)], np.int32)
        cv2.polylines(creases, [pts], False, 1.0, 2, lineType=cv2.LINE_AA)
    if lines:
        base -= (cv2.GaussianBlur(creases, (0, 0), 0.8) * 30 * line_strength)[..., None]
    img = np.clip(base, 0, 255).astype(np.uint8)
    if blur:
        img = cv2.GaussianBlur(img, (0, 0), blur)
    return img


def warp(img: np.ndarray, *, angle=3.0, scale=1.03, dx=18, dy=-12) -> tuple[np.ndarray, np.ndarray]:
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
    M[:, 2] += (dx, dy)
    H = np.vstack([M, [0, 0, 1]])
    return cv2.warpPerspective(img, H, (w, h), borderMode=cv2.BORDER_REFLECT), H


def watermark(img: np.ndarray, text="SYNTHETIC DEMO IMAGE") -> np.ndarray:
    out = img.copy()
    h, w = out.shape[:2]
    scale = max(0.5, w / 1400)
    cv2.putText(out, text, (int(14 * scale), h - int(16 * scale)), cv2.FONT_HERSHEY_SIMPLEX, 0.7 * scale, (255, 255, 255), max(1, int(2 * scale)), cv2.LINE_AA)
    cv2.putText(out, text, (int(14 * scale), h - int(16 * scale)), cv2.FONT_HERSHEY_SIMPLEX, 0.7 * scale, (60, 40, 30), max(1, int(scale)), cv2.LINE_AA)
    return out
