# Prism Studio layout, round 2

On 30 Oct the owner asked to "keep customizing the layout of prism studio". This brief is for the layout session, which works on branch `claude/prism-studio-layout`, made from `claude/made-with-claude-film`.

## Context
Prism Studio is the owner's control room for five science channels. Before starting, read `prism-studio/CLAUDE.md`, `README.md`, `PROJECT_STATE.md`, `DECISIONS.md` and `RUNBOOK.md`. The RUNBOOK covers local setup (`service postgresql start`, env, import) and "Clickable preview".

The owner works from an **iPhone**, through a static preview that the coordinator publishes from `scripts/static-preview.cjs`. Videos in that preview are rewritten by `scripts/static-preview-media.cjs` so they play from the artifact's media store. Keep every video a plain `<video … src="…">` in the exported HTML so that rewrite still applies.

Keep the identity (the night NYC skyline, the wall of six monitors with Instagram in the centre) and extend it; don't re-theme it.

## Goals, in order
1. **Phone-first Review.** The owner's main job is watching and approving, so on a phone, Review and the episode view become a full-screen vertical player:
   - one episode at a time;
   - swipe, or tap next/previous;
   - Approve and Hold within thumb reach;
   - title, caption and sources below;
   - the platform versions as small switches.

   Desktop keeps a grid. The page must still work in the static export and stay readable without JS.
2. **The two new channels get their own identities** on the wall and on their `/m/[slug]` screens. Their names are final: "Outer Layer" and "Back of the Envelope".
   - **Outer Layer** (`skincare`): a light "slide" look.
     - Colours: ground #EEF2F1, ink #13252C, water #00685F, uv #9135A8.
     - Fonts: Newsreader and Red Hat Text.
   - **Back of the Envelope** (`whatif`): "graphite and marker".
     - Colours: graphite #131417, marker #EB63FF, tally #3DDC84, ballpoint #4DA3FF.
     - Fonts: Bricolage Grotesque and Figtree, plus JetBrains Mono for figures.
   - The fonts are on the channel branches: `films/channels/skincare/fonts/*.ttf` on `claude/outer-layer-s1`, and `films/channels/whatif/fonts/*.ttf` on `claude/back-of-the-envelope-s1`. Convert them to woff2 in `prism-studio/public/fonts`, with their OFL licences.
   - Set their colours in `src/domain/catalog.ts`: skincare #00685F, whatif #EB63FF. The coordinator adds `filmsPath` and the import SLATES when episodes land, so leave those alone.
3. **Season progress at a glance** on each monitor, from the database: for example, "Season 1 · 4 of 6 ready". A channel with nothing imported yet shows "Season 1 in production" and its six titles, never invented numbers.
   - Outer Layer: The dead layer · Does SPF 100 beat SPF 50? · Bath fingers · What a tan is · Same cells, every colour · Goosebumps.
   - Back of the Envelope: Through the Earth · Everyone, one place · All the ants · Count to a billion · Everybody jump · Every cat at once.
4. **Polish on a 390 px phone.** Fix anything on the wall or the screens that still looks templated:
   - spacing and type scale;
   - tap targets of at least 44 px;
   - safe areas (notch, home bar);
   - the installed-app (PWA standalone) look.

## Rules
- Touch only `prism-studio/`. Leave `films/`, `kits/` and the Los Güeros site at the repo root alone.
- Before each push:
  - `npx tsc --noEmit`, `npm test` with Postgres running, and `npm run build`, all clean;
  - Playwright at 390 and 1440 px (it's preinstalled; never install another), with no console errors;
  - before and after screenshots in `prism-studio/docs/preview-gallery/`.
- Accessibility floor: 4.5:1 text contrast, a visible focus state, `prefers-reduced-motion` respected, and readable without JS.
- Self-hosted fonts only. Add no new runtime dependency unless it's essential.
- Leave the domain logic (metadata, publishing, rewards, connectors) unchanged.
- Run one independent review agent per goal (design and accessibility at 390 and 1440). Verify its findings before acting on them.
- Update `CHANGELOG.md` and `PROJECT_STATE.md`.
- When each goal lands, message the coordinator (session_01QoHo6s2RxqYM5nTnh8pa5q): one paragraph, the screenshot paths and the commit. The coordinator merges your branch and publishes the preview for the owner.
- Nothing is posted or uploaded anywhere. No pull requests, and no model names in commits or files.
