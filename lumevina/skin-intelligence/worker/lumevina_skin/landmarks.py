"""Face landmarks (MediaPipe Face Landmarker), region outlines and scale.

The landmark model is optional. With it, a front-of-face photograph yields
an outline for each area (forehead, cheeks, nose, chin) and a scale basis
(the distance between the outer eye corners), so photos taken at slightly
different distances can be compared. Without it, or when no face is found
(a close-up, a microscope image), a capture of an area is measured whole.
"""

from __future__ import annotations

import os
from functools import lru_cache

import cv2
import numpy as np

from .catalog import AREA_REGIONS, KEYPOINTS, LANDMARKS

# Uncalibrated images are resampled so the outer eye corners sit this many
# pixels apart: the "normalized pixel" every uncalibrated unit refers to.
IOD_NORMALIZED_PX = 400.0


@lru_cache(maxsize=1)
def _landmarker():
    path = os.environ.get("LUMEVINA_FACE_MODEL", "")
    if not path or not os.path.exists(path):
        return None
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mpt
        from mediapipe.tasks.python import vision

        opts = vision.FaceLandmarkerOptions(
            base_options=mpt.BaseOptions(model_asset_path=path),
            running_mode=vision.RunningMode.IMAGE, num_faces=1,
            min_face_detection_confidence=0.5, min_face_presence_confidence=0.5,
        )
        return mp, vision.FaceLandmarker.create_from_options(opts)
    except Exception:  # pragma: no cover - depends on the platform build
        return None


def detect(rgb: np.ndarray) -> np.ndarray | None:
    """478 landmarks as an (N, 2) array of pixel coordinates, or None."""
    lm = _landmarker()
    if lm is None:
        return None
    mp, landmarker = lm
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    res = landmarker.detect(image)
    if not res.face_landmarks:
        return None
    h, w = rgb.shape[:2]
    return np.array([[p.x * w, p.y * h] for p in res.face_landmarks[0]], dtype=np.float32)


def region_polygon(points: np.ndarray, region: str) -> np.ndarray | None:
    idx = LANDMARKS.get(region)
    if idx is None or points is None or len(points) < 468:
        return None
    hull = cv2.convexHull(points[idx].astype(np.float32))
    return hull.reshape(-1, 2)


def polygon_mask(shape: tuple[int, int], polygon: np.ndarray) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.fillPoly(mask, [np.round(polygon).astype(np.int32)], 1)
    return mask.astype(bool)


def inter_ocular_px(points: np.ndarray) -> float | None:
    if points is None:
        return None
    a, b = points[KEYPOINTS["rightEyeOuter"]], points[KEYPOINTS["leftEyeOuter"]]
    d = float(np.hypot(*(a - b)))
    return d if d > 10 else None


def pose(points: np.ndarray) -> dict | None:
    """Yaw, pitch, roll in degrees, with the same rules as js/skin/core/regions.js."""
    if points is None:
        return None
    r, l, nose = points[KEYPOINTS["rightEdge"]], points[KEYPOINTS["leftEdge"]], points[KEYPOINTS["noseTip"]]
    ax, ay = l - r
    len2 = ax * ax + ay * ay
    if not len2:
        return None
    mx, my = (l + r) / 2
    t = ((nose[0] - mx) * ax + (nose[1] - my) * ay) / (len2 / 2)
    yaw = np.degrees(np.arctan(t / 1.295))
    re, le = points[KEYPOINTS["rightEyeOuter"]], points[KEYPOINTS["leftEyeOuter"]]
    roll = np.degrees(np.arctan2(le[1] - re[1], le[0] - re[0]))
    if roll > 90:
        roll -= 180
    elif roll < -90:
        roll += 180
    eye_y = (re[1] + le[1]) / 2
    span = points[KEYPOINTS["chin"]][1] - eye_y
    pitch = float(np.clip((0.314 - (nose[1] - eye_y) / span) * 150, -60, 60)) if span else 0.0
    return {"yaw": round(float(yaw), 1), "pitch": round(pitch, 1), "roll": round(float(roll), 1)}


def regions_for_capture(rgb: np.ndarray, region: str, points: np.ndarray | None) -> dict[str, np.ndarray]:
    """Masks of the areas to measure in this capture.

    A front view with landmarks: every area. An area capture with landmarks
    (a wide shot): that area's outline. Without landmarks: an area capture
    is a close-up of that area, measured on its central 90%; a front or
    profile view has no areas to measure.
    """
    h, w = rgb.shape[:2]
    out: dict[str, np.ndarray] = {}
    if points is not None:
        wanted = AREA_REGIONS if region == "front" else ([region] if region in AREA_REGIONS else [])
        for r in wanted:
            poly = region_polygon(points, r)
            if poly is not None:
                m = polygon_mask((h, w), poly)
                if m.sum() > 400:
                    out[r] = m
        return out
    if region in AREA_REGIONS or region == "custom":
        m = np.zeros((h, w), dtype=bool)
        m[int(h * 0.05):int(h * 0.95), int(w * 0.05):int(w * 0.95)] = True
        out[region] = m
    return out
