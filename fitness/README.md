# SchFLR — Personal Training Site

A one-page site for Ruben's personal training business (SchFLR): private,
one-on-one coaching in Anaheim, three monthly tiers. Same recipe as the
taqueria site — static HTML + CSS + vanilla JS with GSAP, no build step.
Host anywhere that serves static files (Netlify, Vercel, GitHub Pages), or
use it as the blueprint when rebuilding the Squarespace page.

## Files

| Path | What it is |
|------|-----------|
| `index.html` | All page content — hero, backstory, plans, guarantee, results, FAQ |
| `css/styles.css` | Design system (night/bone/orange palette, gold guarantee) |
| `js/main.js` | Nav, mobile menu, GSAP animations |
| `js/vendor/` | GSAP 3.12.5 + ScrollTrigger (self-hosted) |
| `fonts/` | Big Shoulders Display, Archivo, IBM Plex Mono (self-hosted woff2) |
| `media/` | Empty — photos go here (see below) |

## What's already real

Pulled from the original SchFLR Squarespace site:

- The three tiers with real pricing: Foundation $399 / Momentum $749 /
  All-Access $1,299 per month, with each tier's training, nutrition, and
  support details.
- The guarantee, word for word.
- The backstory ("Started from zero") from the About page.
- Contact info: (714) 353-3126 and arzateruben22@gmail.com — every
  "Book" button is a tap-to-call link.

## Photos

Five photos power the page. Drop them in `media/` with these exact names and
every slot fills in automatically (no HTML edits needed):

| File | The shot |
|------|----------|
| `media/stadium.jpg` | Black Benz outside Angel Stadium at night — hero background |
| `media/beginning.jpg` | Bathroom-mirror photo from near the start |
| `media/grind.jpg` | Safety-vest work selfie — the grind years |
| `media/dec-2022.jpg` | Fitting-room mirror photo, December 2022 |
| `media/the-100s.jpg` | Incline-pressing the 100s — most recent |

The first is the hero atmosphere (it fades into the page's black); the other
four are the growth mosaic in "The Coach" section, in chronological order.
Until a file exists, its slot renders as a labeled dashed panel. After
changing photos, rerun `python3 build-artifact.py` to refresh the
single-file bundle.

## Things to fill in before launch

1. **Photos** — see above.
2. **Booking link** — buttons currently call (714) 353-3126. If you set up
   online scheduling (Squarespace Scheduling, Calendly), point the `href`s
   there instead.
3. **Socials** — there's a TODO in the footer if you want Instagram public.

## The hero calendar

The "One month, three ways" panel is the signature: each tier drawn as a
month, with your training days as filled orange squares (4 / 8 / 12
sessions). It comes straight from the pitch on the About page — "Two
sessions a week is 8 in a month." If tier session counts ever change,
update the `.on` squares in `index.html` so the calendars stay honest.
