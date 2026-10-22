"""Lining up two visits' images of the same region, and the difference map.

Registration: enhanced-correlation (ECC) homography on downscaled grey
images, falling back to ORB features with RANSAC when ECC can't converge.
The difference map separates what is likely a real difference from what is
likely the capture: overall brightness is matched first (a lighter photo is
not lighter skin), and every pixel where the two images don't locally agree
in structure (misalignment, motion, glare, hair, a shadow) is marked "low
confidence" and drawn hatched grey rather than as a difference.
"""

from __future__ import annotations

import cv2
import numpy as np

from .color import delta_e, to_lab

REGISTER_VERSION = "reg-0.1.0"


def _gray(rgb, max_side):
    h, w = rgb.shape[:2]
    s = min(1.0, max_side / max(h, w))
    small = cv2.resize(rgb, (max(8, round(w * s)), max(8, round(h * s))), interpolation=cv2.INTER_AREA) if s < 1 else rgb
    g = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    return g, s


def register(ref: np.ndarray, mov: np.ndarray, max_side: int = 1024) -> dict:
    """Homography mapping mov's full-resolution pixels onto ref's, with the method and a score (0–1)."""
    gr, sr = _gray(ref, max_side)
    gm, sm = _gray(mov, max_side)
    if gm.shape != gr.shape:
        gm_fit = cv2.resize(gm, (gr.shape[1], gr.shape[0]), interpolation=cv2.INTER_AREA)
        pre = np.diag([gr.shape[1] / gm.shape[1], gr.shape[0] / gm.shape[0], 1.0]).astype(np.float32)
    else:
        gm_fit, pre = gm, np.eye(3, dtype=np.float32)
    H, cc, method = None, 0.0, None
    try:
        warp = np.eye(3, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        cc, warp = cv2.findTransformECC(gr, gm_fit, warp, cv2.MOTION_HOMOGRAPHY, criteria, None, 5)
        # ECC's warp maps ref → mov; we want mov → ref
        H, method = np.linalg.inv(warp) @ pre, "ecc"
    except cv2.error:
        H = None
    if H is None or cc < 0.5:
        orb = cv2.ORB_create(4000)
        k1, d1 = orb.detectAndCompute((gr * 255).astype(np.uint8), None)
        k2, d2 = orb.detectAndCompute((gm * 255).astype(np.uint8), None)
        if d1 is not None and d2 is not None and len(k1) > 10 and len(k2) > 10:
            matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(d2, d1, k=2)
            good = [m for m, *rest in matches if rest and m.distance < 0.75 * rest[0].distance]
            if len(good) >= 12:
                src = np.float32([k2[m.queryIdx].pt for m in good])
                dst = np.float32([k1[m.trainIdx].pt for m in good])
                Hf, inliers = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
                if Hf is not None:
                    H, method = Hf.astype(np.float32), "orb"
                    warped = cv2.warpPerspective(gm, H, (gr.shape[1], gr.shape[0]))
                    valid = warped > 0
                    cc = float(np.corrcoef(gr[valid].ravel(), warped[valid].ravel())[0, 1]) if valid.sum() > 100 else 0.0
    if H is None:
        return {"ok": False, "method": None, "score": 0.0, "H": None, "version": REGISTER_VERSION}
    # back to full resolution: ref_full ← (1/sr) · H · sm · mov_full   (pre already folded in for the ECC path)
    S_ref_inv = np.diag([1 / sr, 1 / sr, 1.0]).astype(np.float64)
    S_mov = np.diag([sm, sm, 1.0]).astype(np.float64)
    H_full = S_ref_inv @ H.astype(np.float64) @ S_mov
    return {"ok": True, "method": method, "score": round(float(cc), 4), "H": H_full.tolist(), "version": REGISTER_VERSION}


def _local_ncc(a: np.ndarray, b: np.ndarray, k: int = 15) -> np.ndarray:
    mu_a, mu_b = cv2.blur(a, (k, k)), cv2.blur(b, (k, k))
    va = cv2.blur(a * a, (k, k)) - mu_a ** 2
    vb = cv2.blur(b * b, (k, k)) - mu_b ** 2
    cov = cv2.blur(a * b, (k, k)) - mu_a * mu_b
    return cov / np.sqrt(np.maximum(va * vb, 1e-8))


def difference(ref: np.ndarray, mov: np.ndarray, H, *, max_side: int = 1600) -> dict:
    """The aligned image, the difference overlay (PNG-ready RGB) and a summary."""
    h, w = ref.shape[:2]
    s = min(1.0, max_side / max(h, w))
    S = np.diag([s, s, 1.0])
    size = (max(8, round(w * s)), max(8, round(h * s)))
    ref_s = cv2.resize(ref, size, interpolation=cv2.INTER_AREA) if s < 1 else ref.copy()
    Hs = S @ np.asarray(H, dtype=np.float64)
    aligned = cv2.warpPerspective(mov, Hs, size, flags=cv2.INTER_LINEAR)
    valid = cv2.warpPerspective(np.ones(mov.shape[:2], np.uint8), Hs, size, flags=cv2.INTER_NEAREST).astype(bool)
    valid = cv2.erode(valid.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    lab_r, lab_m = to_lab(ref_s), to_lab(aligned)
    # match overall lightness (a brighter photo is not lighter skin)
    if valid.sum() > 100:
        dl = float(lab_r[..., 0][valid].mean() - lab_m[..., 0][valid].mean())
        lab_m[..., 0] = np.clip(lab_m[..., 0] + dl, 0, 100)
    else:
        dl = 0.0
    de = delta_e(lab_r, lab_m).astype(np.float32)
    de = cv2.GaussianBlur(de, (0, 0), 1.5)
    gr = lab_r[..., 0].astype(np.float32) / 100.0
    gm = lab_m[..., 0].astype(np.float32) / 100.0
    ncc = _local_ncc(cv2.GaussianBlur(gr, (0, 0), 1.0), cv2.GaussianBlur(gm, (0, 0), 1.0))
    texture = cv2.blur(gr * gr, (15, 15)) - cv2.blur(gr, (15, 15)) ** 2
    # where both images have structure but it doesn't line up: likely the capture, not the skin
    confident = valid & ~((ncc < 0.3) & (texture > 1e-4))
    overlay = _render(ref_s, de, valid, confident)
    conf_px = confident.sum()
    return {
        "aligned": aligned, "overlay": overlay, "delta_e": de, "confident": confident, "scale": s,
        "summary": {
            "mean_delta_e": round(float(de[confident].mean()), 3) if conf_px else None,
            "p95_delta_e": round(float(np.percentile(de[confident], 95)), 3) if conf_px else None,
            "confident_fraction": round(float(conf_px / max(1, valid.sum())), 4),
            "overlap_fraction": round(float(valid.mean()), 4),
            "lightness_shift": round(dl, 3),
            "version": REGISTER_VERSION,
        },
    }


def _render(base: np.ndarray, de: np.ndarray, valid: np.ndarray, confident: np.ndarray) -> np.ndarray:
    """Grey base, differences in a warm ramp (ΔE 2 → 12), low-confidence areas hatched grey, no-overlap black."""
    grey = cv2.cvtColor(cv2.cvtColor(base, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB).astype(np.float32) * 0.75
    t = np.clip((de - 2.0) / 10.0, 0, 1)[..., None]
    warm = np.array([235, 120, 60], np.float32)
    hot = np.array([180, 20, 80], np.float32)
    colour = warm * (1 - t) + hot * t
    alpha = np.clip(t * 1.4, 0, 0.85)
    out = grey * (1 - alpha) + colour * alpha
    yy, xx = np.mgrid[0:de.shape[0], 0:de.shape[1]]
    hatch = ((xx + yy) // 4) % 2 == 0
    low = valid & ~confident
    out[low & hatch] = [150, 150, 150]
    out[low & ~hatch] = out[low & ~hatch] * 0.6 + 60
    out[~valid] = 0
    return np.clip(out, 0, 255).astype(np.uint8)
