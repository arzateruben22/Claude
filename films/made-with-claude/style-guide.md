# "Made with Claude — Breakout" · style guide

**Film:** 12.0 s · 30 fps · 360 frames · a 120 BPM grid (one beat = 0.5 s = 15 frames).
**Product / audience:** Claude (Opus 5.5) as a hands-on motion-design collaborator. It's for
motion designers, editors and creators scrolling social feeds or watching a launch reel.
**The one thing to remember:** *Claude can climb inside your editor and animate with you,
and this film was made with it.*

## 1. References inspected

Two uploaded films (`claude_visual.mp4` and `claude_visual_2.mp4`), both 1920×1080 at 30 fps,
12.05 s long, with a stereo AAC soundtrack.

| What | Observed | Carried into this film |
|------|----------|------------------------|
| Set | A motion-editor UI lying as a thin dark slab on a desk. A warm orange key light pools from behind; the corners go black. | Same set, built in 3D. The slab has a bevel and real thickness, and the UI panels are emissive screens. |
| Hero | "Clawd": a coral voxel creature with a rounded box body, two black slit eyes, side nubs and four stubby legs. It starts as a 2D pixel sprite (`clawd.png`) selected in the comp viewer. | A procedural rounded-box mascot in Claude coral `#D97757` (the reference Info panel literally reads R 217 G 119 B 87). Same pixel sprite in the viewer. |
| Story | Wide editor → push into the viewer → the sprite breaks out (shards) on the music drop → hops along the menu bar → types "glow" in Effects & Presets → rides the timeline, zapping keyframes with a light beam → lands next to the finished "MADE WITH CLAUDE · OPUS 5.5" card. | Same beats, re-timed to land exactly on the 120 BPM grid (§5). |
| Camera | A 35–50 mm feel with very shallow depth of field, fast whip moves with heavy motion blur, low angles that skim the UI surface, and a slow settle at the end. | One continuous virtual camera with keyframed position, target, lens and focus distance. Real sub-frame motion blur and bokeh depth of field. |
| Type | Title in a wide geometric heavy sans (Montserrat ExtraBold look), "OPUS 5.5" widely tracked, a coral starburst above and a coral swoosh under. UI in a neutral grotesk. | Montserrat 800/600 for the title card, Inter for the UI (both OFL, vendored). |
| Sound | 120 BPM electronic cue. A filtered intro with a riser into a full drop at 2.0 s. Hats on 8ths, plucky arps, a second riser into the end card, and a fade at about 11.9 s. Onsets cluster every 0.25 s. | Synthesized cue on the same grid, plus foley (hops, shatter, key clicks, zaps, keyframe dings) placed from the shared timeline. |

## 2. Palette

| Token | Hex | Role |
|-------|-----|------|
| Claude coral | `#D97757` | Mascot, starburst, swoosh, fill swatch, accents |
| Coral glow | `#F0A07A` | Bloom tint on coral elements |
| Desk shadow | `#0B0705` | Corners and vignette floor |
| Key-light amber | `#7A3E14 → #2A160B` | Backdrop gradient behind the slab |
| Slab graphite | `#1B1B1E` / bevel `#2A2A2F` | Device body |
| Panel | `#232326` · panel header `#1E1E21` · inset `#141416` | UI surfaces |
| UI text | `#C9C9CC` (primary) · `#8D8D93` (secondary) | Kept ≤ 0.8 luminance so only the title and beams bloom |
| UI blue | `#2D8CEB` (selection) · `#4DA3FF` (active text) | Selection, active tab, timecode |
| Layer labels | red `#E05252` · yellow `#E8C547` · teal `#5FC2A8` · violet `#8E7CD6` · sand `#C9A57A` | Timeline bars (from the references) |
| Beam / keyframe | `#E8F3FF` emissive | Light beam, keyframes, playhead |
| Title white | `#F4EFEA` | "MADE WITH CLAUDE", "OPUS 5.5" |

## 3. Typography

| Role | Face | Notes |
|------|------|-------|
| Title | Montserrat 800, tracking 0.02 em | White with a soft coral-white glow once "Glow" is applied |
| Subtitle | Montserrat 600, tracking 0.45 em | "OPUS 5.5" |
| UI | Inter 400/500/600 | Panel labels 13–15 UI px; the timecode is Inter 600 in blue |

## 4. Look and motion rules

- **Lens**: 28–55 mm equivalent. Depth of field always focuses on the mascot, or on the
  title in the last shot. The aperture opens on close-ups and closes on the wide shots.
- **Motion blur**: 180° shutter, sampled as sub-frames, so whip pans streak and hops smear
  at their apex speed.
- **Mascot physics**: hops are ballistic arcs, with stretch on take-off, squash on landing
  (scale Y 0.78, XZ 1.12), and a spring settle (about 0.25 s). It faces its direction of
  travel and looks at the camera on beats that matter.
- **Grid**: every landing, keystroke, zap and cut sits on an 8th or 16th note at 120 BPM.
- **Glow budget**: only the title (after Glow is applied), the beams, keyframes, playhead and
  shards may bloom. UI text never blooms.
- **Finish**: ACES tone mapping, a warm vignette, light grain and 0.4 px chromatic fringe at
  the frame edges.

## 5. Copy (taken from the references; nothing invented)

"MADE WITH CLAUDE" · "OPUS 5.5" · editor labels (File, Edit, Composition, Layer, Effect,
Animation, View, Window, Help · Project · Effects & Presets · Preview · Info · Main Comp ·
Active Camera · 1 View · Layer (none) · Footage (none) · Render Queue · Source Name · Mode ·
Parent & Link · Frame Render Time · Toggle Switches / Modes) · layer names (MADE WITH CLAUDE,
Spark, Swoosh, clawd.png, BG Solid) · project items (Main Comp, clawd.png, Solids, spark.svg) ·
search "glow" → Stylize ▸ Glow.

The editor is an **original, generic UI** drawn in code. It uses the references' layout and
vocabulary, but no third-party app logos or product names.

## 6. Formats

| Composition | Frame | Treatment |
|-------------|-------|-----------|
| `16x9` | 1920×1080 | The reference framing |
| `9x16` | 1080×1920 | Same scene and timeline. The camera keys are re-solved for a portrait lens: higher vantage points and a wider vertical field. The end card frames the comp viewer edge-to-edge, so the title spans about 85% of the width. Type stays out of the bottom 20% (platform UI). |
