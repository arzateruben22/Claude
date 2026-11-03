# Launch checklist: Prism Studio live from an iPhone

This checklist puts the studio online and connects YouTube, TikTok and Instagram, all from a phone browser. You
never need a terminal, SSH or a domain. Each step names the screen and the field. Screen labels were written on
2026-11-03 and may move a little; the words in **bold** are what to look for.

You'll end up with:
- the studio at `https://<name>.up.railway.app` (Railway's free https address, used as `PUBLIC_ORIGIN`);
- one Railway service that runs the web app and the worker together;
- a Postgres database;
- a disk at `/data` for the finished films.

A Claude cloud session sends the films to the studio and starts the import, so you never upload a file yourself.

The self-hosted path (`deploy/DEPLOY.md`: one server, Docker Compose, Caddy) still works and is unchanged.

## Why Railway

| | Railway (chosen) | Render | Fly.io |
|---|---|---|---|
| Set up from a phone | Yes: the dashboard does everything | Yes | Mostly through its command-line tool |
| Web + worker + Postgres + disk | One service with a disk, plus Postgres | A worker and a disk each need a paid instance; a disk can't be shared | Possible, but by CLI |
| Monthly cost (estimate) | **About $10–15**: Hobby plan $5, which includes $5 of usage, plus usage above that | About $21+ (web $7, worker $7, Postgres $7) | Similar to Railway |

Railway bills by use. The estimate assumes:
- one always-on service of about 0.5–1 GB memory;
- a small Postgres;
- a few GB of disk.

Railway shows the live figure under **Usage**. Step 1 sets a limit so it can't surprise you.

**No Cloudflare R2 or other bucket is needed.** The films (about 1.6 GB today) live on Railway's disk. Instagram
fetches each video from the studio's own short-lived signed link. A bucket only becomes worth it if the films outgrow
the disk; there is no bucket adapter in the code yet.

## 1. Railway account and project (10 minutes)

1. Open **railway.com** and sign up with **GitHub** (the account that owns `arzateruben22/Claude`).
   - Choose the **Hobby** plan.
   - Under **Account → Usage**, set a **usage limit** (for example $25). Railway stops the service rather than bill
     past it.
2. **New Project → Deploy from GitHub repo → `arzateruben22/Claude`.**
   - Allow Railway's GitHub app to see that repository when it asks.
3. Open the new service, then **Settings**:
   - **Source → Branch**: the branch the studio ships from. Today that's `claude/made-with-claude-film` (decision
     below).
   - **Source → Root Directory**: `/prism-studio`
   - **Config-as-code → Railway Config File**: `/prism-studio/railway.json`. This file tells Railway to build the
     Dockerfile and start web and worker together (`deploy/entrypoint.sh all`), with the health check on
     `/api/health`.
4. **+ Create → Database → PostgreSQL.** Railway adds a Postgres service to the project.
5. **Add the disk.** In the project canvas, tap the app service, then **+ Create → Volume** (or the service's menu
   → **Attach volume**).
   - Attach it to the app service.
   - **Mount path:** `/data`
6. **The free https address.** App service → **Settings → Networking → Generate Domain**, port **3100**. Copy the
   address it shows, `https://<name>.up.railway.app`.

## 2. Variables, first part (5 minutes)

App service → **Variables → Raw Editor**. Paste this, with your address in `PUBLIC_ORIGIN`, then **Update
Variables**:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PUBLIC_ORIGIN=https://<name>.up.railway.app
MEDIA_ROOT=/data/media
FILMS_REPO_ROOT=/data/films-mirror
PORT=3100
RAILWAY_RUN_UID=0
```

- `${{Postgres.DATABASE_URL}}` is typed as is. Railway fills it in from the Postgres service; if your Postgres
  service has another name, use that name.
- `RAILWAY_RUN_UID=0` lets the app write to the disk, which Railway mounts as root.

Railway deploys. The first build takes about 5 minutes; **Deployments** shows it go green.

## 3. Your passphrase and the secrets (3 minutes, no terminal)

1. On the phone, open `https://<name>.up.railway.app/setup`. The page exists only until the passphrase is set.
2. Type a new passphrase twice (12+ characters) and tap **Make my variables**.
   - Save the passphrase in your password manager first; Prism can't show it again.
   - The passphrase goes only to your own studio, over https, and becomes a hash there. It never goes into a chat.
3. Tap **Copy all**. You get four lines:
   - `SESSION_SECRET`
   - `INTEGRATIONS_KEY`
   - `MEDIA_PUSH_TOKEN`
   - `OWNER_PASSWORD_HASH`
4. Railway → app service → **Variables → Raw Editor**: paste them at the end, then **Update Variables**.
5. After the redeploy, `/setup` answers "not found" and `/login` takes your passphrase. Sign in.
6. Add the studio to the Home Screen: Safari → **Share → Add to Home Screen**.

Never change `INTEGRATIONS_KEY` or `SESSION_SECRET` later:
- a new `INTEGRATIONS_KEY` makes every platform connection unreadable, so you'd reconnect them all;
- a new `SESSION_SECRET` signs every device out.

## 4. Films onto the studio (once, then whenever there are new renders)

A Claude cloud session sends the finished films. It needs two values, which you add to its environment, never to a
chat.

1. In the Claude app, open a session in this repository's environment, then use the **environment menu in the title
   bar → Edit**.
2. **Environment variables:** add
   - `STUDIO_URL=https://<name>.up.railway.app`
   - `MEDIA_PUSH_TOKEN=` the same value as in Railway. Copy it from Railway → **Variables** → `MEDIA_PUSH_TOKEN` (the
     copy icon).
3. **Network access:** allow the studio's host, `<name>.up.railway.app`, under **Allowed domains**, and leave
   **Allow package managers** ticked.
4. Start a new session and say: *"Push the films to the hosted studio."*

What the session runs, from `prism-studio/`:

```
npm run media:check
STUDIO_URL=… MEDIA_PUSH_TOKEN=… npm run media:push
```

- `media:check` flags any 1440p YouTube file that isn't newer than its master, after a checkout; `RUNBOOK.md` has the
  fix.
- `media:push` sends only new or changed files: each episode's script, claims, film timings, QA report, finals and
  covers, plus the lesson compilations. It keeps their modified times and queues **Import rendered episodes** on the
  studio.
- The first push is about 1.6 GB. After that, only what changed.
- In the studio, **Queue** shows the import finish, and the episodes appear in **Review**.

## 5. Connect the platforms

Each platform needs an app in its developer console. All three use these redirect URIs (copy them exactly):

| Platform | Redirect URI |
|---|---|
| YouTube (Google Cloud) | `https://<name>.up.railway.app/api/auth/youtube/callback` |
| TikTok for Developers | `https://<name>.up.railway.app/api/auth/tiktok/callback` |
| Instagram (Meta) | `https://<name>.up.railway.app/api/auth/instagram/callback` |

After each app, add its two values in Railway → **Variables**. Once the service restarts, go to **Accounts** in the
studio and tap **Connect** on that account.

### YouTube: Google Cloud (15 minutes)

1. Open **console.cloud.google.com**, then the project picker → **New project**, named "Prism Studio".
2. **APIs & Services → Library**: search **YouTube Data API v3** and tap **Enable**.
3. **Google Auth Platform** (formerly *OAuth consent screen*):
   - **Branding:** app name "Prism Studio" and your support email.
   - **Audience:** user type **External**. Leave the app in **Testing**.
   - **Audience → Test users → Add users:** every Google account you sign in with to manage the five YouTube
     channels.
   - **Data access → Add or remove scopes:** `…/auth/youtube.upload` and `…/auth/youtube.readonly`.
4. **Clients → Create client → Web application**, named "Prism Studio".
   - **Authorized redirect URIs:** the YouTube URI above.
   - Copy the **Client ID** and **Client secret**.
5. Railway variables: `GOOGLE_CLIENT_ID=…` and `GOOGLE_CLIENT_SECRET=…`.

What to expect:
- **In Testing, sign-ins last 7 days.** Accounts shows "needs reconnecting" weekly until you publish the app (decision
  below).
- **Publishing the app without Google's verification** works for you as its only user: sign-in shows an
  "unverified app" warning you can click through.
- **Uploads through the API stay private until YouTube's API audit.** A project that hasn't passed the **YouTube API
  Services audit** can only upload private videos.
  - Make each one public in YouTube Studio, or apply through Google's **YouTube API Services – Audit and Quota
    Extension** form.
  - The audit checks that the app follows YouTube's terms. Answers usually take a few weeks, and it may ask for a
    screencast of the studio.
- **Quota:** 10,000 units a day; one upload costs about 1,600. That's about 6 uploads a day before any extension.

### TikTok: TikTok for Developers (15 minutes, then review)

1. Open **developers.tiktok.com**, log in, then **Manage apps → Connect an app** (an individual developer account
   is fine).
2. In the app's details:
   - **Category:** your best fit.
   - **Description:** "Posts my own channel's videos from my studio."
   - **Platforms:** **Web**, with the studio address as the website URL.
   - Terms of service and privacy policy URLs: if the form insists, use the studio address for now.
3. **Add products:** **Login Kit** and **Content Posting API**.
   - **Login Kit → Redirect URI:** the TikTok URI above.
   - **Scopes:** `user.info.basic`, `user.info.profile`, `video.upload`, `video.publish`, `video.list`.
4. **Sandbox:** create a sandbox and add your five TikTok accounts as **target users**, so they can connect before
   review.
5. Copy the **Client key** and **Client secret** into Railway: `TIKTOK_CLIENT_KEY=…` and `TIKTOK_CLIENT_SECRET=…`.

What to expect:
- **Uploads go to your TikTok inbox** (the studio's default), and you finish each post in the TikTok app.
- **Direct posting from an unaudited app is private-only** (`SELF_ONLY`), for at most 5 users in 24 hours, and the
  account must be private at posting time.
- **TikTok's audit** of the Content Posting API lifts those limits. Apply from the app page once a few test posts
  have worked. Expect days to weeks, plus a demo video of the flow.
- After approval, tick **audited** on each TikTok account card in **Accounts**.

### Instagram: a Meta app (15 minutes)

The shared Instagram must be a **professional** account (Business or Creator): in the Instagram app, **Settings →
Account type and tools → Switch to professional account**.

1. Open **developers.facebook.com → My Apps → Create app**.
   - Use case: **Manage messaging and content on Instagram** (Instagram API with **Instagram Login**).
   - App type: **Business**, if it asks.
2. **Instagram → API setup with Instagram login**:
   - **Set up Instagram business login → Business login settings → OAuth redirect URIs:** the Instagram URI above.
     Save.
   - Copy the **Instagram app ID** and **Instagram app secret**. They're different from the Facebook App ID at the
     top.
3. **App roles → Roles → Add people → Instagram Tester:** your Instagram account.
   - Accept the invitation in Instagram: **Settings → Apps and websites → Tester invites**. On the web it's
     instagram.com → Settings → Apps and websites.
4. Permissions the studio asks for: `instagram_business_basic`, `instagram_business_content_publish`,
   `instagram_business_manage_insights`.
5. Railway variables: `INSTAGRAM_APP_ID=…` and `INSTAGRAM_APP_SECRET=…`.

What to expect:
- **No review is needed for your own account.** Your account works while it has a role on the app. Meta's App Review
  and Business Verification are only for other people's accounts.
- Publishing is limited to **50 API posts per 24 hours**, and sign-ins last **60 days**. The studio refreshes them.

## 6. First real test (10 minutes)

1. **Review:** approve one episode for one connected account.
2. **Upload Desk → Publish now** on that task. TikTok lands in the inbox; YouTube uploads private.
3. Check it reaches **verified** (Accounts / Analytics) and that the platform shows it. Then do the next platform.
4. **Settings → Notifications → Notify this device**, from the Home Screen app, then **Send a test notification**.

## Decisions for you

1. **Which branch Railway deploys.** The studio lives on `claude/made-with-claude-film` today. `main` is the Los
   Güeros site, so pick the branch the coordinator merges finished studio work into.
2. **A spending limit.** For example $25 a month (step 1).
3. **YouTube sign-in:** stay in **Testing** and reconnect weekly, or **publish** the consent screen unverified (one
   warning at sign-in, no weekly reconnect).
4. **When to apply for the audits:**
   - YouTube API audit, needed for public uploads by API;
   - TikTok Content Posting audit, needed for direct public posts.

   Both are easiest after a few private test uploads.
5. **Backups.** Railway's Postgres has a **Backups** tab on plans that offer it. Otherwise ask a cloud session to
   take a dump now and then.

## If something goes wrong

| What you see | What to do |
|---|---|
| The deploy fails at "permission denied" on `/data` | Check `RAILWAY_RUN_UID=0` is in Variables |
| `/setup` says not found before you've set a passphrase | `OWNER_PASSWORD_HASH` already has a value in Variables: delete it, wait for the redeploy, try again |
| The push says "media push is off or the token is wrong" | `MEDIA_PUSH_TOKEN` differs between Railway and the Claude environment |
| The push says the host was denied | Add the studio's host to the Claude environment's **Allowed domains** |
| A platform says the redirect URI doesn't match | Its URI must be exactly the one above, with your `<name>`, `https`, and no trailing slash |
| Accounts shows "needs reconnecting" | Tap **Reconnect**. YouTube in Testing does this weekly |
