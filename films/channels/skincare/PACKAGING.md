# Packaging: titles and thumbnails (owner's standing rule, 10 Nov 2026)

Applies to every NEW episode, short and long video on the four active channels: **Skin Sense, Reality Rulebook,
Possibility Lab, One More Orbit**. Body Backstage is paused and excluded.

The goal: a title and thumbnail that make a scroller think "wait... what? I need to know why", that are
completely true, and that the video fully pays off. Borderline clickbait in feeling, never in fact.

## The deliverable (per episode or long video)

Write `out/packaging.json` in the episode folder (for a long video: `compilations/<name>/packaging.json`) and render
the winning thumbnail in code. Prism reads `packaging.json` and shows the winner title and the ChatGPT prompt with
copy buttons, and uses the winner title as the YouTube title.

```json
{
  "version": 1,
  "format": "long | short",
  "hook": "the single most surprising, true fact in the script (one sentence)",
  "titles": [
    { "text": "...", "mechanism": "knowledge gap | contradiction | hidden mechanism | unexpected consequence | scale shock | unanswered question | visual paradox | personal relevance" }
  ],
  "thumbnails": [
    { "id": "A", "subject": "...", "composition": "...", "lighting": "...", "trigger": "...", "text": "0-4 words, or empty", "complements": "how it pairs with the title without repeating it" }
  ],
  "pairings": [
    { "title": 0, "thumbnail": "A",
      "scores": { "scroll": 0, "curiosity": 0, "clarity": 0, "synergy": 0, "originality": 0, "accuracy": 0, "mobile": 0, "satisfaction": 0 },
      "note": "..." }
  ],
  "winner": { "title": "exact final title", "thumbnail": "A", "thumbnailText": "", "why": "one or two sentences" },
  "testAndCompare": ["A", "B", "C"],
  "checks": { "halfSecond": true, "curiosity": true, "duplication": true, "competition": true, "truth": true, "satisfaction": true, "originality": true },
  "thumbnailFile": "<file name of the rendered winner in out/>",
  "chatgptPrompt": "a complete, self-contained image prompt for ChatGPT (see below)",
  "shortsCover": { "frameSeconds": 0.0, "text": "0-4 words" }
}
```

Five titles, three thumbnail concepts, three pairings. Scores are 1-100 creative judgments, **not CTR predictions**;
say so wherever they are shown. A check that fails means revise before rendering, never ship with a false.

## The workflow

1. **Hook.** Read the whole script and pick the single most surprising, counterintuitive fact the video proves.
2. **Five titles,** each on a different curiosity mechanism (list above).
3. **Three thumbnail concepts:** subject, exact composition, lighting and treatment, the emotional trigger,
   optional text (1-4 words), how it complements the title.
4. **Pair** titles with thumbnails and keep the three strongest pairs, judged as pairs.
5. **Score** each pair on the eight axes.
6. **Pick the winner** and say why in one or two sentences.
7. **Produce:** render the winner thumbnail in code at full quality, and write the ChatGPT prompt for it.

## Titles

- Short and front-loaded: aim for 35-55 characters, strongest words first, readable by a sixth grader.
- One dominant curiosity trigger. Natural, conversational. Questions or flat statements ("The Moon Starts
  Coming Closer. It Won't Stop.") both work.
- **The YouTube title is the winner title alone.** No "| Channel · Season · Episode" suffix: the series line lives
  in the description.
- Never generic ("5 Amazing Facts About Skin", "The Science Behind Gravity").
- Every word must be true of THIS video. Thought experiments keep their "What if" or are clearly hypothetical.

## Thumbnails

- One unmistakable focal point, strong hierarchy, intentional light and depth, generous negative space.
- Pass the **0.5-second test** at phone size (check it at 168x94 px).
- **Never repeat the title.** The thumbnail is the visual mystery and the title is the question or consequence.
  Thumbnail text is optional, 1-4 words, and adds a new layer.
- No clutter: one hook per image (see "The hook" below: a hand-drawn circle or arrow and a short question are now
  the house device, owner, 12 Nov 2026), never red circles, shocked faces, emoji or generic YouTube clichés.
  Every element earns its place.
- No series line, badges or episode chip on the thumbnail. An honesty label goes on only when the image would
  otherwise read as a real photo or measurement.
- Don't recycle a composition from the previous three episodes on the channel.
- **Long video:** 16:9, render 2560x1440 and export a 1920x1080 JPG under 2 MB (YouTube's custom-thumbnail limit).
- **Shorts, TikTok and Reels:** 9:16 cover, 1080x1920, focal point and text inside the centre safe area (clear of
  the bottom 25% and the right-hand buttons). The platform cover is a frame of the video on most surfaces, so
  `shortsCover.frameSeconds` names a frame that works as a thumbnail. The 9:16 cover JPG goes in out/ as now.

## The hook (owner's rule, 12 Nov 2026)

The owner wants every cover and thumbnail "thumbnail-worthy" and a little clickbait: a picture worth stopping for,
with one hand-drawn hook on it. Approved examples: Possibility Lab S2E05 (the tiny water ball against a giant
Earth, circled, "that's it?!") and One More Orbit S2E03 (the two neutron stars, the gold stream and a gold ring in
front, "your ring?!").

1. **The picture is a clean still from the film's own scene**, rendered for the cover: `render.mjs --times T
   --size 2160x3840 --clean` (or a cover-shaped `--size`), never a screen grab with captions, labels or counters.
2. **Make it worth clicking:** one subject, big; scale contrast pushed by the crop (zoom in, let the big thing run
   off the frame); a camera placed for the still; a secondary object left out of the still; light on the subject
   (`hook.py --glow/--halo`); colour pushed so the subject reads (a gold ring reads gold). Sizes, counts and events
   stay what the video shows.
3. **Sharp, never pixelated:** render stills at 2x; generate procedural textures larger for the still (Earth at
   4096 px, not 1024); no texture seams, stair-stepped coastlines or hard colour bands at cover size. Check the
   full-size file, not only the preview.
4. **The hook mark:** a loose hand-drawn circle and/or a curved arrow at the one surprising thing, plus a 1-3 word
   handwritten question in the channel's own hand and accent (`kits/cinema/film/hook.py`):
   - Possibility Lab: Caveat 700, marker `#E862FF`. One More Orbit: Permanent Marker, teal `#4FE3C6`
     (`space/fonts`, cover-only). Reality Rulebook and Skin Sense choose their own hand and accent at their first
     hook cover and record them here; never another channel's.
   - The question mark carries the honesty: no "(to scale)" or other footnote on the note (owner, 12 Nov 2026).
   - The note adds a layer; it never repeats the title or the cover text. Skin Sense notes follow its word rules
     (no disease, risk or damage words; no faces).
   - The marks never touch the title, the cover text or the subject. Check at 480 px wide and at 168x94.
5. **Keep each channel's layout:** Possibility Lab keeps `covers.py`'s plate (series line, title with the marker
   word, disclosure line), which the owner approved on S2E01, S2E04 and S2E05; One More Orbit keeps
   `season2/make_cover.py`'s look (night gradient, 0-4 words in Lexend 800, teal accent, no series line).

## Truth rules (non-negotiable)

- The picture shows what the video shows or explains: no event, object or scale the video does not deliver.
- No invented findings, no manufactured danger, no exaggeration past the evidence.
- A code-rendered or AI-generated image is never presented as a photograph of a real event or object. Mark it
  "Illustration" when it could pass for a real photo or measurement.
- The video's own claims standards apply to the title and thumbnail text: if the script hedges, the title can't
  be absolute.

## Channel visual DNA (stay distinct, never one template for all)

- **Skin Sense:** premium medical-editorial. Ivory page, the painted or 3-D skin in the series' one skin tone,
  peach and rose, deep green accent `#00685F`, navy serif type. Surprising anatomical close-ups and hidden processes.
  No faces for acne topics (inside a pore only). No disease, risk or damage words over skin art. No products,
  brands, before/after or advice. AI illustrations disclosed. **From Season 3** (SEASON-FORMAT.md): influenced by the Skin
  School course: soft, glowing voxel skin layers on a dark green-black ground, teal accent, small ivory serif.
- **Reality Rulebook:** physics that looks impossible. A daylight lab or an everyday room, one frozen moment
  (a splash crown, a bullet's shock cone, a light front), strobe ghost stamps, blue `#2F5BFF`. Clean and exact.
- **Possibility Lab:** an extraordinary but reasoned situation with you in it. A human-scale anchor against a
  dramatic consequence, one big readout number, magenta `#EB63FF` accents. The scenario must read as a thought experiment.
- **One More Orbit:** vast, beautiful, occasionally unsettling through real scale. Indigo night, teal light fronts,
  the light-time ring, violet `#5B3FD0`. No fabricated cosmic threats, and no render that could pass for a NASA photo.

## The ChatGPT prompt (`chatgptPrompt`)

A complete prompt the owner can paste into ChatGPT's image tool, for when an AI-painted thumbnail would beat the
code render. Write it in this shape:

```
Create a YouTube thumbnail, 16:9 (1920x1080) [or 9:16, 1080x1920 for a Short cover].
Subject: <one focal subject, described physically and accurately>.
Composition: <where the subject sits, scale, camera angle, negative space, rule-of-thirds placement>.
Lighting and treatment: <light direction, colour palette with the channel's hex colours, depth of field, texture>.
Mood: <the one emotion: wonder, disbelief, suspense>.
Text: <"exact 1-4 words" in <typeface style>, placed <where>> OR No text.
Scientific accuracy: <the facts the image must respect>.
Avoid: no arrows, circles, faces with exaggerated expressions, logos, watermarks, brand names, extra text,
or anything that looks like a real news or NASA photo.
Style: premium editorial science documentary, distinctive and art-directed, not generic AI art.
```

Image models garble long text, so keep the thumbnail text to 1-4 words, or add it afterwards in code.

## What's working (owner's observations; hypotheses until the analytics confirm them)

**10 Nov 2026: Possibility Lab S2E1 "How Long Would It Take to Walk to the Moon?"** was the first video posted, and the
owner reports it is pulling noticeably more traffic. The owner likes the thumbnail: the channel's figure walking
toward the Moon. Likely reasons, to apply on every channel:
1. **A human anchor in the frame:** a small figure, or a hand or finger (Skin Sense: never a face), *doing* the
   everyday action. Viewers picture themselves.
2. **The goal or destination visible:** the Moon, the far wall, the bottom of the jar. The question reads before
   the title does.
3. **Scale contrast:** a tiny "you" against something huge (or huge against tiny).
4. **A title about you doing something ordinary at an impossible scale:** "How long would it take to walk to the
   Moon?" Plain words, one question.
5. **Show the setup, never the answer:** the 26 years stays in the video.

How each channel applies it:
- **Possibility Lab:** keep the figure-on-a-journey thumbnails.
- **Reality Rulebook:** a hand or figure caught mid-action at the key frozen moment (letting go of the slinky,
  snapping the spaghetti, shaking the jar).
- **One More Orbit:** a tiny figure on the ground facing the cosmic thing: under the ringed sky, among trees under
  the stars, beside a clock near a black hole.
- **Skin Sense:** one hand, finger or forearm in that episode's skin tone doing the action (in water, in the
  cold), with no face.

Every cover is still a frame (or a re-cut) of what the video shows: the truth test doesn't change. Once Prism has the
numbers (impressions, CTR, average view duration), record here which of these held up. One video is a lead, not a
rule.

**12 Nov 2026: the owner's cover notes.** The owner likes the Possibility Lab S2E01 and S2E04 covers (the hero above the
graphite plate with the series line and the title). S2E05 and S2E06 had shipped as bare frames with no title and
were rebuilt in that layout; S2E05 was then pushed further to "clickbait": a tiny circled ball against a huge
Earth with "that's it?!", the Earth re-rendered sharper because the zoom showed its pixels. One More Orbit S2E03
got the same treatment ("your ring?!"). These are the owner's preferences, not yet measured: record the CTR here
once Prism has it.

## Learning loop

When real YouTube analytics exist, read impressions, CTR, traffic source, average view duration, 30-second retention
and satisfaction signals. Keep **measured** results apart from **hypotheses**. A higher CTR is not automatically
better: optimise for qualified clicks that turn into watch time. Use YouTube's Test & Compare with the three
thumbnails in `testAndCompare` when it is available on the account.
