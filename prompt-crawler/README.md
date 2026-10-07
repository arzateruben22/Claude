# Prompt Crawler

A spider that reads a prompt one section at a time. Every word becomes a point
in a web; the spider walks it, links the words that make the prompt checkable,
and flags the ones that leave the reader guessing. At the end it hands you the
questions to ask before anyone builds: *ask, don't guess*.

It opens on `studio.prompt`, the studio's own website-build brief, so the
first thing you see is a real crawl.

## Open it

Double-click `index.html`. No server, no install, no build step.

To send it as one file (to a phone, a client, anywhere):

```bash
python3 pack.py                 # writes prompt-crawler.html
```

## Crawl your own prompt

Click **studio.prompt** in the top-right corner (or **Crawl your prompt** at
the end), paste a prompt or open a `.txt`/`.md` file, and press **Crawl it**.

Start each part with a heading so the crawler knows where it is:

```
# role · who the studio works for
# objective · one site · one manual run
# context
# roles
# rules
# review
# start
```

Anything after ` · ` becomes the subtitle. `## Role`, `**Rules**`, `Rules:` on
its own line and `<rules>` tags work too, and so do common synonyms (Team,
Constraints, Success criteria, Background…). A prompt without headings still
works: the crawler sorts each sentence by its wording and counts it under
**guessed**.

## What it marks

| Mark | Meaning | Examples |
|---|---|---|
| **link · owner** | someone is responsible | owner, team, client, chief, staff |
| **link · claim** | a statement with a source | source, traceable, cite, evidence |
| **link · approval** | someone signs it off | approve, signs, confirms |
| **link · spec** | a number, size, file or color | 4.5:1, 1440, $5k, index.html, #E8A356 |
| **flag · vague** | sounds like a spec, isn't one | full, complete, clean, modern, fast, some, etc. |

Each flag becomes one question, phrased by what is missing: *“clean” how?
Point to a reference site, a color or a typeface.* A missing section is a flag
too (*No review. How will the result be checked before it ships?*).

**Spec score** (0–100): each of the seven sections is worth 100/7 points, earned
as it is read. A section shorter than 12 words earns part of its share, and
each vague word in it takes off 12% (it never drops below 40%). A missing
section earns nothing.

## Controls

- **Tabs** jump straight to a section; **ship** jumps to the results.
- **pause** / **1x**: pause the crawl (or press Space) and change its speed.
- **Copy questions** puts the list on your clipboard, with where each word appears.
- With reduced motion turned on, the camera and the spider cut from place to place instead of gliding.

## Files

| File | What it does |
|---|---|
| `index.html` | page markup, plus the built-in `studio.prompt` |
| `analyze.js` | splits a prompt into sections and sorts every word (no DOM; tested) |
| `crawler.js` | the web, the spider, the camera and the six panels |
| `crawler.css` | the console look |
| `pack.py` | bundles everything into one HTML file |

## Tests

```bash
node --test test/*.test.mjs
```
