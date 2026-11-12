export const meta = {
  name: 'oc-finish-lane',
  description: 'OC Ultra: finish one paused lane after the container reset (continue the restored work on disk, judge it with two lenses, up to two repairs, commit and push its branch)',
  phases: [
    { title: 'Build', detail: 'continue the restored work on disk and prove it' },
    { title: 'Verify', detail: 'two lenses; up to two repairs' },
    { title: 'Commit', detail: 'one reviewed commit, pushed (fast-forward)' },
  ],
}

// args: { id, title, wt, branch, brief, lensA: 'play'|'art', lensAText, commit: { subject, how } }
const A = args || {}
const SESSION = 'Claude-Session: https://claude.ai/code/session_01NkQ41gebWX6mPbmCQZBc81'
const PG = `Machine rules: 4 shared CPU cores and up to four other lanes run Playwright at the same time, so run ONE Playwright process at a time with long timeouts, keep proof runs lean (targeted frames and Node scans; split suite groups so no single run passes 20 minutes), and run commands in the foreground. Never wait in a loop on 'pgrep -f <pattern>' that matches your own shell; to check for browsers use exactly: pgrep -f '[c]hrome-linux/chrom|[h]eadless_shell'. Playwright: require('playwright') from the worktree's node_modules; if its bundled browser is missing, launch with executablePath: '/opt/pw-browsers/chromium' (never run 'playwright install'). Always finish by calling StructuredOutput.`
const COMMON = `
OC Ultra: a phone-first first-person driving game on Orange County's real freeways (three.js 0.160 + TypeScript strict + React, a single-file build), with walkable venues (Lot 57, Stoppage Time) and the OC Hypercar. Read the game folder's CLAUDE.md (in ${A.wt}). Verify in Playwright (headless Chromium with --use-angle=swiftshader --enable-unsafe-swiftshader) using the window.__game hooks (fastForward, navigateTo, setCam('cockpit'|'hood'|'chase'), stats). The game has only Free Drive and Speed Survival. Look at every image you cite with the Read tool. Never invent results. ${PG}
Work only in ${A.wt} (git worktree, branch ${A.branch}). Never touch other worktrees, the main checkout or the repo root (the repo root is a different project). node_modules is a symlink; don't commit it, tests/out or dist.
OWNERSHIP: src/preview/hands*, src/onfoot/people/*, src/preview/car-wheel.ts (the ROAD wheels) and src/game/vehicle/Physics.ts belong to another session: do not edit them. Our own brands only (Rossini, Vela, the R badge, the OC mark, Lot 57, Stoppage Time): no real car brands, logos or copied designs. Honest labels stay ("simulated", "Simulated crowd", "street driving isn't built yet", the map-data credits). No real money; the store stays in test mode.
RESTORED WORK: the cloud machine was reset on 2026-11-10/11. This worktree was rebuilt from its last backup: HEAD is the lane's base commit and the working tree holds the uncommitted work of the earlier builders and repairers, exactly as it was when the work was paused (some of it may be half-finished: a repair was interrupted). Start with 'git status' and 'git diff HEAD --stat', read the diff, then continue. Earlier test outputs and frames (tests/out) were NOT restored: re-shoot what you cite.`

const FIX_SCHEMA = { type: 'object', required: ['done', 'summary', 'files', 'after'], properties: { done: { type: 'boolean' }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, after: { type: 'array', items: { type: 'string' } }, before: { type: 'array', items: { type: 'string' } }, stats: { type: 'string' }, suite: { type: 'string' } } }
const VERDICT_SCHEMA = { type: 'object', required: ['keep', 'reason'], properties: { keep: { type: 'boolean' }, reason: { type: 'string' }, fixes: { type: 'array', items: { type: 'string' } } } }
const COMMIT_SCHEMA = { type: 'object', required: ['done', 'hash', 'summary'], properties: { done: { type: 'boolean' }, hash: { type: 'string' }, summary: { type: 'string' } } }
const safe = async (p, o) => { try { return await agent(p, o) } catch (e) { log(`${o.label} failed: ${String(e).slice(0, 200)}`); return null } }

if (!A.id || !A.wt || !A.brief) return { kept: false, stage: 'args', summary: 'missing args' }
const JUDGE_DIR = `/tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad/jdg-${A.id}/`
const LENS = {
  A: `${A.lensAText} Take your own frames into ${JUDGE_DIR}.`,
  code: `a sceptical senior engineer. Do NOT render; read 'git diff HEAD' and the new files in ${A.wt}, run 'npx tsc --noEmit' and the brief's fast test groups yourself (timeout 1200 s), and check: the brief is met in the code (list each item: done / not done), causes fixed at the source, no check weakened to pass, no per-frame allocation, the phone tier stays cheap, nothing outside the brief changed, the other session's files untouched, honest player-facing copy, our own brands only.`,
}
const judgeOne = (lens, f, earlier) => safe(`${COMMON}
THE BRIEF (${A.title}):
${A.brief}
Task: you are ${lens === 'A' ? LENS.A : LENS.code} Judge the ${earlier ? 'REPAIRED ' : ''}work in ${A.wt}. Default to keep=false unless the evidence convinces you. Keep only work that meets the brief with no regressions; list concrete fixes if not.
${earlier ? 'Earlier verdicts: ' + earlier + '\n' : ''}Builder's summary: ${f.summary}
Files: ${(f.files || []).join(', ')}. Before: ${(f.before || []).join(', ')}. After: ${(f.after || []).join(', ')}. Stats: ${f.stats || ''}. Suite: ${f.suite || 'not reported'}`, { label: `${earlier ? 'rejudge' : 'judge'}:${A.id}:${lens === 'A' ? A.lensA : 'code'}`, model: 'opus', effort: 'high', phase: 'Verify', schema: VERDICT_SCHEMA })
const judge = async (f, earlier) => {
  const vs = (await parallel([() => judgeOne('A', f, earlier), () => judgeOne('code', f, earlier)])).filter(Boolean)
  if (vs.length < 2) return { keep: false, reason: 'a reviewer did not report', fixes: [] }
  return { keep: vs.every((v) => v.keep), reason: vs.map((v, i) => `[${i === 0 ? A.lensA : 'code'}: ${v.keep ? 'keep' : 'reject'}] ${v.reason}`).join(' '), fixes: vs.flatMap((v) => v.fixes || []) }
}

phase('Build')
let f = await safe(`${COMMON}
THE BRIEF (${A.title}):
${A.brief}
Task: CONTINUE and FINISH this work in ${A.wt}. Read the restored diff first; keep what is sound, finish what is missing or half-done, fix what is wrong. Then prove it as the brief says. Do not commit. Report files, before and after image paths, the numbers, the exact suite lines, and anything still not right, plainly (list every brief item as done or not done).`, { label: `build:${A.id}`, model: A.buildModel || 'opus', effort: 'high', phase: 'Build', schema: FIX_SCHEMA })
if (!f || !f.done) return { kept: false, stage: 'build', summary: f ? f.summary : 'builder failed' }

phase('Verify')
let v = await judge(f, null)
for (let round = 1; round <= 2 && !v.keep; round++) {
  phase('Build')
  const f2 = await safe(`${COMMON}
THE BRIEF (${A.title}):
${A.brief}
Task: REPAIR this work in ${A.wt} exactly as the reviewers asked, keeping what they accepted (edits on disk; read git diff HEAD first). Do not commit.
Reviewers: ${v.reason.slice(0, 5000)}
Fixes: ${(v.fixes || []).join(' | ').slice(0, 4000)}
Re-run the proof where your change touches it (frames with -r${round} names, tsc, the build, the affected test groups). Report as before.`, { label: `repair${round}:${A.id}`, model: A.repairModel || A.buildModel || 'opus', effort: 'high', phase: 'Build', schema: FIX_SCHEMA })
  if (!f2 || !f2.done) break
  f = { ...f2, files: Array.from(new Set([...(f.files || []), ...(f2.files || [])])) }
  phase('Verify')
  v = await judge(f, v.reason.slice(0, 2500))
}
if (!v.keep) return { kept: false, stage: 'judge', summary: f.summary, after: f.after, judge: v.reason.slice(0, 6000), fixes: v.fixes }

phase('Commit')
const c = await safe(`${COMMON}
Task: COMMIT and PUSH the reviewed work. You MAY run git. In ${A.wt} on branch ${A.branch}:
${A.commit.how}
Add a short dated entry at the TOP of PROJECT_OC_PROGRESS.md ("## 2026-11-11: ${A.commit.subject}", plain words: what the owner asked, what was built, the frame paths, the numbers and the suite lines below, that it passed a ${A.lensA} lens and a code lens). 'git add' the changed files by name (never tests/out, dist or node_modules); commit with the configured author, subject "${A.commit.subject}", a plain body, last line exactly: ${SESSION}. No model names. Then push the branch with a fast-forward push ('git push -u origin ${A.branch}'; never force; if the push is refused, stop and report done=false with the error). Report the hash, 'git log --oneline -3' and 'git status --short'.
Builder: ${f.summary.slice(0, 2500)}
Suite: ${f.suite || ''}
Reviewers: ${v.reason.slice(0, 2000)}`, { label: `commit:${A.id}`, model: 'opus', effort: 'low', phase: 'Commit', schema: COMMIT_SCHEMA })
return { kept: true, summary: f.summary, after: f.after, suite: f.suite, judge: v.reason.slice(0, 4000), commit: c }
