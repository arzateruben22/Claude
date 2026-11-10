# HTTP API and security contract

This is the contract between the server and the single-screen UI. It is also the
specification the HTTP and sign-in layers are built to. If the code and this file ever
disagree, that is a bug in one of them: fix it, do not work around it.

All bodies are JSON. All timestamps are ISO-8601 UTC. Points are virtual: nothing in
this API represents money.

## 1. Configuration and start-up

Environment variables (see `.env.example`). **There are no defaults for the two mode
switches**: the server refuses to start until they are set explicitly.

| Variable | Meaning | Default |
|---|---|---|
| `AUTH_MODE` | `google` or `dev` | **none — required** |
| `PLATFORM_MODE` | `mock` (sample data, labelled simulated) or `live` | **none — required** |
| `APP_ORIGIN` | the exact origin the app is opened at, e.g. `https://rewards.example.com` or `http://localhost:8787` | **none — required** |
| `HOST`, `PORT` | listen address | `127.0.0.1`, `8787` |
| `DATABASE_PATH` | SQLite file | `./data/rewards.db` |
| `GOOGLE_CLIENT_ID` | OAuth client id (required when `AUTH_MODE=google`) | none |
| `ADMIN_EMAILS` | comma-separated addresses made admins **on first start only** | none |
| `SESSION_TTL_HOURS` | session lifetime, 1–720 | `168` |
| `TRUST_PROXY_HOPS` | how many reverse proxies sit in front (0–3) | `0` |
| `DEV_LOGIN_CODE` | fixed dev sign-in code for automated tests (≥ 16 characters) | random per start |

`npm run dev` sets `AUTH_MODE=dev PLATFORM_MODE=mock APP_ORIGIN=http://localhost:8787`.

**Security posture follows `APP_ORIGIN`**, not `NODE_ENV`:

- `https://…` → session cookie `__Host-sid; Secure; HttpOnly; SameSite=Lax; Path=/`, and
  `Strict-Transport-Security` is sent.
- `http://…` is accepted only for `localhost`, `127.0.0.1` or `[::1]` → cookie
  `rewards_sid; HttpOnly; SameSite=Lax; Path=/` (no `Secure`: Safari does not reliably
  keep Secure cookies from `http://localhost`).

**The server refuses to start when:**

- `AUTH_MODE`, `PLATFORM_MODE` or `APP_ORIGIN` is missing or not one of the allowed values
- `APP_ORIGIN` is not a bare origin (has a path, query or trailing slash), or is `http`
  on a host other than localhost
- `AUTH_MODE=google` without a `GOOGLE_CLIENT_ID` ending in `.apps.googleusercontent.com`
- `AUTH_MODE=google`, the database has no admin account, and `ADMIN_EMAILS` is empty
- `AUTH_MODE=dev` and `HOST` is not a loopback address
- `AUTH_MODE=dev` and any account has ever signed in with Google (a database that has
  seen real sign-ins is never served with dev sign-in)
- `PLATFORM_MODE=live` and the database contains simulated data (a mock-verified claim,
  mock statistics, or a demo channel link)
- `SESSION_TTL_HOURS` or `TRUST_PROXY_HOPS` is out of range, an `ADMIN_EMAILS` entry is
  not an address, `DEV_LOGIN_CODE` is shorter than 16 characters, or `DATABASE_PATH`
  resolves inside `public/`
- the integrity self-check (`src/domain/integrity.js`) reports any violation

Start-up order: read config → open database → migrate → install default tiers if none →
create admins from `ADMIN_EMAILS` if there is no admin at all → the refusals above →
re-erase any tombstoned member that reappeared (restored backup) → integrity check →
delete expired sessions (and, in `google` mode, every dev session) → listen.

In dev mode the sign-in code is printed **once to the terminal** at start. It never
appears in an API response or a log file.

## 2. Request protection (applies to every route)

1. **Host check.** `Host` must equal `APP_ORIGIN`'s host and port; otherwise `421`.
2. **Security headers on every response:**

   ```
   Content-Security-Policy: default-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   Referrer-Policy: strict-origin-when-cross-origin
   Cross-Origin-Opener-Policy: same-origin-allow-popups
   ```

   plus `Strict-Transport-Security: max-age=31536000; includeSubDomains` on an https
   origin, and on `/api/*`: `Cache-Control: no-store` and
   `Cross-Origin-Resource-Policy: same-origin`. **No `Access-Control-*` header is ever
   sent.** Consequence for the UI: no inline scripts, no inline `style=""` attributes and
   no inline event handlers.
3. **State-changing requests** (anything but `GET`/`HEAD`) must have:
   - `Origin` exactly equal to `APP_ORIGIN` → else `403 bad_origin`
   - `Content-Type: application/json` when there is a body → else `415 json_required`
   - a body of at most 64 KB, measured on bytes actually read → else `413 body_too_large`
   - a body that parses as a JSON **object** → else `400 invalid_json`
   - a valid session and `X-CSRF-Token` equal to that session's token →
     `401 not_signed_in` / `403 bad_csrf`.
     The two sign-in routes are the only exceptions (there is no session yet); they are
     protected by the Origin rule plus the nonce (Google) or the code (dev).
4. **Fields.** Every route accepts an exact set of body fields. Any other key is
   `422 unknown_field`. Ownership is never taken from the body.
5. **Rate limits** (in memory): sign-in attempts 10 per minute per client and 60 per
   minute overall; claim submissions by the per-member daily limit. The client key is the
   socket address, or with `TRUST_PROXY_HOPS = n > 0` the n-th address from the right of
   `X-Forwarded-For`. Exceeding returns `429 rate_limited`.
6. **Static files** are served only from a list built at start by walking `public/`
   (no dotfiles); the request path is looked up in that list, never joined to a directory.
   Member photos must never be placed in `public/`.
7. **Logging.** One line per request: method, path without query string, status,
   duration, request id, opaque user id. Never request bodies, cookies, tokens, ID
   tokens, e-mail addresses or evidence text.

### Errors

```json
{ "error": { "code": "duplicate_claim", "message": "There is already a submission for this. It cannot be credited twice.", "details": { "existing_claim_id": "clm_…", "existing_decision": "pending" } } }
```

`code` is stable and machine-readable; `message` is safe to show to a person; `details`
holds ids, enum values and numbers only. Unexpected failures are `500 internal_error`
with a generic message and a `request_id`.

## 3. Sign-in

### Sessions

- The cookie holds a random 256-bit token; the database stores only its SHA-256.
- A session is valid only if its row exists, has not expired (compared with the
  application clock), was created by the **currently configured** `AUTH_MODE`, and its
  account is active.
- Signing in always discards the session named by any incoming cookie and issues a new
  token. Changing an account's role, status or member link ends all its sessions
  (database trigger).
- The CSRF token is `base64url(HMAC-SHA256(key = session token, message = "csrf"))`. It is
  returned by `GET /api/session` and is not stored.

### Routes

| Route | Notes |
|---|---|
| `GET /healthz` | `{ "ok": true }` |
| `GET /api/auth/config` | `{ auth_mode, demo_mode, google_client_id?, nonce?, dev_login?: { locked } }`. In `google` mode it issues a one-time nonce (10 minutes) and sets it in a cookie (`__Host-nonce` / `rewards_nonce`; `HttpOnly; SameSite=Strict`). |
| `POST /api/auth/google` `{ credential }` | Verifies the Google ID token (below), finds the account, starts a session. `200 { user }`. Every failure is the same `401 sign_in_denied` with a generic message. |
| `POST /api/auth/dev-login` `{ email, code }` | Dev mode only (`404` otherwise). Constant-time code check; after 5 wrong codes dev sign-in locks until restart. |
| `POST /api/auth/logout` | Ends the session, clears the cookie. |
| `GET /api/session` | `{ user: { id, email, role, member_id }, csrf_token, auth_mode, demo_mode }` or `401`. |

**Google ID-token verification** (`jose`, against Google's published key set): algorithm
RS256 only; `aud` = `GOOGLE_CLIENT_ID`; `iss` ∈ {`accounts.google.com`,
`https://accounts.google.com`}; not expired; issued at most 10 minutes ago; `nonce` equals
the nonce cookie **and** is still outstanding on the server — a nonce is removed on first
presentation, pass or fail. Then `domain/users.js` `resolveSignIn()` applies the identity
rules (bind an allowlisted address on first sign-in only if Google is authoritative for
it; afterwards only the Google `sub` counts).

Denied sign-ins are counted in memory; at most one `auth.denied` audit row per minute is
written, carrying a count and reason codes only.

## 4. Routes for signed-in people

`member` means an account attached to a member; `admin` means an admin account.

| Route | Who | Returns / does |
|---|---|---|
| `GET /api/dashboard` | any | the whole screen in one payload — see §6 |
| `GET /api/members/:id` | any | member profile; the linked channel id only for self/admin |
| `GET /api/members/:id/activity?limit&before_id` | any | public activity items, paginated |
| `GET /api/claims?member_id&decision&limit&before` | member: own only · admin: all (+ `flags`) | submissions |
| `GET /api/claims/:id` | own · admin | one submission; someone else's id is `404` |
| `POST /api/claims` `{ task_type_id, video_id?, evidence_text?, evidence_url?, member_id?, exception_reason? }` | member: for self · admin: on behalf, may grant an exception | `201 { claim, check? }`. For a task with an automatic check, the check runs straight away and its result is returned as `check`. |
| `POST /api/claims/:id/withdraw` | own (pending) · admin | |
| `GET /api/ledger?member_id&limit&before_id` | member: own only · admin: all | ledger entries with reasons |
| `GET /api/competitions` | any (drafts: admin) | |
| `GET /api/competitions/:id/standings` | any | |
| `GET /api/me/export` | any | everything stored about the caller |
| `DELETE /api/me` `{ confirm: "ERASE" }` | any | erases the caller's member (or admin-only account); writes the tombstone; ends the session |
| `DELETE /api/me/youtube-link` | member | removes the stored channel id immediately |

## 5. Admin routes

All require an admin account. Ledger and decision routes need a real admin account as
actor and are refused for an admin acting on their own member (`403
self_review_forbidden` / `self_credit_forbidden`).

| Route | Does |
|---|---|
| `POST /api/admin/claims/:id/check` | runs the platform check again |
| `POST /api/admin/claims/:id/review` `{ outcome: "approve"\|"reject", note? }` | approve writes exactly one ledger award (or `409 cap_exceeded` and nothing changes); reject needs a note |
| `POST /api/admin/claims/:id/revoke` `{ reason }` | reverses the award and revokes the claim |
| `POST /api/admin/ledger/bonuses` `{ member_id, points?, xp?, reason, competition_id? }` + `Idempotency-Key` | |
| `POST /api/admin/ledger/adjustments` `{ member_id, points?, xp?, bucket?, reason }` + `Idempotency-Key` | may add only to `bonus`; may deduct from either bucket |
| `POST /api/admin/ledger/:id/reverse` `{ reason }` | exact undo, once |
| `GET /api/admin/audit?limit&before_id&action&subject_member_id&entity_type&entity_id` | audit trail |
| `GET /api/admin/integrity` | integrity self-check result |
| `GET /api/admin/settings` · `PATCH /api/admin/settings` | caps, budget, limits, time zone, ranking |
| `PUT /api/admin/tiers` `{ tiers: [5 × { level, name, min_xp, art_key }] }` | |
| `GET /api/admin/task-types` · `POST …` · `PATCH …/:id` | contribution types only (engagement and money wording refused) |
| `GET /api/admin/videos` · `POST …` · `PATCH …/:id` · `POST …/:id/refresh-stats` | refresh returns `{ video, result }`; a failed refresh returns `200` with `result.ok = false` and the adapter's error, so the UI can show it |
| `GET /api/admin/members` · `POST …` · `PATCH …/:id` · `DELETE …/:id` `{ confirm }` · `GET …/:id/export` · `DELETE …/:id/youtube-link` | |
| `GET /api/admin/users` · `POST …` · `PATCH …/:id` · `DELETE …/:id` | the sign-in allowlist; an admin cannot change their own role, status or member link |
| `POST /api/admin/competitions` · `PATCH …/:id` | |

Not built yet: linking a YouTube channel (needs a Google Cloud project and the OAuth
consent flow; see `PLATFORM_CAPABILITIES.md` §3 and §5). There is deliberately **no**
route that accepts a channel id typed by a person.

## 6. The dashboard payload

`GET /api/dashboard` (shape produced by `src/domain/leaderboard.js`):

```jsonc
{
  "generated_at": "2026-11-09T20:00:00.000Z",
  "viewer": { "user_id": "usr_…", "role": "member", "member_id": "mbr_…",
              "submissions_today": { "limit": 5, "used": 1, "remaining": 4 } },
  "demo_mode": true,          // platform checks and statistics are simulated sample data
  "auth_mode": "dev",         // "dev" = sign-in itself is simulated
  "platform_mode": "mock",
  "disclaimer": "Points are virtual. They have no cash value, …",
  "period": { "month": "2026-11", "time_zone": "America/Los_Angeles", "rank_by": "points",
              "budget": { "limit": 750, "used": 85, "remaining": 665 }, "cap_per_member": 300 },
  "tiers": [ { "level": 1, "name": "Stage 1", "min_xp": 0, "art_key": "stage-1" }, … ],
  "members": [ {
      "id": "mbr_…", "slug": "…", "display_name": "…", "avatar_key": "placeholder",
      "is_you": false, "rank": 1,
      "points": { "earned": 50, "bonus": 0, "pending": 25, "total": 50 },
      "xp": 50,
      "tier": { "level": 1, "name": "Stage 1", "art_key": "stage-1", "min_xp": 0, "xp_into_tier": 50,
                "next": { "level": 2, "name": "Stage 2", "min_xp": 100, "xp_needed": 50 }, "progress": 0.5 },
      "youtube_linked": false,
      "recent_activity": [ { "id": 12, "type": "task", "label": "Constructive feedback",
                             "video_title": "…", "points": 25, "xp": 25, "at": "…" } ],
      // only for the member themselves and for admins:
      "pending_submissions": 1,
      "cap": { "member_id": "mbr_…", "limit": 300, "used": 50, "remaining": 250 }
  } ],
  "leaderboard": [ { "rank": 1, "member_id": "mbr_…", "display_name": "…", "avatar_key": "…",
                     "points": 50, "xp": 50, "tier_level": 1 } ],
  "task_types": [ { "id": "tsk_…", "key": "constructive_feedback", "label": "…", "description": "…",
                    "points": 25, "xp": 25, "requires_video": true, "api_check": "none", "active": true } ],
  "videos": [ { "id": "vid_…", "platform": "youtube", "kind": "video", "url": "…", "title": "…",
                "owner_member_id": "mbr_…", "status": "active",
                "stats": { "views": 1840, "likes": 96, "comments": 14,
                           "source": "mock_adapter", "fetched_at": "…", "simulated": true } } ],
  "platforms": { "youtube": [ { "key": "like_attribution", "label": "Which people liked a video",
                                "status": "unsupported", "used_by_product": "no", "can_earn_points": false,
                                "explanation": "…", "evidence_tier": "C", "source_url": "…" }, … ],
                 "tiktok": [ … ] }
}
```

Rules the UI must respect:

- `points`, `xp`, `tier` and `rank` come only from the ledger. `videos[].stats` are
  informational platform statistics and must be shown in a separate, clearly labelled
  block with their source and fetch time (never merged into a score).
- When `demo_mode` is true, show a persistent "sample data — platform checks are
  simulated" notice, and render a claim with `simulated: true` as "Verified (simulated)".
- When `auth_mode` is `"dev"`, show that sign-in is simulated.
- Verification wording is fixed: `verified` → "Verified by the platform",
  `manually_reviewed` → "Reviewed by an admin", `unverified` → "Not verified".
- Show `disclaimer` on screen. Never use currency symbols or money words for points.
- `platforms.*` entries with `status: "unsupported"` (above all `like_attribution`) are
  to be shown as stated limits, not hidden.

## 7. What a member sees of another member

Exactly: display name, avatar, rank, tier, XP, the four point totals, whether a YouTube
channel is linked, and public activity items `{ type, label, video_title, points, xp,
at }` for approved submissions and bonuses that have not been reversed. Nothing else —
no reasons, notes, evidence, deductions, e-mail addresses, or pending / rejected /
withdrawn submissions.
