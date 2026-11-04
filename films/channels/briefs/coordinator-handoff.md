# Coordinator handoff: lower-usage setup (3 Nov 2026, 12:30 PM PST)

The previous coordinator session (session_01QoHo6s2RxqYM5nTnh8pa5q, top model, very long history) is retired to save
usage. You are the new coordinator. Everything is **paused**; the owner restarts work. The owner's weekly limit hit
99% on 3 Nov and resets **Sun 8 Nov, 2 PM PST**.

## How to work with the owner (Ruben)
- Times in **California time (PST)**. Short, simple replies, one clear next step. No walls of links.
- Send finished videos **in chat** (SendUserFile) with title, caption and a pointer to the upload kit.
- Nothing posts without the owner. Never ask for passwords, codes or API keys in chat (they go in environment settings).
- Never force-push; no PRs unless asked; no model names in commits; kill processes by PID, never `pkill -f`/`pgrep -f`
  (a `pgrep -f` wait loop matches its own shell and never ends: wait with `while kill -0 PID; do sleep 30; done`).
- Don't touch the Lumevina Monday task (trig_0146TF58oJg72pAmqh19Jo3F) or the Los Güeros site on `main`.

## Model and effort plan (to use less usage, same quality bar)
| Role | Model | Effort |
|---|---|---|
| Coordinator (you) | Sonnet | medium |
| Builders (scene code, scripts, fixes) | Sonnet | high |
| Reviewer that scores (a)–(h) | Opus (subagent: Agent tool, `model: "opus"`) | medium |
| Render workers (render slices, push parts) | Sonnet | low |

Rules: keep the gate unchanged (finals need no score under 3, (a), (g) and (h) at 4+, nothing factual or ethical open).
If one episode is stuck under (h) 4 after 3 rounds on Sonnet, ask the owner before moving only that episode to Opus.
Check in every **3 hours**, not hourly. Reuse the approved looks; no new look tests.

## What is done (all in the upload kit)
Reality Rulebook, One More Orbit, Possibility Lab: 6 shorts each (+ vol01). Body Backstage: No. 001 and No. 002 in the
new "live scan" look. Skin Sense: No. 001, 002, 003 in the upgraded look. All merged on `claude/made-with-claude-film`.
Upload kit: https://claude.ai/artifact/2SjdguhcYRrYL48yPxi7xD, regenerated with
`python3 -I films/channels/upload-kit/gen.py` (writes `films/channels/upload-kit/build/`; publish `upload-kit.html` with
the changed `covers/<slug>-NN.jpg` as files). Edit `NOTE`/`HOLD` at the top of gen.py when an episode lands.

## What is left (paused)
- **Skin Sense 004–006**: branch `claude/outer-layer-s1-b` (last 46a2243 + later slice commits). 005/006 have (a)–(g)
  at the bar, (h) 3, round-4 drafts part-rendered. 004 has (a) 3, (g) 3, (h) 2. Its death-line ruling isn't applied
  yet: no lethality or disease line over a face or skin. Brief: `films/channels/briefs/outer-layer.md` + the Skin
  Sense bible and PRODUCTION.md on `claude/outer-layer-s1`.
- **Body Backstage 003–006**: branch `claude/back-of-the-envelope-s1-b` (last ee9604c). 003 is at draft round 2
  (resume with `--resume`). 004 draft r1 is on `claude/body-backstage-draft-ep04-r1` (fe2519e), rendered to chunk 005.
  005/006 aren't rebuilt in the new look yet. Brief: `films/channels/briefs/body-backstage-reboot.md`.
- Existing idle sessions (top model, keep idle or archive once new ones exist): Skin builder 1
  session_0192s8Y1qqwVVS2o76ahft4Y, Skin builder 2 session_0192s8Y4YMoWjgWNhAHEkQyT, Body lead
  session_0192s8Y64dVP9kantwdLE3Ey. Sonnet render workers: W1 session_0192s8Y5CA9gS1btn9ZvdFgR,
  W2 session_0192s8Y5XG6z9Q5HCMKpvkTr, W3 session_0192s8Y5BftMAQQ4y3CS6BjD, W4 session_0192s8Y4bQMd58PnkARUaySQ.
  Workers accept jobs only from a session the coordinator has named to them, so tell them first.

## Delivering a final (per episode)
1. Merge the builder branch into `claude/made-with-claude-film` (check `df -h /` first; build/ dirs are disposable).
2. From `prism-studio/`: `npm run covers -- films/channels/<ch>/epNN --force`, then
   `npx tsx scripts/posting-pack.ts films/channels/<ch>/epNN`. Look at the cover (no clipped labels; `--at=<s>` re-picks).
3. Commit `out/`, push, regenerate and publish the kit, and send the 9x16 master in chat.
   Delivery encode: CRF 15, or the lowest CRF that keeps the master at or under 95 MB.
   Skin Sense captions carry "Education, not medical advice"; a dermatologist review is the owner's call.

## Prism Studio (the owner's posting studio; he calls it "Prism Studio")
- What it is: a Next.js + Postgres app in `prism-studio/` on this branch. It holds the channel catalog, the upload
  queue, captions and covers for every episode (YouTube, TikTok, Instagram), approvals, costs and lessons. Read
  `prism-studio/CLAUDE.md` (its rules: publishing is manual, never store passwords or codes) and `prism-studio/README.md`.
- Links the owner uses (both private artifacts of his; read them with the Artifact tool, action "read"):
  - **Prism Studio preview** (static, clickable, buttons linked): https://claude.ai/artifact/WBGPX93rZhTPXeB9jvKaiu
  - **Prism Studio launch checklist** (Railway hosting, steps 1–7): https://claude.ai/artifact/6EKHKokWLjAXuCo3VrvUzd
    (same content as `prism-studio/docs/LAUNCH-CHECKLIST.md`)
- When he says "give me Prism Studio", send the preview link. To refresh it with new episodes: run
  `prism-studio/scripts/static-preview.cjs` (read its header for usage; `static-preview-media.cjs` copies media), then
  publish to the same artifact URL (read it first).
- Per episode, run from `prism-studio/`: `npm run covers -- <ep> --force`, then `npx tsx scripts/posting-pack.ts <ep>`.
  Tests: `npm run typecheck && npm test` (start Postgres first: `service postgresql start`).
- Hosting isn't live yet: it waits on the owner's Railway address. Then `npm run media:push` sends films to
  `/api/media-push` (MEDIA_PUSH_TOKEN comes from the environment, never from chat).

## Open questions for the owner
1. Was the old-look Body Backstage No. 001 already posted? If yes, the new one goes up as a re-release.
2. Does he want his cloned voice (sent as an A/B test on 3 Nov)? If yes: the clone toolchain is on branch
   `claude/voice-clone` (`kits/cinema/voice/CLONE.md`, `setup_clone.sh`, `clone.lock.json` with pinned hashes,
   `ingest_male.py`). His recordings were never put in git, so he re-uploads the 3 voice memos to your session.
   Network hosts `*.hf.co` and `*.huggingface.co` are already allowed. The consent gate must pass.
3. Railway address for Prism Studio (`prism-studio/docs/LAUNCH-CHECKLIST.md`), and GEMINI_API_KEY for AI shots
   (paid generation stays off without a budget).
