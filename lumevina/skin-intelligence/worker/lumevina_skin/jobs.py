"""The four kinds of job the edge functions queue (analysis_jobs.kind).

ingest    hash the original, read its size and camera details, make the
          viewing copy and thumbnail; then queue quality
quality   the authoritative checks; mark the capture processed; when it is
          usable, queue measure
measure   find the regions (face landmarks or the close-up itself), measure
          each, and a scar when the practitioner outlined one; one analysis
          row per run, never overwriting an earlier one
register  line this capture up with an earlier one of the same region and
          make the aligned copy and the difference map
"""

from __future__ import annotations

import posixpath
from datetime import datetime, timezone

import numpy as np

from . import ALGORITHM_VERSION
from .imageio import encode_jpeg, encode_png, load, resize_max, sha256
from .landmarks import detect, regions_for_capture
from .measure import measure_region, measure_scar
from .quality import QUALITY_VERSION, assess
from .register import REGISTER_VERSION, difference, register
from .store import Store

VIEW_MAX, THUMB_MAX = 2048, 400
FACE_REGIONS = {"front", "left_profile", "right_profile", "forehead", "left_cheek", "right_cheek", "nose", "chin"}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _dir(capture):
    return posixpath.dirname(capture["original_path"])


def _calibration(store: Store, capture: dict) -> float | None:
    if capture.get("um_per_px"):
        return float(capture["um_per_px"])
    session = store.get("imaging_sessions", id=capture["session_id"])
    if session and session.get("device_id"):
        device = store.get("imaging_devices", id=session["device_id"])
        cal = (device or {}).get("calibration") or {}
        if cal.get("um_per_px"):
            return float(cal["um_per_px"])
    return None


def _device_kind(store: Store, capture: dict) -> str | None:
    session = store.get("imaging_sessions", id=capture["session_id"])
    if session and session.get("device_id"):
        return (store.get("imaging_devices", id=session["device_id"]) or {}).get("kind")
    return None


def _derived(store: Store, capture: dict, kind: str, path: str, data: bytes, content_type: str, width: int, height: int,
             reference: str | None = None, params: dict | None = None, version: str = ALGORITHM_VERSION):
    store.upload(path, data, content_type)
    if not store.get("derived_images", path=path):
        store.insert("derived_images", {"capture_id": capture["id"], "kind": kind, "path": path, "reference_capture_id": reference,
                                        "algorithm_version": version, "params": params, "width": width, "height": height})


def ingest(store: Store, job: dict) -> None:
    cap = store.get("captures", id=job["capture_id"])
    data = store.download(cap["original_path"])
    rgb, meta = load(data)
    patch = {}
    if not cap.get("original_sha256"):
        patch["original_sha256"] = sha256(data)
    if not cap.get("width"):
        patch.update(width=meta["width"], height=meta["height"])
    if not cap.get("bytes"):
        patch["bytes"] = len(data)
    if not cap.get("exif") and meta["exif"]:
        patch["exif"] = meta["exif"]
    cal = _calibration(store, cap)
    if cal and not cap.get("um_per_px"):
        patch.update(um_per_px=cal, calibration_status="device_calibrated")
    if patch:
        store.update("captures", patch, id=cap["id"])
    view = resize_max(rgb, VIEW_MAX)
    _derived(store, cap, "view", f"{_dir(cap)}/view.jpg", encode_jpeg(view), "image/jpeg", view.shape[1], view.shape[0])
    thumb = resize_max(rgb, THUMB_MAX)
    _derived(store, cap, "thumb", f"{_dir(cap)}/thumb.jpg", encode_jpeg(thumb, 82), "image/jpeg", thumb.shape[1], thumb.shape[0])
    store.enqueue(cap["id"], "quality")


def quality(store: Store, job: dict) -> dict:
    cap = store.get("captures", id=job["capture_id"])
    rgb, _ = load(store.download(cap["original_path"]))
    points = detect(rgb) if cap["region"] in FACE_REGIONS else None
    q = assess(rgb, source=cap["source"], region=cap["region"], calibrated=bool(_calibration(store, cap)), points=points,
               reference_sharpness=_reference_sharpness(store, cap))
    store.insert("quality_checks", {"capture_id": cap["id"], "algorithm_version": QUALITY_VERSION, "metrics": q["metrics"],
                                    "flags": q["flags"], "passed": q["passed"], "comparable": q["comparable"]})
    store.update("captures", {"status": "processed"}, id=cap["id"])
    if q["passed"]:
        store.enqueue(cap["id"], "measure")
    return q


def _reference_sharpness(store: Store, cap: dict) -> float | None:
    """The median sharpness of this client's earlier passed captures of the same region and source."""
    vals = []
    for other in store.rows("captures", profile_id=cap["profile_id"], region=cap["region"]):
        if other["id"] == cap["id"] or other.get("source") != cap.get("source"):
            continue
        for q in store.rows("quality_checks", capture_id=other["id"]):
            if q.get("passed") and (q.get("metrics") or {}).get("sharpness"):
                vals.append(float(q["metrics"]["sharpness"]))
    return float(np.median(vals)) if len(vals) >= 2 else None


def _validation(store: Store, name: str, region: str, device_kind: str | None):
    for r in (region, "any"):
        for d in (device_kind or "any", "any"):
            v = store.get("measurement_validation", name=name, region=r, device_kind=d)
            if v and v.get("status") == "validated":
                return v
    return None


def measure(store: Store, job: dict) -> dict:
    cap = store.get("captures", id=job["capture_id"])
    rgb, _ = load(store.download(cap["original_path"]))
    qc_rows = store.rows("quality_checks", capture_id=cap["id"])
    qc = sorted(qc_rows, key=lambda r: str(r.get("created_at", "")))[-1] if qc_rows else None
    quality_word = "good" if qc and qc["comparable"] else ("marginal" if qc and qc["passed"] else "poor")
    points = detect(rgb) if cap["region"] in FACE_REGIONS else None
    um = _calibration(store, cap)
    device_kind = _device_kind(store, cap)
    analysis = store.insert("analyses", {"capture_id": cap["id"], "profile_id": cap["profile_id"], "algorithm_version": ALGORITHM_VERSION,
                                         "engine": "lumevina-worker", "status": "running",
                                         "params": {"landmarks": points is not None, "um_per_px": um, "quality": quality_word}})
    try:
        rows = []
        for region, mask in regions_for_capture(rgb, cap["region"], points).items():
            rows += measure_region(rgb, mask, region, quality=quality_word, um_per_px=um, points=points)
        roi = (job.get("params") or {}).get("scar_roi")
        if roi and len(roi) >= 3:
            rows += measure_scar(rgb, np.array(roi, dtype=np.float32), cap["region"], quality=quality_word, um_per_px=um, points=points)
        for r in rows:
            v = _validation(store, r["name"], r["region"], device_kind)
            store.insert("measurements", {
                "analysis_id": analysis["id"], "capture_id": cap["id"], "profile_id": cap["profile_id"], "name": r["name"],
                "value": r["value"], "unit": r["unit"], "region": r["region"], "roi": r["roi"], "quality": r["quality"],
                "calibration_status": r["calibration_status"], "uncertainty": r["uncertainty"],
                "repeatability": v["repeatability_coefficient"] if v else None, "experimental": v is None,
            })
        store.update("analyses", {"status": "done", "finished_at": _now()}, id=analysis["id"])
        return {"analysis_id": analysis["id"], "measurements": len(rows)}
    except Exception as e:
        store.update("analyses", {"status": "failed", "finished_at": _now(), "error": str(e)[:1000]}, id=analysis["id"])
        raise


def register_pair(store: Store, job: dict) -> dict:
    cap = store.get("captures", id=job["capture_id"])
    ref = store.get("captures", id=job["reference_capture_id"])
    if not ref or ref["profile_id"] != cap["profile_id"] or ref["region"] != cap["region"]:
        raise ValueError("the reference must be the same client's same region")
    rgb_ref, _ = load(store.download(ref["original_path"]))
    rgb_mov, _ = load(store.download(cap["original_path"]))
    reg = register(rgb_ref, rgb_mov)
    if not reg["ok"]:
        raise ValueError("the images could not be lined up")
    diff = difference(rgb_ref, rgb_mov, reg["H"])
    params = {"registration": {k: reg[k] for k in ("method", "score", "version")}, **diff["summary"]}
    base = _dir(cap)
    al = diff["aligned"]
    _derived(store, cap, "aligned", f"{base}/aligned-{ref['id']}.jpg", encode_jpeg(al), "image/jpeg", al.shape[1], al.shape[0], ref["id"], params, REGISTER_VERSION)
    ov = diff["overlay"]
    _derived(store, cap, "diffmap", f"{base}/diff-{ref['id']}.png", encode_png(ov), "image/png", ov.shape[1], ov.shape[0], ref["id"], params, REGISTER_VERSION)
    return params


HANDLERS = {"ingest": ingest, "quality": quality, "measure": measure, "register": register_pair}


def run_one(store: Store, worker: str) -> dict | None:
    """Claim and run one job. Returns the job (with 'error' when it failed), or None when there was nothing to do."""
    job = store.claim(worker)
    if not job:
        return None
    try:
        HANDLERS[job["kind"]](store, job)
        store.finish(job["id"])
    except Exception as e:  # the job is marked failed with the reason; the worker keeps going
        store.finish(job["id"], f"{type(e).__name__}: {e}")
        if job["kind"] in ("ingest", "quality"):
            try:
                store.update("captures", {"status": "failed"}, id=job["capture_id"])
            except Exception:
                pass
        job = {**job, "error": str(e)}
    return job
