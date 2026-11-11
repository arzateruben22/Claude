export const meta = {
  name: 'oc-final-live-3',
  description: 'OC Ultra: merge the reviewed lane branches onto the live game (claude/final-live), judge with four lenses, up to two repairs, commit locally (no push)',
  phases: [
    { title: 'Merge', detail: 'merge each reviewed branch, prove the result' },
    { title: 'Verify', detail: 'four lenses; up to two repairs' },
    { title: 'Commit', detail: 'commit the fixes locally (the main loop pushes and publishes)' },
  ],
}

// args: { branches: [{ name: 'claude/sport-wheel', what: 'the fresh sport steering wheel', head: '<sha>' }, ...] }
const A = args || {}
const B = A.branches || []
const WT = '/home/user/Claude/tsu-live/top-speed-ultra'
const SESSION = 'Claude-Session: https://claude.ai/code/session_01NkQ41gebWX6mPbmCQZBc81'
const OUT = 'tests/out/final-live-3'
const PG = `Machine rules: 4 shared CPU cores; run ONE Playwright process at a time with long timeouts, keep proof runs lean (split suite groups so no single run passes 20 minutes), run commands in the foreground. To check for browsers use exactly: pgrep -f '[c]hrome-linux/chrom|[h]eadless_shell'. Playwright: require('playwright') from the worktree's node_modules; if its bundled browser is missing, launch with executablePath: '/opt/pw-browsers/chromium' (never run 'playwright install'). Always finish by calling StructuredOutput.`
const LIST = B.map((b) => `origin/${b.name} at ${b.head} (${b.what})`).join('; ')
const COMMON = `
OC Ultra: a phone-first first-person driving game on Orange County's real freeways (three.js 0.160 + TypeScript strict + React, a single-file build dist/artifact.html), with walkable venues (Lot 57 and Stoppage Time, mounted in the game through src/onfoot/embed.ts; Go To, Auto-drive, Get out, walk in, Drive back) and the OC Hypercar. Read the game folder's CLAUDE.md (in ${WT}). Verify in Playwright (headless Chromium with --use-angle=swiftshader --enable-unsafe-swiftshader) using the window.__game hooks (fastForward, navigateTo, setCam('cockpit'|'hood'|'chase'), stats). Look at every image you cite with the Read tool. Never invent results. ${PG}
Work only in ${WT} (git worktree of branch claude/final-live, whose base c3962c5 is the LIVE game = origin/local/live-preview, published as v14). Never touch other worktrees, the main checkout or the repo root (a different project). node_modules is a symlink; never commit it, tests/out or dist. Never push.
WHAT IS BEING MERGED (each passed its own two-lens review on its branch): ${LIST}.
KEEP: only two modes (Free Drive and Speed Survival); dist/artifact.html carries exactly one data-build="owner-test"; the venue mount layer (src/onfoot/embed.ts) and every venue's release path: leaving a venue must release everything it created (S4's new looks included: three Go To / Get out / Drive back round trips per venue with no heap growth); honest labels ("simulated", "Simulated crowd", "street driving isn't built yet", the map-data credits); no real money (test mode only); our own brands only (Rossini, Vela, the R badge, the OC mark, Lot 57, Stoppage Time; no real car brand names, logos or copied designs).
OWNERSHIP: src/preview/hands*, src/onfoot/people/*, src/preview/car-wheel.ts (the road wheels) and src/game/vehicle/Physics.ts belong to another session: their content must stay exactly as at c3962c5 unless a merged branch changed them (none should), and src/preview/spec.ts stays unchanged.`

const FIX_SCHEMA = { type: 'object', required: ['done', 'summary', 'after'], properties: { done: { type: 'boolean' }, summary: { type: 'string' }, merged: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } }, after: { type: 'array', items: { type: 'string' } }, suite: { type: 'string' }, heap: { type: 'string' } } }
const VERDICT_SCHEMA = { type: 'object', required: ['keep', 'reason'], properties: { keep: { type: 'boolean' }, reason: { type: 'string' }, fixes: { type: 'array', items: { type: 'string' } } } }
const COMMIT_SCHEMA = { type: 'object', required: ['done', 'hash', 'summary'], properties: { done: { type: 'boolean' }, hash: { type: 'string' }, summary: { type: 'string' } } }
const safe = async (p, o) => { try { return await agent(p, o) } catch (e) { log(`${o.label} failed: ${String(e).slice(0, 200)}`); return null } }

if (!B.length) return { kept: false, stage: 'args', summary: 'no branches to merge' }

phase('Merge')
let f = await safe(`${COMMON}
Task: MERGE. Start with 'git status' (must be clean) and 'git log --oneline -1' (must be c3962c5); if not, stop with done=false. 'git fetch origin ${B.map((b) => b.name).join(' ')}', and check each origin branch head equals the hash above (if not, merge the hash, and say so). Merge them one at a time in this order: ${B.map((b) => b.name).join(', ')}, each with 'git merge --no-ff <hash> -m "Merge origin/<branch> into claude/final-live: <what>"' (you MAY commit these merge commits; the configured author; the body's last line exactly: ${SESSION}; no model names). Resolve every conflict by keeping BOTH sides' intent (e.g. tests/regression.mjs gets every lane's new checks; the HUD and the cockpit keep both changes; road data keeps the debris fix: if the debris branch's scripts/levels.mjs bakes src/data/oc-levels.json, re-run it after the merge so the boot check's comparison holds). A branch whose merge cannot be made to work without losing behaviour: abort it ('git merge --abort'), list it under skipped with the reason, and go on.
Then PROVE the merged game, fixing in a follow-up edit (uncommitted) whatever the merge broke: npx tsc --noEmit (and -p tsconfig.game.json if it exists); npm run build (one owner-test mark); npm test split into runs by group (boot; phone; modes; venues; render; regression and every new check the lanes added), each run under 20 minutes; the venue round trips (three per venue, heap via performance.memory or CDP HeapProfiler: report the numbers); frames into ${OUT}/ (390x844 phone viewport copy of dist/artifact.html with <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"> injected, isMobile, hasTouch, DPR 3; and 1450x767): the main menu, the new wheel from the seat (Rossini GT and OC Hypercar), the driving HUD with Stoppage Time chosen in Go To (1450x767, 1350x750 and 390x844), the I-5 North at the Disney Way / Katella Ave exit from the seat, Stoppage Time on foot on HD, Lot 57 on foot, the OC Hypercar in the garage. Report merged / skipped, files changed by your follow-up edit, frame paths, the exact suite lines and the heap numbers.`, { label: 'merge', model: 'opus', effort: 'high', phase: 'Merge', schema: FIX_SCHEMA })
if (!f || !f.done) return { kept: false, stage: 'merge', summary: f ? f.summary : 'merger failed' }

const LENSES = [
  ['ours', `a sceptical senior engineer for the merge itself. Do NOT render. Read 'git log --oneline c3962c5..HEAD', 'git diff c3962c5 --stat' and each merge's conflict resolutions ('git show --cc <merge>'), plus the uncommitted follow-up ('git diff HEAD'). Check: every merged branch's reviewed change is fully present (compare each file against the branch head: nothing dropped in a conflict), nothing outside those changes slipped in, tsc is clean, the fast groups pass (run 'npm test -- --only=boot,modes' and the lanes' new regression checks yourself, timeout 1200 s), owner-test mark kept, two modes only, no per-frame allocation added by the merge.`],
  ['theirs', `the reviewer for the OTHER session's work and the shared code. Do NOT render more than one short script. Check with git that src/preview/hands*, src/onfoot/people/*, src/preview/car-wheel.ts, src/game/vehicle/Physics.ts and src/preview/spec.ts are byte-identical to c3962c5; then in ONE short Playwright run on dist/artifact.html check the hands still sit on the NEW steering wheel's rim at GRIP 32 and 148 degrees while steering (seat view, Rossini GT and OC Hypercar, 390x844 and 1280x720: no floating or clipping hands), the road wheels and tyres roll, and the people in both venues still render and animate.`],
  ['venues', `a sceptical game designer and QA lead for the venues and the roads. First look (Read tool) at the owner's own screenshot of the debris on the live game, /tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad/owner/debris-i5n-disney-katella-1350x750.jpg (grey ramp-deck slabs slanting across and over the I-5 North lanes and a brick sound wall jutting in, at the Disney Way / Katella Ave exit): the same spot from the same chase view must now be clean. Take your own frames in ONE short Playwright script on dist/artifact.html (390x844 phone viewport copy, DPR 3, isMobile, hasTouch; and 1350x750): Go To Stoppage Time, Auto-drive there (the route passes the I-5 North Disney Way / Katella Ave exit: look from the seat there; no ramp, deck, wall or slab may hang over, slant across or stand in the lanes), Get out, walk in on Low and HD (and Ultra if it is unlocked; 'Ultra · locked' must read honestly), play one thing, Drive back; then the same for Lot 57; three round trips with heap numbers (no growth). Judge: everything works end to end, S4's look is in the in-game venue, nothing leaks, the roads are clean.`],
  ['cars', `a sceptical automotive art director and game UI designer for the cars and the HUD. First look (Read tool) at the owner's own screenshot of the HUD problem on the live game, /tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad/owner/destination-hud-1450x767.jpg (the destination card under the VIEW button, the directions card and the route shield clipped at the top, the bottom controls cut off): reproduce that view (OC Hypercar, Stoppage Time chosen, chase camera, 1450x767) and confirm every one of those faults is gone. Look at the merger's frames with the Read tool, then take your own in ONE short Playwright script: the seat view of the Rossini GT, the Rossini Corsa and the OC Hypercar (the fresh sport wheel: Alcantara, carbon, flat bottom, stitching, the two dial widgets with live displays, thumb pads; switch the handling profile once and see the left dial change), the OC Hypercar in the garage and chase camera (M1b body detail), and the driving HUD with Stoppage Time chosen in Go To at 1450x767, 1350x750, 1280x600 and 390x844 (nothing overlaps or is clipped, the navigation reads as one panel top-left, the right rail stays inside the screen, Thrust / Focus Time and the drive chips fully visible). Judge: each piece looks as good as on its own branch and nothing fights another piece.`],
]
const judgeOne = (l, f, earlier) => safe(`${COMMON}
Task: you are ${l[1]} Take your own frames into /tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad/jdg-final3-${l[0]}/. Judge the ${earlier ? 'REPAIRED ' : ''}merged game in ${WT}. Default to keep=false unless the evidence convinces you; keep only a merge that carries every reviewed piece with no regressions; list concrete fixes if not.
${earlier ? 'Earlier verdicts: ' + earlier + '\n' : ''}Merger's summary: ${f.summary}
Merged: ${(f.merged || []).join(', ')}. Skipped: ${(f.skipped || []).join(', ') || 'none'}. Files: ${(f.files || []).join(', ')}. Frames: ${(f.after || []).join(', ')}. Suite: ${f.suite || 'not reported'}. Heap: ${f.heap || 'not reported'}`, { label: `${earlier ? 'rejudge' : 'judge'}:${l[0]}`, model: 'opus', effort: 'high', phase: 'Verify', schema: VERDICT_SCHEMA })
const judge = async (f, earlier) => {
  const vs = await parallel(LENSES.map((l) => () => judgeOne(l, f, earlier)))
  if (vs.some((v) => !v)) return { keep: false, reason: 'a reviewer did not report: ' + LENSES.filter((l, i) => !vs[i]).map((l) => l[0]).join(', '), fixes: [] }
  return { keep: vs.every((v) => v.keep), reason: vs.map((v, i) => `[${LENSES[i][0]}: ${v.keep ? 'keep' : 'reject'}] ${v.reason}`).join(' '), fixes: vs.flatMap((v) => v.fixes || []) }
}

phase('Verify')
let v = await judge(f, null)
for (let round = 1; round <= 2 && !v.keep; round++) {
  phase('Merge')
  const f2 = await safe(`${COMMON}
Task: REPAIR the merged game in ${WT} exactly as the reviewers asked, keeping what they accepted (edits on disk, uncommitted; read 'git diff HEAD' first; do not rewrite or redo the merge commits). If a reviewer says a merged piece cannot be kept without breaking the game, say so plainly instead of hiding it.
Reviewers: ${v.reason.slice(0, 5000)}
Fixes: ${(v.fixes || []).join(' | ').slice(0, 4000)}
Re-run the proof where your change touches it (frames with -r${round} names in ${OUT}/, tsc, the build, the affected test groups, the heap round trips if venues changed). Report as before.`, { label: `repair${round}`, model: 'opus', effort: 'high', phase: 'Merge', schema: FIX_SCHEMA })
  if (!f2 || !f2.done) break
  f = { ...f2, merged: f2.merged || f.merged, skipped: f2.skipped || f.skipped, files: Array.from(new Set([...(f.files || []), ...(f2.files || [])])) }
  phase('Verify')
  v = await judge(f, v.reason.slice(0, 3000))
}
if (!v.keep) return { kept: false, stage: 'judge', summary: f.summary, merged: f.merged, skipped: f.skipped, after: f.after, judge: v.reason.slice(0, 6000), fixes: v.fixes }

phase('Commit')
const c = await safe(`${COMMON}
Task: COMMIT the reviewed follow-up. You MAY run git, but NEVER push. In ${WT} on claude/final-live: if 'git status --short' shows changes (other than tests/out, dist, node_modules), add a short dated entry at the TOP of PROJECT_OC_PROGRESS.md ("## 2026-11-11: Final live merge 3", plain words: which branches went live and what each brings for the owner, what was skipped and why, the frame paths, the suite lines and heap numbers, that it passed four lenses), 'git add' the changed files by name and commit with subject "Final live merge 3: fixes", a plain body, last line exactly: ${SESSION}. No model names. If there were no changes, still add the progress entry and commit it with the same subject. Report the hash, 'git log --oneline -8' and 'git status --short'.
Merger: ${f.summary.slice(0, 2500)}
Suite: ${f.suite || ''}  Heap: ${f.heap || ''}
Reviewers: ${v.reason.slice(0, 2500)}`, { label: 'commit', model: 'opus', effort: 'low', phase: 'Commit', schema: COMMIT_SCHEMA })
return { kept: true, summary: f.summary, merged: f.merged, skipped: f.skipped, after: f.after, suite: f.suite, heap: f.heap, judge: v.reason.slice(0, 4000), commit: c }
