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
| `media/grind.jpg` | Safety-vest work selfie — rock bottom, the tile job |
| `media/dec-2022.jpg` | Fitting-room mirror photo, December 2022 |
| `media/the-100s.jpg` | Incline-pressing the 100s — most recent |
| `media/stadium-mobile.jpg` | Brightened, car-centered crop used on phones (auto-generated from stadium.jpg) |
| `media/client-1.jpg` … `client-4.jpg` | Client progress shots — they join the proof ring automatically; missing ones are skipped |

The first is the hero atmosphere (it fades into the page's black); the other
four are the growth mosaic in "The Coach" section, in chronological order.
Until a file exists, its slot renders as a labeled dashed panel. After
changing photos, rerun `python3 build-artifact.py` to refresh the
single-file bundle.

## Connecting Stripe (5 minutes per link)

The Book buttons are wired for Stripe Payment Links. Open `js/main.js`,
find `STRIPE_LINKS`, and paste one URL per tier per payment mode. Any slot
left `""` keeps the tap-to-call fallback.

Creating the links at <https://dashboard.stripe.com> → **Payment Links**
→ **+ New**:

1. **Pay-in-full links (3)** — new product per tier ("Momentum — Monthly
   Coaching"), price $399 / $749 / $1,299, billing **Recurring, monthly**.
   The client subscribes and it renews until cancelled — matches
   "month to month, cancel anytime."
2. **Split links (3)** — Stripe Payment Links can't do 50/25/25
   automatically, so create a **one-time** link for the start amount
   ($199 / $375 / $649, name it "Momentum — Week 1 start"), and collect
   the two weekly payments with **Stripe Invoicing** (Dashboard →
   Invoices → send to the client's email; takes a minute each). Tip:
   in the link settings turn on "Collect customers' phone numbers" so
   you can text them.
3. Optional: in each link's payment-method settings enable **Klarna /
   Afterpay** — buyers get automatic installments without you managing
   anything.

Test each link in an incognito tab, then paste the URLs into
`STRIPE_LINKS` and rerun `python3 build-artifact.py`.

## The scheduler

The "Lock in session one" section lets a visitor pick a day and time and
sends the request as a prefilled text to (714) 353-3126, including their
chosen plan and payment mode. Edit availability at the top of the
scheduler block in `js/main.js`: `OPEN_DAYS` (0 = Sunday), `SLOT_TIMES`,
and `DAYS_AHEAD`. Plan buttons without a Stripe link scroll here.

## Going fully live (Stripe + Supabase)

`js/booking-live.js` is the Lumevina calendar engine ported for SchFLR.
It sleeps until configured; the full setup (SQL table, security
policies, where the keys go) is written step-by-step in that file's
header comment. Once `SUPABASE_URL` + `SUPABASE_ANON_KEY` are pasted
there and `STRIPE_LINKS` is filled in `main.js`:

- booked slots show struck-through and unclickable for every visitor,
- "I paid — text my slot" writes a pending booking that closes the
  slot instantly,
- you confirm or cancel bookings from the Supabase table editor
  (cancelled slots reopen on their own).

Note: `tel:`/`sms:` buttons are blocked inside the Claude preview
frame's sandbox; the site detects that and shows a copyable contact
card instead. On real hosting the buttons dial/text natively.

## Things to fill in before launch

1. **Stripe links** — see above; buttons fall back to calling
   (714) 353-3126 until then.
2. **Socials** — there's a TODO in the footer if you want Instagram public.

## The hero calendar

The "One month, three ways" panel is the signature: each tier drawn as a
month, with your training days as filled orange squares (4 / 8 / 12
sessions). It comes straight from the pitch on the About page — "Two
sessions a week is 8 in a month." If tier session counts ever change,
update the `.on` squares in `index.html` so the calendars stay honest.
