# Scorecard: Skin Sense No. 006, "Same list as cigarettes"

## Look 2 rebuild (2 Nov, first real draft)

Rebuilt in the owner-approved look test 2 (`../../s1v2/BUILD-LOOK2.md`), on the facts-pass-2 script (vo lines
unchanged). Four hero shots (`storyboard.md`): the list as an engraved slate plate in haze; deep-tone skin under the
canopy of UVA tubes; the UV switch-off (the cyan scan line on "Whole countries acted"); the cut face, the tissue photo with
UVA dashes and the gauge. Channel renamed to Skin Sense (ID `skin-sense-006`, series line and follow chip).

**Measured (draft, 15 fps):**
- **Mix:** −14.1 LUFS / −1.9 dBTP (AAC), LRA 3.1; music under voice −29.0 vs dialog −13.5 LUFS (gap 15.5 LU, pass);
  phone mono loss 0.08 dB (dialog), pass.
- **Sync:** PASS (cell.land 0.1 ms, counter.show 0.0, reveal 12/57 ms, scale 0.0, scale.jump 0.0, section 0.0,
  signature 8/11 ms, swell 2/2 ms, zap 0.0).
- **Script lint:** 0 errors, 0 warnings (`--segment toscale`).
- **Labels:** at most two small labels at once and one corner note at a time (asserted in `compile.py`).

**Honesty on screen:** "IARC Group 1 · excerpt"; the plate's line "ranks the strength of evidence, not the size of
risk" (lit on "sure", relit for the takeaway); "large, powerful units" + "UVA vs midday sun · may be ×10–15";
"pooled studies · 2012 (corr.) · 2007" + "relative risk · first use < 35: 1.59 · 1.75"; "model, not a photo" on the
switch-off; "tissue photo · rays simplified" on the cut face; years on screen only; no advice.

**After the draft (coordinator's rules, 3 Nov), not yet re-rendered as a full draft:**
- Duration: the draft ran 76.07 s; the delivery window is 60–75 s. Picture-only holds trimmed in `script.md`
  headings only (normal 0.5 → 0.3 s, change 0.6 → 0.3 s, toscale 0.5 → 0.3 s, takeaway 0.5 → 0.3 s; no vo line
  touched; why 2.0 s, whoa 3.0 s and the end card 1.6 s are at or near lint's floors): film.json now 74.20 s, lint 0/0.
- The cut face's badge now reads "tissue photo · rays simplified"; the texture is shown once (repeat 1, 1; no
  rotation, crop or tiling). The slide's pale background now shows as a thin band above the stratum corneum.

**Open:**
- The stained micrograph is the public-domain H&E section used by the look test; a person confirms its licence on
  the Commons page. Its stain colours are not a skin tone; the block's top surface carries the episode's deep tone.
- The tag pair on the switch-off ("Australia · 2015", "Brazil · 2009") sits beside the corner note "model, not a
  photo": two labels plus one note.
- The far skin under the canopy melts into violet haze; a reviewer may want more skin and less shaft in the change.
- Dermatologist sign-off on every line before posting (unchanged).

## Review round 1 fixes (3 Nov; scored on the 76.07 s draft: a 3, b 4, c 3, d 3, e 4, f 3, g 3, h 2)

- **Ethics:** from "started" the camera tilts up off the skin into the canopy and the focus racks onto the tubes by
  "pooled"; no skin is in frame under the melanoma figures (storyboard rows 6–7).
- **Facts:** "Australia · 2015–16" (c9 note updated); the plate's evidence line is set larger than the rows, on two
  lines; "model, not a photo" on the canopy until "large, powerful units"; beat headers in `script.md` match the build
  (headers only, no vo line touched).
- **Production (episode objects only; the shared pass in `../set/prod.js` via `lookV2` brings the skin, hairs, fog
  and grade):** a bevelled slate slab, tilted, engraved, with recessed cyan inlays, a violet rim from a defocused tube
  bank, haze volume, background bokeh and foreground dust; frame 0 starts mid-rack on the slab with no duplicate
  caption under the title; 3D tubes (core, glass, reflector housing, acrylic), god rays, exponential fog, hair drift,
  baked occlusion; the switch-off on one shader with a soft seam: the left bank flickers out and the whole left half
  goes dark, the right bank rims across, a cool fill and afterglow after "Brazil", the dark held ~1.8 s before a cut on
  the music grid; the cut face three-quarters with a darker deep-tone top, 16 thicker dashes crossing a traced
  epidermis–dermis line with a flash, the gauge over the dermis on the right.
- **Ending and layout:** the tobacco and beds rows relight to full on "Same list"; the spines sit below the corner notes
  and the excerpt note leaves before "certainty"; the end card sits over the plate, racked out of focus, under a light
  scrim.
- Solar radiation's year is hidden until "sun"; the years column is headed "year listed".

**Round 1 draft (74.20 s, 15 fps; channel look `prod.js` + `hudv2.js` folded in):**
- Sync PASS: cell.land 0.1/0.1 ms, counter.show 0.5/1.0 ms, reveal 12.0/57.0 ms, scale 0.0/0.0 ms, scale.jump 0.0/5.0 ms,
  section 0.0/0.0 ms, signature 8.0/11.0 ms, swell 2.0/2.0 ms, zap 0.0/0.0 ms.
- Mix: −14.1 LUFS / −2.0 dBTP (AAC), LRA 2.9; music −29.2 vs dialog −13.6 LUFS (gap 15.7 LU, pass); phone mono loss 0.07 dB.
- Render audit: 0 warnings; 1.77 s/frame at draft; lint 0/0.
- Open: the switch-off's left half reads as a soft darkening rather than a clear split; the cut face is close (the face
  fills most of the frame, the block's top reads brown but flat); the spines' notes are drawn as the card's header row
  (note above spine) because a note-under-spine card would push the spine out of the safe box.

## Review round 2 fixes (3 Nov; scored a 3, b 4, c 3, d 3, e 4, f 3, g 4, h 2)

- **Ethics:** the risk spine and its note hard-out 0.75 s before the cut to the skin, so their fade ends by about
  41.5 s; no frame of skin carries the figure.
- **One deep tone:** skin albedo lowered (DEEP 0.095, 0.05, 0.03 linear), a warm grazing bounce added, the violet bank
  light, fill and environment cut in the canopy; the UV lilac darkened.
- **Canopy:** the flat haze wall removed (the terrain runs into fog); the flat shaft cards replaced by soft volumetric
  cones from the tubes; tubes ignore fog so they read as the light source.
- **Switch-off:** seen from above the canopy, both banks cross the frame and the seam runs down the middle with a
  narrow soft falloff; an "off" bank's cores and glass go dark in frame; the right half stays lilac until "Brazil";
  a cool fill and a 20% floor keep pores legible after.
- **First 2 s:** the slab at about 65% of the frame width, centred under the title; a bank of bright tubes behind
  and below it; the lit rows drawn bright enough to bloom.
- **Cut face:** a portrait block (photo cropped through the UVs) seen three-quarters from further back, its top a
  deep-tone relief with pores; the gauge over the lower dermis with dashed leader lines registered to the surface and to
  the traced boundary; the paper bar paper-white; the paper column moved right.
- **Section cut:** stays on the music grid 1.8 s after "too", now with a shutter sound; motion-blur samples no longer
  cross a cut (no one-frame bleed).
- **Nice:** a slow sideways drift in the sunburst, a rack pulse on "half", a faint tube flicker, the spine in on
  "half"; "Australia · 2015–16" with an en dash.
- Shared look v3 (`set/look3.js`): skin (`skinV3` with the canopy's low key), hairs, grain; no local overrides.
