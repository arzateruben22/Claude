/**
 * Turns `CoachFacts` into the cited metric list. Pure: no database, no clock (the facts carry the
 * read time), so the same facts always produce the same ids, labels and values.
 *
 * Metric ids are stable and documented in docs/notes/coach-reports.md. Ids that depend on data
 * (a job category, a program) are slugged: `category.construction-coordinator`, `program.weca`.
 */
import { rateEstimate, LOW_SAMPLE_N, type RateEstimate } from "@/lib/analytics/stats";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CitedMetric, CoachFacts, CoachSnapshot, ConversionFact, Metric, ProgramFact } from "./types";

/** A conversion group needs at least this many applications to be compared at all. */
export const MIN_GROUP_N = 5;
/** Applications with no update for this many days count as stale. */
export const STALE_DAYS = 21;
const MAX_GROUPS_PER_DIMENSION = 8;

export type Dimension = "category" | "source" | "resume";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  category: "job category",
  source: "source",
  resume: "résumé version",
};

export function slugId(text: string, max = 40): string {
  const s = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "none";
}

/** Metric id for an apprenticeship program (slugs are unique in the directory, so ids are too). */
export function programMetricId(p: Pick<ProgramFact, "slug">): string {
  return `program.${slugId(p.slug, 100)}`;
}

export function pct(ratio: number | null | undefined): string {
  return formatPercent(ratio ?? null, 0);
}

/** "95% interval 4%–17%" (or "" when there is no interval). */
export function intervalText(r: Pick<RateEstimate, "interval">): string {
  return r.interval ? `95% interval ${pct(r.interval.low)}–${pct(r.interval.high)}` : "";
}

/** "8% (6 of 75)" */
export function rateDisplay(r: RateEstimate): string {
  if (r.value === null) return "No data yet (0 applications)";
  return `${pct(r.value)} (${r.successes} of ${r.n})`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

function rateMetric(id: string, label: string, successes: number, n: number, detail: string, href?: string): Metric {
  const r = rateEstimate(successes, n);
  const iv = intervalText(r);
  return {
    id,
    label,
    value: r.value,
    display: rateDisplay(r),
    basis: "observed",
    n: r.n,
    successes: r.successes,
    interval: r.interval,
    lowSample: r.lowSample,
    detail: [detail, iv && `${iv} (estimate)`, r.lowSample && r.n > 0 ? `fewer than ${LOW_SAMPLE_N} applications: not reliable yet` : ""]
      .filter(Boolean)
      .join("; "),
    href,
  };
}

function count(id: string, label: string, value: number, detail: string, basis: Metric["basis"] = "observed", href?: string): Metric {
  return { id, label, value, display: formatNumber(value), basis, detail, href };
}

export type ConversionPick = { row: ConversionFact; rate: RateEstimate; id: string };

/** Groups with n ≥ MIN_GROUP_N, each with its response-rate estimate and metric id. */
export function qualifyingGroups(dimension: Dimension, rows: ConversionFact[]): ConversionPick[] {
  const used = new Set<string>();
  return rows
    .filter((r) => r.applied >= MIN_GROUP_N)
    .slice(0, MAX_GROUPS_PER_DIMENSION)
    .map((row) => {
      let id = `${dimension}.${slugId(row.label)}`;
      for (let i = 2; used.has(id); i++) id = `${dimension}.${slugId(row.label)}-${i}`;
      used.add(id);
      return { row, rate: rateEstimate(row.responded, row.applied), id };
    });
}

/**
 * Best and worst group by response rate among groups with n ≥ MIN_GROUP_N. Needs at least two such
 * groups whose rates differ; otherwise there is nothing to compare and both are null.
 */
export function bestAndWorst(dimension: Dimension, rows: ConversionFact[]): { best: ConversionPick | null; worst: ConversionPick | null } {
  const groups = qualifyingGroups(dimension, rows);
  if (groups.length < 2) return { best: null, worst: null };
  const byRate = [...groups].sort((a, b) => (b.rate.value ?? 0) - (a.rate.value ?? 0) || b.row.applied - a.row.applied);
  const best = byRate[0]!;
  const worstCandidates = [...groups].sort((a, b) => (a.rate.value ?? 0) - (b.rate.value ?? 0) || b.row.applied - a.row.applied);
  const worst = worstCandidates[0]!;
  if ((best.rate.value ?? 0) <= (worst.rate.value ?? 0)) return { best: null, worst: null };
  return { best, worst };
}

/** Do two 95% intervals overlap (i.e. the difference could plausibly be chance)? */
export function intervalsOverlap(a: RateEstimate, b: RateEstimate): boolean {
  if (!a.interval || !b.interval) return true;
  return a.interval.low <= b.interval.high && b.interval.low <= a.interval.high;
}

function conversionDisplay(p: ConversionPick): string {
  const r = p.rate;
  const interviews = p.row.interviews ? ` · ${plural(p.row.interviews, "interview")}` : "";
  return `${pct(r.value)} response rate (${r.successes} of ${r.n})${interviews}`;
}

function conversionMetric(dimension: Dimension, p: ConversionPick, id = p.id, labelPrefix?: string): Metric {
  const label = labelPrefix ? `${labelPrefix}: ${p.row.label}` : `Response rate, ${DIMENSION_LABELS[dimension]} "${p.row.label}"`;
  return {
    id,
    label,
    value: p.rate.value,
    display: conversionDisplay(p),
    basis: "observed",
    n: p.rate.n,
    successes: p.rate.successes,
    interval: p.rate.interval,
    lowSample: p.rate.lowSample,
    detail: `Employer responses among ${plural(p.row.applied, "application")} with this ${DIMENSION_LABELS[dimension]}; ${intervalText(p.rate)} (estimate)`,
    href: "/analytics",
  };
}

/** Human status for a program, honest about verification: OPEN only counts with a check date. */
export function programStatusText(p: ProgramFact): string {
  const checked = p.verifiedOn ? `last checked ${p.verifiedOn}` : "never checked";
  if (p.recruitmentStatus === "OPEN" && p.verifiedOn) return `Accepting applications (verified ${p.verifiedOn})`;
  if (p.recruitmentStatus === "CLOSED") return `Not recruiting as of the last check (${checked})`;
  return `Recruitment status unverified, check the program's site (${checked})`;
}

export function isVerifiedOpen(p: ProgramFact): boolean {
  return p.recruitmentStatus === "OPEN" && Boolean(p.verifiedOn);
}

function programMetric(p: ProgramFact): Metric {
  return {
    id: programMetricId(p),
    label: `Apprenticeship program: ${p.name}`,
    value: isVerifiedOpen(p) ? "OPEN" : p.recruitmentStatus === "OPEN" ? "UNVERIFIED" : p.recruitmentStatus,
    display: programStatusText(p),
    basis: isVerifiedOpen(p) ? "verified" : "reference",
    detail: [
      `${p.region}${p.isUnion ? " · union" : ""}`,
      p.interestStatus ? `your status: ${p.interestStatus.toLowerCase()}` : "not saved to your list",
      p.recruitmentNote ? p.recruitmentNote.slice(0, 200) : "",
    ]
      .filter(Boolean)
      .join("; "),
    href: "/academy/apprenticeships",
  };
}

export function buildSnapshot(facts: CoachFacts): CoachSnapshot {
  const m: Metric[] = [];
  const f = facts.funnel;

  // Funnel (non-archived applications, Analytics' default slice).
  m.push(count("funnel.applied", "Applications submitted", f.applied, "Non-archived applications with an application date or a submitted event", "observed", "/applications"));
  m.push(count("funnel.responses", "Employer responses", f.responded, "Applications where the employer reacted (screening, interview, offer or rejection)", "observed", "/analytics"));
  m.push(rateMetric("funnel.response_rate", "Response rate", f.responded, f.applied, "Responses ÷ applications submitted", "/analytics"));
  m.push(count("funnel.screened", "Reached screening", f.screened, "Applications that reached a screening or later stage", "observed", "/analytics"));
  m.push(count("funnel.interviews", "Reached interview stage", f.interviewed, "Applications with an interview scheduled or held, or a later stage", "observed", "/analytics"));
  m.push(rateMetric("funnel.interview_rate", "Interview rate", f.interviewed, f.applied, "Interview-stage applications ÷ applications submitted", "/analytics"));
  m.push(count("funnel.offers", "Offers", f.offers, "Applications that reached an offer", "observed", "/analytics"));
  m.push(rateMetric("funnel.offer_rate", "Offer rate", f.offers, f.applied, "Offers ÷ applications submitted", "/analytics"));

  // Interviews and offers.
  const iv = facts.interviews;
  m.push(count("interviews.attended", "Interviews attended", iv.attended, "Interviews marked as attended in the tracker", "observed", "/applications?status=INTERVIEWING"));
  m.push(count("interviews.upcoming", "Interviews in the next 7 days", iv.upcoming7d, "Pending interviews scheduled within 7 days", "observed", "/applications?status=INTERVIEWING"));
  if (iv.next) {
    const n = iv.next;
    m.push({
      id: "interviews.next",
      label: "Next interview",
      value: n.hoursUntil,
      display: `${n.company} · ${n.title}, in ${n.hoursUntil < 48 ? `${Math.max(0, Math.round(n.hoursUntil))} h` : `${Math.round(n.hoursUntil / 24)} days`} · prep ${n.prepDone ? "marked complete" : "not marked complete"}`,
      basis: "observed",
      detail: `Scheduled ${n.scheduledAt}`,
      href: `/applications/${n.applicationId}`,
    });
  }
  const offers = facts.offers.open;
  m.push(count("offers.open", "Open offers", offers.length, "Offers recorded as received or under negotiation", "observed", "/applications?status=OFFER"));
  const dueSoon = offers.filter((o) => o.daysToDecision !== null).sort((a, b) => a.daysToDecision! - b.daysToDecision!)[0];
  if (dueSoon) {
    m.push({
      id: "offers.next_decision",
      label: "Nearest offer decision deadline",
      value: dueSoon.daysToDecision,
      display: `${dueSoon.company}: ${dueSoon.daysToDecision! < 0 ? `${Math.abs(dueSoon.daysToDecision!)} days past` : `${dueSoon.daysToDecision} days left`} (due ${dueSoon.decisionDue})`,
      basis: "observed",
      detail: "Decision date you recorded on the offer",
      href: `/applications/${dueSoon.applicationId}`,
    });
  }
  const bestOffer = offers.filter((o) => o.annualized !== null).sort((a, b) => b.annualized! - a.annualized!)[0];
  if (bestOffer) {
    m.push({
      id: "offers.best_annualized",
      label: "Highest open offer (annualized)",
      value: bestOffer.annualized,
      display: `${formatCurrency(bestOffer.annualized)} per year from ${bestOffer.company} (${formatCurrency(bestOffer.baseAmount, { cents: bestOffer.period === "HOURLY" })}${bestOffer.period === "HOURLY" ? "/hr" : "/yr"})`,
      basis: "estimate",
      detail: "Hourly offers are annualized at the recorded hours per week × 52; benefits and overtime are not included",
      href: `/applications/${bestOffer.applicationId}`,
    });
  }

  // This week, today, targets.
  const w = facts.week;
  m.push(count("week.applied", "Applications this week", w.applied, `Applications dated this week (Monday ${facts.weekStartKey} onward), archived ones included`, "observed", "/dashboard"));
  m.push(count("week.target", "Weekly application target", w.target, "From your campaign settings", "target", "/settings/campaign"));
  m.push(count("week.pace_expected", "Expected by end of yesterday", w.expectedByYesterday, "Daily target × planned workdays already finished this week (capped at the weekly target)", "target", "/dashboard/goals"));
  m.push(count("today.applied", "Applications today", w.todayApplied, `Applications dated today (${facts.todayKey})`, "observed", "/dashboard"));
  m.push(count("today.target", "Daily application target", w.dailyTarget, w.todayIsWorkday ? "Today is a planned workday" : "Today is not a planned workday", "target", "/settings/campaign"));
  m.push(count("week.active_days", "Days with applications this week", w.activeDays, "Calendar days this week with at least one application", "observed", "/dashboard"));

  // Follow-ups and stale applications.
  m.push(count("followups.overdue", "Overdue follow-ups", facts.followUps.overdue, "Active applications whose follow-up date has passed", "observed", "/applications?sort=followUp"));
  m.push(count("followups.due_today", "Follow-ups due today", facts.followUps.dueToday, "Active applications with a follow-up due today", "observed", "/applications?sort=followUp"));
  m.push({
    ...count(
      "applications.stale",
      `Applications with no update for ${STALE_DAYS}+ days`,
      facts.stale.count,
      `Submitted or confirmed applications with no status change, event or follow-up date in the last ${STALE_DAYS} days`,
      "observed",
      "/applications?status=SUBMITTED,CONFIRMED",
    ),
    display: facts.stale.items.length
      ? `${formatNumber(facts.stale.count)} (oldest: ${facts.stale.items[0]!.company}, ${facts.stale.items[0]!.daysSinceActivity} days)`
      : formatNumber(facts.stale.count),
  });

  // Conversions by dimension.
  const dims: Array<[Dimension, ConversionFact[]]> = [
    ["category", facts.conversions.category],
    ["source", facts.conversions.source],
    ["resume", facts.conversions.resume],
  ];
  for (const [dim, rows] of dims) {
    const { best, worst } = bestAndWorst(dim, rows);
    if (best && worst) {
      m.push(conversionMetric(dim, best, `${dim}.best`, `Strongest ${DIMENSION_LABELS[dim]} by response rate`));
      m.push(conversionMetric(dim, worst, `${dim}.worst`, `Weakest ${DIMENSION_LABELS[dim]} by response rate`));
    }
    for (const g of qualifyingGroups(dim, rows)) m.push(conversionMetric(dim, g));
  }

  // Campaign and streaks.
  const c = facts.campaign;
  m.push({
    id: "campaign.day",
    label: "Campaign day",
    value: c.day,
    display: !c.started ? `Starts in ${1 - c.day} days` : c.beyond ? `Day ${c.day} (past the ${c.lengthDays}-day campaign)` : `Day ${c.day} of ${c.lengthDays}`,
    basis: "observed",
    detail: `${Math.max(0, c.daysRemaining)} days remaining`,
    href: "/missions/campaign",
  });
  m.push({
    id: "campaign.phase",
    label: "Campaign phase",
    value: c.phase,
    display: c.phase ? `Phase ${c.phase} · ${c.phaseName}` : c.beyond ? "Campaign finished" : "Not started",
    basis: "observed",
    detail: "Operation Get Hired is split into three phases (launch, momentum, close)",
    href: "/missions/campaign",
  });
  m.push(count("streak.current", "Current streak", facts.streak.current, "Planned workdays in a row with real activity (rest days never break it)", "observed", "/missions"));
  m.push(count("streak.longest", "Longest streak", facts.streak.longest, "Your best streak so far", "observed", "/missions"));
  m.push(count("activity.consecutive_days", "Consecutive active days", facts.streak.consecutiveActiveDays, "Calendar days in a row (weekends included) with any logged activity, ending today or yesterday", "observed", "/missions"));

  // Academy.
  const a = facts.academy;
  m.push({
    id: "academy.lessons_completed",
    label: "Academy lessons completed",
    value: a.lessonsCompleted,
    display: `${formatNumber(a.lessonsCompleted)} of ${formatNumber(a.lessonsTotal)}${a.inProgress ? ` (${a.inProgress} in progress)` : ""}`,
    basis: "observed",
    detail: "Lessons whose quiz you passed. Academy lessons are study material, not field experience or certification.",
    href: "/academy",
  });
  for (const t of a.tracks) {
    m.push({
      id: `academy.track.${slugId(t.key)}`,
      label: `Academy track: ${t.label}`,
      value: t.total ? t.completed / t.total : null,
      display: `${t.completed} of ${t.total} lessons`,
      basis: "observed",
      href: "/academy",
    });
  }
  if (a.next) {
    m.push({ id: "academy.next_lesson", label: "Next Academy lesson", value: a.next.title, display: a.next.title, basis: "observed", href: `/academy/lessons/${a.next.key}` });
  }
  if (a.daysSinceActivity !== null) {
    m.push(count("academy.days_since_activity", "Days since last Academy activity", a.daysSinceActivity, "Days since you last opened a lesson or submitted a quiz", "observed", "/academy"));
  }
  if (a.recentQuizzes.length) {
    const latest = a.recentQuizzes[0]!;
    m.push({
      id: "quiz.latest",
      label: "Most recent quiz",
      value: latest.percent / 100,
      display: `${latest.label}: ${latest.percent}% (${latest.passed ? "passed" : "not passed"})`,
      basis: "observed",
      detail: `Submitted ${latest.at.slice(0, 10)}`,
      href: latest.href,
    });
    const avg = a.recentQuizzes.reduce((s, q) => s + q.percent, 0) / a.recentQuizzes.length;
    m.push({
      id: "quiz.recent_average",
      label: `Average of your last ${a.recentQuizzes.length} quiz scores`,
      value: avg / 100,
      display: `${Math.round(avg)}% across ${plural(a.recentQuizzes.length, "attempt")}`,
      basis: "observed",
      n: a.recentQuizzes.length,
      detail: a.recentQuizzes.map((q) => `${q.label} ${q.percent}%`).join(", "),
      href: "/academy",
    });
  }

  // Work hours.
  const h = facts.hours;
  m.push({ ...count("hours.self_reported", "Self-reported work hours", h.selfReported, "Hours you logged that no employer or official record has verified yet", "self_reported", "/academy/hours"), display: `${formatNumber(h.selfReported)} h` });
  m.push({ ...count("hours.verified", "Verified work hours", h.verified, "Hours verified by an employer or an official record", "verified", "/academy/hours"), display: `${formatNumber(h.verified)} h` });
  if (h.daysSinceLast !== null) {
    m.push(count("hours.days_since_last", "Days since your last logged work day", h.daysSinceLast, `${plural(h.entries, "entry", "entries")} logged in total`, "observed", "/academy/hours"));
  }

  // Résumé, goals, XP.
  m.push({
    ...count("resume.versions", "Saved résumé versions", facts.resumes.count, "Résumé versions saved in the Advisor", "observed", "/coach/resumes"),
    display: facts.resumes.latestName ? `${formatNumber(facts.resumes.count)} (latest: ${facts.resumes.latestName})` : formatNumber(facts.resumes.count),
  });
  m.push({ id: "goals.salary_immediate", label: "Immediate salary target", value: facts.profile.immediateSalaryTarget, display: `${formatCurrency(facts.profile.immediateSalaryTarget)} per year`, basis: "target", href: "/settings" });
  m.push({ id: "goals.salary_long_term", label: "Long-term salary target", value: facts.profile.longTermSalaryTarget, display: `${formatCurrency(facts.profile.longTermSalaryTarget)} per year`, basis: "target", href: "/settings" });
  m.push(count("xp.total", "Total XP", facts.xp.total, "XP from real actions recorded in CareerQuest (game progress, not a credential)", "observed", "/missions"));

  // Apprenticeship programs (reference data with verification status).
  const openVerified = facts.programs.filter(isVerifiedOpen);
  m.push(count("programs.open_verified", "Apprenticeship programs verified open", openVerified.length, "Programs in the directory whose OPEN recruitment status carries a check date", "reference", "/academy/apprenticeships"));
  m.push(
    count(
      "programs.unverified",
      "Apprenticeship programs with unverified status",
      facts.programs.filter((p) => !isVerifiedOpen(p) && p.recruitmentStatus !== "CLOSED").length,
      "Programs whose recruitment status could not be verified; check their sites",
      "reference",
      "/academy/apprenticeships",
    ),
  );
  m.push(count("programs.saved", "Apprenticeship programs on your list", facts.programs.filter((p) => p.interestStatus).length, "Programs you saved or are applying to", "observed", "/academy/apprenticeships"));
  for (const p of facts.programs) m.push(programMetric(p));

  // Ids are unique by construction; if two directory slugs ever normalize to the same id, the first wins.
  const byId: Record<string, Metric> = {};
  const metrics = m.filter((metric) => {
    if (byId[metric.id]) return false;
    byId[metric.id] = metric;
    return true;
  });
  return { facts, metrics, byId };
}

/** Freeze the cited subset of metrics for storage with a message or report. */
export function citeMetrics(byId: Record<string, Metric>, ids: readonly string[]): CitedMetric[] {
  const out: CitedMetric[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const m = byId[id];
    if (!m || seen.has(id)) continue;
    seen.add(id);
    out.push({ id: m.id, label: m.label, display: m.display, basis: m.basis, detail: m.detail, n: m.n, interval: m.interval ?? null, lowSample: m.lowSample, href: m.href });
  }
  return out;
}
