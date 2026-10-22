#!/usr/bin/env python3
"""Run the repeatability protocol and (optionally) publish the thresholds.

Real captures (the protocol in skin-intelligence/VALIDATION.md):
  python scripts/repeatability.py captures/ --device phone --out results/
    captures/<subject>/<region>/<any>.jpg   several captures of the same untreated
                                            skin per subject and region
  add --publish to write the results to measurement_validation (needs
  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY); a result is "validated" only
  with at least 5 subjects and 3 repeats each.

Synthetic dry run (exercises the tooling; NOT a validation):
  python scripts/repeatability.py --synthetic --out results/
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lumevina_skin import ALGORITHM_VERSION  # noqa: E402
from lumevina_skin.imageio import load  # noqa: E402
from lumevina_skin.landmarks import detect, regions_for_capture  # noqa: E402
from lumevina_skin.measure import measure_region  # noqa: E402
from lumevina_skin.quality import assess  # noqa: E402
from lumevina_skin.repeatability import markdown, summarize  # noqa: E402


def measure_file(data: bytes, region: str, um_per_px=None):
    rgb, _ = load(data)
    points = detect(rgb)
    q = assess(rgb, source="camera", region=region, calibrated=bool(um_per_px), points=points)
    word = "good" if q["comparable"] else ("marginal" if q["passed"] else "poor")
    rows = []
    for r, mask in regions_for_capture(rgb, region, points).items():
        rows += measure_region(rgb, mask, r, quality=word, um_per_px=um_per_px, points=points)
    return rows, q


def synthetic_rows(subjects=6, repeats=4, regions=("left_cheek", "forehead")):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import cv2
    from tests.synth import skin, warp

    rng = np.random.default_rng(42)
    rows = []
    tones = [(230, 200, 175), (215, 189, 150), (190, 150, 120), (160, 126, 86), (120, 85, 62), (80, 60, 48)]
    for s in range(subjects):
        for region in regions:
            truth = skin(seed=100 + s * 7 + hash(region) % 5, tone=tones[s % len(tones)], spots=3, lines=4, pores=220)
            for k in range(repeats):
                img, _ = warp(truth, angle=rng.uniform(-3, 3), scale=rng.uniform(0.97, 1.03), dx=rng.uniform(-20, 20), dy=rng.uniform(-20, 20))
                img = img.astype(np.float32) * rng.uniform(0.94, 1.06) * np.array([rng.uniform(0.98, 1.02), 1.0, rng.uniform(0.98, 1.02)])
                img = img + rng.normal(0, 1.5, img.shape)
                img = np.clip(img, 0, 255).astype(np.uint8)
                if rng.random() < 0.5:
                    img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.2, 0.6))
                for r in measure_region(img, regions_for_capture(img, region, None)[region], region, quality="good"):
                    rows.append({"subject": f"synthetic-{s}", "name": r["name"], "region": region, "value": r["value"]})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?")
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--device", default="phone")
    ap.add_argument("--um-per-px", type=float, default=None)
    ap.add_argument("--out", default="repeatability-results")
    ap.add_argument("--publish", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if args.synthetic:
        rows = synthetic_rows()
        title, note = "Repeatability: synthetic dry run", ("Computed on synthetic images with simulated re-positioning, exposure, white balance, "
                                                           "focus and noise variation. This exercises the tooling only; it is NOT a validation and must never be published.")
    else:
        if not args.folder:
            ap.error("give a captures folder, or --synthetic")
        rows = []
        for path in sorted(Path(args.folder).glob("*/*/*")):
            if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff"):
                continue
            subject, region = path.parent.parent.name, path.parent.name
            ms, q = measure_file(path.read_bytes(), region, args.um_per_px)
            if not q["passed"]:
                print(f"skip {path}: failed quality ({', '.join(q['flags'])})")
                continue
            rows += [{"subject": subject, "name": m["name"], "region": m["region"], "value": m["value"]} for m in ms]
        title, note = f"Repeatability: {args.device}", f"Algorithm {ALGORITHM_VERSION}."

    results = summarize(rows)
    for r in results:
        r["device_kind"] = args.device
        r["algorithm_version"] = ALGORITHM_VERSION
        if args.synthetic:
            r["status"] = "synthetic only"
    (out / "repeatability.json").write_text(json.dumps({"title": title, "note": note, "results": results}, indent=2))
    (out / "repeatability.md").write_text(markdown(results, title, note))
    print(markdown(results, title, note))

    if args.publish:
        if args.synthetic:
            sys.exit("Refusing to publish a synthetic run.")
        from lumevina_skin.store import SupabaseStore
        store = SupabaseStore()
        for r in results:
            store._rest("POST", "measurement_validation?on_conflict=name,region,device_kind", json={
                "name": r["name"], "region": r["region"], "device_kind": args.device, "status": r["status"],
                "repeatability_coefficient": r["repeatability_coefficient"], "within_sd": r["within_sd"],
                "n_subjects": r["n_subjects"], "n_repeats": r["n_repeats"], "protocol_version": r["protocol_version"],
                "algorithm_version": ALGORITHM_VERSION, "notes": f"CV {r['cv_percent']}%",
            }, headers={"Prefer": "resolution=merge-duplicates"})
        print(f"published {len(results)} results")


if __name__ == "__main__":
    main()
