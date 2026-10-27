# Integrations

## How publishing works now (Stage C, first cut)

Every destination starts **manual**: the Upload Desk hands the owner the exact approved file and text, the owner
posts in the app and marks it uploaded. **Connecting** a destination (Accounts → Connect) stores the platform's
OAuth grant, sealed with `INTEGRATIONS_KEY`, and switches that destination to **api**. From then on:

- **Publish now** on a desk task queues a `publish` job for the worker.
- With the channel's automation set to **Approved**, the worker queues every due, approved publication on a
  connected destination by itself (checked every minute).
- The guards are the same either way: external actions not stopped, a live approval of that exact export for
  that destination, a connected (non-expired) grant, nothing already posted by hand.
- Only a platform's own "published" answer becomes a **verified** publication (evidence `api_verified`).
  "Processing" is re-checked by a `publish_status` job; a TikTok inbox upload or a private post stays
  *handed off* with a note until the owner finishes it in the app and marks it uploaded.
- Posting text (title, description/caption, hashtags, tags, the sources comment) comes from the metadata
  engine (`src/domain/metadata.ts`), the same text the owner approved.

## API analytics (`src/domain/api-analytics.ts`)

- The worker's housekeeping (every 15 minutes) queues a `pull_metrics` job for each verified publication on a
  connected destination whose connector reads metrics (YouTube, TikTok, Instagram): **daily** for a post's first 30
  days after publication, then **weekly**, counted in UTC days from the last attempt. **Refresh now** on Analytics or
  the episode page queues one at once.
- The job asks the platform with the sealed token (refreshed when near expiry) and writes `metric_snapshots` rows
  with source `api`: views, likes, comments, shares, average view duration and watch time, whichever the platform
  reports (a metric it doesn't give gets no row, never 0). One row per post, metric and UTC day: re-pulling that day
  updates it. Views run the milestone rules like any qualifying number.
- An auth failure or a refused refresh marks the connection **expired** (Accounts shows "needs reconnecting"); nothing
  pulls from it until it's reconnected and the job is not retried. Network trouble retries with backoff; any other
  refusal (a deleted video, quota) waits for the post's next period. Simulated publications and demo episodes are
  never pulled. **Stop external actions** pauses pulls too.
- What each connector reads today: YouTube `videos.list` statistics (views, likes, comments; watch time needs the
  YouTube Analytics API and its own scope, not requested yet); TikTok `video/query` (views, likes, comments, shares);
  Instagram media insights (views or plays, likes, comments, shares).

Setup (`.env.local`): `INTEGRATIONS_KEY` (openssl rand -hex 32), `PUBLIC_ORIGIN` (the https origin the platforms
redirect back to; callbacks are `/api/auth/<platform>/callback`), and each platform's app credentials below.
Secrets never reach the browser; tokens are never logged.

## Platform conditions (verified by web search on 2026-10-25; re-check before relying on them)

| Platform | What the studio does | Conditions |
|---|---|---|
| **YouTube** | Data API v3: resumable `videos.insert` (snippet + status), `captions.insert` (the .srt), `thumbnails.set`; `videos.list` for processing status and view counts. Sets `status.containsSyntheticMedia` from the "AI visuals" disclosure (YouTube's altered/synthetic-content flag, added Oct 2024). | A Google Cloud OAuth client with the YouTube Data API enabled. While the consent screen is in **Testing**, refresh tokens expire after **7 days**; publish it to production for unattended uploads (youtube.upload is a sensitive scope: an unverified production app shows a warning the owner can click through). Default quota 10,000 units/day; an upload costs about 1,600. |
| **TikTok** | Content Posting API. Default **upload to inbox**: the video and caption land in the owner's TikTok inbox to finish in the app. **Direct post** once the app is audited (tick "audited" on the account card). Sets `is_aigc` from the disclosures. | **Unaudited** apps: direct posts are **private-only** (SELF_ONLY), at most 5 users per 24 h, and the account must be private at posting time; the audit (TikTok's review of the app) lifts this. Caps still apply after the audit. |
| **Instagram** | Business Login for Instagram; Graph API media container (`REELS`, `video_url`) → poll → `media_publish`; insights for views. The studio signs a short-lived public link to the file (`/api/public-media/<token>`) because Instagram fetches the video itself. | A professional (Business or Creator) account. The owner's own account works while they have a role on the Meta app (App Review and Business Verification are only for other people's accounts). 50 API-published posts per rolling 24 h. Long-lived tokens last 60 days; the studio refreshes them. |

Sources: YouTube revision history (containsSyntheticMedia) — https://developers.google.com/youtube/v3/revision_history ·
Google OAuth testing-mode token lifetime — https://developers.google.com/health/setup and https://discuss.google.dev/t/oauth2-refresh-token-expiration-and-youtube-api-v3/160874 ·
TikTok content sharing guidelines (unaudited clients) — https://developers.tiktok.com/doc/content-sharing-guidelines and https://developers.tiktok.com/doc/content-posting-api-reference-direct-post ·
Instagram content publishing — https://developers.facebook.com/docs/instagram-platform/content-publishing and the Instagram Platform overview (App Review, Business Verification).

## Official links used in the app

| Platform | Studio / upload | Help |
|---|---|---|
| YouTube | https://studio.youtube.com (channel-specific `/channel/<UC…>` once the channel ID is known) | https://support.google.com/youtube/answer/3046356 · upload: https://support.google.com/youtube/answer/57407 |
| TikTok | https://www.tiktok.com/tiktokstudio | https://support.tiktok.com/en/using-tiktok/creating-videos/creator-tools-on-tiktok |
| Instagram | https://www.instagram.com/ · https://business.facebook.com/ | https://help.instagram.com/ |

## Rules that hold for every connector
- Tokens are sealed (AES-256-GCM) in `connections.token_cipher`, unsealed only for a call, never sent to the client.
- A saved URL or handle is never a connection; only an OAuth grant makes a destination `api`.
- The same platform account cannot be connected to two destinations.
- `mayAutoPublish` refuses when the owner already posted by hand, when the record is simulated, or when external actions are stopped.
- Metrics from the APIs are written as `metric_snapshots` with source `api` (one row per post, metric and UTC day); posts on unconnected accounts stay owner-confirmed or CSV.
