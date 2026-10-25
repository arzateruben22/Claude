# Integrations

## Today (Stage A): manual
Every destination's `publish_method` is `manual`. The Upload Desk hands the owner the exact approved file and text;
the owner posts it in the platform's app and marks it uploaded. Links in the app are the platforms' **generic**
official pages, or ones built from an ID the owner entered:

| Platform | Studio / upload | Help |
|---|---|---|
| YouTube | https://studio.youtube.com (channel-specific `/channel/<UC…>` once the owner enters the channel ID) | https://support.google.com/youtube/answer/3046356 · upload: https://support.google.com/youtube/answer/57407 |
| TikTok | https://www.tiktok.com/tiktokstudio | https://support.tiktok.com/en/using-tiktok/creating-videos/creator-tools-on-tiktok |
| Instagram | https://www.instagram.com/ · https://business.facebook.com/ | https://help.instagram.com/ |

These were checked by web search on 2026-10-24. Check them again before Stage C and whenever a platform redesigns.

## Stage C plan (not built; verify every point before building)
- **YouTube:** the YouTube Data API upload (`videos.insert`) through the owner's OAuth. Quotas and the audit
  requirements for public uploads must be checked against the current Google documentation.
- **TikTok:** the Content Posting API needs an approved developer app. Unaudited apps may be limited to private
  posting. Check the current terms.
- **Instagram:** the Graph API content publishing for professional (Business/Creator) accounts linked to a
  Facebook Page. Check the current requirements.
- **Rules that already hold for integrations:**
  - Tokens are encrypted server-side (`connections.token_cipher`) and never sent to the browser.
  - A saved URL is never treated as a connection.
  - `mayAutoPublish` refuses when the owner already posted manually, when the record is simulated, or when external actions are stopped.
- **Analytics APIs:** these will write `metric_snapshots` with source `api`. Until then, values are owner-confirmed
  (source `manual`) or imported from CSV.
