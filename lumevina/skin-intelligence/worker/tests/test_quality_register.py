"""Quality checks (fair across skin tones) and registration between visits."""

import cv2
import numpy as np

from lumevina_skin.color import cast_index
from lumevina_skin.quality import assess
from lumevina_skin.register import difference, register
from tests.synth import skin, warp

MONK = [(246, 237, 228), (243, 231, 219), (247, 234, 208), (234, 218, 186), (215, 189, 150),
        (160, 126, 86), (130, 92, 67), (96, 65, 52), (58, 49, 42), (41, 36, 32)]


def test_a_sharp_well_lit_image_passes_and_is_comparable():
    q = assess(skin(seed=1), source="camera", region="left_cheek", calibrated=False)
    assert q["passed"] and q["comparable"], q


def test_gross_blur_fails_even_on_a_first_capture():
    q = assess(skin(seed=1, blur=4.0), source="camera", region="left_cheek", calibrated=False)
    assert "blur" in q["flags"] and not q["passed"]


def test_smooth_but_sharp_skin_is_not_called_blurred():
    q = assess(skin(seed=1, grain=2, pores=0), source="camera", region="left_cheek", calibrated=False)
    assert "blur" not in q["flags"], q["metrics"]


def test_slight_blur_is_caught_against_the_clients_own_earlier_photos():
    sharp = assess(skin(seed=1), source="camera", region="left_cheek", calibrated=False)["metrics"]["sharpness"]
    soft = assess(skin(seed=1, blur=1.0), source="camera", region="left_cheek", calibrated=False, reference_sharpness=sharp)
    assert "blur" in soft["flags"], soft["metrics"]
    again = assess(skin(seed=9), source="camera", region="left_cheek", calibrated=False, reference_sharpness=sharp)
    assert "blur" not in again["flags"], again["metrics"]


def test_motion_blur_is_flagged():
    import cv2
    k = np.zeros((1, 15), np.float32)
    k[0, :] = 1 / 15
    q = assess(cv2.filter2D(skin(seed=1), -1, k), source="camera", region="left_cheek", calibrated=False)
    assert "motion" in q["flags"], q


def test_no_monk_skin_tone_is_flagged_for_exposure_or_colour():
    for i, tone in enumerate(MONK):
        q = assess(skin(seed=20 + i, tone=tone, pores=60, shading=0.0, grain=4), source="camera", region="left_cheek", calibrated=False)
        wrong = [f for f in q["flags"] if f in ("underexposed", "overexposed", "color_cast")]
        assert not wrong, f"Monk {i + 1} {tone}: {wrong} {q['metrics']}"


def test_a_blue_cast_is_flagged():
    img = skin(seed=2).astype(np.int16)
    img[..., 2] += 60
    img[..., 1] -= 25
    q = assess(np.clip(img, 0, 255).astype(np.uint8), source="camera", region="left_cheek", calibrated=False)
    assert "color_cast" in q["flags"] and q["passed"] and not q["comparable"]


def test_the_cast_rule_matches_the_websites():
    # js/skin/core/quality.js colorCast on the same averages
    flat = np.zeros((10, 10, 3), np.uint8)
    flat[:] = (205, 130, 195)
    assert cast_index(flat) > 0.5
    flat[:] = (215, 189, 150)
    assert cast_index(flat) == 0.0


def test_an_uncalibrated_microscope_image_is_not_comparable():
    q = assess(skin(seed=3), source="microscope", region="custom", calibrated=False)
    assert "no_calibration" in q["flags"] and not q["comparable"]


def test_registration_recovers_a_known_shift_rotation_and_scale():
    ref = skin(seed=4, spots=6, lines=4)
    mov, H_true = warp(ref, angle=4.0, scale=1.04, dx=25, dy=-15)
    r = register(ref, mov)
    assert r["ok"] and r["score"] > 0.8, r
    H = np.array(r["H"])
    # H maps mov → ref; H_true maps ref → mov, so H·H_true ≈ identity on interior points
    pts = np.array([[300, 300, 1], [900, 300, 1], [600, 600, 1]], float).T
    back = H @ (H_true @ pts)
    back /= back[2]
    assert np.abs(back[:2] - pts[:2]).max() < 2.0


def test_an_unchanged_region_shows_little_difference_and_a_new_spot_shows_up():
    ref = skin(seed=5, spots=3)
    same, _ = warp(ref, angle=2.0, scale=1.0, dx=10, dy=6)
    r = register(ref, same)
    d0 = difference(ref, same, r["H"])
    assert d0["summary"]["mean_delta_e"] < 2.0, d0["summary"]
    changed = ref.copy()
    yy, xx = np.mgrid[0:ref.shape[0], 0:ref.shape[1]]
    changed[((xx - 500) ** 2 + (yy - 400) ** 2) < 40 ** 2] = (changed[((xx - 500) ** 2 + (yy - 400) ** 2) < 40 ** 2] * 0.7).astype(np.uint8)
    moved, _ = warp(changed, angle=2.0, scale=1.0, dx=10, dy=6)
    d1 = difference(ref, moved, register(ref, moved)["H"])
    s = d1["scale"]
    spot = ((xx * s - 500 * s) ** 2 + (yy * s - 400 * s) ** 2) < (30 * s) ** 2
    spot = cv2.resize(spot.astype(np.uint8), (d1["delta_e"].shape[1], d1["delta_e"].shape[0]), interpolation=cv2.INTER_NEAREST).astype(bool) if spot.shape != d1["delta_e"].shape else spot
    inside = d1["delta_e"][spot & d1["confident"]].mean()
    outside = d1["delta_e"][~spot & d1["confident"]].mean()
    assert inside > 5 and outside < 2, (inside, outside)
    assert d1["overlay"].shape[:2] == d1["aligned"].shape[:2]


def test_a_brighter_photo_is_not_lighter_skin():
    ref = skin(seed=6)
    bright = np.clip(ref.astype(np.int16) + 18, 0, 255).astype(np.uint8)
    d = difference(ref, bright, np.eye(3))
    assert abs(d["summary"]["lightness_shift"]) > 3
    assert d["summary"]["mean_delta_e"] < 2.0
