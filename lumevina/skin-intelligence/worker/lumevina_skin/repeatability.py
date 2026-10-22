"""Repeatability: how much a measurement moves when nothing about the skin has.

The protocol (skin-intelligence/VALIDATION.md): photograph the same
untreated skin of several people several times, re-positioning between
shots, under the studio's normal conditions. For each measurement, region
and kind of device:

  within-subject SD   Sw = √(mean over subjects of each subject's variance)
  repeatability coefficient   RC = 1.96 × √2 × Sw
                      (95% of differences between two captures of unchanged
                      skin are smaller than this)

A later change smaller than RC is "no meaningful change". A measurement is
only marked validated with enough people and repeats (MIN_SUBJECTS,
MIN_REPEATS); otherwise its numbers are reported but it stays experimental.
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np

MIN_SUBJECTS = 5
MIN_REPEATS = 3
PROTOCOL_VERSION = "rep-1"


def summarize(rows: list[dict]) -> list[dict]:
    """rows: [{subject, name, region, value}] (one per capture per measurement). Returns one result per (name, region)."""
    groups: dict[tuple, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        if r.get("value") is None or not math.isfinite(r["value"]):
            continue
        groups[(r["name"], r["region"])][r["subject"]].append(float(r["value"]))
    out = []
    for (name, region), by_subject in sorted(groups.items()):
        usable = {s: v for s, v in by_subject.items() if len(v) >= 2}
        if not usable:
            continue
        variances = [float(np.var(v, ddof=1)) for v in usable.values()]
        sw = math.sqrt(float(np.mean(variances)))
        grand = float(np.mean([np.mean(v) for v in usable.values()]))
        repeats = min(len(v) for v in usable.values())
        validated = len(usable) >= MIN_SUBJECTS and repeats >= MIN_REPEATS and sw > 0
        out.append({
            "name": name, "region": region, "n_subjects": len(usable), "n_repeats": repeats,
            "within_sd": round(sw, 6), "repeatability_coefficient": round(1.96 * math.sqrt(2) * sw, 6),
            "cv_percent": round(100 * sw / abs(grand), 2) if grand else None, "mean": round(grand, 6),
            "status": "validated" if validated else "experimental", "protocol_version": PROTOCOL_VERSION,
            **({"note": "no variation between repeats: the measurement is too coarse (quantized) to estimate repeatability"} if sw == 0 else {}),
        })
    return out


def markdown(results: list[dict], title: str, note: str = "") -> str:
    lines = [f"# {title}", ""]
    if note:
        lines += [note, ""]
    lines += ["| Measurement | Region | Subjects | Repeats | Within-subject SD | Repeatability coefficient | CV % | Status |",
              "|---|---|---:|---:|---:|---:|---:|---|"]
    for r in results:
        lines.append(f"| {r['name']} | {r['region']} | {r['n_subjects']} | {r['n_repeats']} | {r['within_sd']:.4g} | "
                     f"{r['repeatability_coefficient']:.4g} | {'' if r['cv_percent'] is None else r['cv_percent']} | {r['status']} |")
    return "\n".join(lines) + "\n"
