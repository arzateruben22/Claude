"""Reading originals: any of the accepted formats, oriented for analysis,
with the camera metadata that matters for comparing visits. The original
bytes are never modified; orientation is applied to the pixels we analyse."""

from __future__ import annotations

import hashlib
import io

import numpy as np
from PIL import ExifTags, Image, ImageOps

try:  # HEIC/HEIF from iPhones
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - optional
    pass

Image.MAX_IMAGE_PIXELS = 120_000_000  # a 25 MB TIFF from a dermatoscope fits; bombs don't

_EXIF_KEYS = {
    "Make": "make", "Model": "model", "LensModel": "lens", "FocalLength": "focal_mm",
    "FocalLengthIn35mmFilm": "focal_35mm", "ExposureTime": "exposure_s", "FNumber": "f_number",
    "ISOSpeedRatings": "iso", "PhotographicSensitivity": "iso", "WhiteBalance": "white_balance",
    "Flash": "flash", "DateTimeOriginal": "taken_at", "Software": "software",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _plain(v):
    try:
        if hasattr(v, "numerator") and hasattr(v, "denominator"):
            return round(float(v), 6) if v.denominator else None
        if isinstance(v, bytes):
            return None
        if isinstance(v, (int, float, str)):
            return v
        return str(v)[:80]
    except Exception:
        return None


def exif_of(img: Image.Image) -> dict:
    out = {}
    try:
        raw = img.getexif()
        merged = dict(raw)
        try:
            merged.update(raw.get_ifd(ExifTags.IFD.Exif))
        except Exception:
            pass
        for tag, value in merged.items():
            name = ExifTags.TAGS.get(tag)
            if name in _EXIF_KEYS:
                v = _plain(value)
                if v is not None:
                    out[_EXIF_KEYS[name]] = v
    except Exception:
        pass
    return out


def load(data: bytes) -> tuple[np.ndarray, dict]:
    """RGB uint8 pixels (oriented) and metadata: width, height, format, exif."""
    img = Image.open(io.BytesIO(data))
    fmt = img.format
    exif = exif_of(img)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB",):
        img = img.convert("RGB")
    arr = np.asarray(img, dtype=np.uint8)
    return arr, {"width": int(arr.shape[1]), "height": int(arr.shape[0]), "format": fmt, "exif": exif}


def encode_jpeg(rgb: np.ndarray, quality: int = 88) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def encode_png(rgb: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def resize_max(rgb: np.ndarray, max_side: int) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = max_side / max(h, w)
    if s >= 1:
        return rgb
    img = Image.fromarray(rgb).resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    return np.asarray(img)
