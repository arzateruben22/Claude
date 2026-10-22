"""The shared catalog (regions, landmark sets, measurement units), generated
from js/skin/core by scripts/build-skin-core.mjs so the worker and the
website agree on every name."""

import json
from pathlib import Path

_CATALOG = json.loads((Path(__file__).with_name("catalog.json")).read_text())

REGIONS = {r["id"]: r for r in _CATALOG["regions"]}
AREA_REGIONS = [r["id"] for r in _CATALOG["regions"] if r["kind"] == "area"]
LANDMARKS = {k: list(v) for k, v in _CATALOG["landmarks"].items()}
KEYPOINTS = dict(_CATALOG["keypoints"])
MEASUREMENTS = dict(_CATALOG["measurements"])


def unit_for(name: str, calibrated: bool) -> str:
    m = MEASUREMENTS[name]
    return m["unit"]["calibrated" if calibrated else "uncalibrated"]
