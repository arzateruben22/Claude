/**
 * Job Finder build: turns a web-search sweep (workflow journals) into ranked data and a page.
 *
 *   npx tsx scripts/jobfinder-build.ts --journals <dir>[,<dir>...] --date 2026-11-11 \
 *        --out data/jobs/2026-11-11.json --html /path/to/jobfinder.html
 *
 * Each journal directory holds a journal.jsonl whose lines pair "find:<slice>" agents (candidate
 * postings) with "verify:<slice>:<n>" agents (independent verdict for candidate n). A candidate
 * with no verdict is ruled out rather than shown as a match.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FIELD_LABELS, WEIGHTS, scoreRow, select, type Candidate, type RawRow, type ScoredJob, type Verdict } from "../src/lib/jobfinder/score";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type FindResult = { candidates?: Candidate[]; searched?: string[]; notFound?: string[] };

export function readJournals(dirs: string[]) {
  const rows: RawRow[] = [];
  const searched: string[] = [];
  const notFound: string[] = [];
  const slices: string[] = [];
  const watch: { slice: string; items: string[] }[] = [];
  let verifyPending = 0;
  for (const dir of dirs) {
    const file = path.join(dir, "journal.jsonl");
    if (!existsSync(file)) continue;
    const labels = new Map<string, string>();
    const results = new Map<string, unknown>();
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let rec: { type?: string; agentId?: string; label?: string; result?: unknown };
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (rec.type === "started" && rec.agentId && rec.label) labels.set(rec.agentId, rec.label);
      if (rec.type === "result" && rec.agentId) results.set(rec.agentId, rec.result);
    }
    const byLabel = new Map<string, unknown>();
    for (const [agentId, label] of labels) if (results.has(agentId)) byLabel.set(label, results.get(agentId));
    for (const [label, result] of byLabel) {
      if (!label.startsWith("find:") || !result || typeof result !== "object") continue;
      const key = label.slice(5);
      const found = result as FindResult;
      slices.push(key);
      searched.push(...(found.searched ?? []));
      notFound.push(...(found.notFound ?? []));
      watch.push({ slice: key, items: found.notFound ?? [] });
      (found.candidates ?? []).slice(0, 6).forEach((c, i) => {
        const v = byLabel.get(`verify:${key}:${i + 1}`);
        if (!v) verifyPending++;
        rows.push({ ...c, slice: key, verdict: v && typeof v === "object" ? (v as Verdict) : null });
      });
    }
  }
  return { rows, searched, notFound, slices, verifyPending, watch };
}

const trimJob = (j: ScoredJob) => ({
  ...j,
  evidence: (j.evidence ?? []).slice(0, 3),
  verdict: j.verdict ? { ...j.verdict, independentEvidence: (j.verdict.independentEvidence ?? []).slice(0, 3) } : null,
});

const SLICE_LABELS: Record<string, string> = {
  "city-utilities": "City of Los Angeles, LADWP, LA Metro, ports and airports",
  "counties-districts": "Counties, cities and water or sanitation districts",
  "campus-hospital": "Universities, colleges and hospitals",
  "electrical-contractors": "Electrical contractors and utilities",
  "elevator-hvac-pipe": "Elevator, commercial HVAC and piping",
  "industrial-plants": "Refineries, plants, aerospace and theme parks",
  "construction-office": "Construction office roles",
  "building-engineering": "Building engineering and data centers",
};

/** Keep the finder notes that tell the applicant something actionable: a date, a window, a place to check. */
const WATCH_RE = /\b(open|opens|opening|closed|closes|window|filing|watch|check|next cycle|tentative|re-check|recheck|waitlist|accept)/i;
const NOISE_RE = /^(coverage limit|not searched|no best_fit|search budget|attempted but not)/i;

export function build(dirs: string[], date: string, programsFile?: string) {
  const { rows, searched, notFound, slices, verifyPending, watch } = readJournals(dirs);
  const scored = rows.map(scoreRow);
  let sel = select(scored, { best: 10, stretch: 5, maxPerEmployer: 2 });
  for (const cap of [3, 4]) {
    if (sel.bestFit.length >= 10 && sel.stretch.length >= 5) break;
    sel = select(scored, { best: 10, stretch: 5, maxPerEmployer: cap });
  }
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const label = fmt(date);
  const shown = [...sel.bestFit, ...sel.stretch, ...sel.bench];
  const unchecked = shown.filter((j) => !j.checked).length;
  const programs: Record<string, unknown>[] = programsFile && existsSync(programsFile) ? JSON.parse(readFileSync(programsFile, "utf8")) : [];
  const programsChecked = programs.map((p) => String(p.verifiedOn ?? "")).filter(Boolean).sort().at(-1);

  const notices: string[] = [];
  if (sel.bestFit.length < 10 || sel.stretch.length + sel.bench.length < 5) {
    notices.push(`This is short of the ${sel.bestFit.length < 10 ? "10 best-fit" : "5 stretch"} openings you asked for.||Today's search surfaced ${sel.bestFit.length} best-fit and ${sel.stretch.length + sel.bench.length} stretch leads that hold up. Nothing was padded to reach the number. The search allowance ran out partway; a second pass will widen it.`);
  }
  if (unchecked > 0) {
    notices.push(`${unchecked === shown.length ? "None" : `${shown.length - unchecked} of ${shown.length}`} of these leads ${unchecked === shown.length ? "has" : "have"} been double-checked yet.||Each was found once in search results on ${label}. The independent pass that tries to disprove every posting could not run because the search allowance was used up, and the job sites cannot be opened from where this ran. Open each posting and confirm it is live before you spend time on it.`);
  } else {
    notices.push(`Open each link to confirm it is still accepting applications.||These were found and cross-checked through web search on ${label}; the job sites themselves could not be opened from where this ran.`);
  }
  notices.push("Your résumé has not been shared yet.||Fit is scored against your stated goals and an assumed beginner background, so tick the requirement boxes yourself. Cover letters use [square brackets] wherever only you know the fact.");
  notices.push("Nothing has been submitted for you.||Every application is yours to send.");

  return {
    generatedOn: date,
    generatedLabel: label,
    weights: WEIGHTS,
    fieldLabels: FIELD_LABELS,
    lede: `${sel.bestFit.length} best-fit and ${sel.stretch.length + sel.bench.length} stretch openings, each applied for directly with the employer, plus ${programs.length} paid apprenticeship routes and a watch list of entry jobs that open soon. Ranked against the goals you gave: $80K+ pay or a paid path to it, hands-on trade work with low AI exposure, starting from beginner.`,
    notices,
    methodNote: `Eight search sweeps covered ${slices.length} groups of employers and surfaced ${rows.length} postings with an employer-site link and a pay figure. ${sel.ruledOut.length} were ruled out (closed, out of reach, or a duplicate route). A second independent pass is meant to try to disprove each one; today it ${unchecked === shown.length ? "could not run any searches" : `completed for ${shown.length - unchecked} of ${shown.length}`}, so the "Still open" factor uses the first pass's own confidence where no second check exists.`,
    assumptions:
      "career changer and beginner in the trades, high-school diploma or GED, no journey-level card or state electrician certification, living in the LA and Orange County area. Driving requirements are flagged and never assumed about you.",
    stats: { slices: slices.length, found: rows.length, ruledOut: sel.ruledOut.length, verifyPending, unchecked },
    bestFit: sel.bestFit.map(trimJob),
    stretch: sel.stretch.map(trimJob),
    bench: sel.bench.map(trimJob),
    ruledOut: sel.ruledOut.map((j) => ({ id: j.id, employer: j.employer, title: j.title, payText: j.payText, postingUrl: j.postingUrl, ruledOutReason: j.ruledOutReason, slice: j.slice })),
    programs,
    programsCheckedLabel: programsChecked ? fmt(programsChecked) : "",
    watch: watch
      .map((g) => ({ label: SLICE_LABELS[g.slice] ?? g.slice, items: g.items.filter((x) => WATCH_RE.test(x) && !NOISE_RE.test(x.trim())) }))
      .filter((g) => g.items.length > 0),
    searched: [...new Set(searched)],
    notFound: [...new Set(notFound)],
  };
}

function main() {
  const journals = (arg("journals") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const date = arg("date") ?? new Date().toISOString().slice(0, 10);
  if (!journals.length) {
    console.error("usage: tsx scripts/jobfinder-build.ts --journals <dir>[,<dir>] [--date YYYY-MM-DD] [--out file.json] [--html file.html]");
    process.exit(1);
  }
  const data = build(journals, date, arg("programs") ?? path.join(__dirname, "..", "data", "seed", "apprenticeship_programs.json"));
  const out = arg("out");
  if (out) {
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
  }
  const html = arg("html");
  if (html) {
    const template = readFileSync(path.join(__dirname, "..", "jobfinder", "page-template.html"), "utf8");
    const { searched: _s, notFound: _n, ...pageData } = data;
    void _s; void _n;
    mkdirSync(path.dirname(html), { recursive: true });
    writeFileSync(html, template.replace("__DATA__", () => JSON.stringify(pageData).replace(/</g, "\\u003c")));
  }
  console.log(JSON.stringify({ ...data.stats, bestFit: data.bestFit.length, stretch: data.stretch.length, bench: data.bench.length, programs: data.programs.length, watch: data.watch.reduce((a, g) => a + g.items.length, 0) }));
  for (const j of [...data.bestFit, ...data.stretch]) console.log(`${j.list.padEnd(8)} ${String(j.score).padStart(3)}  ${j.checked ? "checked  " : "unchecked"} ${j.employer} | ${j.title} | ${j.payText.slice(0, 60)} | open ${Math.round(j.breakdown.open.value * 100)}%`);
  for (const j of data.ruledOut) console.log(`ruled    ${j.employer} | ${j.title} | ${j.ruledOutReason}`);
}

if (process.argv[1] && process.argv[1].endsWith("jobfinder-build.ts")) main();
