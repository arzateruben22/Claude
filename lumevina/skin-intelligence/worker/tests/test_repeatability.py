"""The repeatability statistics."""

import math

from lumevina_skin.repeatability import summarize


def test_rc_from_known_within_subject_variation():
    rows = []
    for s in range(6):
        for v in (10 + s, 11 + s, 12 + s):   # each subject: SD 1 around their own mean
            rows.append({"subject": f"s{s}", "name": "redness_a_star", "region": "left_cheek", "value": float(v)})
    [r] = summarize(rows)
    assert math.isclose(r["within_sd"], 1.0, rel_tol=1e-6)
    assert math.isclose(r["repeatability_coefficient"], 1.96 * math.sqrt(2), rel_tol=1e-6)
    assert r["status"] == "validated"


def test_too_few_people_or_repeats_stays_experimental():
    rows = [{"subject": f"s{s}", "name": "texture_roughness", "region": "forehead", "value": float(v)} for s in range(3) for v in (1, 2, 3)]
    assert summarize(rows)[0]["status"] == "experimental"
    rows = [{"subject": f"s{s}", "name": "texture_roughness", "region": "forehead", "value": float(v)} for s in range(8) for v in (1, 2)]
    assert summarize(rows)[0]["status"] == "experimental"


def test_missing_values_are_ignored_not_counted_as_zero():
    rows = [{"subject": "a", "name": "pigment_contrast", "region": "nose", "value": None}, {"subject": "a", "name": "pigment_contrast", "region": "nose", "value": 3.0}]
    assert summarize(rows) == []


def test_no_variation_at_all_cannot_give_a_threshold():
    rows = [{"subject": f"s{s}", "name": "pore_size_median", "region": "nose", "value": 4.0} for s in range(6) for _ in range(3)]
    [r] = summarize(rows)
    assert r["status"] == "experimental" and "quantized" in r["note"]
