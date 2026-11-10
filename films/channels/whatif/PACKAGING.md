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
- No clutter: no arrows, red circles, shocked faces or generic YouTube clichés. Every element earns its place.
- No series line, badges or episode chip on the thumbnail. An honesty label goes on only when the image would
  otherwise read as a real photo or measurement.
- Don't recycle a composition from the previous three episodes on the channel.
- **Long video:** 16:9, render 2560x1440 and export a 1920x1080 JPG under 2 MB (YouTube's custom-thumbnail limit).
- **Shorts, TikTok and Reels:** 9:16 cover, 1080x1920, focal point and text inside the centre safe area (clear of
  the bottom 25% and the right-hand buttons). The platform cover is a frame of the video on most surfaces, so
  `shortsCover.frameSeconds` names a frame that works as a thumbnail. The 9:16 cover JPG goes in out/ as now.

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
  brands, before/after or advice. AI illustrations disclosed.
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

## Learning loop

When real YouTube analytics exist, read impressions, CTR, traffic source, average view duration, 30-second retention
and satisfaction signals. Keep **measured** results apart from **hypotheses**. A higher CTR is not automatically
better: optimise for qualified clicks that turn into watch time. Use YouTube's Test & Compare with the three
thumbnails in `testAndCompare` when it is available on the account.
