# Season format: one long film, eight parts (owner's decision, 10 Nov 2026)

Applies to Reality Rulebook, One More Orbit and Possibility Lab from their next season on. Skin Sense stays
short-form (1:01-1:15 story shorts), but its seasons are 8 stories that share one thread, so a long film can be made
from them later. Body Backstage is paused and excluded.

Why: YouTube mid-roll ads need a video of at least 8:00. Every stitched Season 2 long video is 7:07-7:31, so none
qualified. Long-form watch hours are also what unlock the Partner Program (shorts views don't count toward the
4,000 hours).

## A season is one long film and its 8 parts

1. **Write the long film first, as ONE story.** One question that escalates and never resets (the day keeps
   shrinking, the Moon keeps coming, the second keeps slowing). Never glue finished shorts together, because every
   short ending is a place where viewers leave.
2. **8 chapters of about 65 s**, plus a short cold open and close, so the film runs **8:30-9:30** (never under 8:00).
3. **No chapter cards and no "1, 2, 3".** Each chapter ends on an open loop that the next chapter answers
   ("...and at twelve hours, it gets much stranger").
4. **Retention devices:**
   - a live number the viewer waits to see hit its end
   - a "wait, what?" twist at about 60%
   - the payoff in the last minute
   - a last shot that loops back to the first
5. **One scene, two renders:** 16:9 for the long film (2560x1440, plus the 1080p upload) and 9:16 for the parts
   (1080x1920, readouts relaid for portrait). Never stretch or crop one into the other.
6. **The 8 parts are the 8 chapters, cut from the 9:16 render.** Each part:
   - runs **1:01-1:15**, over a minute for TikTok Creator Rewards
   - opens with its own 2 s hook line in place of the long film's bridge line
   - ends with its cliffhanger line, then "Part N of 8. Full video on YouTube."
   - says "Part N of 8" once, at the end, not on screen the whole time (the declutter rule still applies)
7. **The ending belongs to the long film.** Part 8 stops just before the payoff. The climax or twist appears only
   in the long film.
8. **Packaging** (films/channels/PACKAGING.md): one packaging.json for the long film (16:9 thumbnail) and one per
   part (9:16 cover).
9. **Posting order** (the owner still posts by hand): the long film goes up first, so every part can link to it
   (YouTube Shorts' related-video link; "link in bio" elsewhere). Then one part a day.

## Files (so Prism imports and links everything)

- Long film: `films/channels/<channel>/compilations/<film-slug>/` with `<film-slug>-16x9.mp4`, the 1440p version,
  `description.md` (title line and chapter list), `packaging.json` and the thumbnail. Prism registers it as a long
  video ("lesson").
- Parts: the next free `films/channels/<channel>/epNN/` folders, one per part, each with script.md, claims.json,
  film.json, `out/` (the 9:16 final, cover and packaging.json) as for any episode.
- Prism links parts to the film only if each `description.md` chapter title matches a part's title exactly, so
  keep them identical.
- Push each with push-one.sh (`compilations/<film-slug>` or `epNN`), then POST the import.

## Voice

Reality Rulebook and One More Orbit keep the AI voice. Possibility Lab uses the owner's own voice: each film adds
8 hook lines and 8 cliffhanger/outro lines to the owner's recording script (films/channels/voice-scripts/), and
the AI voice stands in until the recordings land.

## Every long video is at least 8:30 (owner, 10 Nov 2026)

This applies to every long video on every channel, new or rebuilt. Aim for **8:30-9:30**, so mid-roll ads are always
possible with margin. A long video that would land under 8:30 gets **real content added, never padding**:
- an opening hook (15-25 s) that states the thread connecting the whole video
- **bridges** between segments (6-12 s each): a cliffhanger line that links one topic to the next, so it plays as
  one story rather than "1, 2, 3"
- a **finale** (25-45 s) that pays the thread off: a ranking, a comparison of all the answers, or a closing "wait,
  what?" fact
Never stretch with slowed-down footage, silence, long holds, repeats or recaps of what was just shown. That hurts
retention, and YouTube's repetitive-content policy targets it. Every added line is fact-checked like any other.

### Season 2 long videos, stretched with bridges
- **Possibility Lab** S2 long video (7:31): add an opening, 5 bridges and a finale, to about 8:30-8:45.
- **Skin Sense** S2 long video: rebuilt from the 3-D episodes once ep12 is done, with an opening, bridges and a
  finale, to at least 8:30.
- **Reality Rulebook** (7:28) and **One More Orbit** (7:07): revived with bridges to at least 8:30, but only after
  each channel's Season 3 long film and its 8 parts are done.

## Season 2

The Season 2 shorts finish their declutter re-renders and post as normal. Their stitched long videos follow the 8:30 rule above: they are rebuilt with bridges, not glued as they were.
