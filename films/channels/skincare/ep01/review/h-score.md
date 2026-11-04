# Skin Sense No. 001: (h) production value

Judged from the 15 final stills in `review/final-stills/`. They are 540×960; the shipped mp4 is 1080×1920 at 30 fps.
Bar: "a very high multi million dollar production budget aesthetic". A frame fails if any part of it reads as a
default 3D render, a template or a stock preset.

## (h) = 2 / 5

The design system is coherent: violet plates, the mono honesty notes, the viewfinder HUD and the gauge read as one
family. That is the one criterion close to the bar. Almost no frame passes on light, material or lens:

- **The cheek, UV and daylight shots (0.5, 4, 9, 14, 63, 66).**
  - The cheek is a flat, evenly lit oval of noise with dots, cut out against violet, and has no form.
  - There is no key, fill or rim light, no skin topology, no subsurface scattering, and no lens.
  - It reads as a 2D texture card, not as skin under a camera.
- **The follicle, pair and rupture shots (20, 30, 41, 44).**
  - The follicle is a smooth, untextured lathe shape with plastic sheen, set against a flat photo backdrop.
  - The white cells are identical, evenly shaded spheres (default PBR balls) with no contact shadow, no depth of
    field and no secondary motion.
  - The spill is a pile of matching beige beads.
  - The dermis "volume" is a flat brown slab above the photo, with a hard horizontal edge (30).
- **The marrow stream (48).** It reads as a stock preset: identical glossy spheres drifting on a violet gradient.
  - There is no volumetric light, no depth of field and no sense of scale or place.
  - It has the least detail of any shot, and it carries the film's biggest number.
- **The sheen on "barrier" (69.5).** The sheen is a hard-edged pale rectangle sliding in from the left edge of the
  oval. It reads as a compositing glitch, not as light.
- **The to-scale card (56, 60).**
  - Flat infographic: dots, a bar and a dashed outline on an empty violet panel.
  - Clean, but it looks like a template, and it holds 6 s with no texture, light or motion detail.
- **The lens and the grade across the film.**
  - Grade: there is no single grade. The pink tissue photo (20–45) and the violet HUD world (0–16, 48–75) look like
    two different films.
  - Lens: there is no motion blur in any still and no depth of field outside the dive (16–17).
  - Composition: the camera mostly frames objects head-on in the centre; there are no lit, staged compositions.

## What a production pass would need

The minimum to reach a 4:
- relight every 3D shot with key, fill and rim, plus one volumetric shaft;
- give the cells subsurface scattering and varied membranes;
- replace the follicle shape with a sculpted, textured one;
- run cinema3d.js's depth-of-field, motion-blur and bloom finish on every 3D shot;
- apply one grade that ties the tissue and violet worlds together;
- replace the stream and the sheen with lit, volumetric versions.
