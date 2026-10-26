# Platform connectors

One file per platform, each implementing `PlatformConnector` from `types.ts`. Pure API clients: no database,
no logging of tokens, `fetch` injected for tests. The studio decides what and when to publish.

| Platform | File | Publishes via | Conditions today |
|---|---|---|---|
| YouTube | `youtube.ts` | Data API v3 `videos.insert` (resumable), `captions.insert`, `thumbnails.set` | OAuth app in *Testing* gives 7-day refresh tokens; publish the consent screen to production for unattended uploads. `status.containsSyntheticMedia` is set from the disclosures. |
| TikTok | `tiktok.ts` | Content Posting API: upload-to-inbox (finish in the app) or direct post | Unaudited apps: direct posts are private-only and the account must be private at posting; inbox upload is the practical path until the audit. |
| Instagram | `instagram.ts` | Graph API media container (REELS, `video_url`) → `media_publish` | Professional account; the owner has a role on the app (no App Review needed for the owner); 50 API posts per 24 h; the video must be fetchable from a public https URL (the studio signs a short-lived one). |

Verified by web search on 2026-10-25 (see ../../INTEGRATIONS.md for links). Re-check before relying on any of it.
