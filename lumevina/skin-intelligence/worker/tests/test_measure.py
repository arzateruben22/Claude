"""The measurements respond to what they claim to measure, and only that."""

import numpy as np
import pytest

from lumevina_skin.catalog import MEASUREMENTS
from lumevina_skin.landmarks import regions_for_capture
from lumevina_skin.measure import measure_region, measure_scar, working_scale
from tests.synth import skin


def measure(img, region="left_cheek", **kw):
    masks = regions_for_capture(img, region, None)
    rows = measure_region(img, masks[region], region, quality="good", **kw)
    return {r["name"]: r for r in rows}


def test_every_measurement_name_is_in_the_shared_catalog():
    rows = measure(skin(seed=2, spots=4, lines=6))
    assert set(rows) <= set(MEASUREMENTS)
    for r in rows.values():
        assert r["experimental"] is True
        assert r["unit"]
        assert r["calibration_status"] == "uncalibrated"


def test_more_pores_means_a_higher_pore_density():
    few, many = measure(skin(pores=60, seed=3)), measure(skin(pores=400, seed=3))
    assert many["pore_density"]["value"] > few["pore_density"]["value"] * 2.5
    assert many["pore_density"]["uncertainty"]["method"] == "Poisson count"


def test_bigger_pores_measure_bigger():
    small, big = measure(skin(pores=250, pore_r=(2.0, 3.0), seed=4)), measure(skin(pores=250, pore_r=(5.0, 7.0), seed=4))
    assert big["pore_size_median"]["value"] > small["pore_size_median"]["value"]


def test_redness_rises_with_redness_and_not_with_pores():
    base, red = measure(skin(seed=5)), measure(skin(seed=5, redness=1.0))
    assert red["redness_a_star"]["value"] > base["redness_a_star"]["value"] + 2
    assert red["redness_area"]["value"] > base["redness_area"]["value"]
    porous = measure(skin(seed=5, pores=500))
    assert abs(porous["redness_a_star"]["value"] - base["redness_a_star"]["value"]) < 1.5


def test_dark_spots_show_up_as_spot_area_and_contrast():
    clear, spotty = measure(skin(seed=6, spots=0)), measure(skin(seed=6, spots=10))
    assert spotty["pigment_spot_area"]["value"] > clear["pigment_spot_area"]["value"] + 0.5
    assert spotty["pigment_contrast"]["value"] is not None and spotty["pigment_contrast"]["value"] > 2


def test_no_spots_means_insufficient_data_for_contrast_not_a_number():
    assert measure(skin(seed=6, spots=0, pores=0))["pigment_contrast"]["value"] is None


def test_fine_lines_raise_line_density():
    smooth, lined = measure(skin(seed=7, lines=0, pores=80)), measure(skin(seed=7, lines=12, pores=80))
    assert lined["fine_line_density"]["value"] > smooth["fine_line_density"]["value"] * 1.5


def test_grain_raises_roughness_and_lowers_uniformity():
    fine, coarse = measure(skin(seed=8, grain=3)), measure(skin(seed=8, grain=14))
    assert coarse["texture_roughness"]["value"] > fine["texture_roughness"]["value"]
    assert coarse["texture_uniformity"]["value"] < fine["texture_uniformity"]["value"]


def test_uncertainty_bands_contain_the_value():
    for r in measure(skin(seed=9, spots=4)).values():
        u = r["uncertainty"]
        if r["value"] is not None and u and "ci95" in u:
            lo, hi = u["ci95"]
            assert lo <= r["value"] <= hi, r["name"]


def test_the_same_image_measures_the_same_every_time():
    a, b = measure(skin(seed=10)), measure(skin(seed=10))
    for k in a:
        assert a[k]["value"] == b[k]["value"], k


def test_resolution_matters_not_pixels_when_calibrated():
    img = skin(seed=11)
    half = img[::2, ::2]
    full = measure(img, um_per_px=40.0)
    halved = measure(half, um_per_px=80.0)
    assert full["redness_a_star"]["value"] == pytest.approx(halved["redness_a_star"]["value"], abs=0.5)
    assert full["pore_density"]["unit"] == "per cm²"


def test_too_coarse_for_pores_says_so_instead_of_guessing():
    rows = measure(skin(seed=12), um_per_px=150.0)
    assert rows["pore_density"]["value"] is None
    assert rows["pore_density"]["quality"] == "poor"
    assert "resolution" in rows["pore_density"]["why"]


def test_a_scar_outline_gives_colour_texture_and_area_only():
    img = skin(seed=13, pores=80)
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    scar = ((xx - 600) / 120) ** 2 + ((yy - 450) / 40) ** 2 <= 1
    img = img.copy()
    img[scar] = (img[scar] * np.array([1.08, 0.95, 0.95])).clip(0, 255).astype(np.uint8)
    poly = np.array([[600 + 120 * np.cos(t), 450 + 40 * np.sin(t)] for t in np.linspace(0, 2 * np.pi, 40)], np.float32)
    rows = {r["name"]: r for r in measure_scar(img, poly, "left_cheek", quality="good", um_per_px=50.0)}
    assert set(rows) == {"scar_contrast", "scar_texture_ratio", "scar_area"}
    assert rows["scar_contrast"]["value"] > 1.0
    assert rows["scar_area"]["value"] == pytest.approx(np.pi * 120 * 40 * (0.05 ** 2), rel=0.15)   # mm² at 50 µm/px


def test_working_scale_bases():
    assert working_scale(4000, um_per_px=5.0, points=None)["um"] == 10.0     # never finer than 10 µm/px
    assert working_scale(4000, um_per_px=None, points=None)["basis"] == "frame"
