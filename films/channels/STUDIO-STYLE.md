# Studio style sheet (shared by Claude and ChatGPT)

One page. Each channel's full look is in its `bible.md` (read it before making anything for that channel).

## Channels and where the look lives
| Channel | Folder | Accent in Prism Studio | Full look |
|---|---|---|---|
| Reality Rulebook | physics | #2F5BFF | physics/bible.md |
| One More Orbit | space | #5B3FD0 | space/bible.md |
| Possibility Lab | whatif | #EB63FF | whatif/bible.md |
| Body Backstage | body | #FF6F5E | body/bible.md ("live scan" look: abyss teal-black ground, chartreuse #D6F25F scanner) |
| Skin Sense | skincare | #00685F | skincare/bible.md |

Every channel keeps its own palette and type. Never recycle one channel's identity in another.

## Quality gate (every episode, scored 1-5 by a reviewer)
(a) the first 2 s hook; (b) one thread from hook to payoff; (c) the picture moves with the sentence;
(d) motivated camera; (e) the voice carries meaning and the screen carries figures; (f) rhythm; (g) the ending;
(h) production value (no default 3D render, template or stock look).
Pass = no score under 3, (a), (g) and (h) at 4 or more, nothing factual or ethical open.

## Words
Friend-speak: plain words first, a technical term only when it earns its place and is explained in the same breath.
Comparisons beat counts. Open on a "wait, what?" by 2 s and pay it off. Tie it to the viewer's body or day.
Hedge exactly as far as the source goes (mouse data is not "your body"; "up to", "about"). No medical advice;
Skin Sense captions carry "Education, not medical advice".

## Facts
Every claim goes in the episode's claims list with a source. A claim is OK only when a person has opened the source.
Anything checked only from a search excerpt stays OPEN. Numbers a viewer hears must match the screen.

## Process rules
Nothing posts without the owner. No passwords, codes or API keys in chat (they go in settings). No real card data.
Placeholders (phones, emails, prices, hours) are marked TODO and listed in every handoff.

## Handing an episode to Prism Studio
Finished files per episode: the 9x16 master (mp4), cover jpg, captions per platform, claims list, SRT.
Claude pushes through the studio's media-push API. ChatGPT cannot stream big files through a GPT Action, so
its episodes go in through the studio's Upload page, then Review.
