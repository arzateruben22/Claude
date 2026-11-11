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
import { HOME, PAY_RULE } from "../src/lib/jobfinder/geo";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type FindResult = { candidates?: Candidate[]; searched?: string[]; notFound?: string[] };

export function readJournals(dirs: string[], leads: Candidate[] = []) {
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
      // "recheck:<n>" = the second pass's verdict on lead n of an earlier run.
      if (label.startsWith("recheck:") && result && typeof result === "object") {
        const lead = leads[Number(label.slice(8)) - 1];
        if (lead) rows.push({ ...lead, slice: "recheck", verdict: result as Verdict });
        continue;
      }
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

/**
 * A starting letter for a posting the second pass never reached. It states only what the posting
 * says; everything about the applicant is a bracket for them to fill in.
 */
export function defaultLetter(j: ScoredJob): string {
  const asks = (j.minimumRequirements ?? []).slice(0, 3).map((r) => `- ${r}`).join("\n");
  return [
    "[your name]",
    "[your city, CA] | [phone] | [email]",
    "",
    `Dear Hiring Team at ${j.employer.replace(/\s*\(.*$/, "")},`,
    "",
    `I am applying for the ${j.title.replace(/\s+-\s+\$.*$/, "")} position in ${j.city}. [One sentence, in your own words, on why this work and this employer.]`,
    "",
    "[Two or three sentences on what you have actually done that relates to this job: where you worked, what you were responsible for, and one result you can back up.]",
    "",
    asks ? `The posting asks for:\n${asks}\n[Say plainly which of these you meet and how. If you do not meet one, say so and say what you are doing about it.]` : "[Say plainly which of the posted requirements you meet and how.]",
    "",
    "I can start [date] and am available for [the shifts you can work]. I would welcome the chance to talk.",
    "",
    "Sincerely,",
    "[your name]",
  ].join("\n");
}

export const trimJob = (j: ScoredJob) => ({
  ...j,
  letterDraft: j.verdict?.coverLetter?.trim() || defaultLetter(j),
  letterIsGeneric: !j.verdict?.coverLetter?.trim(),
  evidence: (j.evidence ?? []).slice(0, 3),
  verdict: j.verdict ? { ...j.verdict, independentEvidence: (j.verdict.independentEvidence ?? []).slice(0, 3) } : null,
});

export const SLICE_LABELS: Record<string, string> = {
  "city-utilities": "City of Los Angeles, LADWP, LA Metro, ports and airports",
  "counties-districts": "Counties, cities and water or sanitation districts",
  "campus-hospital": "Universities, colleges and hospitals",
  "electrical-contractors": "Electrical contractors and utilities",
  "elevator-hvac-pipe": "Elevator, commercial HVAC and piping",
  "industrial-plants": "Refineries, plants, aerospace and theme parks",
  "construction-office": "Construction office roles",
  "building-engineering": "Building engineering and data centers",
  "valley-industry": "Private employers near Canoga Park",
  "valley-public": "Public employers, utilities, campuses and hospitals near the Valley",
  "la-high-pay": "Rest of Los Angeles County",
  "oc-high-pay": "Orange County",
  "apprenticeships-open": "Apprenticeship and trainee windows",
};

/** Keep the finder notes that tell the applicant something actionable: a date, a window, a place to check. */
export const WATCH_RE = /\b(open|opens|opening|closed|closes|window|filing|watch|check|next cycle|tentative|re-check|recheck|waitlist|accept)/i;
export const NOISE_RE = /^(coverage limit|not searched|no best_fit|search budget|attempted but not)/i;

const normKey = (c: { employer: string; title: string }) => `${c.employer}|${c.title}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();

export function build(dirs: string[], date: string, programsFile?: string, leads: Candidate[] = []) {
  const { rows: allRows, searched, notFound, slices, verifyPending, watch } = readJournals(dirs, leads);
  // A re-checked lead replaces its first-pass copy, whatever the re-check concluded.
  const rechecked = new Set(allRows.filter((r) => r.slice === "recheck").map(normKey));
  const rows = allRows.filter((r) => r.slice === "recheck" || !rechecked.has(normKey(r)));
  const scored = rows.map(scoreRow);
  const sel = select(scored, { best: 99, stretch: 99, maxPerEmployer: 4 });
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const label = fmt(date);
  const stretch = [...sel.stretch, ...sel.bench];
  const shown = [...sel.bestFit, ...stretch, ...sel.belowPay];
  const unchecked = shown.filter((j) => !j.checked).length;
  const programs: Record<string, unknown>[] = programsFile && existsSync(programsFile) ? JSON.parse(readFileSync(programsFile, "utf8")) : [];
  const programsChecked = programs.map((p) => String(p.verifiedOn ?? "")).filter(Boolean).sort().at(-1);
  const inArea = (a: string) => [...sel.bestFit, ...stretch].filter((j) => j.area === a).length;

  const notices: string[] = [];
  if (sel.bestFit.length < 10) {
    notices.push(
      `This is short of the 10 best-fit openings you asked for.||${sel.bestFit.length} best-fit and ${stretch.length} stretch leads meet your pay rule and hold up; nothing was padded to reach the number. “Best fit” means the posting states no experience minimum. “Stretch” means it asks for experience I cannot confirm without your résumé, so some stretch jobs may turn out to be best fits once it is in.`,
    );
  }
  if (unchecked === 0) {
    notices.push(`Every lead here survived a second, independent check on ${label}.||That check works from search results; the job sites themselves cannot be opened from where this ran. Open each posting to confirm it is still accepting applications.`);
  } else if (unchecked === shown.length) {
    notices.push(`None of these leads has been double-checked yet.||Each was found once in search results on ${label}. Open each posting and confirm it is live before you spend time on it.`);
  } else {
    notices.push(`${shown.length - unchecked} of ${shown.length} leads survived a second, independent check; ${unchecked} ${unchecked === 1 ? "has" : "have"} not been double-checked.||Each card says which. The checks work from search results on ${label}; the job sites themselves cannot be opened from where this ran, so open each posting to confirm it is live.`);
  }
  notices.push("Your résumé has not been shared yet.||So there is no tailored résumé attached to these jobs yet. Paste your résumé under “Your details and résumé” and press “Tailor every job”: each job then gets its own résumé and cover letter, written only from what your résumé says. Until then fit is scored against an assumed beginner background.");
  notices.push("Nothing has been submitted for you.||Every application is yours to send.");

  return {
    generatedOn: date,
    generatedLabel: label,
    weights: WEIGHTS,
    fieldLabels: FIELD_LABELS,
    payRule: PAY_RULE,
    home: HOME.name,
    lede: `${sel.bestFit.length} best-fit and ${stretch.length} stretch openings that meet your pay rule, split into the Los Angeles area (${inArea("LA")}) and Orange County (${inArea("OC")}), each applied for directly with the employer. Pay target: about $${PAY_RULE.baseHourly} an hour near ${HOME.name}, rising with distance.`,
    notices,
    methodNote: `Two passes of web search on ${label} covered ${new Set(slices).size} groups of employers and surfaced ${rows.length} distinct postings with an employer-site link. A second, independent pass tries to disprove each one: that it exists on the employer's own site, is still open, is where it says and pays what it says. ${sel.ruledOut.length} were ruled out and ${sel.belowPay.length} pay below your target for their distance.`,
    assumptions:
      "career changer and beginner in the trades, high-school diploma or GED, no journey-level card or state electrician certification, home base Canoga Park. Driving requirements are flagged and never assumed about you.",
    stats: { slices: new Set(slices).size, found: rows.length, ruledOut: sel.ruledOut.length, belowPay: sel.belowPay.length, verifyPending, unchecked },
    bestFit: sel.bestFit.map(trimJob),
    stretch: stretch.map(trimJob),
    belowPay: sel.belowPay.map(trimJob),
    bench: [],
    ruledOut: sel.ruledOut.map((j) => ({ id: j.id, employer: j.employer, title: j.title, payText: j.payText, postingUrl: j.postingUrl, ruledOutReason: j.ruledOutReason, slice: j.slice, area: j.area })),
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
  const leadsFile = arg("leads");
  const leads: Candidate[] = leadsFile && existsSync(leadsFile) ? JSON.parse(readFileSync(leadsFile, "utf8")) : [];
  const data = build(journals, date, arg("programs") ?? path.join(__dirname, "..", "data", "seed", "apprenticeship_programs.json"), leads);
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
  console.log(JSON.stringify({ ...data.stats, bestFit: data.bestFit.length, stretch: data.stretch.length, programs: data.programs.length, watch: data.watch.reduce((a, g) => a + g.items.length, 0) }));
  for (const j of [...data.bestFit, ...data.stretch, ...data.belowPay]) console.log(`${j.list.padEnd(9)} ${j.area} ${String(j.score).padStart(3)} ${j.checked ? "checked  " : "unchecked"} ${j.employer.slice(0, 34)} | ${j.title.slice(0, 44)} | ${j.placeName} ${j.milesFromHome}mi | max $${j.payMaxHourly}/hr vs $${j.targetHourly} | open ${Math.round(j.breakdown.open.value * 100)}%`);
  for (const j of data.ruledOut) console.log(`ruled    ${j.employer} | ${j.title} | ${j.ruledOutReason}`);
}

if (process.argv[1] && process.argv[1].endsWith("jobfinder-build.ts")) main();
