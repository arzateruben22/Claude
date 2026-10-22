"""The job pipeline end to end against an in-memory store: ingest → quality →
measure, and register, with the rows and files the functions expect."""

import hashlib
import io
import itertools

import numpy as np
from PIL import Image

from lumevina_skin import ALGORITHM_VERSION
from lumevina_skin.jobs import run_one
from tests.synth import skin, warp


class MemoryStore:
    def __init__(self):
        self.t = {k: [] for k in ("captures", "imaging_sessions", "imaging_devices", "derived_images", "quality_checks",
                                  "analyses", "measurements", "measurement_validation", "analysis_jobs")}
        self.files = {}
        self.ids = itertools.count(1)

    def claim(self, worker):
        for j in self.t["analysis_jobs"]:
            if j["status"] == "queued":
                j.update(status="running", claimed_by=worker)
                return dict(j)
        return None

    def finish(self, job_id, error=None):
        for j in self.t["analysis_jobs"]:
            if j["id"] == job_id:
                j.update(status="failed" if error else "done", error=error)

    def get(self, table, **eq):
        return next((dict(r) for r in self.t[table] if all(r.get(k) == v for k, v in eq.items())), None)

    def rows(self, table, **eq):
        return [dict(r) for r in self.t[table] if all(r.get(k) == v for k, v in eq.items())]

    def insert(self, table, row):
        row = {"id": row.get("id") or f"{table}-{next(self.ids)}", "created_at": f"2026-10-22T00:00:{next(self.ids):02d}Z", **row}
        self.t[table].append(row)
        return dict(row)

    def update(self, table, patch, **eq):
        for r in self.t[table]:
            if all(r.get(k) == v for k, v in eq.items()):
                r.update(patch)

    def enqueue(self, capture_id, kind, reference_capture_id=None, params=None):
        if any(j["capture_id"] == capture_id and j["kind"] == kind and j["status"] in ("queued", "running") and j.get("reference_capture_id") == reference_capture_id for j in self.t["analysis_jobs"]):
            return
        self.t["analysis_jobs"].append({"id": next(self.ids), "capture_id": capture_id, "kind": kind, "reference_capture_id": reference_capture_id, "params": params, "status": "queued"})

    def download(self, path):
        return self.files[path]

    def upload(self, path, data, content_type):
        self.files[path] = data


def jpeg(rgb):
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def add_capture(store, cid, rgb, region="left_cheek", source="camera"):
    path = f"p1/s1/{cid}/original.jpg"
    store.files[path] = jpeg(rgb)
    store.t["captures"].append({"id": cid, "session_id": "s1", "profile_id": "p1", "region": region, "source": source,
                                "original_path": path, "mime": "image/jpeg", "status": "uploaded", "um_per_px": None, "bytes": len(store.files[path])})
    return path


def drain(store):
    done = []
    while (j := run_one(store, "test")) is not None:
        done.append(j)
    return done


def test_ingest_quality_measure_end_to_end():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": None})
    path = add_capture(s, "c1", skin(seed=1, spots=3, lines=3))
    s.enqueue("c1", "ingest")
    jobs = drain(s)
    assert [j["kind"] for j in jobs] == ["ingest", "quality", "measure"]
    assert all("error" not in j for j in jobs), jobs
    cap = s.get("captures", id="c1")
    assert cap["original_sha256"] == hashlib.sha256(s.files[path]).hexdigest()
    assert (cap["width"], cap["height"], cap["status"]) == (1200, 900, "processed")
    assert {d["kind"] for d in s.t["derived_images"]} == {"view", "thumb"}
    assert s.files[path] == jpeg(skin(seed=1, spots=3, lines=3)), "the original is never rewritten"
    q = s.t["quality_checks"][0]
    assert q["passed"] and q["comparable"]
    a = s.t["analyses"][0]
    assert a["status"] == "done" and a["algorithm_version"] == ALGORITHM_VERSION
    names = {m["name"] for m in s.t["measurements"]}
    assert {"pore_density", "texture_roughness", "redness_a_star", "pigment_spot_area", "fine_line_density"} <= names
    assert all(m["experimental"] for m in s.t["measurements"])


def test_a_validated_measurement_carries_its_threshold_and_stops_being_experimental():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": "d1"})
    s.t["imaging_devices"].append({"id": "d1", "kind": "phone", "calibration": None})
    s.t["measurement_validation"].append({"name": "redness_a_star", "region": "any", "device_kind": "phone", "status": "validated", "repeatability_coefficient": 1.2})
    add_capture(s, "c1", skin(seed=2))
    s.enqueue("c1", "ingest")
    drain(s)
    red = next(m for m in s.t["measurements"] if m["name"] == "redness_a_star")
    assert red["repeatability"] == 1.2 and red["experimental"] is False
    assert next(m for m in s.t["measurements"] if m["name"] == "texture_roughness")["experimental"] is True


def test_a_blurred_capture_is_checked_but_not_measured():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": None})
    add_capture(s, "c1", skin(seed=3, blur=5))
    s.enqueue("c1", "ingest")
    assert [j["kind"] for j in drain(s)] == ["ingest", "quality"]
    assert not s.t["quality_checks"][0]["passed"]
    assert s.t["measurements"] == []


def test_a_device_calibration_reaches_the_capture_and_the_units():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": "d1"})
    s.t["imaging_devices"].append({"id": "d1", "kind": "usb_microscope", "calibration": {"um_per_px": 30.0}})
    add_capture(s, "c1", skin(seed=4), region="custom", source="microscope")
    s.enqueue("c1", "ingest")
    drain(s)
    assert s.get("captures", id="c1")["calibration_status"] == "device_calibrated"
    assert next(m for m in s.t["measurements"] if m["name"] == "pore_density")["unit"] == "per cm²"


def test_registration_makes_the_aligned_copy_and_the_difference_map():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": None})
    ref = skin(seed=5, spots=4)
    add_capture(s, "c1", ref)
    add_capture(s, "c2", warp(ref, angle=3, dx=12, dy=8)[0])
    s.enqueue("c2", "register", "c1")
    jobs = drain(s)
    assert jobs[0]["kind"] == "register" and "error" not in jobs[0], jobs
    kinds = {d["kind"]: d for d in s.t["derived_images"]}
    assert set(kinds) == {"aligned", "diffmap"}
    assert kinds["diffmap"]["reference_capture_id"] == "c1"
    assert kinds["diffmap"]["params"]["registration"]["score"] > 0.8
    assert s.files[kinds["diffmap"]["path"]][:8] == b"\x89PNG\r\n\x1a\n"


def test_registering_another_clients_image_is_refused_and_the_job_fails_cleanly():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": None})
    add_capture(s, "c1", skin(seed=6))
    add_capture(s, "c2", skin(seed=6))
    s.t["captures"][0]["profile_id"] = "p2"
    s.enqueue("c2", "register", "c1")
    jobs = drain(s)
    assert "same client" in jobs[0]["error"]
    assert s.t["analysis_jobs"][0]["status"] == "failed"


def test_a_scar_outline_in_the_job_adds_scar_measurements():
    s = MemoryStore()
    s.t["imaging_sessions"].append({"id": "s1", "device_id": None})
    add_capture(s, "c1", skin(seed=7))
    s.t["captures"][0]["status"] = "processed"
    s.t["quality_checks"].append({"capture_id": "c1", "passed": True, "comparable": True, "created_at": "x"})
    roi = [[500, 400], [700, 400], [700, 480], [500, 480]]
    s.enqueue("c1", "measure", None, {"scar_roi": roi})
    drain(s)
    assert {"scar_contrast", "scar_texture_ratio", "scar_area"} <= {m["name"] for m in s.t["measurements"]}
