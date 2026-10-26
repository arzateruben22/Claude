# Runbook

## Daily routine (about 15 minutes)
1. **Home** shows what's due today. Open the **Upload Desk**.
2. Each task is one account. Check the account card says the handle you're signed in as in that app.
3. On a phone, **Share to app** sends the exact video straight to TikTok, YouTube or Instagram. Otherwise
   **Download**, then **Copy caption** (and **Copy title** for YouTube). For YouTube, also upload **Captions .srt**.
   Turn on the platform's AI / synthetic-content label (the narration is synthetic).
4. Post it, then **Mark uploaded**: tick the account box, and paste the post link if you have it. If you scheduled it
   inside the platform instead, give that time.
5. Leaving for the app and coming back returns you to the same task.

## Weekly
- **Review** new renders: watch each one, check the sources, then approve each account's video and text.
- **Calendar → Plan the next 7 days**. Add blackout days for travel.
- **Analytics:** log views from each app (or paste a CSV). Milestones unlock from real numbers only.
- **Queue:** look for dead jobs, then retry or read the error.

## Costs
- **Costs** (More → Costs): set a monthly production budget per channel (and, if you like, a studio-wide ceiling). It
  carries on each month until you change it. Record what you pay for (voices, music, services); tick **estimate** for
  quotes. Estimates and voided entries never count as spent. Prism only records costs; it never pays anything.
- Paid generation stays off unless Settings → **Paid generation** is on and that channel's budget has room this month.

## Demo data
`npm run db:seed -- --demo` adds a labelled demo series. It stays hidden until Settings → **Show demo data**; shown or
not, it never counts toward progress, rewards, XP, achievements or analytics totals.

## New episodes from the films pipeline
Render, then QA (`kits/cinema/film/qa.py`). Then either **Queue → Import rendered episodes** or
`npm run import:episodes`. A new render becomes a new version: older approvals end, and the episode comes back to
Review.

## Problems
| Symptom | Do |
|---|---|
| Can't sign in | Check `OWNER_PASSWORD_HASH` and `SESSION_SECRET` in `.env.local`. Five wrong tries lock sign-in for 15 minutes (per server process) |
| A task says "not approved" | Open Review: an edit or a new render withdrew the approval. Approve again |
| A post link is refused | Paste the platform's own https link. TikTok links must belong to the saved handle |
| Jobs stuck "running" | The worker died: start `npm run worker`. Expired leases are recovered within 15 minutes |
| Marked uploaded by mistake | Use **Undo** on the task (the audit log keeps the history) |
| Everything must stop | Settings → **Pause publishing** and/or **Stop external actions** |

## Backups
`pg_dump "$DATABASE_URL" > data/backups/prism-$(date +%F).sql` (the `data/backups` folder is git-ignored).
Restore into an empty database with `psql`. The rendered videos live in the films repo (`films/channels/*/ep*/out`).
