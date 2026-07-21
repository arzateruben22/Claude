# Lumevina — Go-Live Guide (plain English)

This is the whole path from "demo site" to "real bookings and real money,"
written for a human, not a programmer. Nothing here is urgent — do it at your
own pace. Where a step is mine, it says so.

**The big picture in one sentence:** you already have the website; we add two
free accounts (a card processor and a database), I connect the wires, and your
site starts taking real deposits and tracking real numbers.

---

## Before anything else: write down your "before" numbers ⏳

This is the one time-sensitive thing. Once you switch off Acuity, its history
becomes your "before" picture — and you can only prove growth if you captured it.

**You do this (15 minutes, today-ish):** open Acuity and jot down, for the last
few months:
- How many bookings per month
- Roughly what % are repeat clients
- Your no-show rate
- Your average ticket (what a typical visit spends)

Keep that somewhere safe. That's your baseline. Skip this and six months from
now you'll have great numbers with nothing to compare them to.

---

## The three accounts you'll use

| Account | What it's for | Cost |
|---|---|---|
| **Netlify** | Hosts your website (you already have this — `lumevina.netlify.app`) | Free |
| **Stripe** | Processes card payments, sends money to your bank | Free to start · ~2.9% + 30¢ per charge |
| **Supabase** | The database — remembers bookings, points, availability | Free at your size |

---

## Part A — Get the newest version of the site onto Netlify

Your Netlify site is live, but it's showing whatever version you last uploaded.
The dashboard and latest fixes need to be deployed. There are two ways your
Netlify might be set up — here's how to tell and what to do for each.

### First, check which kind you have

Log into **netlify.com** → click your Lumevina site → look at the top tabs.
- If you see a **"Deploys"** tab that mentions **GitHub**, you're on the
  *auto-deploy* setup (Option 1).
- If you originally **dragged a folder** onto Netlify, you're on the *manual*
  setup (Option 2).

### Option 1 — Auto-deploy from GitHub (best; set once, forget forever)

If it's connected to GitHub, every time I push an update, your site updates
itself. You just need it pointed at the right folder:

1. In your site → **Site configuration → Build & deploy → Build settings**.
2. Set **Base directory** to `lumevina` (our files live in that subfolder).
3. Leave **Build command** empty, set **Publish directory** to `lumevina`.
4. Save. Netlify redeploys, and now `lumevina.netlify.app/dashboard.html` works.

*(One note for me: the finished work is on a working branch. I'll make sure the
branch Netlify watches has the latest — that's my side.)*

### Option 2 — Manual drag-and-drop (simplest, no GitHub)

1. I hand you the finished `lumevina` folder (a download).
2. Go to **netlify.com** → your site → **Deploys** tab.
3. Drag the folder onto the box that says **"Drag and drop your site folder
   here."**
4. Done — it's live in about 30 seconds. You repeat this whenever there's an
   update.

Either way, once done: your site — including the dashboard — is live at your
Netlify address.

---

## Part B — Create the two new accounts

You don't need to configure anything technical here. Just create them and keep
the login safe; I'll tell you exactly which buttons to press when we wire it.

### Stripe (the card processor)

1. Go to **stripe.com** → **Sign up**.
2. Enter your business details (name, address, bank account for payouts) to
   **activate** the account — this is what lets real money reach your bank.
3. That's it. Don't touch the settings — when we wire it, I'll point you to the
   exact keys to copy.

### Supabase (the database / "notebook")

1. Go to **supabase.com** → **Sign up** (use your email).
2. Click **New project**, give it a name (e.g. "Lumevina"), and set a database
   password. **Write that password down** — you'll need it once.
3. That's it. Leave the rest alone.

---

## Part C — Connecting everything (mostly my side)

This is where the wires get connected. Here's the honest split:

**You do (about 20 minutes total, guided):**
- Tell me the Stripe and Supabase accounts exist.
- When I ask, copy a few specific keys from those accounts and paste them into
  **Netlify's settings panel** (and Supabase's) — I'll show you the exact
  screens. These keys go into settings panels **only** — never into a text
  message, never onto the public site.

**I do:**
- Set up the database tables in Supabase (the booking calendar, points ledger,
  availability).
- Swap the demo payment engine for real Stripe.
- Connect the booking calendar to real availability (so slots grey out for
  everyone the moment they're taken).
- Wire the dashboard to show your **real** numbers instead of samples.
- Put the dashboard **behind your login**, so only you can open it.

**Then, together:** we make one real test booking with a test card to confirm
money flows and the booking shows up — before you announce anything.

---

## What you end up with

- **Your site**, taking real 50% deposits, at `lumevina.netlify.app`.
- **One shared calendar** — no more double-bookings; slots grey out live.
- **Your dashboard** at `lumevina.netlify.app/dashboard.html`, behind your
  login, showing real revenue, rebooking, no-shows, app-vs-web, and rewards.
- **Where to look, day to day:** your dashboard for the summary · **supabase.com**
  for individual records · **stripe.com** for the money.

Clients only ever see the public site and their own account — never your
numbers.

---

## A note on keys and safety 🔒

Some of the keys you'll copy are like house keys — they must stay private. The
rule is simple: **secret keys go into the settings panels I point you to, and
nowhere else.** Never paste them into a chat, an email, or anywhere on the
public website. I'll always tell you which are safe-to-share (publishable) and
which are secret.

---

## When you're ready

Do Part A and Part B whenever it suits you — they're independent and low-stakes.
When both accounts exist, tell me, and we'll do Part C together in one sitting.
The App Store app comes after this (it needs this same backend first) — the
`APP.md` file covers that leg.
