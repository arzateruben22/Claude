# UI brief — the single screen

For whoever builds the front end. The server, data rules and JSON API are finished;
this is what the screen must do with them. Read `API.md` first (especially §2 and §6).

## 1. What it should feel like

A fast, premium, iPhone-first **single screen**. No page navigations, no multi-page
app: everything expands or slides in place. Three members are visible together the
moment it loads, as floating game-style avatars on individual stands, with the
leaderboard directly beneath.

## 2. Rules that are not negotiable

| Rule | Because |
|---|---|
| No inline `<script>`, no `style=""` attributes, no inline event handlers, no third-party assets except Google's sign-in script. Fonts and images are self-hosted. | The Content-Security-Policy blocks them (`API.md` §2). |
| Never a currency symbol or a money word for points. The piggy bank holds neutral tokens — stars, gems, sparks — not coins with symbols. | Points are virtual and have no cash value. |
| Show the `disclaimer` text from the payload somewhere always reachable. | Same. |
| Verification wording is fixed: **Verified by the platform** / **Reviewed by an admin** / **Not verified**. A claim with `simulated: true` reads **Verified (simulated)**. | The product never overstates what was checked. |
| `demo_mode: true` → a persistent "Sample data — platform checks are simulated" strip. `auth_mode: "dev"` → "Sign-in is simulated". | Same. |
| Platform statistics (`videos[].stats`) live in their own block labelled with source and fetch time. They are never placed inside, next to, or styled like the points/XP/rank figures. | They do not affect points, and platform terms restrict mixing them into scores. |
| Limits are shown, not hidden: a `platforms.*` item with `status: "unsupported"` (above all "which people liked a video") appears as a stated limit. A failed stats refresh or platform check shows the adapter's message. | Honest failure states are an acceptance criterion. |
| Status is never conveyed by colour alone; every chip has words. | Accessibility. |
| There is no field anywhere for typing a YouTube channel id. | It may only come from the member's own Google consent. |
| Nothing in the UI rewards, counts or celebrates likes, comments, views, shares, follows or subscriptions. | Product rule. |

## 3. Layout (design at 390 px wide first, then widen)

1. **Top strip** — product name (placeholder), month chip (`period.month`), account
   menu: sign out · download my data · erase my data.
2. **The stage** — three avatars on stands, gently floating. Each shows name, tier
   badge, a ring or bar for progress to the next tier (`tier.progress`), total points,
   and a rank medal. The viewer's own avatar is marked (`is_you`).
   Tapping an avatar **expands it in place** to show:
   - earned / bonus / pending points, XP, the five-stage ladder with the current stage lit
   - recent public activity (`recent_activity`; "show more" → `GET /api/members/:id/activity`)
   - for the member themselves and admins: monthly cap usage, their own submissions with
     decision and verification chips and any review note
   - for the member themselves: the **contribute** form (below)
3. **Leaderboard** — rank, small avatar, name, points, XP, tier. Ties share a rank.
4. **Contribute** (member) — pick a task; then either pick a tracked video and write
   feedback, or paste a link to your own video. Show the daily allowance
   (`viewer.submissions_today`). Handle inline: `409 duplicate_claim`, `422
   evidence_too_short` (with the minimum), `429 rate_limited`, and for creative
   submissions the returned `check` result in plain words.
5. **Videos & statistics** — the labelled platform block from §2.
6. **"What can be checked"** — collapsible plain-language list from `platforms`.
7. **Admin drawer** (admins only), sections:
   review queue (flags, re-run check, approve, reject with note; `409 cap_exceeded` explained) ·
   ledger (bonus, adjustment, reverse — generate a fresh `Idempotency-Key` each time a
   form is opened and reuse it for retries of that form) · videos (add by link, refresh,
   archive) · tasks · tiers · settings · members and sign-in accounts · competitions ·
   audit log · integrity status.
8. **Footer** — disclaimer; placeholders for terms and privacy links.

## 4. States to design

Signed out (Google button; or, in dev mode, e-mail + code form) · loading skeleton ·
empty (no activity yet) · network error with retry · session expired (`401` → sign-in)
· not allowed (`403`) · duplicate / cap / rate-limit messages · decision chips (pending,
approved, rejected, withdrawn, revoked) · verification chips (three, plus simulated) ·
a tier-up moment · erase-my-data confirmation (type `ERASE`) · reduced motion.

## 5. Avatars and evolution

- Art slots are keyed by `avatar_key` (per member) and `tier.art_key` (five stages).
  Until authorised photos arrive, use original, abstract game-style placeholders — not
  likenesses of real people and not existing game characters.
- Five visibly different evolution stages per avatar; names and thresholds come from the
  payload and may change, so never hard-code them.
- Real photos, when supplied, must not go in `public/` (they would be readable without
  signing in). They need a signed-in-only route; that is a server task to add then.

## 6. Motion and performance

- Animate `transform` and `opacity` only; 150–250 ms for transitions; the float loop
  pauses when off screen.
- `prefers-reduced-motion: reduce` → no float, no bounce, instant state changes. Add a
  visible toggle too.
- One request renders the screen (`GET /api/dashboard`); re-fetch it after any action.
- No framework or bundler is required. Budget: under ~70 KB of JavaScript and ~40 KB of
  CSS uncompressed, no layout shift after first paint, touch targets ≥ 44 px.
- Easter eggs are welcome if they are harmless, optional, and worth no points.

## 7. Test hooks

Keep these `data-testid` values stable so end-to-end tests survive restyling:
`sign-in`, `dev-login-form`, `demo-banner`, `dev-auth-banner`, `disclaimer`,
`member-card-<slug>`, `member-points-<slug>`, `member-tier-<slug>`, `member-rank-<slug>`,
`member-detail-<slug>`, `leaderboard`, `leaderboard-row-<slug>`, `contribute-form`,
`contribute-error`, `claim-row-<id>`, `verification-chip-<id>`, `decision-chip-<id>`,
`videos-block`, `video-stats-<id>`, `capabilities`, `admin-drawer`, `review-queue`,
`review-approve-<id>`, `review-reject-<id>`, `ledger-adjust-form`, `ledger-reverse-<id>`,
`erase-confirm`.

## 8. Tests to add with the UI

Playwright, iPhone viewport: sign in (dev) → three members visible → submit a
contribution → admin approves → that member's points and the leaderboard change →
resubmitting is refused → erase my data removes the member. Plus: reduced-motion mode,
keyboard-only pass through the main flow, no console errors, no CSP violations, and the
page-weight budget above.
