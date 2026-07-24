# Studio Architecture — the Master System

This is the permanent architecture behind every website the studio builds. It is
**doctrine, not a framework**: a shared way of thinking and a catalog of proven,
reusable machinery — never a heavyweight build system bolted onto every client.

The studio's operating principle is **system-first**. We never think page by page.
Every feature, component, animation, token, and integration is designed to be
reused across industries. A new client site is *assembled* from this system and
then given a unique identity — it is not invented from zero.

> **Reference implementation:** the Taqueria Los Güeros site at the repo root is
> the canonical build. Everything documented here is grounded in code that ships
> there. When this doc and the code disagree, the code wins — update this doc.

## How this fits the studio process

`ARCHITECTURE.md` (this file) is the *why* and the *whole*. The step-by-step
*how* lives in the [`new-website` skill](../.claude/skills/new-website/SKILL.md).
The skill runs intake → design plan → reuse → verify → deliver; this doc gives
that process its shared vocabulary and its catalog. Deep references:

| Reference | Covers |
|---|---|
| [design-system-and-components.md](../.claude/skills/new-website/references/design-system-and-components.md) | Token architecture (color/type/space/radius/shadow), light+dark, and the full modular component library with the real CSS/JS anchors |
| [industry-modules.md](../.claude/skills/new-website/references/industry-modules.md) | Pluggable per-industry feature sets (restaurant, gym, beauty, medical, contractor, real estate, e-commerce, SaaS…) that snap onto the shared architecture |
| [backend-integrations.md](../.claude/skills/new-website/references/backend-integrations.md) | Auth/RBAC, payments, CMS, bookings, email/SMS, analytics — documented as swap-in layers that keep static-first as the default |

## The two hard constraints (they shape every decision)

1. **Static-first is the default.** No build step. Self-hosted fonts and GSAP.
   Relative asset paths (works under GitHub Pages subpaths). A site must render
   and be readable with JavaScript disabled; entrance/interaction states are
   layered on top from JS. We reach for Next.js / a server only when the client
   genuinely needs routes, auth, or a live backend — and we say why.
2. **Every client gets a unique identity.** We reuse the *quality bar and the
   machinery*, never a previous client's palette, type, or signature element.
   Los Güeros owns espresso `#100C09` / amber `#E8A356` / Cormorant + Jost. That
   identity is off-limits for anyone else.

## Think in layers — before writing any code

Every build is planned through these seventeen layers. Most are decisions, not
deliverables; the point is that none of them are skipped or discovered late.

| # | Layer | What we decide up front |
|---|---|---|
| 1 | Business strategy | Who this converts, the one primary action, the offer |
| 2 | Brand identity | Palette, type pairing, voice, one signature element |
| 3 | Information architecture | Sections, nav tree, URL/anchor scheme |
| 4 | User experience | The 2–3 flows that matter (order, book, inquire) |
| 5 | Visual design | Tokens instantiated into a distinct look |
| 6 | Component library | Which modular components this site assembles from |
| 7 | Animation | Reveal/hero/stagger via GSAP; reduced-motion first |
| 8 | Responsive system | Fluid type/space; verified at 1440 and 375 |
| 9 | Backend | None (static) unless a flow demands it — then which layer |
| 10 | CMS | Content in HTML by default; swap-in CMS only if the client edits |
| 11 | SEO | Semantic HTML, meta/OG, schema markup, sitemap, local SEO |
| 12 | Accessibility | The floor below is non-negotiable |
| 13 | Performance | Core Web Vitals; lazy media; self-hosted assets |
| 14 | Security | No real card data without a processor; no secrets in the client |
| 15 | Analytics | Privacy-respecting events on the primary conversion |
| 16 | Deployment | GitHub Pages / Netlify; per-deploy cache bump for the PWA |
| 17 | Scalability | Storage/UI seam so on-device state swaps to a backend cleanly |

## The accessibility & quality floor (never negotiable)

Applies to **every** build, every industry, from a $1.5k brochure to a $10k app:

- Contrast ≥ 4.5:1 for text; visible `:focus-visible` states; 44px touch targets.
- `prefers-reduced-motion` respected — the site is fully usable with motion off.
- Readable and navigable with JavaScript disabled.
- No emoji used as functional icons; real `lang` attributes on second-language text.
- English-first with optional second-language accents.
- **Never collect real card numbers without a connected payment processor.** The
  built-in card form stays in 4242 test mode until real `PAYMENT_LINKS` exist.
- Verify in a real browser (Chromium via Playwright) at 1440px and 375px, drive
  the key flows, screenshot, and fix what you see *before* showing the user.

## The 16-point delivery format

When we create or modify a site, we can account for all of these — scaled to the
project. A $1.5k brochure won't have a database; a $10k app will touch every row.

1. High-level project architecture 2. Information architecture & sitemap
3. Folder structure 4. Component hierarchy 5. Design system 6. User flows
7. Database schema (if any) 8. API structure (if any) 9. Third-party integrations
10. SEO plan 11. Accessibility checklist 12. Performance optimizations
13. Security considerations 14. Deployment strategy 15. Scalability roadmap
16. The production-ready implementation.

## Budget tiers (what "system-first" assembles at each price)

| Tier | What it assembles |
|---|---|
| ~$1.5k | Brochure page: tokens + nav/hero/sections/CTA/footer, reveal animation, contact form → mailto, SEO + a11y floor |
| ~$5k | Adds a menu/service/product section, **online ordering or booking**, richer GSAP motion, gallery |
| ~$10k | Adds **PWA install**, rewards/membership, mandatory payment + test-mode card form, on-device order history |

Higher tiers *add* modules to the same architecture — they never fork it.

## Reuse over rebuild — the studio's one rule

If a client needs a cart, a scheduler, a delivery gate, a rewards punch-card, or a
PWA, that machinery already exists and has shipped. Copy the pattern, swap the
tokens and content, re-skin. Building any of it from scratch for a new client is a
mistake unless the existing pattern genuinely can't flex to fit. When you extend a
pattern in a way the next client could reuse, fold the improvement back here and
into the [reuse map](../.claude/skills/new-website/SKILL.md).
