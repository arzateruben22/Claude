/**
 * The Advisor's rules engine. Pure: (snapshot) → recommendations. Every recommendation cites the
 * metric ids it is based on, and `evaluateRules` drops any citation that is not in the snapshot, so
 * a recommendation can never point at a number the user cannot inspect.
 *
 * Honesty rules baked in here:
 * - Rates are only compared with n ≥ MIN_GROUP_N per group, always with n and a 95% interval, and
 *   overlapping intervals are called out as "may be chance".
 * - Apprenticeship programs are only "open" when the directory row says OPEN *and* carries a check
 *   date; everything else is "check the site" with the last-checked date.
 * - Outcomes are never promised; rest is recommended, not punished.
 */
import { formatNumber } from "@/lib/format";
import { LOW_SAMPLE_N, rateEstimate } from "@/lib/analytics/stats";
import {
  STALE_DAYS,
  bestAndWorst,
  intervalText,
  intervalsOverlap,
  isVerifiedOpen,
  pct,
  programMetricId,
  programStatusText,
} from "./snapshot";
import type { CoachSnapshot, Recommendation } from "./types";

export type Rule = {
  id: string;
  /** What the rule looks at, for the notes and tests. */
  description: string;
  evaluate: (s: CoachSnapshot) => Recommendation | Recommendation[] | null;
};

const LOW_RESPONSE_MIN_APPLIED = 30;
const LOW_RESPONSE_RATE = 0.1;
const REST_AFTER_DAYS = 6;
const ACADEMY_IDLE_DAYS = 7;
const HOURS_IDLE_DAYS = 14;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

function rec(r: Omit<Recommendation, "citations"> & { citations: string[] }): Recommendation {
  return r;
}

function askHref(text: string): string {
  return `/coach?ask=${encodeURIComponent(text)}`;
}

function whenText(hours: number): string {
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in about ${Math.round(hours)} hours`;
  if (hours < 48) return "tomorrow";
  return `in ${Math.round(hours / 24)} days`;
}

export const RULES: Rule[] = [
  {
    id: "first-application",
    description: "No applications logged yet",
    evaluate: ({ facts }) =>
      facts.funnel.applied > 0
        ? null
        : rec({
            id: "first-application",
            priority: 100,
            group: "volume",
            title: "Log your first application",
            body: "You have 0 submitted applications in the tracker [funnel.applied]. Every rate and recommendation here is computed from what you log, so add one you have already sent, or a new one.",
            citations: ["funnel.applied"],
            action: { label: "Log an application", href: "/applications/new" },
          }),
  },
  {
    id: "finish-setup",
    description: "Onboarding not completed, so targets may be defaults",
    evaluate: ({ facts }) =>
      facts.profile.onboardingComplete
        ? null
        : rec({
            id: "finish-setup",
            priority: 88,
            group: "setup",
            title: "Finish setup so your targets match your plan",
            body: `Your daily target is ${facts.week.dailyTarget} [today.target] and your weekly target is ${facts.week.target} [week.target], which may still be the defaults. Setup takes two minutes and drives every pace calculation.`,
            citations: ["today.target", "week.target"],
            action: { label: "Finish setup", href: "/settings/onboarding" },
          }),
  },
  {
    id: "interview-soon",
    description: "A pending interview within 7 days with prep not marked complete",
    evaluate: ({ facts }) => {
      const n = facts.interviews.next;
      if (!n || n.prepDone || n.hoursUntil > 7 * 24) return null;
      return rec({
        id: "interview-soon",
        priority: n.hoursUntil <= 48 ? 98 : 94,
        group: "interview",
        title: `Prepare for your ${n.company} interview ${whenText(n.hoursUntil)}`,
        body: `Your next interview is ${n.title} at ${n.company} [interviews.next], and prep is not marked complete. Re-read the posting, prepare two or three STAR stories, run a mock interview here, then mark prep complete on the application.`,
        citations: ["interviews.next", "interviews.upcoming"],
        action: { label: "Open the interview", href: `/applications/${n.applicationId}` },
      });
    },
  },
  {
    id: "interview-practice",
    description: "Interview within 7 days and prep already done: suggest a mock interview",
    evaluate: ({ facts }) => {
      const n = facts.interviews.next;
      if (!n || !n.prepDone || n.hoursUntil > 7 * 24) return null;
      return rec({
        id: "interview-practice",
        priority: 58,
        group: "interview",
        title: `Rehearse before your ${n.company} interview`,
        body: `Prep is marked complete for ${n.company} [interviews.next]. A short mock interview out loud is a good final rehearsal; the feedback here is a keyword heuristic, not a prediction.`,
        citations: ["interviews.next"],
        action: { label: "Start a mock interview", href: askHref("Mock interview") },
      });
    },
  },
  {
    id: "offer-decision-due",
    description: "An open offer with a decision date within 3 days",
    evaluate: ({ facts }) => {
      const due = facts.offers.open.filter((o) => o.daysToDecision !== null && o.daysToDecision <= 3).sort((a, b) => a.daysToDecision! - b.daysToDecision!)[0];
      if (!due) return null;
      return rec({
        id: "offer-decision-due",
        priority: 97,
        group: "offer",
        title: `Decide on the ${due.company} offer`,
        body: `The decision date you recorded is close [offers.next_decision]. If you need more time, it is reasonable to ask for it in writing before the deadline.`,
        citations: ["offers.next_decision", "offers.open"],
        action: { label: "Open the offer", href: `/applications/${due.applicationId}` },
      });
    },
  },
  {
    id: "offer-negotiation",
    description: "At least one open offer: evaluate and negotiate with the Salary Simulator",
    evaluate: ({ facts, byId }) => {
      const open = facts.offers.open;
      if (open.length === 0) return null;
      const best = byId["offers.best_annualized"] ? " [offers.best_annualized]" : "";
      return rec({
        id: "offer-negotiation",
        priority: 92,
        group: "offer",
        title: open.length === 1 ? `Evaluate the ${open[0]!.company} offer before you answer` : `Compare your ${open.length} open offers`,
        body: `You have ${plural(open.length, "open offer")} [offers.open]${best}. Compare base pay, hours, overtime rules and benefits against your target [goals.salary_immediate] in the Salary Simulator, then decide what to ask for. Asking for a review of the base rate is common; the outcome is never guaranteed.`,
        citations: ["offers.open", "offers.best_annualized", "goals.salary_immediate"],
        action: { label: "Open the Salary Simulator", href: "/salary" },
      });
    },
  },
  {
    id: "followups-overdue",
    description: "Follow-ups whose date has passed",
    evaluate: ({ facts }) => {
      const n = facts.followUps.overdue;
      if (n === 0) return null;
      return rec({
        id: "followups-overdue",
        priority: Math.min(91, 82 + n),
        group: "followups",
        title: `Send ${plural(n, "overdue follow-up")}`,
        body: `${plural(n, "application")} passed its follow-up date [followups.overdue]. A short, polite note keeps you on the recruiter's radar. Ask me to "draft a follow-up email" for any of them; drafts are never sent for you.`,
        citations: ["followups.overdue"],
        action: { label: "Open follow-ups", href: "/applications?sort=followUp" },
      });
    },
  },
  {
    id: "followups-today",
    description: "Follow-ups due today",
    evaluate: ({ facts }) => {
      const n = facts.followUps.dueToday;
      if (n === 0) return null;
      return rec({
        id: "followups-today",
        priority: 72,
        group: "followups",
        title: `${plural(n, "follow-up")} due today`,
        body: `${plural(n, "application")} has a follow-up scheduled for today [followups.due_today]. Record each one on the application after you send it so the tracker and missions count it.`,
        citations: ["followups.due_today"],
        action: { label: "Open follow-ups", href: "/applications?sort=followUp" },
      });
    },
  },
  {
    id: "volume-behind",
    description: "This week's applications are behind the pace implied by the daily target",
    evaluate: ({ facts }) => {
      const w = facts.week;
      if (facts.funnel.applied === 0 || w.expectedByYesterday <= 0 || w.applied >= w.expectedByYesterday) return null;
      const gap = w.expectedByYesterday - w.applied;
      return rec({
        id: "volume-behind",
        priority: 75,
        group: "volume",
        title: `${plural(gap, "application")} behind this week's pace`,
        body: `You've logged ${w.applied} this week [week.applied]; at your daily target you would have about ${w.expectedByYesterday} by now [week.pace_expected], toward a weekly target of ${w.target} [week.target]. Batch a few applications today, quality first.`,
        citations: ["week.applied", "week.pace_expected", "week.target"],
        action: { label: "Log an application", href: "/applications/new" },
      });
    },
  },
  {
    id: "today-target",
    description: "Today is a planned workday and today's applications are below the daily target",
    evaluate: ({ facts }) => {
      const w = facts.week;
      if (!w.todayIsWorkday || w.dailyTarget <= 0 || w.todayApplied >= w.dailyTarget || facts.funnel.applied === 0) return null;
      const left = w.dailyTarget - w.todayApplied;
      return rec({
        id: "today-target",
        priority: 66,
        group: "volume",
        title: `${plural(left, "application")} to reach today's target`,
        body: `You've logged ${w.todayApplied} today [today.applied] against a daily target of ${w.dailyTarget} [today.target].`,
        citations: ["today.applied", "today.target"],
        action: { label: "Log an application", href: "/applications/new" },
      });
    },
  },
  {
    id: "volume-on-target",
    description: "Weekly target reached: shift to quality",
    evaluate: ({ facts }) => {
      const w = facts.week;
      if (w.target <= 0 || w.applied < w.target) return null;
      return rec({
        id: "volume-on-target",
        priority: 24,
        group: "volume",
        title: "Weekly target reached",
        body: `You've logged ${w.applied} applications this week [week.applied], meeting your target of ${w.target} [week.target]. Extra time is well spent tailoring your résumé to your best-fit postings or following up.`,
        citations: ["week.applied", "week.target"],
        action: { label: "Tailor my résumé", href: askHref("Tailor my résumé") },
      });
    },
  },
  {
    id: "strongest-category",
    description: "Best job category by response rate (n ≥ 5) beats the overall rate: reallocate some volume",
    evaluate: ({ facts, byId }) => {
      const { best } = bestAndWorst("category", facts.conversions.category);
      const overall = rateEstimate(facts.funnel.responded, facts.funnel.applied);
      if (!best || !byId["funnel.response_rate"] || overall.value === null || (best.rate.value ?? 0) <= overall.value || best.row.responded === 0) return null;
      const overlap = intervalsOverlap(best.rate, overall);
      const apprentice = facts.profile.openToApprenticeships && facts.programs.some((p) => p.interestStatus) ? " while keeping your apprenticeship applications going" : "";
      return rec({
        id: "strongest-category",
        priority: overlap ? 62 : 70,
        group: "targeting",
        title: `Your strongest response rate comes from ${best.row.label} roles`,
        body: `${best.row.label} roles have a ${pct(best.rate.value)} response rate: ${best.rate.successes} of ${best.rate.n} applications, ${intervalText(best.rate)} [category.best], versus ${pct(overall.value)} overall [funnel.response_rate]. Consider shifting some of this week's applications toward similar roles${apprentice}.${overlap ? " The intervals overlap, so this could still be chance; treat it as a hypothesis to test." : ""}`,
        citations: ["category.best", "funnel.response_rate"],
        action: { label: "See this category in Analytics", href: `/analytics?category=${encodeURIComponent(best.row.key)}` },
      });
    },
  },
  {
    id: "weakest-source",
    description: "A source with n ≥ 10 and a clearly lower response rate than the best source",
    evaluate: ({ facts }) => {
      const { best, worst } = bestAndWorst("source", facts.conversions.source);
      if (!best || !worst || worst.row.applied < LOW_SAMPLE_N || intervalsOverlap(best.rate, worst.rate)) return null;
      return rec({
        id: "weakest-source",
        priority: 44,
        group: "targeting",
        title: `${worst.row.label} is converting worst`,
        body: `${worst.row.label} has produced ${worst.row.responded} responses from ${worst.row.applied} applications [source.worst]; ${best.row.label} is at ${pct(best.rate.value)} [source.best]. Consider moving some volume to the better channel or applying on company sites directly.`,
        citations: ["source.worst", "source.best"],
        action: { label: "Compare sources", href: "/analytics" },
      });
    },
  },
  {
    id: "best-resume",
    description: "One résumé version (n ≥ 5) has a better response rate than another",
    evaluate: ({ facts }) => {
      const { best, worst } = bestAndWorst("resume", facts.conversions.resume);
      if (!best || !worst) return null;
      const overlap = intervalsOverlap(best.rate, worst.rate);
      return rec({
        id: "best-resume",
        priority: 48,
        group: "resume",
        title: `"${best.row.label}" is your best-performing résumé`,
        body: `"${best.row.label}" is at ${pct(best.rate.value)} (${best.rate.successes} of ${best.rate.n}) [resume.best] versus "${worst.row.label}" at ${pct(worst.rate.value)} [resume.worst].${overlap ? " The intervals overlap, so keep both in use a little longer before deciding." : " Consider making it your default."}`,
        citations: ["resume.best", "resume.worst"],
        action: { label: "Manage résumés", href: "/coach/resumes" },
      });
    },
  },
  {
    id: "low-response-rate",
    description: "Response rate under 10% after 30 or more applications: review résumé and targeting",
    evaluate: ({ facts, byId }) => {
      const r = byId["funnel.response_rate"];
      if (facts.funnel.applied < LOW_RESPONSE_MIN_APPLIED || !r || typeof r.value !== "number" || r.value >= LOW_RESPONSE_RATE) return null;
      return rec({
        id: "low-response-rate",
        priority: 80,
        group: "targeting",
        title: "Review your résumé and targeting",
        body: `After ${facts.funnel.applied} applications [funnel.applied], ${facts.funnel.responded} employers responded [funnel.response_rate]. With this many applications, a low rate more often points to targeting or résumé fit than bad luck. Pick three recent postings and ask me to tailor your résumé to each to see which requirements it doesn't mention.`,
        citations: ["funnel.applied", "funnel.response_rate"],
        action: { label: "Tailor my résumé", href: askHref("Tailor my résumé") },
      });
    },
  },
  {
    id: "bottleneck-screening",
    description: "Responses are not turning into interviews (≥ 5 responses, < 25% reach interviews)",
    evaluate: ({ facts }) => {
      const f = facts.funnel;
      if (f.responded < 5 || f.interviewed / f.responded >= 0.25) return null;
      return rec({
        id: "bottleneck-screening",
        priority: 57,
        group: "bottleneck",
        title: "Responses aren't turning into interviews yet",
        body: `${f.responded} employers responded [funnel.responses] but ${f.interviewed} applications reached an interview [funnel.interviews]. Responses include rejections, so check which ones were screening calls; a phone-screen pitch (who you are, why this trade, availability) is worth practising.`,
        citations: ["funnel.responses", "funnel.interviews"],
        action: { label: "Practise with a mock interview", href: askHref("Mock interview") },
      });
    },
  },
  {
    id: "bottleneck-interviews",
    description: "Three or more interviews and no offers yet",
    evaluate: ({ facts }) => {
      const f = facts.funnel;
      if (f.interviewed < 3 || f.offers > 0) return null;
      return rec({
        id: "bottleneck-interviews",
        priority: 56,
        group: "bottleneck",
        title: "Sharpen your interview answers",
        body: `${f.interviewed} applications reached an interview [funnel.interviews] and none has turned into an offer yet [funnel.offers]. Mock interviews with STAR feedback and a polite request for feedback after each interview can show what to change.`,
        citations: ["funnel.interviews", "funnel.offers"],
        action: { label: "Start a mock interview", href: askHref("Mock interview") },
      });
    },
  },
  {
    id: "stale-applications",
    description: `Submitted applications with no activity for more than ${STALE_DAYS} days`,
    evaluate: ({ facts }) => {
      const n = facts.stale.count;
      if (n === 0) return null;
      return rec({
        id: "stale-applications",
        priority: 60,
        group: "followups",
        title: `${plural(n, "application")} quiet for ${STALE_DAYS}+ days`,
        body: `${plural(n, "submitted application")} had no status change or follow-up in over ${STALE_DAYS} days [applications.stale]. Follow up once, or mark them No Response so your active pipeline stays accurate; marking No Response only records what happened.`,
        citations: ["applications.stale"],
        action: { label: "Review submitted applications", href: "/applications?status=SUBMITTED,CONFIRMED" },
      });
    },
  },
  {
    id: "apprenticeship-open",
    description: "Programs whose OPEN status is verified with a check date and that you haven't applied to",
    evaluate: ({ facts }) => {
      if (!facts.profile.openToApprenticeships) return null;
      const applied = new Set(["APPLIED", "TESTING", "INTERVIEWING", "WAITLISTED", "ACCEPTED", "DECLINED"]);
      const open = facts.programs.filter((p) => isVerifiedOpen(p) && !applied.has(p.interestStatus ?? ""));
      if (open.length === 0) return null;
      const first = open[0]!;
      const ids = open.slice(0, 3).map((p) => programMetricId(p));
      return rec({
        id: "apprenticeship-open",
        priority: 85,
        group: "apprenticeship",
        title: open.length === 1 ? `${first.name} is accepting applications` : `${open.length} apprenticeship programs are accepting applications`,
        body: `${open
          .slice(0, 3)
          .map((p) => `${p.name}: ${programStatusText(p)} [${programMetricId(p)}]`)
          .join("; ")}. Confirm the deadline and requirements on the official site before you apply; recruitment windows can close early.`,
        citations: ["programs.open_verified", ...ids],
        action: { label: "Open apprenticeships", href: "/academy/apprenticeships" },
      });
    },
  },
  {
    id: "apprenticeship-unverified",
    description: "Saved programs whose recruitment status is unverified: check the site",
    evaluate: ({ facts }) => {
      if (!facts.profile.openToApprenticeships) return null;
      const saved = facts.programs.filter((p) => p.interestStatus && !isVerifiedOpen(p) && p.recruitmentStatus !== "CLOSED");
      if (saved.length === 0) return null;
      const ids = saved.slice(0, 3).map((p) => programMetricId(p));
      return rec({
        id: "apprenticeship-unverified",
        priority: 38,
        group: "apprenticeship",
        title: `Check the site${saved.length > 1 ? "s" : ""} for ${saved.length === 1 ? saved[0]!.name : `${saved.length} saved programs`}`,
        body: `${saved
          .slice(0, 3)
          .map((p) => `${p.name}: ${programStatusText(p)} [${programMetricId(p)}]`)
          .join("; ")}. CareerQuest can't confirm these are recruiting; the program's own site or office is the only reliable source.`,
        citations: ids,
        action: { label: "Open apprenticeships", href: "/academy/apprenticeships" },
      });
    },
  },
  {
    id: "apprenticeship-research",
    description: "Open to apprenticeships but no program saved yet",
    evaluate: ({ facts }) => {
      if (!facts.profile.openToApprenticeships || facts.programs.length === 0 || facts.programs.some((p) => p.interestStatus)) return null;
      return rec({
        id: "apprenticeship-research",
        priority: 34,
        group: "apprenticeship",
        title: "Save the apprenticeship programs you'd consider",
        body: `The directory lists ${facts.programs.length} programs; ${facts.programs.filter(isVerifiedOpen).length} are verified open [programs.open_verified] and ${facts.programs.filter((p) => !isVerifiedOpen(p) && p.recruitmentStatus !== "CLOSED").length} have unverified status [programs.unverified]. You haven't saved any yet [programs.saved]; saving them lets the Advisor watch their status for you.`,
        citations: ["programs.open_verified", "programs.unverified", "programs.saved"],
        action: { label: "Compare programs", href: askHref("Compare apprenticeship programs") },
      });
    },
  },
  {
    id: "academy-start",
    description: "No Academy lessons completed yet (electrician pathway)",
    evaluate: ({ facts }) => {
      const a = facts.academy;
      const electrical = facts.profile.primaryTrade === "ELECTRICIAN" || facts.profile.openToApprenticeships;
      if (!electrical || a.lessonsTotal === 0 || a.lessonsCompleted > 0 || !a.next) return null;
      return rec({
        id: "academy-start",
        priority: 40,
        group: "academy",
        title: `Start the Academy with "${a.next.title}"`,
        body: `You've completed ${a.lessonsCompleted} of ${a.lessonsTotal} lessons [academy.lessons_completed]. Apprenticeship aptitude tests lean on algebra and reading comprehension, and the fundamentals track is a gentle start; it is study material, not field experience.`,
        citations: ["academy.lessons_completed", "academy.next_lesson"],
        action: { label: "Open the lesson", href: `/academy/lessons/${a.next.key}` },
      });
    },
  },
  {
    id: "academy-momentum",
    description: `No Academy activity for ${ACADEMY_IDLE_DAYS}+ days with lessons remaining`,
    evaluate: ({ facts }) => {
      const a = facts.academy;
      if (a.lessonsCompleted === 0 || a.daysSinceActivity === null || a.daysSinceActivity < ACADEMY_IDLE_DAYS || a.lessonsCompleted >= a.lessonsTotal || !a.next) return null;
      return rec({
        id: "academy-momentum",
        priority: 42,
        group: "academy",
        title: "Pick the Academy back up",
        body: `It's been ${a.daysSinceActivity} days since your last lesson or quiz [academy.days_since_activity]; you're at ${a.lessonsCompleted} of ${a.lessonsTotal} lessons [academy.lessons_completed]. One lesson keeps the momentum: "${a.next.title}" [academy.next_lesson].`,
        citations: ["academy.days_since_activity", "academy.lessons_completed", "academy.next_lesson"],
        action: { label: "Continue learning", href: `/academy/lessons/${a.next.key}` },
      });
    },
  },
  {
    id: "quiz-review",
    description: "The most recent quiz was not passed",
    evaluate: ({ facts }) => {
      const q = facts.academy.recentQuizzes[0];
      if (!q || q.passed) return null;
      return rec({
        id: "quiz-review",
        priority: 50,
        group: "academy",
        title: `Review before retaking ${q.label}`,
        body: `Your latest attempt scored ${q.percent}% and did not pass [quiz.latest]. Re-read the sections behind the missed questions, then retake it; your recent average is shown here [quiz.recent_average].`,
        citations: ["quiz.latest", "quiz.recent_average"],
        action: { label: "Review the material", href: q.href },
      });
    },
  },
  {
    id: "hours-unverified",
    description: "Self-reported work hours with no verified hours",
    evaluate: ({ facts }) => {
      const h = facts.hours;
      if (h.selfReported <= 0 || h.verified > 0) return null;
      return rec({
        id: "hours-unverified",
        priority: 32,
        group: "hours",
        title: "Get your logged hours verified",
        body: `You've logged ${formatNumber(h.selfReported)} self-reported hours [hours.self_reported] and none are verified yet [hours.verified]. Certification and apprenticeship credit depend on documentation, so ask the employer to confirm them and attach the record.`,
        citations: ["hours.self_reported", "hours.verified"],
        action: { label: "Open training hours", href: "/academy/hours" },
      });
    },
  },
  {
    id: "hours-logging",
    description: `Work hours logged before but nothing in the last ${HOURS_IDLE_DAYS} days`,
    evaluate: ({ facts }) => {
      const h = facts.hours;
      if (h.entries === 0 || h.daysSinceLast === null || h.daysSinceLast < HOURS_IDLE_DAYS) return null;
      return rec({
        id: "hours-logging",
        priority: 30,
        group: "hours",
        title: "Log your recent work hours",
        body: `Your last logged work day was ${h.daysSinceLast} days ago [hours.days_since_last]. If you've worked since, log it while the dates and supervisors are fresh.`,
        citations: ["hours.days_since_last"],
        action: { label: "Log hours", href: "/academy/hours" },
      });
    },
  },
  {
    id: "rest-day",
    description: `${REST_AFTER_DAYS}+ consecutive active days: plan a rest day`,
    evaluate: ({ facts }) => {
      const d = facts.streak.consecutiveActiveDays;
      if (d < REST_AFTER_DAYS) return null;
      return rec({
        id: "rest-day",
        priority: 55,
        group: "rest",
        title: "Plan a rest day",
        body: `You've been active ${d} days in a row [activity.consecutive_days]. A job search is a long effort; rest days you mark in Missions never break your streak [streak.current].`,
        citations: ["activity.consecutive_days", "streak.current"],
        action: { label: "Open Missions", href: "/missions" },
      });
    },
  },
  {
    id: "small-sample",
    description: `Fewer than ${LOW_SAMPLE_N} applications: rates are not reliable yet`,
    evaluate: ({ facts }) => {
      const n = facts.funnel.applied;
      if (n === 0 || n >= LOW_SAMPLE_N) return null;
      return rec({
        id: "small-sample",
        priority: 14,
        group: "honesty",
        title: "Your rates are based on very few applications",
        body: `With ${plural(n, "application")} [funnel.applied], the response rate [funnel.response_rate] can swing a lot from a single reply. Don't change strategy on it yet; steady volume matters more right now.`,
        citations: ["funnel.applied", "funnel.response_rate"],
        action: { label: "See the numbers", href: "/analytics" },
      });
    },
  },
  {
    id: "resume-missing",
    description: "No résumé version saved",
    evaluate: ({ facts }) =>
      facts.resumes.count > 0
        ? null
        : rec({
            id: "resume-missing",
            priority: 70,
            group: "resume",
            title: "Add your résumé",
            body: "You have no résumé saved [resume.versions]. Tailoring, cover-letter drafts and résumé-version analytics all need one; paste the text of the résumé you are sending now.",
            citations: ["resume.versions"],
            action: { label: "Add a résumé", href: "/coach/resumes" },
          }),
  },
  {
    id: "campaign-closing",
    description: "Seven or fewer days left in the campaign",
    evaluate: ({ facts }) => {
      const c = facts.campaign;
      if (!c.started || c.beyond || c.daysRemaining > 7) return null;
      return rec({
        id: "campaign-closing",
        priority: 46,
        group: "campaign",
        title: `Your campaign ends in ${plural(c.daysRemaining, "day")}`,
        body: `You're on ${c.day > 0 ? `day ${c.day}` : "the last days"} of the campaign [campaign.day]. Write down what worked and what you'll change for the next phase while it's fresh.`,
        citations: ["campaign.day"],
        action: { label: "Plan the next phase", href: "/missions/campaign#next-phase" },
      });
    },
  },
];

export const RULE_IDS: string[] = RULES.map((r) => r.id);

/** All recommendations that apply, highest priority first, citations restricted to known metrics. */
export function evaluateRules(snapshot: CoachSnapshot, rules: readonly Rule[] = RULES): Recommendation[] {
  const out: Recommendation[] = [];
  for (const rule of rules) {
    const r = rule.evaluate(snapshot);
    const list = r === null ? [] : Array.isArray(r) ? r : [r];
    for (const item of list) {
      const citations = Array.from(new Set(item.citations.filter((id) => snapshot.byId[id] !== undefined)));
      // Remove inline tokens that point at metrics the snapshot doesn't have.
      const body = item.body.replace(/\s?\[([a-z][a-z0-9_.-]*)\]/g, (tok, id: string) => (snapshot.byId[id] ? tok : ""));
      out.push({ ...item, body, citations });
    }
  }
  const order = new Map(rules.map((r, i) => [r.id, i]));
  return out.sort((a, b) => b.priority - a.priority || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** This week's priorities: the top `limit` recommendations, at most one per group. */
export function weeklyPriorities(recommendations: readonly Recommendation[], limit = 3): Recommendation[] {
  const groups = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of recommendations) {
    const g = r.group ?? r.id;
    if (groups.has(g)) continue;
    groups.add(g);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
