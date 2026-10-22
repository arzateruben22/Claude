# Measurement validation: the repeatability protocol

No measurement is trusted to say a client's skin changed until this protocol has shown how much that measurement moves when nothing about the skin has. Until then it is shown, labelled **Experimental**, and never produces an "improvement" or "deterioration".

## Why

Two photos of the same skin, minutes apart, never measure exactly the same: the head is a little closer, the light lands differently, the camera picks a different exposure and white balance, focus shifts. A "change" smaller than that photo-to-photo variation is noise. The protocol measures the noise, per measurement, area and kind of device, and turns it into a threshold.

## The statistic

For each measurement, area and device kind, with several people photographed several times:

* **within-subject SD** `Sw = √(mean over people of each person's variance across their repeats)`
* **repeatability coefficient** `RC = 1.96 × √2 × Sw`. 95% of differences between two captures of unchanged skin are smaller than RC.

A later difference smaller than RC is **no meaningful change**. Larger, in the direction the measurement calls better or worse, is **improvement** or **deterioration**, and goes to the practitioner for review before a client ever sees it. (`js/skin/core/change.js`; `skin-intelligence/worker/lumevina_skin/repeatability.py`.)

A result is marked **validated** only with at least **5 people × 3 repeats** and some variation between repeats (a measurement that never varies is too coarse to give a threshold; that happens today with the median pore size, whose blob scales are quantized).

## The capture protocol

1. **People.** At least 5 consenting volunteers (staff or friends, with the photography consent), covering a range of skin tones. More is better: 8–10 gives a steadier threshold.
2. **Skin.** Untreated that day: no treatment, peel, exfoliation, makeup or new product in the previous 24 hours. Same time of day for all repeats.
3. **Setup.** The studio's normal setup: the phone on its fixed mount, the studio LED on, blinds as usual. A grey card in the frame for colour.
4. **Repeats.** For each person and each area (front, cheeks, forehead, nose, chin; any microscope sites you use), take **3–5 captures, re-positioning fully between each**: the person stands up, sits back down, the practitioner lines them up again with the capture guide. Do not take a burst; the point is to include real re-positioning.
5. **Each device kind separately.** Phone, USB microscope and dermatoscope each need their own run. A microscope needs its calibration (micrometres per pixel) entered first.
6. **Organise the files** as `captures/<person>/<area>/<any name>.jpg`.
7. **Run** `python skin-intelligence/worker/scripts/repeatability.py captures/ --device phone --out results/` and read `results/repeatability.md`. Captures that fail the quality check are skipped and listed.
8. **Publish** with `--publish` (needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) once the numbers make sense. The studio's Admin → Validation shows what is validated. Re-run after any change to the capture setup, the device or the algorithm version (results record both).

## What the synthetic dry run shows (not a validation)

`python scripts/repeatability.py --synthetic` runs the whole pipeline on generated images with simulated re-positioning (±3°, ±3% scale, ±20 px), exposure (±6%), white balance (±2%), slight defocus and sensor noise. It exercises the tooling and refuses to publish. Its one useful lesson: **colour measurements are the most fragile**. Redness varied 8–12% between repeats under small exposure and white-balance changes, against 3–5% for texture, tone and pores. Expect the real protocol to show the same; the grey card and fixed lighting are what keep redness thresholds small.

## Known limitations

* **Uncalibrated photos** (phones) are measured per working pixel at a normalized scale (outer eye corners 1000 px apart for face views, 1200 px wide for close-ups). One client's visits compare well when photographed the same way; values are not comparable between clients or devices, and the UI never compares them.
* **Pores and fine lines need resolution.** Below about 80 µm per pixel (pores) or 120 µm (lines) the worker reports "Insufficient data" rather than a number. Face photos from a phone at arm's length are usually too coarse for pores; close-ups and microscopes are not.
* **Blur is judged relative to the client's own earlier photos** of the same area; no absolute sharpness threshold separates smooth sharp skin from textured skin out of focus (tests demonstrate it). The first capture of an area relies on a low floor and the practitioner's review.
* **The on-device checks are advisory.** Fair across all ten Monk Skin Tone colours in the tests; the worker's checks on the original are the authoritative ones. Both should be re-checked on real photos of the full range of skin tones during the protocol.
* **Scars**: colour contrast, texture ratio and outlined area only. Depth, volume, 3D shape and translucency are not measured from photographs and the UI says so.
* **Difference maps** match overall brightness first and hatch areas where the two photos don't line up locally; residual differences in lighting direction can still show as colour difference. They are for looking, not for measuring.
