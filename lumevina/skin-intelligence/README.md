# Lumevina Skin Intelligence

A private, longitudinal record of how each client's skin looks over time, built into Lumevina: guided photos at every visit (and the client's own between visits), careful measurements the practitioner reviews, a Skin Evolution view from visit 1 to today, private treatment records, the client's routine, and practitioner-approved progress reports.

It describes how skin **looks in photographs taken the same way each visit**. It never diagnoses, never claims a biological measurement (collagen, hydration, elasticity, "skin age"), never recommends a needle depth or an energy setting, and never sends a client's skin photos to an AI service.

Status, what's left and the open questions: [STATUS.md](STATUS.md). The Phase 0 audit: [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md). Validation: [VALIDATION.md](VALIDATION.md). Privacy and security: [PRIVACY-SECURITY.md](PRIVACY-SECURITY.md).

## Try it

The pages run on a synthetic demo record when `js/site-config.js` has no Supabase settings (as committed): one demo client, six visits, generated skin textures stamped SYNTHETIC DEMO IMAGE, measured by the real analysis worker.

```
cd lumevina && npx http-server -c-1 .     # any static server; ES modules need http, not file://
open http://localhost:8080/my-skin.html        # the client's portal
open http://localhost:8080/studio-skin.html    # the studio (practitioner and admin)
open http://localhost:8080/index.html?preview=v4   # the main site with "Your skin record" under My Lumevina
```

## What's where

| Part | Files |
|---|---|
| Client portal | `my-skin.html`, `js/skin/portal.js` |
| Studio | `studio-skin.html`, `js/skin/studio.js` |
| Progress report (printable) | `report.html`, `js/skin/report-page.js` |
| Skin Evolution, comparison viewer, charts | `js/skin/evolution-view.js`, `viewer.js`, `charts.js` |
| Guided capture, on-device face landmarks | `js/skin/capture.js`, `face.js`, `vendor/mediapipe/` |
| Sign-in (client, and staff with an authenticator app) | `js/skin/session.js` |
| Talking to the functions; the demo backend | `js/skin/api.js`, `demo-backend.js`, `demo-data.js` |
| Styles (light client, dark studio) | `css/skin.css`, `css/studio-skin.css` |
| **The rules, shared by pages, functions and worker** | `js/skin/core/*.js` (regions, measurements and what photos can't measure, wording guard, consent gates, change detection, evolution, validation, access, reports, on-device quality). `scripts/build-skin-core.mjs` copies them to `server/functions/_shared/skin/core/` and writes the worker's `catalog.json`. |
| Database | `server/migrations/0001…0012` and `down/` |
| Edge functions | `server/functions/skin/` (client), `studio-skin/` (staff), `intake/` (pre-visit form), `_shared/skin.ts`, `skin-data.ts`, `consents.ts` |
| Analysis worker | `skin-intelligence/worker/` (Python: OpenCV 5, scikit-image, MediaPipe 1.1) |
| Tests | `tests/` (Node: database, functions, shared logic, browser) and `skin-intelligence/worker/tests/` (pytest) |

## How it fits together

```
 phone / laptop                       Supabase (one project, as today)                 worker (small container)
 ─────────────                        ────────────────────────────────                 ───────────────────────
 my-skin.html ──▶ functions/skin ───▶ Postgres: skin_profiles, consents,               polls analysis_jobs
 studio-skin.html ─▶ functions/studio-skin   imaging_sessions, captures (immutable),   ingest → hash, EXIF, viewing copies
   │   (staff token + multifactor)    quality_checks, analyses, measurements           quality → authoritative checks
   │                                  (append-only), change_detections,                measure → regions, measurements
   │                                  treatment_records, routine, reports,             register → aligned copy, difference map
   │                                  audit_log (append-only), analysis_jobs           writes rows and derived images
   └─ original ──(one-time signed URL)──▶ Storage: skin-images (private, no policies) ◀─ reads originals (service key)
 viewing ◀──(5-minute signed URLs, every one audited)──┘
```

* **Who is asking** always comes from the verified token. Clients act only on their own record; staff need an active `staff` row and a multifactor sign-in (aal2); the shared `STUDIO_KEY` is never accepted.
* **Originals never change**: path and kind fixed, hash and size written once, no deletes outside a retention run (database triggers enforce it). Measurements and approved reports can't be rewritten either; signed treatment records are amended, never edited.
* **Consent first**: no capture without the photography consent; no treatment record without the treatment-records consent; chat photos reach the AI assistant only with the separate AI consent (`functions/ask` now checks it).
* **Honest numbers**: every measurement has a unit, an uncertainty band, image quality and calibration status, and stays experimental until the repeatability protocol has validated it; a change is only called improvement or deterioration when it exceeds that measurement's validated threshold, and the client sees only what the practitioner confirmed and chose to share, worded without causes.

## Deploying (after the reviews in PRIVACY-SECURITY.md)

1. **Database.** On the Supabase project (with `server/schema.sql` applied), apply `server/migrations/0001…0012` in order (`psql "$DATABASE_URL" -f server/migrations/0001_clients_identity.sql`, …, or paste each into the SQL editor). Each has a `down/` twin.
2. **Functions.** `supabase functions deploy skin studio-skin intake ask --no-verify-jwt`. Secrets: `AUDIT_SALT` (a long random string, for hashing addresses in the audit log), `SITE_URL` (the allowed origin). The rest already exist.
3. **Supabase Auth.** Turn on **MFA (TOTP)** in Authentication → Multi-factor. Add `<site>/my-skin.html` and `<site>/studio-skin.html` to the redirect URLs.
4. **First admin.** Evelyn signs in once at `studio-skin.html` (the email link), then in the SQL editor: `insert into staff (user_id, email, display_name, role) select id, email, 'Evelyn', 'admin' from auth.users where email = '<her email>';`. She then sets up her authenticator app on the next visit to the page.
5. **Worker.** `cd skin-intelligence/worker && docker build -t lumevina-skin-worker .` and run it with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Fly.io, Railway or any small container host; it needs no inbound port). Or `pip install -r requirements.txt && python run.py`.
6. **Site.** `skin` is on in the `v4` preview (`?preview=v4`); to switch it on for everyone, add `"skin"` to `features` in `js/site-config.js`. Optional: `node scripts/fetch-skin-vendor.mjs` to self-host MediaPipe's runtime and model.
7. **Validation** before any change detection: run the protocol in VALIDATION.md and publish its thresholds.

## Running the tests

```
cd lumevina/tests && npm install && npm test        # 92: database, functions, shared logic
npm run test:e2e                                    # 59: the site and the new pages in Chromium at 390 and 1280 px
cd ../skin-intelligence/worker && pip install -r requirements-dev.txt && pytest   # 37: the worker
node scripts/build-skin-core.mjs --check            # the server's and worker's copies of the rules are current
```

The database tests run real Postgres 17 (PGlite) with Supabase's roles, default grants, `auth` and `storage` stubbed, so row-level security is tested as Supabase applies it. The function tests run the actual handlers against that database. Nothing needs Docker or a cloud project.
