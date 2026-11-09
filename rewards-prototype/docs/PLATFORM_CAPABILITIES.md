# What the platforms can and cannot attest

Researched 2026-11-09. Full claim-by-claim evidence, with source URLs and the
fact-checker's verdicts, is in `research/platform-research-2026-11-09.json`.

**Read this first — how solid is each statement?**

| Tier | Meaning |
|---|---|
| **A** | Read directly from Google's official machine-readable API description (the YouTube Data API v3 *discovery document*) and re-read by a second, independent checker. |
| **B** | Taken from official pages (`developers.google.com`, `support.google.com`, `developers.tiktok.com`, `tiktok.com`) **as relayed by web-search excerpts**. The pages themselves could not be opened from the build environment (its network policy blocks those hosts), so wording and numbers were *not* checked verbatim. Treat as "very likely, re-check before relying on it". |
| **C** | Inference: nothing in the API offers it, but the platform does not say so outright. |

Nothing here was tested against a live API. There is no Google Cloud project, API key
or TikTok app yet, so the prototype ships mock adapters only.

## 1. Bottom line

| Question | Answer | Tier |
|---|---|---|
| Can we find out **which people liked** a video? | **No.** The API has eight video methods; none lists the users who rated a video. Only an aggregate `likeCount` exists. | A (method list), C (the limitation is not stated in words) |
| Can a member prove **their own** like? | Technically yes, but only with that member's own OAuth consent: `videos.getRating` returns the rating given by the user who authorized the request. **The product does not use this**: likes are never rewarded, so there is nothing to prove. | A |
| Can we tell whether a member **commented** on a YouTube video? | **Sometimes.** Public comments carry `snippet.authorChannelId.value`. If the member has linked their YouTube channel (see §3), an exact match on that id is a real attestation. Limits below. Informational only — never rewarded. | A |
| Does that work for **Shorts**? | Presumably: the comment methods take a generic video id and the docs do not treat Shorts separately. Not stated anywhere. | C |
| Can we show **view / like / comment counts**? | Yes, as aggregate statistics from `videos.list`. | A |
| Can a creative submission be tied to the member's own channel? | Planned check: the submitted video's channel id equals the member's linked channel id. The field was not part of this research round; confirm when the live adapter is built. | to confirm |
| **TikTok**: who liked or commented? | **No**, not for a normal third-party app. Login Kit / Display API scopes expose only the authorizing user's own profile, own public videos and aggregate counts. | B |
| TikTok: any other route? | The Research API can list a public adult user's liked videos and a video's comments, but is restricted to approved non-commercial researchers. The Data Portability API covers EEA/UK users only and needs a separate application. Neither fits this product. | B |

### Limits of comment matching (YouTube)

| Limit | Tier |
|---|---|
| No "comments by author" filter exists. `commentThreads.list` accepts `videoId`, `channelId`, `allThreadsRelatedToChannelId`, `id`, `moderationStatus`, `order`, `searchTerms`, `textFormat`, paging — nothing else. The app must page through a video's threads (max 100 per page) and compare author ids itself. | A |
| `authorChannelId` is documented as present only "if any": a comment can lack it, and is then unattributable. | A |
| A thread embeds only "a limited number" of replies; the rest need one `comments.list?parentId=` call per thread. | A |
| The default listing returns `published` comments only. Held-for-review, likely-spam, rejected and deleted comments are invisible to us. | A (default), B (who may request other statuses) |
| Called with OAuth, `commentThreads.list` accepts only the broad `youtube.force-ssl` scope. So comments should be read with the project's **API key**, never with a member's token. | A |
| Each page costs 1 quota unit; default quota is reported as 10,000 units per day; exhaustion returns HTTP 403 `quotaExceeded`. | B |
| A video with comments turned off returns 403 `commentsDisabled`, not an empty list. | B |

Consequence for wording: an incomplete scan must be reported as "not found in the N
comments checked", never as "did not comment".

## 2. Rules that constrain the product

All tier **B** unless marked.

**Incentivised engagement is prohibited.** YouTube's fake-engagement and spam policies
prohibit artificially increasing views, likes, comments or other metrics, and list
"offering rewards in exchange for likes, views or subscribers" as engagement
manipulation. Simply asking viewers to like, comment or subscribe is allowed. TikTok's
Community Guidelines likewise prohibit trading services that artificially boost
engagement. *This is why no engagement action can earn points here — see §4.*

**Derived scores from API data are prohibited by default.** The YouTube API Developer
Policies forbid using API data to compute new metrics; the cited example is a score that
factors in likes or total views. Custom scores and leaderboards built on YouTube metrics
are reported as available only to audited clients with an accepted analytics use case
(policy dated June 2026). *So points, XP, tiers and rank must never be computed from
YouTube data at all.*

**YouTube data next to other data needs a clear label.** Non-YouTube data may appear
alongside YouTube API data only with a prominent disclosure of what comes from where.

**Storage limits.** Data fetched without the owner's authorization (for example public
counts) may be kept at most 30 calendar days, then deleted or refreshed. A user's request
to delete their data must be honoured within 7 calendar days. The deadline after a user
revokes access from Google's own security page was reported inconsistently (7 vs 30
days) — **unresolved**; the product assumes the stricter figure.

**Required disclosures before using the YouTube API for real.** A privacy policy the
user agrees to, explaining what is accessed and stored; a link to the YouTube Terms of
Service and the Google Privacy Policy; and how to revoke access in Google's security
settings.

**Contests.** YouTube permits contests that are free to enter, have official rules, do
not manipulate metrics and state that YouTube is not a sponsor. Relevant only if a
competition is ever tied to YouTube activity; the prototype's competitions are not.

**TikTok app review.** An app has no production API access until it passes review, and
"private or personal use" and "still in development" are listed as grounds for refusal.
Sandbox mode allows up to 10 named test accounts per sandbox without review. A
three-person private dashboard is therefore unlikely to obtain production TikTok access.

## 3. Sign in with Google and the optional YouTube link

All tier **B**.

- **Verifying the ID token on the server**: signature against Google's published keys
  (JWK set at `https://www.googleapis.com/oauth2/v3/certs`, re-fetched per its cache
  headers), `aud` equals our client id, `iss` is `accounts.google.com` or
  `https://accounts.google.com`, `exp` not passed. Google recommends a maintained
  library over hand-written checks.
- **`sub` is the identity.** It is unique and never reused. E-mail can change and is not
  a key.
- **E-mail is only trustworthy when Google is authoritative for it**: an `@gmail.com`
  address, or `email_verified` true together with an `hd` (Workspace domain) claim. For
  any other address `email_verified` alone is not proof. *The allowlist's
  first-sign-in match therefore accepts only Google-authoritative addresses.*
- **Delivery**: the button's popup mode returns the token to a JavaScript callback, which
  our page posts to the server. (Redirect mode instead posts to a `login_uri` with a
  `g_csrf_token` double-submit cookie; not used here.)
- **Headers the page needs**: `script-src https://accounts.google.com/gsi/client`;
  `frame-src` and `connect-src https://accounts.google.com/gsi/`; and
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` when the popup is not rendered
  through FedCM.
- **The ID token is not API access.** Reading the member's channel id needs a separate
  OAuth authorization-code request with scope `youtube.readonly` (the narrowest scope
  accepted by `channels.list?mine=true`; tier **A**), a `state` value checked on return,
  and an exactly matching redirect URI (HTTPS, or `localhost` for development).
- **A small private app can stay in "Testing"** in the Google Cloud console: up to 100
  listed test users and no verification review. In Testing, authorizations that include
  YouTube scopes expire after 7 days — harmless here, because the channel id is read
  once and no token is kept. Plain sign-in (name, e-mail, profile) is not affected.
- Accounts with no YouTube channel, or with several (Brand Accounts): behaviour of
  `mine=true` is **not documented** in what we could see. The link flow must show the
  member which channel was found and let them confirm it.
- Housekeeping reported for 2025: OAuth client secrets are shown only at creation, and
  Google may delete OAuth clients left unused for six months.

## 4. What the product does with all this

| Decision | Because |
|---|---|
| Likes, comments, views, shares, follows and subscriptions can be **shown** as statistics and can **never** earn points or XP. Enforced structurally (no data path to the ledger) and by `domain/policy.js`. | §2 incentivised engagement; the owner's brief |
| Points, XP, tiers and rank are computed only from the app's own ledger — never from platform numbers. | §2 derived scores |
| Platform statistics are displayed in their own clearly labelled block, with source and fetch time, and are dropped once older than 30 days. | §2 labelling and storage limits |
| "Like attribution" is reported by the adapters as **unsupported**, with this explanation, rather than hidden or faked. | §1 |
| Comment matching, when built, is informational, requires the member's own YouTube link, reads comments with the project API key, and reports incomplete scans honestly. | §1 limits |
| Linking YouTube stores only the channel id and the time of consent. No access or refresh token is kept. Unlinking deletes both immediately. | §2 storage, data minimisation |
| TikTok activity is **manual review only**. The TikTok adapter reports attribution as unsupported. | §1, §2 TikTok app review |
| The only automatic "verified" status planned is *video ownership* for creative submissions. Everything else a member submits is `unverified` until an admin reviews it (`manually_reviewed`). | §1 |
| First sign-in binds an allowlisted e-mail only when Google is authoritative for that address. | §3 |

## 5. Before any live API is switched on

1. Open the tier-B pages directly and confirm the wording and numbers above
   (the hosts need to be allowed in the build environment, or checked by a person).
2. Resolve the 7-versus-30-day deletion deadline after revocation.
3. Create the Google Cloud project, OAuth consent screen (Testing, listed test users)
   and API key; keep them in environment variables.
4. Publish a privacy policy and terms that carry the disclosures in §2.
5. Confirm the video-ownership field and the `mine=true` behaviour for accounts with no
   channel or several channels, against the live API.
6. Decide whether TikTok sandbox access is worth setting up at all.
