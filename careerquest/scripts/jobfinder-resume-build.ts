/**
 * Job Finder build for a resume-matched run.
 *
 *   npx tsx scripts/jobfinder-resume-build.ts --journals <dir>[,<dir>] --date YYYY-MM-DD \
 *        --trade data/jobs/<date>.json --out <private>/resume-run.json --html <private>/jobfinder.html \
 *        [--leads <private>/leads.json] [--kits <dir>[,<dir>]] [--jobs-out <private>/top-jobs.json] [--top 10]
 *
 * Journals come from jobfinder/resume-sweep.workflow.js ("find:<slice>" / "verify:<slice>:<n>").
 * --kits points at jobfinder/apply-kit.workflow.js runs: only the publicly sourced contact research
 * ("contact:<id>") is put on the page. The tailored resume and letters are NOT written here: they
 * go to the applicant's private store, never into a file in this (public) repository, which is
 * also why --out and --html should point outside the repository for a resume run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FIELD_LABELS, WEIGHTS, scoreRow, select, type Candidate, type ScoredJob } from "../src/lib/jobfinder/score";
import { HOME, PAY_RULE } from "../src/lib/jobfinder/geo";
import { NOISE_RE, SLICE_LABELS, WATCH_RE, readJournals, trimJob } from "./jobfinder-build";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export type Contact = { name?: string | null; role: string; channel: string; value: string; sourceUrl: string; publishedBy: string; note?: string };
export type ContactResearch = { contacts: Contact[]; employerPolicy: string; outreachVerdict: "good_option" | "after_applying" | "not_recommended"; reason: string; whoToAddress: string };
type KitInfo = { contact: ContactResearch | null; written: boolean; corrected: boolean };

const RESUME_SLICE_LABELS: Record<string, string> = {
  ...SLICE_LABELS,
  "dispatch-field-ops": "Dispatch and field scheduling",
  "construction-project-coord": "Construction and infrastructure project coordination",
  "safety-compliance": "Safety and regulatory compliance",
  "ops-logistics-purchasing": "Operations, logistics and purchasing",
  "public-agency-utility": "Public agencies, utilities and campuses",
  "oc-and-south-la": "Orange County and south or east Los Angeles County",
};

/** Per-job results of an apply-kit run, keyed by job id. Document text is deliberately not returned. */
export function readKits(dirs: string[]): Map<string, KitInfo> {
  const out = new Map<string, KitInfo>();
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
    for (const [agentId, label] of labels) {
      const result = results.get(agentId);
      if (!result || typeof result !== "object") continue;
      const [kind, id] = [label.slice(0, label.indexOf(":")), label.slice(label.indexOf(":") + 1)];
      const cur = out.get(id) ?? { contact: null, written: false, corrected: false };
      if (kind === "contact") cur.contact = result as ContactResearch;
      if (kind === "kit") cur.written = true;
      if (kind === "check") cur.corrected = (result as { ok?: boolean }).ok === false;
      out.set(id, cur);
    }
  }
  return out;
}

/**
 * Contact-data brokers infer or resell addresses; an address seen only there was not published by
 * the employer or by the person, so it is treated like a guessed one and dropped.
 */
const BROKER_RE = /rocketreach|zoominfo|contactout|signalhire|lusha|apollo\.io|hunter\.io|leadiq|datanyze|email-format|anymailfinder|snov\.io|clearbit|seamless\.ai|uplead|adapt\.io|kendo|skrapp|voilanorbert|peopledatalabs|spokeo|beenverified|whitepages|truepeoplesearch|radaris/i;

/** Only https links and plain text reach the page; anything else a search extract produced is dropped. */
export function cleanContact(c: ContactResearch | null): ContactResearch | null {
  if (!c) return null;
  const okUrl = (u: string) => /^https:\/\//i.test(String(u ?? "")) && !BROKER_RE.test(String(u));
  const personal = (x: Contact) => x.channel === "email" && /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|me|live|msn)\./i.test(x.value);
  return { ...c, contacts: (c.contacts ?? []).filter((x) => x && x.value && okUrl(x.sourceUrl) && !personal(x)).slice(0, 5) };
}

export function buildResume(dirs: string[], date: string, opts: { tradeFile?: string; kitDirs?: string[]; top?: number; leads?: Candidate[]; label?: string } = {}) {
  const { rows, searched, notFound, slices, verifyPending, watch } = readJournals(dirs, opts.leads ?? []);
  const scored = rows.map(scoreRow);
  const sel = select(scored, { best: 99, stretch: 99, maxPerEmployer: 2 });
  const top = opts.top ?? 10;
  // "Stop after N": best fits first, then stretch leads, each by score.
  // Within each list, leads that went through the second check come before found-once leads.
  const byTrust = (a: ScoredJob, b: ScoredJob) => Number(b.checked) - Number(a.checked) || b.score - a.score;
  const ranked = [...[...sel.bestFit].sort(byTrust), ...[...sel.stretch].sort(byTrust)];
  const chosen = ranked.slice(0, top);
  const chosenIds = new Set(chosen.map((j) => j.id));
  const more = [...ranked.filter((j) => !chosenIds.has(j.id)), ...sel.bench];
  const kits = readKits(opts.kitDirs ?? []);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  // A run that spans more than one day says so instead of dating every check to the last day.
  const label = opts.label ?? fmt(date);
  const page = (j: ScoredJob, extra = false) => {
    const k = kits.get(j.id);
    return { ...trimJob(j), extra, contact: cleanContact(k?.contact ?? null), kit: k ? { written: k.written, corrected: k.corrected } : null };
  };
  const best = chosen.filter((j) => j.list === "best_fit");
  const stretch = chosen.filter((j) => j.list === "stretch");
  const unchecked = chosen.filter((j) => !j.checked).length;
  const inArea = (a: string) => chosen.filter((j) => j.area === a).length;
  const verdictCount = (v: string) => chosen.filter((j) => kits.get(j.id)?.contact?.outreachVerdict === v).length;
  const kitsWritten = chosen.filter((j) => kits.get(j.id)?.written).length;

  let tradeLeads: unknown[] = [];
  if (opts.tradeFile && existsSync(opts.tradeFile)) {
    const t = JSON.parse(readFileSync(opts.tradeFile, "utf8")) as { bestFit?: unknown[]; stretch?: unknown[]; belowPay?: unknown[] };
    tradeLeads = [...(t.bestFit ?? []), ...(t.stretch ?? []), ...(t.belowPay ?? [])];
  }

  const notices: string[] = [];
  notices.push(
    chosen.length >= top
      ? `These ${chosen.length} are matched to your résumé.||Each posted minimum was compared with what your résumé says: ${best.length} show every minimum, ${stretch.length} ask for something your résumé does not show and say so plainly on the card.`
      : `Only ${chosen.length} of the ${top} you asked for held up.||${best.length} show every posted minimum on your résumé and ${stretch.length} ask for something it does not show. Nothing was padded to reach ${top}.`,
  );
  if (kitsWritten > 0) {
    notices.push(
      `A tailored résumé and cover letter are attached to ${kitsWritten === chosen.length ? "each of them" : `${kitsWritten} of them`}.||They use only facts from your résumé, reordered and reworded; a second pass checked every line against the original. Each card lists what was changed and what was deliberately not claimed. Read them before you send anything.`,
    );
  } else {
    notices.push("Tailored résumés and cover letters are not attached yet.||Each card has a slot for them.");
  }
  if (kits.size > 0) {
    notices.push(
      `Writing to someone directly: worth doing for ${verdictCount("good_option") + verdictCount("after_applying")} of ${chosen.length}, not for ${verdictCount("not_recommended")}.||Each card says which, why, and which publicly posted contact routes were found. No address was guessed. Nothing has been sent to anyone.`,
    );
  }
  notices.push(
    unchecked === 0
      ? `Every lead here survived a second, independent check on ${label}.||That check works from search results; the job sites themselves cannot be opened from where this ran. Open each posting to confirm it is still accepting applications.`
      : `${chosen.length - unchecked} of ${chosen.length} leads survived a second, independent check; ${unchecked} ${unchecked === 1 ? "was" : "were"} found once.||Each card says which. Open each posting to confirm it is live.`,
  );
  notices.push("Nothing has been submitted for you.||Every application and every message is yours to send.");

  return {
    mode: "resume" as const,
    generatedOn: date,
    generatedLabel: label,
    weights: WEIGHTS,
    fieldLabels: FIELD_LABELS,
    payRule: PAY_RULE,
    home: HOME.name,
    lede: `${chosen.length} openings matched to your résumé (${best.length} best fit, ${stretch.length} stretch), ${inArea("LA")} in the Los Angeles area and ${inArea("OC")} in Orange County, each applied for directly with the employer. Pay target: about $${PAY_RULE.baseHourly} an hour near ${HOME.name}, rising with distance.`,
    notices,
    methodNote: `Web search on ${label} covered ${new Set(slices).size} role families chosen from your résumé and surfaced ${rows.length} distinct postings with an employer-site link. A second, independent pass tries to disprove each one (that it exists on the employer's own site, is still open, is where it says and pays what it says) and then compares every posted minimum with your résumé. ${sel.ruledOut.length} were ruled out and ${sel.belowPay.length} pay below your target for their distance.`,
    assumptions: "",
    stats: { slices: new Set(slices).size, found: rows.length, ruledOut: sel.ruledOut.length, belowPay: sel.belowPay.length, verifyPending, unchecked, kitsWritten },
    bestFit: best.map((j) => page(j)),
    stretch: stretch.map((j) => page(j)),
    belowPay: sel.belowPay.map((j) => page(j)),
    bench: more.map((j) => page(j, true)),
    tradeLeads,
    ruledOut: sel.ruledOut.map((j) => ({ id: j.id, employer: j.employer, title: j.title, payText: j.payText, postingUrl: j.postingUrl, ruledOutReason: j.ruledOutReason, slice: j.slice, area: j.area })),
    programs: [] as unknown[],
    programsCheckedLabel: "",
    watch: watch
      .map((g) => ({ label: RESUME_SLICE_LABELS[g.slice] ?? g.slice, items: g.items.filter((x) => WATCH_RE.test(x) && !NOISE_RE.test(x.trim())) }))
      .filter((g) => g.items.length > 0),
    searched: [...new Set(searched)],
    notFound: [...new Set(notFound)],
    chosen,
  };
}

function main() {
  const journals = (arg("journals") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const date = arg("date") ?? new Date().toISOString().slice(0, 10);
  if (!journals.length) {
    console.error("usage: tsx scripts/jobfinder-resume-build.ts --journals <dir>[,<dir>] --date YYYY-MM-DD [--trade file.json] [--kits <dir>[,<dir>]] [--out file.json] [--html file.html] [--jobs-out file.json] [--top 10]");
    process.exit(1);
  }
  const kitDirs = (arg("kits") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const leadsFile = arg("leads");
  const leads: Candidate[] = leadsFile && existsSync(leadsFile) ? JSON.parse(readFileSync(leadsFile, "utf8")) : [];
  const { chosen, ...data } = buildResume(journals, date, { tradeFile: arg("trade"), kitDirs, top: arg("top") ? Number(arg("top")) : 10, leads, label: arg("label") });
  const write = (file: string | undefined, text: string) => {
    if (!file) return;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  write(arg("out"), JSON.stringify(data, null, 2) + "\n");
  const html = arg("html");
  if (html) {
    const template = readFileSync(path.join(__dirname, "..", "jobfinder", "page-template.html"), "utf8");
    const { searched: _s, notFound: _n, ...pageData } = data;
    void _s; void _n;
    write(html, template.replace("__DATA__", () => JSON.stringify(pageData).replace(/</g, "\\u003c")));
  }
  // Input for jobfinder/apply-kit.workflow.js: what each writer and contact researcher needs to know.
  write(
    arg("jobs-out"),
    JSON.stringify(
      chosen.map((j) => ({
        id: j.id, employer: j.employer, title: j.title, city: j.city, payText: j.payText, postingUrl: j.postingUrl, list: j.list,
        minimumRequirements: j.minimumRequirements, preferredQualifications: j.preferredQualifications ?? [],
        requirementMatch: j.verdict?.requirementMatch ?? [], gaps: [...j.gaps.hard, ...j.gaps.soft, ...j.gaps.preferred],
        resumeEmphasis: j.verdict?.resumeEmphasis ?? [], doNotClaim: j.verdict?.doNotClaim ?? [], drivingRequirement: j.drivingRequirement,
      })),
      null,
      1,
    ) + "\n",
  );
  console.log(JSON.stringify({ ...data.stats, bestFit: data.bestFit.length, stretch: data.stretch.length, more: data.bench.length, trade: data.tradeLeads.length, watch: data.watch.reduce((a, g) => a + g.items.length, 0) }));
  for (const j of [...data.bestFit, ...data.stretch, ...data.bench, ...data.belowPay]) {
    console.log(`${(j.extra ? "more" : j.list).padEnd(9)} ${j.area} ${String(j.score).padStart(3)} ${j.checked ? "checked  " : "found once"} fit ${Math.round(j.breakdown.interest.value * 100)}% ${j.employer.slice(0, 30)} | ${j.title.slice(0, 44)} | ${j.placeName} ${j.milesFromHome}mi | max $${j.payMaxHourly}/hr vs $${j.targetHourly} | open ${Math.round(j.breakdown.open.value * 100)}% | ${j.contact ? j.contact.outreachVerdict : "-"}`);
  }
  for (const j of data.ruledOut) console.log(`ruled    ${j.employer.slice(0, 40)} | ${j.title.slice(0, 50)} | ${String(j.ruledOutReason).slice(0, 110)}`);
}

if (process.argv[1] && process.argv[1].endsWith("jobfinder-resume-build.ts")) main();
