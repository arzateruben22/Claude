"""The measurements, on one region of one image.

Every measurement is deterministic and explainable (see the method lines in
js/skin/core/measurements.js), carries a unit, an uncertainty estimate from
the image itself, the image quality and the calibration status, and starts
experimental. When the image can't support a measurement (too few pixels,
too coarse to resolve pores) the value is None: "Insufficient data", never
a guess.

Scale. Filters are sized in micrometres:
  calibrated     the device's or the image's micrometres per pixel
  face landmarks resampled so the outer eye corners are 1000 px apart; the
                 filter sizes assume an average 63 mm, which is an estimate,
                 so results stay "uncalibrated" (per normalized pixel)
  neither        a close-up resampled to 1200 px wide; filters assume
                 50 µm per pixel, results "uncalibrated" (per working pixel)
Units for uncalibrated images refer to those working pixels, which keeps one
client's visits comparable when they are photographed the same way.
"""

from __future__ import annotations

import math

import cv2
import numpy as np
from scipy import ndimage as ndi
from skimage import feature, filters, morphology

from .catalog import MEASUREMENTS, unit_for
from .color import delta_e, to_lab
from .landmarks import inter_ocular_px

IOD_WORK_PX = 1000.0
FRAME_WORK_PX = 1200.0
IOD_MM = 63.0
FRAME_UM_ASSUMED = 50.0
MAX_CALIBRATED_WORK_UM = 10.0     # never work finer than 10 µm/px (microscopes can be finer)
PORE_MIN_DL = 2.5                 # a pore-like feature is at least 2.5 L* darker than the skin around it


def working_scale(width: int, *, um_per_px: float | None, points) -> dict:
    if um_per_px:
        target = max(float(um_per_px), MAX_CALIBRATED_WORK_UM)
        return {"basis": "calibrated", "s": float(um_per_px) / target, "um": target, "calibrated": True}
    iod = inter_ocular_px(points) if points is not None else None
    if iod:
        return {"basis": "iod", "s": IOD_WORK_PX / iod, "um": IOD_MM * 1000 / IOD_WORK_PX, "calibrated": False, "iod_px": round(iod, 1)}
    return {"basis": "frame", "s": FRAME_WORK_PX / width, "um": FRAME_UM_ASSUMED, "calibrated": False}


def _crop(rgb: np.ndarray, mask: np.ndarray, s: float, margin: float = 0.06):
    ys, xs = np.nonzero(mask)
    h, w = mask.shape
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    my, mx = int((y1 - y0) * margin) + 2, int((x1 - x0) * margin) + 2
    y0, y1, x0, x1 = max(0, y0 - my), min(h, y1 + my), max(0, x0 - mx), min(w, x1 + mx)
    c_rgb, c_mask = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    if abs(s - 1) > 1e-3:
        nw, nh = max(8, round((x1 - x0) * s)), max(8, round((y1 - y0) * s))
        c_rgb = cv2.resize(c_rgb, (nw, nh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
        c_mask = cv2.resize(c_mask.astype(np.uint8), (nw, nh), interpolation=cv2.INTER_NEAREST).astype(bool)
    return c_rgb, c_mask, (int(x0), int(y0), int(x1 - x0), int(y1 - y0))


def _tiles(mask: np.ndarray, n: int = 4, min_cover: float = 0.4):
    h, w = mask.shape
    for i in range(n):
        for j in range(n):
            ys, ye, xs, xe = i * h // n, (i + 1) * h // n, j * w // n, (j + 1) * w // n
            t = np.zeros_like(mask)
            t[ys:ye, xs:xe] = True
            t &= mask
            if t.sum() >= min_cover * (ye - ys) * (xe - xs) and t.sum() > 30:
                yield t


def _tile_uncertainty(value: float | None, per_tile: list[float]) -> dict | None:
    vals = [v for v in per_tile if v is not None and math.isfinite(v)]
    if value is None or len(vals) < 3:
        return None
    se = float(np.std(vals, ddof=1) / math.sqrt(len(vals)))
    return {"sd": round(se, 5), "ci95": [round(value - 1.96 * se, 5), round(value + 1.96 * se, 5)], "method": f"between-tile SE, {len(vals)} tiles"}


def _px(um: float, um_per_px: float) -> float:
    return um / um_per_px


def _row(name, value, region, scale, quality, uncertainty, roi, extra=None):
    m = MEASUREMENTS[name]
    if value is not None:
        value = float(value)
        value = round(value, 6) if math.isfinite(value) else None
    if value is not None and uncertainty and uncertainty.get("ci95"):
        lo, hi = uncertainty["ci95"]   # rounding can push a bound past the value; keep the value inside its interval
        uncertainty = {**uncertainty, "ci95": [min(lo, value), max(hi, value)]}
    return {
        "name": name, "value": value, "unit": unit_for(name, scale["calibrated"]),
        "region": region, "roi": roi, "quality": quality,
        "calibration_status": "device_calibrated" if scale["calibrated"] else "uncalibrated",
        "uncertainty": uncertainty, "experimental": True, **(extra or {}),
    }


def measure_region(rgb: np.ndarray, mask: np.ndarray, region: str, *, quality: str, um_per_px: float | None = None,
                   points=None, roi_polygon=None) -> list[dict]:
    """All area measurements for one region. quality: 'good' | 'marginal' | 'poor' from the quality check."""
    scale = working_scale(rgb.shape[1], um_per_px=um_per_px, points=points)
    c_rgb, c_mask, box = _crop(rgb, mask, scale["s"])
    um = scale["um"]
    area_px = float(c_mask.sum())
    roi = {"box": box, "polygon": None if roi_polygon is None else np.round(roi_polygon).astype(int).tolist(), "scale": scale}
    q = quality if area_px >= 3000 else ("poor" if area_px < 800 else "marginal")
    lab = to_lab(c_rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    inner = ndi.binary_erosion(c_mask, iterations=2) if area_px > 2000 else c_mask
    rows: list[dict] = []
    area_units = (area_px * um * um / 1e8) if scale["calibrated"] else area_px / 1e4   # cm² or 10k px

    # ── pores: dark, round, pore-sized features ──
    if um <= 80 and inner.sum() > 1500:
        s_min, s_max = max(0.8, _px(30, um) / math.sqrt(2)), max(1.6, _px(200, um) / math.sqrt(2))
        # fixed L* units (0–1 = 0–100 L*), so the threshold means the same in every image
        blobs = feature.blob_dog((100.0 - L) / 100.0, min_sigma=s_min, max_sigma=s_max, threshold=0.012, overlap=0.5)
        kept = []
        yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
        for y, x, sg in blobs:
            yi, xi = int(round(y)), int(round(x))
            if not inner[yi, xi]:
                continue
            r = sg * math.sqrt(2)
            win = (slice(max(0, yi - int(2 * r) - 2), yi + int(2 * r) + 3), slice(max(0, xi - int(2 * r) - 2), xi + int(2 * r) + 3))
            d2 = (yy[win] - y) ** 2 + (xx[win] - x) ** 2
            core, ring = d2 <= r * r, (d2 > r * r) & (d2 <= 4 * r * r)
            if core.sum() < 2 or ring.sum() < 4:
                continue
            dl = float(L[win][ring].mean() - L[win][core].mean())
            if dl > PORE_MIN_DL:
                kept.append((r, dl))
        n = len(kept)
        density = n / area_units if area_units else None
        dens_unc = {"sd": round(math.sqrt(max(n, 1)) / area_units, 5), "ci95": [round(max(0.0, (n - 1.96 * math.sqrt(n)) / area_units), 5), round((n + 1.96 * math.sqrt(n)) / area_units, 5)], "method": "Poisson count"} if area_units else None
        rows.append(_row("pore_density", density, region, scale, q, dens_unc, roi, {"count": n}))
        if n >= 5:
            diam = np.array([2 * r * (um if scale["calibrated"] else 1.0) for r, _ in kept])
            med = float(np.median(diam))
            rng = np.random.default_rng(7)
            boots = [float(np.median(rng.choice(diam, size=len(diam)))) for _ in range(200)]
            lo, hi = min(med, float(np.percentile(boots, 2.5))), max(med, float(np.percentile(boots, 97.5)))
            rows.append(_row("pore_size_median", med, region, scale, q, {"sd": round(float(np.std(boots)), 5), "ci95": [round(lo, 5), round(hi, 5)], "method": "bootstrap of diameters"}, roi))
            dls = np.array([dl for _, dl in kept])
            vis = float(dls.mean())
            se = float(dls.std(ddof=1) / math.sqrt(len(dls)))
            rows.append(_row("pore_visibility", vis, region, scale, q, {"sd": round(se, 5), "ci95": [round(vis - 1.96 * se, 5), round(vis + 1.96 * se, 5)], "method": "SE of the mean"}, roi))
        else:
            rows.append(_row("pore_size_median", None, region, scale, q, None, roi))
            rows.append(_row("pore_visibility", None, region, scale, q, None, roi))
    else:
        for n_ in ("pore_density", "pore_size_median", "pore_visibility"):
            rows.append(_row(n_, None, region, scale, "poor" if um > 80 else q, None, roi, {"why": "resolution too coarse for pores" if um > 80 else "region too small"}))

    # ── texture ──
    hp = L - cv2.GaussianBlur(L, (0, 0), max(1.0, _px(500, um)))
    rough = float(hp[inner].std()) if inner.sum() > 200 else None
    rows.append(_row("texture_roughness", rough, region, scale, q, _tile_uncertainty(rough, [float(hp[t].std()) for t in _tiles(inner)]), roi))
    uni = _glcm_homogeneity(hp, inner)
    rows.append(_row("texture_uniformity", uni, region, scale, q, _tile_uncertainty(uni, [_glcm_homogeneity(hp, t) for t in _tiles(inner)]), roi))

    # ── tone and pigmentation ──
    Ls = cv2.GaussianBlur(L, (0, 0), max(1.0, _px(1000, um)))
    iqr = lambda m: float(np.subtract(*np.percentile(Ls[m], [75, 25]))) if m.sum() > 50 else None
    tone = iqr(inner)
    rows.append(_row("tone_evenness", tone, region, scale, q, _tile_uncertainty(tone, [iqr(t) for t in _tiles(inner)]), roi))
    bg_sigma = max(2.0, _px(3000, um))
    L_bg, b_bg = cv2.GaussianBlur(L, (0, 0), bg_sigma), cv2.GaussianBlur(b, (0, 0), bg_sigma)
    spots = (L < L_bg - 4.0) & (b > b_bg + 0.5) & inner
    min_area = max(6, int(2e5 / (um * um)))
    spots = morphology.remove_small_objects(spots, max_size=min_area) if spots.any() else spots
    spot_pct = float(spots.sum() / max(1.0, inner.sum()) * 100)
    rows.append(_row("pigment_spot_area", spot_pct, region, scale, q, _tile_uncertainty(spot_pct, [float(spots[t].sum() / t.sum() * 100) for t in _tiles(inner)]), roi))
    if spots.sum() >= min_area:
        ring = ndi.binary_dilation(spots, iterations=max(2, int(_px(500, um)))) & ~spots & inner
        contrast = float(delta_e(lab[spots].mean(axis=0), lab[ring].mean(axis=0))) if ring.sum() > 20 else None
    else:
        contrast = None
    rows.append(_row("pigment_contrast", contrast, region, scale, q, None, roi, None if contrast is not None else {"why": "no dark spots found"}))

    # ── redness ──
    red = float(a[inner].mean()) if inner.sum() > 50 else None
    rows.append(_row("redness_a_star", red, region, scale, q, _tile_uncertainty(red, [float(a[t].mean()) for t in _tiles(inner)]), roi))
    if inner.sum() > 50:
        med_a = float(np.median(a[inner]))
        red_mask = (a > med_a + 3.0) & inner
        red_pct = float(red_mask.sum() / inner.sum() * 100)
        rows.append(_row("redness_area", red_pct, region, scale, q, _tile_uncertainty(red_pct, [float(((a > med_a + 3.0) & t).sum() / t.sum() * 100) for t in _tiles(inner)]), roi))
    else:
        rows.append(_row("redness_area", None, region, scale, q, None, roi))

    # ── fine lines ──
    if um <= 120 and inner.sum() > 1500:
        sig = [max(0.8, _px(s_um, um)) for s_um in (60, 110, 200)]
        ridge = filters.frangi(L / 100.0, sigmas=sig, black_ridges=True)
        rv = ridge[inner]
        thr = max(float(rv.mean() + 2.5 * rv.std()), 1e-6)
        lines = morphology.remove_small_objects((ridge > thr) & inner, max_size=max(10, int(_px(1500, um))))
        skel = morphology.skeletonize(lines)
        length_units = (skel.sum() * um / 1000.0) if scale["calibrated"] else float(skel.sum())   # mm or px
        dens = length_units / area_units if area_units else None
        per = []
        for t in _tiles(inner):
            au = (t.sum() * um * um / 1e8) if scale["calibrated"] else t.sum() / 1e4
            per.append(((skel & t).sum() * (um / 1000.0 if scale["calibrated"] else 1.0)) / au if au else None)
        rows.append(_row("fine_line_density", dens, region, scale, q, _tile_uncertainty(dens, per), roi))
    else:
        rows.append(_row("fine_line_density", None, region, scale, "poor" if um > 120 else q, None, roi, {"why": "resolution too coarse for fine lines" if um > 120 else "region too small"}))
    return rows


def _glcm_homogeneity(hp: np.ndarray, mask: np.ndarray, levels: int = 32) -> float | None:
    if mask.sum() < 200:
        return None
    vals = hp[mask]
    lo, hi = np.percentile(vals, [1, 99])
    if hi - lo < 1e-6:
        return 1.0
    q = np.clip((hp - lo) / (hi - lo) * (levels - 1), 0, levels - 1).astype(np.uint8) + 1
    q[~mask] = 0
    ys, xs = np.nonzero(mask)
    sub = q[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    g = feature.graycomatrix(sub, distances=[1, 2], angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4], levels=levels + 1, symmetric=True, normed=False)
    g = g[1:, 1:, :, :].astype(np.float64)   # drop pairs touching the outside
    sums = g.sum(axis=(0, 1), keepdims=True)
    g = np.divide(g, sums, out=np.zeros_like(g), where=sums > 0)
    return float(feature.graycoprops(g, "homogeneity").mean())


def measure_scar(rgb: np.ndarray, polygon: np.ndarray, region: str, *, quality: str, um_per_px: float | None = None, points=None) -> list[dict]:
    """Scar colour contrast, texture ratio and area inside a practitioner's outline. Never depth, volume or translucency."""
    from .landmarks import polygon_mask

    scale = working_scale(rgb.shape[1], um_per_px=um_per_px, points=points)
    mask = polygon_mask(rgb.shape[:2], polygon)
    if mask.sum() < 30:
        return []
    um = scale["um"]
    big = ndi.binary_dilation(mask, iterations=max(3, int(_px(1500, um) / max(scale["s"], 1e-6))))
    c_rgb, c_big, box = _crop(rgb, big, scale["s"], margin=0.02)
    x0, y0, w0, h0 = box
    c_scar = cv2.resize(mask[y0:y0 + h0, x0:x0 + w0].astype(np.uint8), (c_rgb.shape[1], c_rgb.shape[0]), interpolation=cv2.INTER_NEAREST).astype(bool)
    ring = c_big & ~ndi.binary_dilation(c_scar, iterations=2)
    lab = to_lab(c_rgb)
    L = lab[..., 0]
    roi = {"box": box, "polygon": np.round(polygon).astype(int).tolist(), "scale": scale}
    q = quality if c_scar.sum() > 200 else "marginal"
    rows = []
    contrast = float(delta_e(lab[c_scar].mean(axis=0), lab[ring].mean(axis=0))) if ring.sum() > 30 else None
    rows.append(_row("scar_contrast", contrast, region, scale, q, None, roi))
    hp = L - cv2.GaussianBlur(L, (0, 0), max(1.0, _px(500, um)))
    ratio = float(hp[c_scar].std() / max(1e-6, hp[ring].std())) if ring.sum() > 30 and c_scar.sum() > 30 else None
    rows.append(_row("scar_texture_ratio", ratio, region, scale, q, None, roi))
    area = float(c_scar.sum()) * ((um / 1000.0) ** 2 if scale["calibrated"] else 1.0)
    rows.append(_row("scar_area", area, region, scale, q, None, roi))
    return rows
