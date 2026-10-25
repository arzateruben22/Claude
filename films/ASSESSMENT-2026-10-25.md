# Assessment, 25 October 2026 (23:15 UTC)

Written at the pause you asked for. Everything below is committed and pushed on `claude/made-with-claude-film`
(30 commits since the weekly reset at 22:00 UTC).

## 1. What exists and has been checked

| Deliverable | State | Measured |
|---|---|---|
| Skin School pilot short (Lumevina) | delivered earlier | −14.1 LUFS, QA pass |
| Rest Frame (physics) No. 001 v2 | **delivered** | 74.9 s, −14.1 LUFS / −2.0 dBTP, 0 flashes, 20/20 label sounds on frame |
| Rest Frame No. 002 | **delivered** (channel session) | 71.7 s, −14.1 LUFS / −1.9 dBTP, QA pass |
| Light Minute (space) No. 001 v2 | **delivered** | 73.6 s, −14.1 LUFS / −1.9 dBTP, QA pass |
| Light Minute No. 002 | **delivered** (channel session) | 74.7 s, −14.1 LUFS / −1.8 dBTP, QA pass |
| Meanwhile, Inside (body) No. 001 v2 | rendering here | slow: ~8 s/frame at the start (the cell scene is heavy), ETA ~4 h |
| Posting sheets (`out/POSTING.md` + `posting.json`) | written for all 4 delivered shorts | title, description, tags, TikTok caption + 150-char sources comment, Instagram caption + first comment |
| Compilation builder (`kits/cinema/film/compilation.mjs`) | ready, tested on a 2-episode scratch run | −14.3 LUFS, chapters, description, thumbnail, QA |
| Prism Studio Stage A (studio app) | **done, verified** | tsc clean, `next build` clean, 139 tests, 14-step browser run on a test database |
| Prism Studio Stage B | lessons + Learn + posting-text engine done; costs UI and demo toggle not | lesson build tested on the domain; the real `compilation.mjs` run is a gated test (`LESSON_E2E=1`) |
| Prism Studio Stage C | connect flow, sealed tokens, publish/status jobs, scheduler, Publish now, 3 connectors | 62 connector tests with mocked network; **not yet run against a real account** |

## 2. Where each channel's pipeline is (from the channel sessions' branches)

| Channel | Finals delivered | Compiled with scene (render-ready) | Script only |
|---|---|---|---|
| Rest Frame (physics) | 001, 002 | 003, 004 | 005 |
| Light Minute (space) | 001, 002 | 003, 004, 005 | 006 |
| Meanwhile, Inside (body) | (001 rendering here) | 002, 003, 004 | 005 |

The sessions are pipelining correctly: scripts → voice → compile → scene → animatic while the previous final renders.
They now commit at every milestone, so a limit or restart loses nothing.

## 3. ETA for the target (5 shorts per channel + 1 compilation per channel)

A final render takes about 1 h per episode in a container, one at a time. Remaining renders: physics 3, space 3,
body 4 in its session plus 001 here (slow). If nothing stalls:

- physics and space: 003–005 by about **03:00–04:00 UTC, 26 Oct**; compilations (~10 min each) right after.
- body: 002–005 by about **04:00–05:00 UTC**; 001 here by about 03:30 UTC; compilation after.
- **Everything: roughly 05:00–06:00 UTC on 26 Oct.**

The main risk to that ETA is usage: four sessions share the account's 5-hour window (resets 03:00 UTC). If it
hits, each session stops and resumes after the reset (they are built to), adding up to a few hours.

## 4. The automated publishing system (what you asked to focus on)

Built and tested with fake platforms, honest about what is not yet proven:

- **Text:** every platform's title, description/caption, hashtags, YouTube tags and the sources comment come
  from the script's beats and the claims ledger, within every platform limit; cuts are reported, never silent.
  Regenerate from Review; `npm run text:regenerate`; `npm run text:pack` writes the sheets into the films repo.
- **Accounts:** one YouTube and one TikTok per channel plus the shared Instagram, each with a connect flow
  (OAuth with PKCE, sealed tokens, the platform's own account facts written onto the destination, refresh, expiry,
  disconnect). The same account can't be connected twice.
- **Publishing:** "Publish now" on the desk, or automatic at the scheduled slot for channels set to *Approved*.
  Same guards as the manual desk: a live approval of that exact video and text, a connected grant, external actions
  not stopped. Only the platform's own "published" answer verifies a post; processing is re-checked; a TikTok inbox
  upload or a private post stays "handed off" until you finish it in the app.
- **Platform conditions you will meet** (documented in `prism-studio/INTEGRATIONS.md`, verified by web search
  today, not against live docs because the sandbox can't open the developer sites):
  - YouTube: Google OAuth client; consent screen in Testing expires tokens every 7 days (publish it); unaudited API
    projects may have uploads forced private; quota ~6 uploads/day by default.
  - TikTok: without TikTok's app audit, direct posts are private-only; the connector defaults to upload-to-inbox
    (you tap Post in the app). The audit lifts it.
  - Instagram: professional account, your role on the Meta app; Reels only; Instagram fetches the video from a
    public https URL, so the studio must be hosted somewhere reachable.

## 5. What it needs from you before it can post for real

1. **Accounts:** the 11 accounts (names, handles, a brand email each; a password manager and 2-step everywhere).
2. **Developer apps:** a Google Cloud OAuth client (YouTube Data API on), a TikTok for Developers app
   (Login Kit + Content Posting), a Meta app (Instagram API with Instagram Login). Their IDs/secrets go in
   `prism-studio/.env.local` with `INTEGRATIONS_KEY` and `PUBLIC_ORIGIN`.
3. **Hosting:** Prism runs locally today (Postgres + Next). OAuth callbacks and Instagram's fetch need an https origin:
   a small VPS or a platform with managed Postgres. (Stage D.)
4. **Decisions:** final names for the Skincare and What If? channels (working names now); whether to build those
   two channels' episode pipelines next (they have no episodes yet); Skin School on the shared Instagram only with
   Evelyn's agreement; the reward budget cap (nothing is reserved until set).

## 6. Usage

This session has cost about $451 since 21 Oct (all projects); the three channel sessions about $7 each so far
today; the two connector agents about 300k tokens. The weekly limit that stopped everything on 24 Oct reset at
22:00 UTC today; the 5-hour window resets at 03:00 UTC.

## 7. Recommendation

- Let the three channel sessions run: they are the deliverable, and they resume by themselves after limits.
- Keep this session in low-usage mode (the check-in now only restarts stalled renders and merges finished episodes).
- Next working block, in this order: (1) QA + merge the remaining shorts and build the three compilations;
  (2) create the developer apps and connect one real YouTube account, upload one private test video end to end;
  (3) hosting; (4) Skincare and What If? pipelines.
