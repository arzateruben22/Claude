# Series bible: Outer Layer (skin channel), reboot

Prism Studio slug `skincare`. Name decided by the owner on 27 Oct 2026. Season 1 as first made (the "slide" look) was
replaced by the owner on 2 Nov 2026 ("the designs are too boring and the facts need to be more compelling"); it is
kept, never posted, in `shelved-s1/` with its bible. The owner picked this look the same day from three rendered
concepts (`concepts/`): **A, the UV camera, with B's macro flights.**

## 1. Promise and audience

**Promise:** *Skin biology, ingredients and routines, with the evidence on the screen.* Each episode is one thing about
the organ you live inside, told in about 70 seconds, every number sourced.

**Audience:** curious adults who want to understand their skin, not be sold to.

**Tone:** calm, precise, kind. A myth is corrected by showing the mechanism, never by mocking the person who believed
it. No advice, no diagnosis, no products, no brands, no before/after of real people, no "you have X".

**Skin tones (owner-approved, 2 Nov):** each episode's world is drawn in **one** melanin level, rotating across the
season (light, medium, deep, then around again). Never change tone inside an episode's story: a tone change on a line
about risk, behaviour or illness reads as linking that tone to it. The UV reveals carry a **daylight strip** of three
tones (light · medium · deep) when the subject applies to all skin; that strip never pairs a tone with a risk line.
No lethality or disease line over a face or skin of any particular tone (coordinator, 3 Nov): a death or disease line
over a person reads as a statement about that person. Put it on a non-skin shot that shows what the sentence says
(an object, a molecule, a chart, a tissue photo), and bring the skin back when the subject is ordinary skin again.

**Honesty, always on screen:** every comparison is labelled **"model, not a photo"**; illustrations say so; time
compressions are badged ("weeks, compressed"); results in animals or single studies say so ("in mice", "one study",
"rat skin"); debated findings are badged "debated". No title or label claims more than the source does (the sunscreen
trial is **4.5 years**, not ten).

## 2. The look: "UV camera + macro flight"

Two modes, cut together in every episode:

- **The reveal (the signature): the UV camera.** The skin seen through a 365 nm camera viewfinder: the surface glows
  violet, what absorbs UV (sunscreen, pigment) reads dark, damage the eye can't see shows as freckles, and what the
  episode is about lights in cyan. Corner brackets, `● REC  UV 365 nm`, a split line when two halves are compared.
  At least one reveal per episode, always on the episode's whoa or its payoff.
- **The movement: the macro flight.** A drone over skin terrain at golden hour: the fine diamond grid of furrows,
  pores as craters, hairs as trees, a warm low sun with a rim, soft distance (depth of field, kept modest). Flights
  carry the story between reveals; they cut **below the surface** only for the mechanism (a follicle, the weave, a
  capillary), as a cut-face section in the same warm light.

**Palette (theme.json; contrast computed, WCAG 2.x):**

| Token | Hex | Use |
|---|---|---|
| `bg` / `slide` | `#2C1660` | The ground: a clear violet (pushed off indigo so it never reads as Light Minute's navy) |
| `slide-low` | `#20104A` | The ground's lower edge |
| `card` | `#3A2178` | Caption, label, badge and gauge plates (93%) |
| `text` / `ink` | `#F7F3FF` | Words said, labels, values (13.8:1 on bg, 11.5:1 on plate) |
| `text-2` | `#D9CCFA` | Words to come, notes (10.0 / 8.4:1) |
| `water` (the instrument) | `#5FF2E8` | Cyan: the UV instrument, the word being spoken, the thing named (11.0 / 9.2:1) |
| `uv` | `#C3A6FF` | Lilac: the UV glow on skin, secondary values (7.3 / 6.1:1) |
| `uv-glow` / `water-glow` | `#8B5CFF` / `#3EE6E0` | 3D only: the glowing skin and the cyan light (never under text) |

The macro terrain is warm (the skin's own tone in golden light); its overlays keep the violet plates, so every frame
reads as the same channel. Never Lumevina's black, rose or gold; no gold accent anywhere.

## 3. Type

Red Hat Mono 700, upper case, for the series line, titles and end cards (the instrument's voice); Red Hat Text 600 for
captions and labels; Red Hat Mono 500 for numbers and honesty notes (tabular). All OFL, self-hosted in `fonts/`.

## 4. Motif

- **The viewfinder:** corner brackets in cyan, `● REC  UV 365 nm`, half labels at the bottom when two halves are
  compared (`set/uvcam.js`). It frames every reveal and the title.
- **The daylight strip:** three tone discs (light · medium · deep) on a plate, "in daylight", under a reveal when the
  subject applies to all skin.
- **The depth gauge** (from season 1, `set/motif.js`) stays for the "to scale" segment, in the new tokens: a µm ruler
  with a sheet of paper (≈ 100 µm) as the everyday reference.
- **Segment "toscale":** kept (lint `--segment toscale`).
- **End card:** the violet ground with the viewfinder brackets, the next episode's question in Red Hat Mono, the
  footnote with the AI-voice label, the follow chip "Outer Layer · No. NNN".

## 5. Sound

Unchanged from season 1 (`studio/vibes/outerlayer-slide.json`): F major, 64.2857 BPM (a 16th = 7 frames), the soft
breathy **reed** lead (sparse long tones), low pad, a sub only for the whoa; the reed signature F5 → C6 → A5 on the
title, the gauge's last value and the end card. New foley allowed: a soft camera *shutter* (`knock`, short, high-cut)
on each UV reveal. No bells, plucks, pings, mallets, blips.

## 6. Narrator

**bf_isabella** (Kokoro), per-line speeds in each episode's `voice.py`, aligned with `kits/cinema/voice/align.py`.
"Narration: synthetic voice (AI)" on every end card.

## 7. The set

| Block | File | What |
|---|---|---|
| UV skin | `set/uvcam.js` | `createUVSkin()`: a domed skin surface shaded as a 365 nm photograph (pores, grain, sun freckles by `damage`, sunscreen dark by `screen`, a cyan `focus` mark, a split seam); `createViewfinder()`: brackets, REC, half labels; `createDaylight()`: the three-tone strip |
| Macro terrain | `set/terrain.js` | `createTerrain()`: the microrelief (two families of furrows), pore craters, hairs, pigment spots; `set({ tone, furrows, spots, sheen })`; the golden-hour rig (sun, fill, fog) |
| Section | `set/section.js` | Season 1's cut-face section (cells, layers, vessels), used for the below-surface cuts in the warm light |
| Gauge, title, end | `set/motif.js` | Season 1's gauge, title and end bars, in the new tokens |
| Rig | `set/rig.js` | The orbit camera (slow arcs; flights may use `pos/look` keys) |

## 8. Episode template

As season 1 (WRITING.md story standard and its Flow rules): a frame-0 payoff hook asked in 2 s, normal → change →
why → whoa → toscale → takeaway → tease; one spine readout from the hook to the end; match cuts or pushes at every
cut; the named thing the brightest; ≤ ~3 s on one composition. Every claim in `claims.json`; `review/` carries
HUMAN-REVIEW.md, CLAIMS-REVIEW.md and the scorecard (the compelling pass, seven scores, the ratchet: each episode at
least as good as the one before, every score ≥ 4 before a final).

## 9. Season 1 (reboot)

Scripts and claims from the second builder (`s1v2/`, jaw-drop pass by the coordinator); order and tease chain in
`s1v2/SEASON.md`.

| No. | Topic | Built by |
|---|---|---|
| 001 | Pimples: "The fight you never saw" | first builder |
| 002 | Glow: "Where a glow comes from" | first builder |
| 003 | Scar: "What's in a scar" | first builder |
| 004 | Botox: "The deadliest dose" | second builder |
| 005 | Sunscreen: "The sunscreen experiment" (4.5-year trial) | second builder |
| 006 | Tanning beds: "Same list as cigarettes" | second builder |

## 10. Sign-off

Nothing posts until a person has opened every source and a **board-certified dermatologist** has signed every claim
(`review/CLAIMS-REVIEW.md`). The owner approves every post in Prism Studio.
