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

## Things to fill in before launch

Search `index.html` for `TODO`:

1. **Coach photo** — add `media/coach.jpg` and swap the placeholder in the
   "The Coach" section for the `<img>` tag in the comment next to it.
2. **Before/after photos** — the Results section has two placeholder pairs;
   drop your transformation shots in `media/` and swap them in.
3. **Booking link** — buttons currently call (714) 353-3126. If you set up
   online scheduling (Squarespace Scheduling, Calendly), point the `href`s
   there instead.
4. **Socials** — there's a TODO in the footer if you want Instagram public.

## The hero calendar

The "One month, three ways" panel is the signature: each tier drawn as a
month, with your training days as filled orange squares (4 / 8 / 12
sessions). It comes straight from the pitch on the About page — "Two
sessions a week is 8 in a month." If tier session counts ever change,
update the `.on` squares in `index.html` so the calendars stay honest.
