#!/usr/bin/env python3
"""Make the demo record the preview runs on: one synthetic client, six visits.

Writes lumevina/img/skin-demo/*.jpg (viewing copies, thumbnails, difference
maps, each image stamped SYNTHETIC DEMO IMAGE) and lumevina/js/skin/demo-data.js.
Every image is generated texture, not a photograph of anyone. Every
measurement in the demo was computed by this worker's real code on those
images. Re-run after changing the measurements:

  python skin-intelligence/worker/scripts/make_demo.py
"""

import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))

from lumevina_skin import ALGORITHM_VERSION  # noqa: E402
from lumevina_skin.imageio import encode_jpeg, resize_max  # noqa: E402
from lumevina_skin.landmarks import regions_for_capture  # noqa: E402
from lumevina_skin.measure import measure_region  # noqa: E402
from lumevina_skin.quality import QUALITY_VERSION, assess  # noqa: E402
from lumevina_skin.register import REGISTER_VERSION, difference, register  # noqa: E402
from lumevina_skin.repeatability import summarize  # noqa: E402
from tests.synth import skin, warp, watermark  # noqa: E402

SITE = HERE.parents[1]
OUT = SITE / "img" / "skin-demo"
OUT.mkdir(parents=True, exist_ok=True)

VISITS = [("2026-05-06", "ProCell #1"), ("2026-06-03", "ProCell #2"), ("2026-07-01", "ProCell #3"),
          ("2026-07-29", "ProCell #4"), ("2026-09-09", "Follow-up"), ("2026-10-14", "Follow-up")]
# how each region's synthetic skin changes over the visits (index = visit)
PLAN = {
    "left_cheek": dict(seed=11, tone=(214, 172, 146), redness=[1.0, 0.85, 0.7, 0.6, 0.45, 0.4], pores=[330, 320, 300, 290, 275, 270], spots=7, spot_strength=[1.0, 1.0, 0.92, 0.85, 0.8, 0.78], lines=3),
    "right_cheek": dict(seed=12, tone=(212, 170, 144), redness=[0.8, 0.75, 0.62, 0.55, 0.5, 0.48], pores=[310, 305, 290, 280, 270, 268], spots=5, spot_strength=[1.0, 0.97, 0.93, 0.9, 0.86, 0.85], lines=2),
    "forehead": dict(seed=13, tone=(218, 178, 152), redness=[0.3, 0.3, 0.28, 0.27, 0.25, 0.25], pores=[220, 218, 214, 212, 210, 208], spots=3, spot_strength=[1.0] * 6, lines=7, line_strength=[1.0, 0.98, 0.95, 0.9, 0.88, 0.86]),
}
RNG = np.random.default_rng(2026)
PID = "00000000-0000-4000-8000-00000000d001"


def uid(kind, *parts):
    import hashlib
    h = hashlib.sha1(("demo:" + kind + ":" + ":".join(map(str, parts))).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def capture_variation(img, k, blur=0.0):
    """What changes between two visits' photos of the same skin: position, exposure, white balance."""
    img, _ = warp(img, angle=RNG.uniform(-2.5, 2.5), scale=RNG.uniform(0.98, 1.02), dx=RNG.uniform(-15, 15), dy=RNG.uniform(-15, 15))
    img = img.astype(np.float32) * RNG.uniform(0.97, 1.03) * np.array([RNG.uniform(0.99, 1.01), 1.0, RNG.uniform(0.99, 1.01)])
    img = np.clip(img + RNG.normal(0, 1.2, img.shape), 0, 255).astype(np.uint8)
    return cv2.GaussianBlur(img, (0, 0), blur) if blur else img


def iso(d, hour=10, minute=0):
    return datetime(*map(int, d.split("-")), hour, minute, tzinfo=timezone.utc).isoformat()


def main():
    sessions, captures, quality, measurements, derived, analyses = [], [], [], [], [], []
    originals = {}
    sharp_ref = {}
    for vi, (day, label) in enumerate(VISITS):
        sid = uid("session", vi)
        sessions.append({"id": sid, "profile_id": PID, "booking_id": None, "visit_label": label,
                         "service_id": "procell-microchanneling" if vi < 4 else "lumevina-custom-facial",
                         "device_id": "demo-device-phone", "status": "reviewed", "started_at": iso(day),
                         "notes_private": "Demo: practitioner's private note (never shown to the client)."})
        for ri, (region, p) in enumerate(PLAN.items()):
            shots = [0.0]
            if vi == 2 and region == "left_cheek":
                shots = [3.2, 0.0]          # a blurred first try, then a good retake
            for si, blur in enumerate(shots):
                cid = uid("capture", vi, region, si)
                truth = skin(seed=p["seed"], tone=p["tone"], redness=p["redness"][vi], pores=p["pores"][vi], spots=p["spots"],
                             spot_strength=p["spot_strength"][vi], lines=p["lines"], line_strength=p.get("line_strength", [1.0] * 6)[vi])
                img = capture_variation(truth, vi, blur)
                originals[cid] = img
                q = assess(img, source="camera", region=region, calibrated=False, reference_sharpness=sharp_ref.get(region))
                if q["passed"]:
                    sharp_ref.setdefault(region, q["metrics"]["sharpness"])
                base = f"img/skin-demo/v{vi + 1}-{region}{'-retake' if si else ''}{'-blurred' if blur else ''}"
                view = watermark(resize_max(img, 960))
                thumb = watermark(resize_max(img, 320), "SYNTHETIC")
                (SITE / f"{base}.jpg").write_bytes(encode_jpeg(view, 80))
                (SITE / f"{base}-thumb.jpg").write_bytes(encode_jpeg(thumb, 75))
                captured_at = iso(day, 10, 5 + ri * 3 + si)
                captures.append({"id": cid, "session_id": sid, "profile_id": PID, "region": region, "site_id": None, "source": "camera",
                                 "mime": "image/jpeg", "width": img.shape[1], "height": img.shape[0], "calibration_status": "uncalibrated",
                                 "status": "processed" if q["passed"] else "excluded", "excluded_reason": None if q["passed"] else "Blurred: retaken",
                                 "captured_at": captured_at, "captured_by_role": "practitioner", "synthetic": True})
                quality.append({"capture_id": cid, "algorithm_version": QUALITY_VERSION, "metrics": q["metrics"], "flags": q["flags"],
                                "passed": q["passed"], "comparable": q["comparable"], "created_at": captured_at,
                                "review_decision": None if q["passed"] else "retake"})
                derived += [{"capture_id": cid, "kind": "view", "path": f"{base}.jpg", "width": view.shape[1], "height": view.shape[0]},
                            {"capture_id": cid, "kind": "thumb", "path": f"{base}-thumb.jpg", "width": thumb.shape[1], "height": thumb.shape[0]}]
                if not q["passed"]:
                    continue
                aid = uid("analysis", cid)
                analyses.append({"id": aid, "capture_id": cid, "algorithm_version": ALGORITHM_VERSION})
                word = "good" if q["comparable"] else "marginal"
                for r, mask in regions_for_capture(img, region, None).items():
                    for m in measure_region(img, mask, r, quality=word):
                        m.pop("roi", None)
                        m.pop("why", None)
                        m.pop("count", None)
                        measurements.append({"id": uid("m", cid, m["name"]), "analysis_id": aid, "capture_id": cid, "profile_id": PID,
                                             "algorithm_version": ALGORITHM_VERSION, "created_at": captured_at,
                                             "review_status": "verified" if vi < 5 else "unreviewed", **m})
        print("visit", vi + 1, "done")

    # difference maps: each later visit against the first, per region
    good = {c["id"]: c for c in captures if c["status"] == "processed"}
    by_region = {}
    for c in captures:
        if c["status"] == "processed":
            by_region.setdefault(c["region"], []).append(c)
    for region, caps in by_region.items():
        caps.sort(key=lambda c: c["captured_at"])
        ref = caps[0]
        for c in caps[1:]:
            reg = register(originals[ref["id"]], originals[c["id"]])
            d = difference(originals[ref["id"]], originals[c["id"]], reg["H"])
            path = f"img/skin-demo/diff-{region}-{c['captured_at'][:10]}.jpg"
            (SITE / path).write_bytes(encode_jpeg(watermark(resize_max(d["overlay"], 720), "SYNTHETIC"), 80))
            al = f"img/skin-demo/aligned-{region}-{c['captured_at'][:10]}.jpg"
            (SITE / al).write_bytes(encode_jpeg(watermark(resize_max(d["aligned"], 960)), 80))
            params = {"registration": {k: reg[k] for k in ("method", "score", "version")}, **d["summary"]}
            derived.append({"capture_id": c["id"], "kind": "diffmap", "path": path, "reference_capture_id": ref["id"], "algorithm_version": REGISTER_VERSION, "params": params})
            derived.append({"capture_id": c["id"], "kind": "aligned", "path": al, "reference_capture_id": ref["id"], "algorithm_version": REGISTER_VERSION, "params": params})

    # a synthetic repeatability run for the demo's thresholds, clearly labelled
    rep_rows = []
    for region, p in PLAN.items():
        for subject in range(6):
            truth = skin(seed=500 + subject * 3 + p["seed"], tone=p["tone"], pores=260, spots=4, lines=p["lines"])
            for k in range(3):
                img = capture_variation(truth, k)
                for m in measure_region(img, regions_for_capture(img, region, None)[region], region, quality="good"):
                    rep_rows.append({"subject": f"s{subject}", "name": m["name"], "region": region, "value": m["value"]})
    validation = [{**r, "device_kind": "phone", "algorithm_version": ALGORITHM_VERSION,
                   "notes": "DEMO ONLY: computed on synthetic repeat images, not a real validation."} for r in summarize(rep_rows)]

    data = {
        "generated": date.today().isoformat(), "algorithm_version": ALGORITHM_VERSION,
        "notice": "Synthetic demonstration data. Every image is generated texture, not a photograph of a person; every measurement was computed by the Lumevina worker on those images; the validation thresholds come from a synthetic repeatability run and are not real.",
        "profile": {"id": PID, "email": "demo.client@example.test", "name": "Demo Client", "goals": "Smoother texture and less redness on my cheeks before the wedding in November.",
                    "concerns": ["Texture", "Redness", "Pores"], "skin_history": "Occasional breakouts in my twenties. Sensitive to fragrance.",
                    "sensitivities": "Fragrance; some essential oils", "current_products": "Gentle gel cleanser, vitamin C serum, SPF 30",
                    "prior_procedures": "Two light peels in 2025", "contraindications": [{"note": "No retinoids 5 days before microchanneling.", "at": "2026-05-06T10:00:00Z", "by": "Evelyn"}],
                    "privacy": {"email_when_report_ready": True}, "status": "active", "enrolled_at": "2026-05-06T09:50:00Z", "updated_at": "2026-10-14T11:00:00Z"},
        "sessions": sessions, "captures": captures, "quality": quality, "measurements": measurements, "derived": derived, "analyses": analyses,
        "devices": [{"id": "demo-device-phone", "name": "Studio phone", "kind": "phone", "model": "Mounted phone under the studio LED", "calibration": None, "active": True}],
        "validation": validation,
    }
    js = ("/* GENERATED by skin-intelligence/worker/scripts/make_demo.py. Synthetic demonstration data:\n"
          " * generated images, real measurements of those images, a synthetic repeatability run. Not a person. */\n"
          f"export const DEMO = {json.dumps(data, separators=(',', ':'))};\n")
    (SITE / "js" / "skin" / "demo-data.js").write_text(js)
    size = sum(f.stat().st_size for f in OUT.glob("*.jpg"))
    print(f"{len(captures)} captures, {len(measurements)} measurements, {len(validation)} thresholds; images {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
