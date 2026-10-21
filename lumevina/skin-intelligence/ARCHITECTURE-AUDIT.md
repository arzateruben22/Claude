# Lumevina Skin Intelligence: Phase 0 architecture audit and integration map

Date: October 21, 2026. Branch: `claude/lumevina-skin-intelligence` (cut from `claude/landing-page-redesign-payments-mqp9sd` at b9a0e11).

This is the audit the Skin Intelligence directive asks for before any production code. It says what Lumevina is today, what can carry Skin Intelligence, what has to change first, what is new, the risks, the migrations, the order of work, and the costs. Every claim about the code cites a file and line so it can be checked. Nothing here was written from the docs alone: where a doc and the code disagree, the code wins and the disagreement is listed.

**How it was done, and what was not verified.** The repository was read directly: `index.html`, `css/styles.css`, every `js/*.js` module, `dashboard.html`, `server/schema.sql`, every edge function and `_shared` module, `server/README.md`, and the planning docs (`EVELYN-NOTES.md`, `PRIORITIES.md`, `NEXT-STEPS.md`, `GO-LIVE.md`, `GLOSSGENIUS-PARITY.md`, `STOREFRONT.md`, `knowledge/`). Two subsystem reads (front end; accounts and authorization) and a completeness pass were done by separate reviewers with file:line evidence; a planned adversarial re-check of the security findings did not run (the account's weekly usage limit was reached mid-audit), so the security findings below are single-reviewer readings of the code, not independently refuted. Nothing was verified against a live Supabase project, because as committed the site runs in demo mode (see 1.2) and the production project does not appear to exist yet.

---

## 1. What Lumevina is today

### 1.1 Stack (established from the code)

| Layer | What it is | Evidence |
|---|---|---|
| Front end | Static HTML + one 6,733-line stylesheet + ~50 vanilla-JS modules loaded as plain `<script>` tags; no framework, no bundler, no root `package.json`. Modules talk through `window.*` globals and `CustomEvent`s. | `index.html:2026-2069`, `README.md:3-5`, `js/account.js:642` |
| Pages | `index.html` (client site, 2,071 lines), `dashboard.html` (Evelyn's "Lumevina Studio", 3,233 lines, its own dark token set), `school.html`, `privacy.html`, `invoice.html`, `shipping-kit.html` | `dashboard.html:19-32` |
| Backend | Supabase: Postgres (`server/schema.sql`, 717 lines), Auth (email magic link), Storage (one private bucket), Edge Functions on Deno (17 functions under `server/functions/`), pg_cron | `server/README.md:1-60` |
| Payments | Stripe Checkout, Billing (memberships), webhooks with HMAC verification | `server/functions/stripe-webhook/index.ts:40-93` |
| Messaging | Resend (email), Twilio (SMS), Web Push (dashboard) | `_shared/mail.ts`, `_shared/sms.ts`, `_shared/notify.ts` |
| Calendar | Google Calendar bridge for busy times; GlossGenius remains the booking system at launch | `_shared/google.ts`, `js/site-config.js:66-68`, `GO-LIVE.md` §5 |
| AI | Anthropic API from the `ask` and `learn` functions (`claude-fable-5-1`) | `server/functions/ask/index.ts:69` |
| Mobile | Capacitor iOS shell that copies the site into `app/www`; plugins: push notifications, haptics only | `app/copy-site.js:13`, `app/package.json:13-16` |
| Hosting (planned) | Netlify or Cloudflare Pages serving the `lumevina/` folder; dashboard at `<site>/dashboard.html` (same origin) | `GO-LIVE.md:21,39` |
| Tests, CI, migrations | None committed. No test files, no Playwright config, no `deno.json`, no `.github/`. Schema changes are made by editing `schema.sql` in place and applying it with `supabase db push` or the SQL editor. | `find` over the repo; `server/schema.sql:4`; `git log -- lumevina/server` |

### 1.2 Live vs demo

`js/site-config.js:41,54-57` ships `version: "v2"` with the Supabase URL and anon key empty. Every module tests for that and otherwise runs in **demo mode**: sign-in accepts any name and email with no verification and all data lives in `localStorage` under ~40 `lumevina_*` keys (`js/account.js:570-585`, `js/profile.js:24,70-74`). `GO-LIVE.md` §2 (create the accounts) and §4 (test before real money) are unchecked; `EVELYN-NOTES.md:213` says live sign-in was tested against a stand-in server. **Consequence:** there is no production data to preserve yet. The "preserve all existing data" rule in the directive is, today, a rule about keeping `schema.sql` and the functions working, not about migrating live rows. That makes this the cheapest possible moment to fix the identity model (see 3.1) before it has real rows in it.

### 1.3 Scope of the business (constraints on what Skin Intelligence may say)

- Evelyn is a licensed esthetician, solo, in Woodland Hills. The knowledge base's scope page is explicit: an esthetician "does not diagnose skin disease, treat medical conditions, prescribe ... or promise results" and "a photo ... is never the basis for the chat to name a condition, call something normal, or rule something out" (`knowledge/general/red-flags-and-scope.md`). Skin Intelligence copy must stay at "visible appearance of", never diagnosis. This matches the directive's own limits.
- ProCell Microchanneling is on the menu: `procell-microchanneling` (70 min, from $350, deposit $0), `procell-package` (4 treatments, $1,100), `procell-package-rebook` (`js/services.js:61-71`). There is no package/series tracking (`GLOSSGENIUS-PARITY.md:60`). There is no RF device on the menu; the directive's "RF parameters when applicable" field should exist but be optional.
- Her stated rule: "Anything about a client's skin stays between her and the client" (`PRIORITIES.md`, "Not on the list, on purpose"). Push notifications today carry client first names and question snippets (`_shared/notify.ts:42-51`); imaging findings must not follow that pattern.
- Marketing policy (newest, Oct 21): client before/after photos are never posted (`marketing/instagram-30-days.md:44`, `marketing/tiktok.md:58`). The intake's "educational and promotional" photo consent (`index.html:1503-1508`) is broader than the policy and distinct from clinical-monitoring consent (`index.html:1442-1446`).
- She uses the dashboard on her **phone** (`EVELYN-NOTES.md:75`); she asked for "an option to add photos of their skin" before a first visit (`EVELYN-NOTES.md:73,87`).
- Ground rules from `NEXT-STEPS.md:5-12`: never ask Evelyn about rent or finances; product claims come from her or the brand; test at 390 px and 1280 px widths before committing. (It also says to commit only to `claude/landing-page-redesign-payments-mqp9sd` with no pull requests; this work is on its own branch by the owner's instruction and will be merged back into that branch.)

---

## 2. What already exists, by area

### 2.1 Client accounts and sessions
- Supabase Auth **magic link only**, implemented with raw `fetch` (no supabase-js in the browser): send OTP (`js/account.js:558`), return via `#access_token` hash (`119-139`), refresh (`99-111`), logout (`589`). Tokens live in `localStorage` `lumevina_auth`; `window.LumevinaAccount.token()` hands the access token to other modules (`account.js:645`). No password, no MFA, no session list or revocation.
- Server side, every client-facing function builds a **service-role** client (bypasses RLS) and derives identity by `db.auth.getUser(jwt)`, rejecting the anon key (`profile/index.ts:31-36`, `book:69-77`, `client-plans:41-49`, `ask:323-338`). Identity is the normalized **email**; `auth.uid()` is used only in `book:76` and `ask:332-335`.
- Functions are deployed with `--no-verify-jwt` (comments at the top of each; `server/README.md:85-88`), so the in-function check is the only gate.

### 2.2 Identity key and the `clients` table
- The whole data model is keyed by lower-case email: `contacts.email` PK (`schema.sql:649`), `bookings.guest_email` (`32`), `client_plans`/`client_profiles`/`client_memory` email PKs (`314,339,351`), `orders.email` (`565`), `questions.email` (`276`), `consults.email` (`599`).
- The uuid `clients` table (`schema.sql:11-22`, FK to `auth.users`, `ref_code NOT NULL` with no default) is **never written** by any code in the repo, and there is no trigger on `auth.users`. Consequence: `book/index.ts:136` inserts `client_id = auth uid` into `bookings.client_id`, an FK to `clients(id)` with no row; a signed-in website booking should fail that FK once live. Every `auth.uid()`-based policy (`intake_forms:151`, `shipments:421`, `push_tokens:194`) can never match. This is a latent v3 bug, not a Skin Intelligence problem, but Skin Intelligence needs a stable internal client id, so it has to be settled first (3.1).

### 2.3 Practitioner side (Evelyn's dashboard)
- `dashboard.html` has **no login**. The only credential is a single shared secret, `STUDIO_KEY`, typed once and stored in plaintext `localStorage` `lumevina_studio_key` (`dashboard.html:3141-3165`), sent as `x-studio-key` and compared constant-time server-side with a 12-character minimum (`_shared/studio.ts:8-15`). The same key authenticates the pg_cron jobs from Vault (`README.md:98-108`) and is the fallback HMAC secret for unsubscribe links (`_shared/contacts.ts:48`). No per-person identity, no roles, no expiry, CORS `*` on every function.
- Studio actions available today (`studio/index.ts`): `alerts answer client_profile consult_decide consult_done consults contact_note contacts extra_mondays_set five_kit hours_get hours_set import_clients invite lesson_add lesson_save lessons members orders priorities push_subscribe push_test push_unsubscribe questions sell shelf_add shelf_set vapid`. Appointments (`studio-book/index.ts`): `book cancel card_link checkout fee list no_show quote waitlist waitlist_remove`.
- Per-client live views exist only for questions, skin plans and the client's own profile (`js/studio-learn.js:146-167` `LumevinaStudioProfile.attach(box, email)`); the Clients card itself reads `localStorage` and falls back to hard-coded sample people (`dashboard.html:1225-1280`). Analytics charts are hard-coded sample data (`dashboard.html:1014,1099-1107`, "Sample data" banner at 640).
- The dashboard is excluded from the iOS app (`app/copy-site.js:13`); she runs it as a Safari home-screen PWA (`GO-LIVE.md:39`).

### 2.4 Scheduling and visits
- `bookings` (`schema.sql:28-80`): 30-minute grid, `status in (pending, held, completed, cancelled, no_show)`, DB-level no-overlap guard with a 30-minute cleaning gap (`82-88`), `services jsonb`, `consent jsonb {signature, signedAt}`, `checkout jsonb`, `google_event_id`. A visit is "completed" by payment: `completeVisit()` runs at checkout (`_shared/visits.ts:99-107`). There is no check-in state and no per-visit clinical note; `bookings.note` is client-facing.
- At launch booking stays on GlossGenius, which has no public API (`NEXT-STEPS.md:44`); the Google bridge returns busy times only (`_shared/google.ts:62-91`). Website bookings in the `bookings` table arrive only with v3.
- Hooks a new feature can use without touching scheduling: `lumevina:booked` / `lumevina:booking-changed` events and `LumevinaBooking.*` (`js/booking.js:2164-2187`); the Appointments card rows and its `showCheckout` flow (`js/studio-appointments.js:148-240`).

### 2.5 Skin data that already exists
- **Client skin profile** (`client_profiles.profile`, `_shared/profiles.ts:27-39`): `{skinType, concerns[], goal, morning, night, weekly, supplements, treatments, sensitivities}` free text, saved only with `consent === true` (`profile/index.ts:51`), `consent_at` stored. Health terms are filtered out of chat memory (`profiles.ts:HEALTH`).
- **Skin plan** (`client_plans.plan`, `_shared/plans.ts:35-50`): `{skinType, concerns[], goal, phase, morning[], night[], weekly[], avoid, next, note, log[]}` where steps are `{id, name, how}` with `id` validated against the shelf, and `log` is `[{at: YYYY-MM-DD, text}]` visit notes. **The log is shown to the client** (`js/account.js:396`, dashboard copy "Visit notes (they see these too)") and injected into the chat (`plans.ts:72`). The only Evelyn-private text per client is `contacts.notes` (`studio/index.ts:210-215`).
- **Pre-visit intake** (`index.html:1222-1540`): allergies, conditions, pregnancy, medications, last retinol, an optional acne section with `acne_photos` ("photographs ... to monitor treatment progress", Yes/No) and a required `photo_consent` (educational/promotional). **Saved to `localStorage` only**: `js/intake.js:180-181` is a `LIVE: upsert ... here` comment; no function writes `intake_forms`; the confirmation email's `/?intake=1` link (`_shared/bookings.ts:283`) has no handler. Several server paths assume it exists (`priorities.ts:76-79` flags every client as missing a form; `studio-book:81,91`).
- **Photos**: the only pipeline is the chat hand-off. Browser shrinks to ≤1568 px JPEG q0.85 (EXIF stripped) (`js/ask.js:541-566`); server accepts JPEG magic bytes ≤2.5 MB, max 3 (`_shared/photos.ts:7-25`), uploads with the service role to the **private** bucket `question-photos` (`schema.sql:300-304`, no storage policies on purpose), and mints 1-hour signed URLs only for the studio-key holder (`studio/index.ts:153-163`, `photos.ts:40-44`). The photos and the client's file are sent to Anthropic to draft Evelyn's reply (`ask/index.ts:283-304`, image blocks at `295`), disclosed in `privacy.html:85-92`. There is no delete or retention code for photos anywhere (`privacy.html:117-118` promises deletion on request).
- **Consents**: `bookings.consent {signature, signedAt}` (no text, no version) and `client_profiles.consent_at`. No consents table.
- **Products a client bought**: `orders.items jsonb [{id, name, qty, price_cents}]` (`schema.sql:567`, RLS by email at `585`), `bookings.checkout.products` for in-studio sales (`visits.ts:51-65`), read by `js/buy-again.js:46-49` through PostgREST. Products are keyed by `products.id` = `js/catalog.js` ids; the skin plan's step `id` uses the same ids.

### 2.6 Design system
- Client site: light-only "sand/coffee" tokens on `:root` (`css/styles.css:19-67`; `--linen #F5F1EA` ground, `--porcelain` cards, `--ink #161412`, `--cocoa #7D5A44`, `--espresso #4A342A`, accent black), Inter variable only (`styles.css:10,57-58`; the preloaded Cormorant/Jost at `index.html:26-27` are unused by the stylesheet), pill buttons (`177-220`), 12/14/18/20/22 px radius scale, per-feature modal recipe that becomes a bottom sheet at ≤760 px (`2478-2493`), `prefers-reduced-motion` honored (`4587-4596`), no dark mode.
- Dashboard: separate dark set in `dashboard.html:19-32` (`--ground #000`, `--card #161618`, `--ink #f5f5f7`, rose accent `#eab9c8`), `.card` 20 px radius, `.kpi` tiles. Any practitioner UI must use these, not `styles.css`.
- No shared sheet/modal helper, no shared fetch wrapper, no charting library anywhere (the dashboard draws its SVG charts by hand, `dashboard.html:1054-1096`), no image comparison or timeline component, no global `.sr-only` rule (`profile.js:205` uses one).
- Feature gating is CSS: `html:not(.has-x) [data-feature~="x"] { display:none !important }` (`styles.css:6055-6059`) driven by `js/site-config.js` features and `?preview=` (`81-109`). This is display-only and must never be the authorization.
- `sw.js` caches same-origin image URLs cache-first until `VERSION` changes (`sw.js:8,36-38,73-85`) and ignores cross-origin requests (`71`), so Supabase signed URLs bypass it; anything proxied through the site origin would be cached past sign-out.

### 2.7 Docs that disagree with the code (do not implement from these)
- `README.md:3-28` describes a v1 ivory/mauve Cormorant site with its own scheduler; code is sand/Inter and books on GlossGenius.
- `dashboard.html:1196` "Live, this reads Supabase" for the Clients card: it reads `localStorage`.
- `schema.sql:139-152`, `README.md:314-319`, `GLOSSGENIUS-PARITY.md:44` ("consent with signature ✅") and `PARITY.md:21` treat the intake as stored server-side; it is not.
- `STOREFRONT.md:61` says the consult gate takes photos; `js/consult.js:115` asks the client to email one (an uncontrolled imagery channel to `Lumevina.aesthetics@gmail.com`, alongside `js/contact.js`).
- `privacy.html:28-31` describes booking/membership/points as live and promises photo deletion that is not implemented.
- `EVELYN-NOTES.md:354` cites a "server harness (120 checks)"; nothing of the kind is in the repo.
- `APP.md:40-45` describes two edge functions and four integration points; there are 17 functions.

---

## 3. Security and privacy posture today (findings)

Ordered by what blocks Skin Intelligence. Each is a reading of the code; none has been exercised against a live project.

1. **No practitioner identity, no roles, no audit trail.** One shared secret in `localStorage` on her phone grants every studio action (2.3). Three roles, per-person audit logs, minimum-necessary access and key revocation cannot be expressed on it. Blocking: Skin Intelligence endpoints must not accept `x-studio-key`.
2. **Identity key is email; the uuid `clients` table is dead** (2.2). Blocking: pick the internal client identifier before the first imaging table.
3. **Endpoints that trust an email from the request body** (by design, for guests): `book create` applies that email's carried-over deposit credit (`book/index.ts:128-131`), `book waitlist`, `consult request/status` (`consult/index.ts:30-55`), `create-checkout` gated-product approval (`:67-69`), `membership join` (`:74`). Not Skin Intelligence's surface, but the pattern must not be copied: imaging reads and writes derive the client from the verified JWT only.
4. **Identifiable photos go to an external AI** on hand-off with only the Send tap as consent (`ask/index.ts:295,353,386`; `js/ask.js:939-940`). The directive requires a recorded AI-processing consent and contracts before this; Skin Intelligence originals must never travel this path.
5. **No audit logging of reads or writes** (only `studio_alerts`, an owner feed, and `sent_messages`, send-idempotency).
6. **No rate limiting** on any function; only Supabase Auth's OTP 429 surfaces (`account.js:563`).
7. **No consent records as data**: no text, version, timestamp per consent type, or withdrawal; intake consents never leave the browser (2.5).
8. **No deletion or retention tooling**: no `storage.remove` anywhere; `profile delete` touches only `client_profiles`/`client_memory` (`profile/index.ts:69-71`); questions and their photos persist indefinitely.
9. **Health data in third-party channels**: push bodies with names and question snippets (`notify.ts:42-51`), morning digest tiers like "medical question" (`priorities.ts:60-66`), Google Calendar events with name and note (`google.ts:103-117`), Twilio SMS, Resend emails. Acceptable for a spa's operations today; imaging findings and treatment records must be kept out of all of them.
10. **Demo sign-in paths exist in production JS** (`account.js:570-585`, `signIn(name,email)` back door at `634-640`), safe only because live functions re-derive identity from the JWT. New client-side code must never trust `LumevinaAccount.current().email` for anything but display.
11. **`manage_token` (32 hex) grants cancel/move without sign-in** (`book/index.ts:189-246`); fine for scheduling, must never reach clinical data.
12. Smaller items: `flash_slots` and `notifications` have no RLS (`schema.sql:131-136,158-167`); `reward_balances` view lacks `security_invoker`; `calendar-feed` compares its token with `!==` and emits guest names (`calendar-feed/index.ts:30-33,53`); CORS `*` everywhere; `sw.js` cache-first on same-origin images; three different "linen" theme colors across `index.html:21`, `manifest.webmanifest:10-11`, `app/capacitor.config.json:7`.
13. **The HIPAA-style controls the directive lists are absent across the board** (MFA, audit, retention, incident plan, vendor review, BAAs). None of Supabase, Stripe, Resend, Twilio, Google or Anthropic is referenced with a BAA anywhere in the repo. See §12.

Things that are **done well** and should be kept: service-role clients with ownership checks in code and the anon key explicitly rejected; private bucket with no storage policies and signed URLs minted only server-side; Stripe webhook HMAC with constant-time compare and replay window (`stripe-webhook/index.ts:40-68`); every stored profile/plan field bounded in length and validated against the shelf (`profiles.ts`, `plans.ts`); medical terms kept out of chat memory; the chat is told it may describe but never diagnose from a photo (`ask/index.ts:227-229`).

---

## 4. What can be reused as-is

- **Auth and session plumbing**: `LumevinaAccount.current()/token()`, the `lumevina:account-changed` event, the `{apikey, Authorization: Bearer}` call shape to `/functions/v1/<fn>` (`js/profile.js:58-64`). A Skin Intelligence client module is a sibling of `profile.js`.
- **Server pattern**: one Deno function per area with `body.action`, service-role client, `getUser(jwt)` identity, bounded inputs (`profile/index.ts`, `client-plans/index.ts`) — copy the shape, add the staff check and audit write.
- **Private bucket + signed URL pattern** (`_shared/photos.ts`, `schema.sql:300-304`) as the model for a new `skin-images` bucket (not the bucket itself: different size limits, formats, retention).
- **Feature flag mechanism** (`js/site-config.js` features, `?preview=`), for progressive rollout, with the understanding that it is display-only.
- **Account sheet slot pattern** (`index.html:1693-1726` `.booking-label` + `.acct-plan-card`) for a "Your skin" entry point; **profile builder sheet** (`js/profile.js:183-210`: one question at a time, chips, review step with explicit consent wording, two-tap destructive confirm) as the template for guided capture and consent; **`service-sheet.js`** open/close/focus-trap/bottom-sheet code (`56-161`) as the cleanest modal to copy for a before/after viewer.
- **Dashboard per-client attach contract** (`js/studio-learn.js` `LumevinaStudioProfile.attach(box, email)`) for an "Imaging" panel on a client card; dashboard dark tokens; its push subscription flow (`dashboard.html:3178-3195`) for "images awaiting review" alerts (without findings in the body).
- **Products and orders**: `orders.items`, `bookings.checkout.products`, `products.id` ↔ `js/catalog.js`, and the plan step shape `{id, name, how}` — a routine entry that references a purchased product needs no new product model.
- **Skin plan log** as the client-visible visit notes; **`contacts.notes`** as the private field; both stay as they are.
- **Scheduling hooks** in 2.4; nothing about booking is duplicated.
- **`LumevinaSave.file()`** (`js/save-file.js`) for downloadable reports; **`[data-reveal]`, `LumevinaFX.countUp`, `[data-reel]`** for measurement tiles and phone timelines (`js/react-bits.js:233-268`, `js/reel.js`).
- **Knowledge base scope rules** (`red-flags-and-scope.md`) as the wording guard for every Skin Intelligence label.
- **The paper "Skin Analysis & Treatment Record" face map** in `pro/src/p03_facemap.py` as the list of regions and fields Evelyn already records by hand (useful for the treatment record form).

---

## 5. What needs modification before Skin Intelligence can sit on it

1. **Practitioner authentication** (3.1): add Supabase Auth sign-in to the dashboard for staff, a `staff` table with roles, a server-side `staffOf(req)` check, MFA required for staff. Keep `STUDIO_KEY` for pg_cron and, during transition, for the existing dashboard actions; Skin Intelligence actions accept only a staff JWT. Later, migrate the existing `studioOk()` call sites (`studio:89`, `studio-book:47`, `gift-cards:59,85,102`, `client-plans:55,61,72`) to the same check so the shared key can be retired.
2. **Identity**: make `clients` real — a trigger on `auth.users` insert that creates the row (with a default `ref_code`) and links existing email-keyed records; this also fixes the latent `bookings.client_id` FK failure (`book/index.ts:136`). Skin Intelligence rows get an internal uuid and carry the email only as a lookup.
3. **Consent**: a `consents` table with kind, version, text hash, signature, timestamps and withdrawal; wire the intake form's server write (`intake.js:180-181`) so `acne_photos` and health answers stop living only in the browser; separate clinical-photography, treatment, AI-processing and marketing consents in the UI.
4. **The existing photo hand-off** (`ask`): gate the Anthropic image step on a recorded AI-processing consent, or stop attaching images and let Evelyn look at them in the dashboard only. Not Skin Intelligence code, but the directive's rule applies to it and it must not stay as the precedent.
5. **Audit log**: a table and a helper every studio and Skin Intelligence function writes to (actor, role, action, subject client, record, result). Existing sensitive studio actions (`client_profile`, `questions`, `contacts`) should start writing to it too.
6. **`sw.js`**: add an explicit no-cache rule for `/skin/` paths and any `no-store` response, and bump `VERSION`; serve imagery only from Supabase Storage signed URLs (cross-origin), never through the site origin.
7. **Dashboard tokens** extracted to a `css/studio.css` so a new practitioner page shares them instead of copying the inline block.
8. **Push and digest content**: a Skin Intelligence alert may say "A client's images are ready for your review", never a name plus a finding (her own rule in `PRIORITIES.md`).
9. **`privacy.html`** rewritten for imaging, retention and AI processing; it is v1 copy today.
10. **Small hardening** that is cheap while touching the schema: RLS on `flash_slots`/`notifications`, `security_invoker` on views, constant-time compare in `calendar-feed`, a separate `PREFS_SECRET` so rotating `STUDIO_KEY` does not break unsubscribe links, CORS restricted to `SITE_URL` once a domain exists.
11. **Chat boundary**: `clientFile()` (`plans.ts:85-140`) must not pick up imaging measurements or treatment records by default; if it ever does, that is a separate consented feature.

---

## 6. What must be newly implemented

- Data model (§8.3): skin profile, consents, imaging sessions, captures (originals, immutable), derived images, quality checks, analyses (append-only, versioned), measurements, change detections, treatment records, routine entries and adherence, reports, audit log, analysis jobs, staff.
- A `skin-images` private bucket with signed **upload** URLs for large originals and short-lived signed read URLs.
- Two edge functions: `skin` (client) and `studio-skin` (staff), plus a tiny worker-facing contract.
- An analysis worker (OpenCV/NumPy/scikit-image) run outside Deno: see §8.5 for where.
- Guided capture UI (phone, upload, microscope/dermatoscope import) with on-device quality pre-checks (blur, exposure, framing) and server-side authoritative checks.
- Skin Evolution viewer: timeline, before/after slider, synchronized zoom/pan, region selector, difference maps, charts with uncertainty, treatment overlays, gallery, dated sequence. No charting library exists; either hand-drawn SVG like the dashboard, or one small vendored library (decide in design; see §7).
- Practitioner pages: client directory (live, not the demo card), client detail, capture, quality review, treatment documentation, analysis, comparison, report review. Admin: users and roles, device settings and calibration, measurement validation status, analytics, audit log, privacy/data management (export, delete, retention).
- Reports: practitioner-reviewed PDF/HTML progress reports, downloadable by the client.
- Tests: unit tests for measurement code, isolation tests (client A cannot read client B; practitioner limited to assigned clients; staff-only actions reject client JWTs and the studio key), upload/retrieval tests, migration up/down tests, Playwright smoke at 390 and 1280.
- A repeatability protocol and its results page before any "change detected" label is allowed to show.

---

## 7. Decisions that need the owner before design is final

Each has a recommendation; saying "go with the recommendation" is enough.

1. **Who are the practitioners and admins?** Today there is one human. Recommendation: Evelyn is both practitioner and admin at launch; build roles properly anyway (a second staff account is one row), no multi-location tenant model until a second location exists.
2. **Internal client identifier.** Recommendation: fix `clients` with an `auth.users` trigger and give Skin Intelligence its own `skin_profiles.id` uuid linked to `clients.id` and to `contacts.email`, so a client who changes email keeps their record. Clients Evelyn enrolls in the studio before they ever sign in get a profile keyed by email that links the moment they sign in.
3. **Check-in before v3.** Website bookings exist only in v3; at launch booking is on GlossGenius with no API. Recommendation: imaging sessions attach to a `bookings` row when one exists and otherwise to a practitioner-created visit with a manual client pick (service and date typed). No change to `bookings.status`.
4. **Treatment records: private.** Recommendation: a new private table, never shown to the client in full and never fed to the chat; the client sees a short, practitioner-approved summary in their report. The skin plan log stays as the client-visible note.
5. **Where the analysis runs.** Recommendation in §8.5: on-device pre-checks in the browser; authoritative measurements in a small Python worker (about $5–10/month) with a Postgres job queue. No GPU, no paid vision API, no images to Anthropic.
6. **Capture surface for microscope/dermatoscope.** Her phone PWA cannot talk to a USB microscope (no WebUSB on iOS Safari). Recommendation: phase 1 is phone camera plus file upload (including exports from a microscope's own app); a desktop capture page with WebUSB/UVC comes later if she buys a USB device. No native camera plugin until the Capacitor app ships the dashboard.
7. **Original formats and sizes.** Recommendation: accept JPEG, PNG, HEIC and TIFF up to 25 MB per capture, store bytes untouched with a SHA-256, derive a JPEG viewing copy and thumbnail in the worker. (The existing 2.5 MB JPEG-only limit is for chat photos and stays there.)
8. **Charting and image comparison.** Recommendation: hand-written SVG charts like the dashboard already does, and a hand-written slider/synced-zoom viewer; no new front-end dependency. Revisit only if the chart set grows past what SVG by hand can carry.
9. **Retention.** Recommendation: originals and analyses kept while the client has an account plus a fixed period after deletion request sufficient for any legal retention Evelyn's counsel names (default proposal: 7 years for treatment records, immediate for marketing-consented derivatives); the decision is legal, not technical (§12).
10. **Existing chat photo path.** Recommendation: add the AI-processing consent gate to the hand-off now, in this project, since it is the same consent table.

---

## 8. Proposed architecture

### 8.1 Principles
- One Supabase project, one Postgres, the same edge-function pattern. No second application.
- Identity always from the verified JWT (`getUser`), never from the body. Staff identity from the JWT plus a `staff` row, with MFA (`aal2`) required.
- Originals are immutable: the bucket path for an original is written once; analyses are append-only rows with an `algorithm_version`; nothing overwrites.
- Every read of imagery or treatment data by staff writes an audit row; every signed URL is short (5 minutes for viewing, 10 for upload).
- Imagery never leaves Supabase Storage except to the analysis worker over the service connection; never to Anthropic; never through the site origin; never in a push, email, calendar event or SMS.
- Measurements are stored with units, region, quality flags, calibration status, algorithm version, repeatability estimate and review status; the UI shows "Insufficient data" rather than a number when any of those is missing.

### 8.2 Roles and authorization
- `staff(user_id uuid PK → auth.users, role text check in ('practitioner','admin'), display_name, active, created_at)`.
- `staffOf(req)`: `getUser(jwt)` → `staff` row → require `jwt.aal === 'aal2'` → returns `{userId, role}` or 401/403. Client functions keep `clientOf(req)`.
- Practitioner access: all enrolled clients at a solo studio; a `client_assignments(client_id, staff_user_id)` table is added the day a second practitioner joins (one migration, one predicate), so minimum-necessary is a predicate change, not a redesign.
- Clients: RLS policies on every new table (`email = lower(auth.jwt()->>'email')` as the existing convention, plus `client_id = auth.uid()` once `clients` is real) so direct PostgREST reads are safe, **and** the functions still check ownership in code (defense in depth, since functions use the service role).
- Admin: user/role management, device and calibration settings, retention and deletion, audit log viewing; analytics are aggregate and de-identified.

### 8.3 Data model (new tables, all with `created_at`, all RLS-enabled)
- `skin_profiles(id uuid PK, client_id uuid → clients null, email text unique → contacts, goals, concerns[], history, sensitivities, procedures_prior, contraindications_by_staff jsonb, privacy_prefs jsonb, enrolled_by staff, enrolled_at)`.
- `consents(id, profile_id → skin_profiles, kind text check in ('clinical_photography','treatment','ai_processing','marketing','research'), version text, text_sha256, granted_at, withdrawn_at, signature text, ip_hash, user_agent, recorded_by)`.
- `imaging_devices(id, name, kind check in ('phone','upload','usb_microscope','dermatoscope','pro_export'), model, calibration jsonb {um_per_px, method, date, by}, lighting_profile jsonb, active)`.
- `imaging_sessions(id, profile_id, booking_id uuid → bookings null, visit_label text, performed_by staff, started_at, device_id, lighting jsonb, notes_private text, status check in ('open','submitted','reviewed'))`.
- `captures(id, session_id, region text check in (front, left_profile, right_profile, forehead, left_cheek, right_cheek, nose, chin, custom), custom_region jsonb, original_path text unique, original_sha256, mime, bytes, width, height, exif jsonb, camera jsonb, magnification_um_per_px, captured_at, captured_by)` — rows are insert-only (a trigger forbids `UPDATE` of `original_path`/`original_sha256`).
- `derived_images(id, capture_id, kind check in ('view','thumb','aligned','enhanced','diffmap'), path, params jsonb, algorithm_version, reference_capture_id null)`.
- `quality_checks(id, capture_id, algorithm_version, blur, exposure_low, exposure_high, color_shift, angle_ok, scale_ok, motion, calibration_present, comparable_to jsonb, passed bool, flags text[])`.
- `analyses(id, capture_id, algorithm_version, engine text, started_at, finished_at, status, params jsonb, error text)` append-only.
- `measurements(id, analysis_id, name text, value numeric null, unit text, region text, roi jsonb, quality text, calibration_status text, repeatability_estimate numeric null, uncertainty jsonb null, experimental bool, reviewed_by staff null, reviewed_at, review_status check in ('unreviewed','verified','rejected'))`.
- `change_detections(id, profile_id, measurement_name, region, from_capture_id, to_capture_id, delta numeric, threshold numeric, verdict check in ('improvement','deterioration','no_meaningful_change','uncertain','invalid_comparison'), rationale text, algorithm_version, practitioner_review_status)`.
- `treatment_records(id, profile_id, session_id null, booking_id null, performed_by staff, treated_at, device text, treatment_type text, areas jsonb, needle_depth_by_region jsonb, rf_params jsonb null, topicals text[], notes_private text, reactions text, recovery_guidance text, follow_up_on date, locked_at)` — practitioner-private.
- `routine_entries(id, profile_id, when_ check in ('am','pm','weekly'), product_id text → products null, product_name, category, frequency, started_on, stopped_on, source check in ('client','practitioner','order'), approved_by staff null)`; `routine_adherence(id, profile_id, on_date, am_done, pm_done, irritation text null, note)`.
- `progress_reports(id, profile_id, session_ids uuid[], generated_at, generated_by, reviewed_by staff, approved_at, path text, summary_for_client text)`.
- `audit_log(id bigint, at, actor_user_id, actor_role, action, profile_id null, record_table, record_id, outcome, ip_hash, user_agent)` — insert-only, no client policy.
- `analysis_jobs(id, capture_id, kind, status, attempts, claimed_by, claimed_at, finished_at, error)` — the queue for the worker.
- `clients`: add `ref_code default`, add the `auth.users` trigger; **no column removed**.

### 8.4 Storage
- Bucket `skin-images` (private, no policies). Paths: `{profile_id}/{session_id}/{capture_id}/original.{ext}`, `.../view.jpg`, `.../thumb.jpg`, `.../aligned-{ref}.jpg`, `.../diff-{ref}.png`.
- Upload: `studio-skin capture_begin` returns a signed upload URL for that exact path (10 min); the browser PUTs the file; `capture_commit` verifies the object exists, records size and MIME, and enqueues a job that computes the SHA-256 and derivatives. Base64-in-JSON (the chat's method) is not used for originals.
- Read: `view_url` actions return 5-minute signed URLs and write an audit row per capture viewed.

### 8.5 Analysis engine
- **On device (browser), advisory only**: Laplacian-variance blur, histogram clipping for exposure, face-box position against the guide, grey-card white balance check if present. Runs on a downscaled canvas during capture; results are hints for "retake", never stored as authoritative.
- **Worker, authoritative**: a small Python service (OpenCV, NumPy, scikit-image; Pillow/pyheif for HEIC) polling `analysis_jobs` over the Supabase service connection, idempotent per capture and version. Phase 1 measurements, all deterministic and explainable: quality metrics; pore-like feature detection via DoG blob detection in a calibrated ROI (count density, apparent size distribution in µm when calibrated, otherwise px with `calibration_status='uncalibrated'`); texture via local standard deviation and GLCM contrast; pigmentation via L*a*b* b*/L* spread and dark-spot segmentation; redness via a* channel in the ROI; fine lines via ridge filters (Frangi) with orientation histograms; scars via practitioner-drawn ROI with boundary, contrast and texture stats. Registration for comparisons: ECC/feature-based homography against the reference capture of the same region and device; difference maps only between captures that pass `quality_checks` and share device and scale.
- Where it runs: Fly.io or Railway smallest instance (about $5–10/month), private, outbound only to Supabase. Alternative at zero cost: the same container run on demand on Evelyn's Mac (she already runs Claude Code there for texting), at the cost of latency and reliability; not recommended for production.
- Everything is labeled `experimental: true` until the repeatability protocol (§10, milestone 15) has produced a threshold for it; `change_detections` are not generated for a measurement without a threshold.

### 8.6 API surface
- `skin` (client JWT): `profile_get`, `profile_save`, `consents_get`, `consent_grant`, `consent_withdraw`, `sessions`, `captures {session_id}` (metadata + view URLs), `evolution {region}` (measurements over time with flags), `routine_get/save`, `adherence_log`, `orders_products` (from `orders.items`), `reports`, `report_url`, `export` (their data), `delete_request`.
- `studio-skin` (staff JWT, MFA): `clients`, `client {profile_id}`, `enroll`, `session_open/submit`, `capture_begin/commit/retake`, `quality_review`, `treatment_save/lock`, `analyze {capture_id}`, `measurement_review`, `compare {a,b}`, `report_generate/approve`, `analytics` (aggregate), `audit {filters}` (admin), `staff_set` (admin), `device_set` (admin), `retention_run` (admin).
- Worker: reads `analysis_jobs` and writes `quality_checks`, `derived_images`, `analyses`, `measurements` with the service key from the worker's own environment; no public endpoint.

### 8.7 UI placement
- Client: a "Your skin" block in the account sheet (`index.html:1693-1726` pattern) linking to a new page `my-skin.html` that shares `css/styles.css`, `js/site-config.js` and `js/account.js`. The page hosts the dashboard-style screens in the directive's client list. Feature flag `skin` for rollout.
- Practitioner/admin: a new page `studio-skin.html` using the extracted `css/studio.css` dark tokens, opened from the dashboard's Clients card and from each Appointments row ("Open imaging"), with staff sign-in. The existing dashboard keeps working on the studio key until its actions are migrated.
- Both pages at 390 px and 1280 px, bottom sheets on phones, `prefers-reduced-motion` honored, Inter only.

---

## 9. Recommended migrations

Adopt `lumevina/supabase/migrations/<timestamp>_<name>.sql` with a matching `down/<same name>.sql`, applied with the Supabase CLI; `server/schema.sql` stays the fresh-install baseline (migration 0000) and gains a header pointing at the folder. Each migration is written to run on a database that already has `schema.sql` applied and to be reversible without touching existing rows:

1. `0001_clients_trigger`: `ref_code` default; `handle_new_user()` trigger on `auth.users`; backfill `clients` from `auth.users` where missing. Down: drop trigger and function, keep rows.
2. `0002_staff_and_audit`: `staff`, `audit_log`, helper `audit()` SQL function. Down: drop both.
3. `0003_consents`: `consents` + a `consent_texts(kind, version, text, published_at)` table. Down: drop.
4. `0004_skin_profiles`: `skin_profiles`, `imaging_devices`. Down: drop.
5. `0005_imaging`: `imaging_sessions`, `captures` (+ immutability trigger), `derived_images`, `quality_checks`, `analysis_jobs`, bucket `skin-images`. Down: drop tables; bucket removed only if empty.
6. `0006_analysis`: `analyses`, `measurements`, `change_detections`. Down: drop.
7. `0007_treatment_records`. Down: drop.
8. `0008_routine`: `routine_entries`, `routine_adherence`. Down: drop.
9. `0009_reports`. Down: drop.
10. `0010_hardening`: RLS on `flash_slots`/`notifications`, `security_invoker` on views. Down: revert flags.
11. `0011_intake_server`: no schema change; the function write for `intake_forms` and its RLS fix (`email`-based policy alongside the uid one). Down: drop the added policy.

No existing column is dropped or renamed anywhere in this plan.

---

## 10. Implementation order (milestones)

Each milestone ends with: tests run, what works, what does not, schema changes listed, new dependencies and costs, and a check that the existing site and dashboard still work (Playwright smoke at 390/1280 plus the server unit tests).

1. **Baseline**: migrations folder and tooling; Deno unit tests for `_shared` pure logic; an RLS isolation test harness (SQL, run against a local Supabase); Playwright smoke of the existing site. (This container has Docker and Node but no Deno or Supabase CLI installed; whether Docker can run containers here is unverified. The harness is written so it runs on a laptop or CI regardless.)
2. **Identity and staff**: migrations 0001–0002; `staffOf()`; staff sign-in and MFA enrollment screen on a new `studio-skin.html`; audit helper; isolation tests for client/staff/studio-key.
3. **Consents**: migration 0003; `consent_texts` for the four kinds; client UI to grant/withdraw; intake server write (0011); AI-processing gate on the chat hand-off.
4. **Skin profile and navigation**: 0004; `skin profile_*`; "Your skin" entry; `my-skin.html` shell; feature flag.
5. **Imaging upload and original storage**: 0005; `capture_begin/commit`; guided phone capture with on-device pre-checks; signed view URLs; audit of every view. Synthetic clients and non-clinical demo images only.
6. **Timeline and comparison**: sessions/captures views, before/after slider, synced zoom, gallery.
7. **Scheduling and treatment records**: session ↔ booking link, Appointments row "Open imaging", 0007 treatment form (practitioner-private).
8. **Routine and orders**: 0008; AM/PM routine with purchased products offered from `orders.items`; adherence log shown beside measurements with the "no causation" wording.
9. **Quality validation**: worker skeleton; authoritative quality checks; failed captures excluded from comparison.
10. **First measurable features**: pores, texture, redness, pigmentation in calibrated ROIs; all `experimental`; "Insufficient data" paths.
11. **Longitudinal charts** with uncertainty bands; difference maps; treatment overlays.
12. **Practitioner-reviewed reports**: 0009; PDF/HTML; client download.
13. **Admin analytics**: aggregate counts, quality failure rate, review workload, follow-up completion; de-identified.
14. **Security pass**: rate limiting (Postgres-backed token bucket in the functions), CORS to `SITE_URL`, retention job, deletion workflow, `privacy.html` rewrite.
15. **Repeatability protocol**: same untreated region, repeated captures under controlled variation; thresholds per measurement; only then enable `change_detections`.
16. **Controlled pilot**: Evelyn plus one or two consenting clients, after the legal review in §12.

**The first vertical slice** (milestones 2 + 4 + 5 + 6 + a stub of 12, on synthetic data): existing account → skin profile → imaging visit → private storage → before/after comparison → practitioner review → client-visible progress report. No measurements in the slice; it proves the security and the data path.

---

## 11. Infrastructure costs

Incremental to what `GO-LIVE.md` already plans (domain ~$15–20/yr, Netlify/Cloudflare free, Supabase free, Stripe fees, Resend free tier, Anthropic a few dollars/month):

| Item | Why | Estimate |
|---|---|---|
| Supabase Pro | 1 GB storage on the free tier is one or two clients of originals; Pro includes 100 GB and daily backups | $25/month |
| Storage growth | ~9 captures × ~4 MB + derivatives ≈ 40 MB per session; 100 clients × 6 sessions/yr ≈ 24 GB/yr; overage beyond 100 GB about $0.02/GB-month | $0 for years 1–3 |
| Point-in-time recovery (recommended once real records exist) | Supabase add-on | ~$100/month (optional; daily backups are included in Pro) |
| Analysis worker | smallest Fly.io/Railway instance, polling, no GPU | $5–10/month |
| Capture hardware | phone mount + LED ring, grey/white card, calibration slide or ruler, optional USB microscope | $50–100; USB microscope $40–150 (calibrated models $200–500) |
| HIPAA posture on Supabase, if counsel says HIPAA applies | Supabase's BAA/HIPAA add-on is only offered on its Team tier | ~$599/month (verify; this is the single decision that changes the budget) |
| Apple Developer, if the app must capture natively | already in `GO-LIVE.md` | $99/yr |

Total incremental if HIPAA does not apply: about **$30–40/month** plus one-off hardware. No paid vision API, no GPU, no new SaaS.

---

## 12. Privacy, security and legal assessment (for counsel to confirm)

This is an engineering reading, not legal advice; the owner's directive asks for the assessment and for review before any real client is enrolled.

- **HIPAA**: likely does not apply as a covered entity. A solo esthetician who does not bill health plans electronically is generally not a HIPAA covered entity, and no business-associate relationship exists. If counsel disagrees (for instance because of how ProCell is billed or if a physician supervises), the stack cost changes (§11) and BAAs with Supabase, Resend, Twilio and Google become necessary; Anthropic is out of the imaging path by design.
- **California CMIA**: applies to "providers of health care"; whether an esthetician's treatment records qualify is a question for counsel. Designing to CMIA's standard (confidentiality, access logging, consent for disclosure) costs little and is already in §8.
- **CCPA/CPRA**: facial images and skin condition data are "sensitive personal information"; a small business may fall under the revenue/volume thresholds, but the consent, access, deletion and retention mechanics in §8 satisfy the obligations anyway. Facial images used only for before/after comparison, not identification, should not be processed as biometric identifiers; the design must never add face recognition.
- **FTC Health Breach Notification Rule** can reach non-HIPAA apps that hold health information; an incident-response note belongs in `GO-LIVE.md`.
- **FDA**: software that documents and compares the visible appearance of skin for cosmetic tracking, with no diagnostic or treatment-recommendation claims, is the kind of general-wellness/cosmetic use that stays outside device regulation. The directive's wording rules (no diagnosis, no needle-depth or energy recommendations, no biological claims) are what keep it there; they are implemented as code-level label rules, not just copy.
- **Scope of practice**: every label uses "visible/apparent"; measurements of collagen, hydration, elasticity, dermal thickness or "skin age" are not offered and the UI has no slot for them.
- **Consent**: four separate consents with versioned text; clinical photography consent is required before any capture; AI-processing consent is not required for Skin Intelligence (no external AI) but gates the existing chat photo path; marketing consent exists but the current marketing policy is "never post client before/afters".
- **Operational**: MFA for staff; audit log; retention and deletion runbook; incident response plan; a vendor list with the data each one sees (Stripe, Resend, Twilio, Google, Anthropic, Supabase, hosting); security testing with synthetic data before onboarding; no real client records until these are signed off.

---

## 13. Limits of this audit

- Security findings are single-reviewer readings; the adversarial re-check did not run (usage limit). The highest-impact ones (shared studio key, dead `clients` table, body-trusted emails, photos to Anthropic, no audit/consent/retention) were confirmed by two independent reads and by direct inspection of `studio.ts`, `photos.ts`, `ask/index.ts`, `schema.sql` and `intake.js`.
- Not read in full: `js/shop.js`, `js/cart.js`, `js/membership.js`, `school.html`, the `pro/` and `docs/` build tooling. Their shapes were taken from the completeness pass; none of them is on the Skin Intelligence path.
- Not verified: anything about the live Supabase project (whether it exists, key format, gateway JWT setting, default grants on views), Docker usability in this container, and the current prices of Supabase tiers and HIPAA add-on.
- Other work is landing on `claude/landing-page-redesign-payments-mqp9sd` from another session (commits on Oct 21 through b9a0e11). This branch merges that branch in before each milestone.
