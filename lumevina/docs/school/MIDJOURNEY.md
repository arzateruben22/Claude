# Skin School: real footage from Midjourney

The opening animation is a slice of skin. The **cut face** (cells, collagen, the
drops sinking in) stays animated in code, because that's the part that has to be
accurate and labeled. The **top of the slice** can be real-looking skin footage:
a short clip laid back in 3D so it reads as the top of the block. Until a clip
is added, the page looks exactly as it does now.

Don't ask Midjourney for a skin cross-section. It will invent layers, cells and
vessels, and a course taught by a licensed esthetician can't show anatomy that's
wrong. Use it for what it's great at: the surface of real skin, up close.

## What to make

| Clip | Where it goes | Needed? |
|---|---|---|
| 1. Skin surface, low angle | The top of the slice in the opening animation | Yes |
| 2. Serum drop landing on skin | Level 2 panel and lessons, later | Optional |
| 3. Glowing, even skin | Level 3 panel and lessons, later | Optional |

## Step by step (clip 1)

1. **Style reference.** Drag `reference/skin-style-reference.jpg` into the
   Imagine bar and mark it as a **style reference**. It carries the warm
   rose-peach light and the black background. If results look too illustrated,
   lower its weight (`--sw 50`) or leave it out.
2. **Image.** Paste the image prompt below. From the four results, pick the one
   with the most natural texture (visible pores, no plastic shine), then upscale
   it (Subtle).
3. **Animate.** Choose **Animate → Manual**, paste the motion prompt, and pick
   **Low motion**. If there's a **Loop** option, turn it on. Extend once if you
   want a longer clip (about 8–10 seconds is ideal).
4. **Download** the video at the highest quality offered, and the still image.
   Send both over. They get prepared (made to loop, compressed for phones, a
   Safari version and a fallback still) with `prepare_media.py`.

Midjourney's video options change often. If something below doesn't match what
you see, the idea is the same: a still first, then a slow, calm animation of it.

### Clip 1 · skin surface

Image:

```
extreme macro photograph of healthy human skin, seen at a low grazing angle as a smooth surface receding into soft darkness, fine natural pores and delicate micro-texture, faint peach fuzz catching the light, dewy healthy glow, unretouched natural skin, warm peach and rose tones, soft warm studio light raking across from the left, shallow depth of field, pure black background at the far edge, luxury skincare campaign, photorealistic, ultra detailed --ar 16:9 --style raw --v 7 --no text, watermark, logo, makeup, hair, face, blemishes
```

Motion:

```
a slow band of soft warm light glides across the skin from left to right, tiny highlights shimmer in the pores, the camera stays almost still with a very slow gentle push in, calm and seamless --motion low
```

### Clip 2 · serum drop (optional)

Image:

```
extreme macro photograph of a single clear glossy serum droplet about to touch smooth human skin, visible pores and fine natural texture, warm rose and peach light from the side, black background, shallow depth of field, luxury skincare campaign, photorealistic, ultra detailed --ar 16:9 --style raw --v 7 --no text, watermark, logo, face
```

Motion:

```
the droplet slowly falls, touches the skin and spreads into it with a soft ripple, slow motion, the camera stays still --motion low
```

### Clip 3 · glowing skin (optional)

Image:

```
macro photograph of smooth, even, luminous cheek skin, soft healthy glow, unretouched natural texture, warm rose light, a gentle highlight along the cheekbone, black background, shallow depth of field, luxury skincare campaign, photorealistic, ultra detailed --ar 16:9 --style raw --v 7 --no text, watermark, logo, makeup, face
```

Motion:

```
a soft glow slowly blooms across the skin as light glides over it, very slow, the camera stays still --motion low
```

## If it doesn't look right

- **Plastic or airbrushed:** add `unretouched, visible pores, natural skin texture`
  and lower `--stylize` (for example `--s 50`).
- **Too orange or too pink:** add `neutral balanced skin tones`.
- **Too busy:** add `minimal, calm, simple composition`.
- **Skin tones:** consider a few versions in different skin tones. The page can
  be set up to rotate between them, so every client sees skin like theirs.
- **Soft or blurry video:** upscale it (for example with Topaz Video) before
  sending, or send it as is and it'll be prepared at the best quality it allows.

## Adding a clip

```
python3 docs/school/prepare_media.py path/to/clip.mp4
python3 docs/school/build.py
```

This writes `media/skin-top.webm`, `media/skin-top.mp4` and `media/skin-top.jpg`
next to `school.html`. The page finds them on its own.
