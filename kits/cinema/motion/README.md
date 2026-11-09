# Motion control for stills (2.5-D parallax)

Makes a still feel filmed: real parallax between depth layers, rack focus, soft light sweeps, a little life, drifting particles, and
labels that stay on their structure through every move. Restrained by design: one move per beat, none while the viewer reads.

Two parts:

1. `layers.py` splits a picture into three layers with a monocular depth model (Depth Anything V2 small, ONNX, CPU, ~5 s a picture;
   weights are fetched once to `~/.cache/cinema-depth`, set `CINEMA_DEPTH` to move them). The background layer has the near areas
   filled in from their surroundings, so nothing shows through when a layer moves.
   `python3 -I kits/cinema/motion/layers.py <pictures…> [--cuts auto|0.4,0.8] [--feather 6] [--mask hand-drawn.png] [--depth-only]`
   writes `<name>-depth.png` and `<name>-L0/L1/L2.webp` (L0 background, L1 middle, L2 foreground) next to each picture.
   `auto` cuts: an Otsu split, then the nearest 30 % of what is left. For a plate the model gets wrong, draw a grey mask
   (white = near) and pass `--mask`, or send the layers' pictures back to the artist as "foreground element only on plain ivory".
2. The engine (`films/channels/skincare/set/ss3.mjs`, ivory/navy look) reads the layers from `episode.json`. Run
   `set/art_index.py <ep>` after writing the layers so the engine finds them.

## episode.json

```json
"images": { "q3": { "src": ["art/x-03.webp"], "layers": ["art/x-03-L0.webp","art/x-03-L1.webp","art/x-03-L2.webp"], "par": [0,0.55,1], "blur": 9 } },
"camera": [ { "t": "start:vo03", "img": "q3", "s": 1.0, "f": [0.5,0.5], "trk": [-0.01,0], "dolly": 0, "rack": 1,
              "anchors": { "muscle": [0.58,0.56] } } ],
"labels": [ { "text": "Muscle", "a": "muscle", "img": "q3", "layer": 2, "t0": "vo03:muscle", "t1": "vo03:nerve", "off": [120,-130] } ],
"sweeps":    [ { "img": "q2", "t0": "vo02:signal", "t1": "vo02:tighten+0.8", "a": 0.55, "w": 0.1, "ang": 105 } ],
"particles": [ { "img": "q5", "n": 16, "a": 0.5 } ]
```

* `trk: [x, y]` lateral track, in picture widths (0.012 is plenty); the layers move by `par` × that, so the far layer holds still and the
  near layer travels. `dolly` adds a scale of `dolly × par` per layer (a push-in with parallax); `s`/`f` are the usual whole-picture zoom and focus.
* `rack` is the layer in focus (0 background, 1 middle, 2 foreground, fractions in between); the others blur by up to `blur` px.
  Leave it out for no depth of field. Keyframes interpolate (ease, 0.9 s); words are the clock, as everywhere in ss3.
* `labels[].layer` makes a label's anchor follow that layer, so the pill and leader line track the structure through the move.
* Layers also breathe a pixel or two on their own (no flashy motion); `sweeps` are a soft-light band gliding over the picture; `particles`
  are slow foreground specks that follow the track at 1.4×.

## House rules for the moves

One move per beat, motivated by the sentence: a push-in on the key word, a rack from the surface to the nerve. A move every 2–4 s,
still while a label or a line is being read. No constant zoom, no shake, no glow. Crossfading two pictures of the same framing
(relaxed → contracted) is the cheapest "morph": give both keyframes the same `s`, `f` and `trk`.
