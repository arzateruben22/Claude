/**
 * The RULES provider: deterministic, data-grounded replies for every intent. Pure — the service
 * loads the snapshot and any records a tool needs (an application, the latest résumé, recent job
 * descriptions) and passes them in.
 *
 * Every factual sentence carries `[metric.id]` citations; tools that compute new numbers (résumé
 * match, skill gaps) publish them as `extraMetrics` so their chips can be inspected too.
 */
import { formatNumber } from "@/lib/format";
import { LOW_SAMPLE_N, rateEstimate } from "@/lib/analytics/stats";
import { normalizeCompany } from "@/lib/applications/normalize";
import { citationIds } from "./citations";
import { coverLetter, followUpEmail, type Draft, type DraftApplication } from "./drafts";
import {
  INTERVIEW_ROLES,
  INTERVIEW_ROLE_LABELS,
  normalizeMessage,
  type CoachIntent,
  type InterviewRole,
} from "./intents";
import { continueInterview, questionPrompt, startInterviewState, type InterviewState } from "./mock-interview";
import { aggregateGaps, analyzeFit, tailoredResumeDraft } from "./resume-tailor";
import { evaluateRules } from "./rules";
import {
  DIMENSION_LABELS,
  bestAndWorst,
  intervalText,
  isVerifiedOpen,
  pct,
  programMetricId,
  programStatusText,
  qualifyingGroups,
  rateDisplay,
  slugId,
  type Dimension,
} from "./snapshot";
import type { CoachSnapshot, Metric, Recommendation, RecommendationAction } from "./types";

export type QuickReply = { label: string; text: string; applicationId?: string; role?: InterviewRole };

export type ReplyKind = CoachIntent | "interview" | "pick_application";

export type CoachReply = {
  kind: ReplyKind;
  /** Text with `[metric.id]` citation tokens; light Markdown (paragraphs, "- " bullets, **bold**). */
  content: string;
  /** Metric ids cited in `content` (filled by `finalizeReply`). */
  citations: string[];
  /** Metrics computed by a tool for this reply only (e.g. a résumé match score). */
  extraMetrics?: Metric[];
  actions?: RecommendationAction[];
  quickReplies?: QuickReply[];
  drafts?: Draft[];
  /** Mock-interview state after this reply (active while a question is waiting). */
  interview?: InterviewState | null;
  /** Shown above the reply, e.g. why the LLM provider was not used. */
  notice?: string;
};

export type ResumeDoc = { id: string; name: string; content: string; updatedAt: string };

export type ApplicationChoice = { id: string; companyName: string; positionTitle: string; status: string };

export type ApplicationDoc = DraftApplication & { jobDescription: string | null };

export type PostingDoc = { id: string; companyName: string; positionTitle: string; jobDescription: string };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** Fill `citations` from the tokens in the content, keeping only ids that can be shown. */
export function finalizeReply(reply: Omit<CoachReply, "citations"> & { citations?: string[] }, snapshot: CoachSnapshot): CoachReply {
  const extra = new Set((reply.extraMetrics ?? []).map((m) => m.id));
  const known = (id: string) => snapshot.byId[id] !== undefined || extra.has(id);
  const ids = [...(reply.citations ?? []), ...citationIds(reply.content)].filter(known);
  return { ...reply, citations: Array.from(new Set(ids)) };
}

function recLine(r: Recommendation): string {
  return `- **${r.title}.** ${r.body}`;
}

// ---------------------------------------------------------------------------
// Overview intents
// ---------------------------------------------------------------------------

export function replyStatus(s: CoachSnapshot): CoachReply {
  const f = s.facts;
  const parts: string[] = [];
  if (f.funnel.applied === 0) {
    parts.push("You haven't logged a submitted application yet [funnel.applied], so there are no rates to report.");
  } else {
    const attended = f.interviews.attended;
    const interviews = attended > 0 ? `attended ${plural(attended, "interview")} [interviews.attended]` : `had ${plural(f.funnel.interviewed, "application")} reach the interview stage [funnel.interviews]`;
    parts.push(`You've submitted ${plural(f.funnel.applied, "application")} [funnel.applied], received ${plural(f.funnel.responded, "response")} [funnel.responses], and ${interviews}.`);
    const r = rateEstimate(f.funnel.responded, f.funnel.applied);
    parts.push(
      `Your response rate is ${rateDisplay(r)} [funnel.response_rate]${r.interval ? `; the ${intervalText(r)} is an estimate of where the true rate lies` : ""}.${r.lowSample ? ` That's fewer than ${LOW_SAMPLE_N} applications, so treat it as a rough early read.` : ""}`,
    );
    const { best } = bestAndWorst("category", f.conversions.category);
    if (best) {
      parts.push(`Your strongest response rate comes from ${best.row.label} roles: ${best.rate.successes} of ${best.rate.n} (${pct(best.rate.value)}) [category.best].`);
    }
  }
  const w = f.week;
  parts.push(`This week you've logged ${plural(w.applied, "application")} [week.applied] against a target of ${w.target} [week.target].`);
  const extras: string[] = [];
  if (f.followUps.overdue) extras.push(`${plural(f.followUps.overdue, "follow-up")} overdue [followups.overdue]`);
  if (f.interviews.upcoming7d) extras.push(`${plural(f.interviews.upcoming7d, "interview")} in the next 7 days [interviews.upcoming]`);
  if (f.offers.open.length) extras.push(`${plural(f.offers.open.length, "open offer")} [offers.open]`);
  if (extras.length) parts.push(`Also on your plate: ${extras.join(", ")}.`);
  const top = evaluateRules(s)[0];
  if (top) parts.push(`My top suggestion: **${top.title}.** ${top.body}`);
  return finalizeReply({ kind: "status", content: parts.join("\n\n"), actions: top ? [top.action] : undefined }, s);
}

export function replyToday(s: CoachSnapshot, limit = 4): CoachReply {
  const recs = evaluateRules(s).slice(0, limit);
  if (recs.length === 0) {
    return finalizeReply(
      {
        kind: "today",
        content: "Nothing urgent stands out in your numbers right now. Keep a steady pace toward your weekly target [week.target] and use spare time to tailor applications to your best-fit roles.",
      },
      s,
    );
  }
  const content = [`Based on your numbers, here's what I'd focus on, most urgent first:`, recs.map(recLine).join("\n")].join("\n\n");
  return finalizeReply({ kind: "today", content, actions: recs.slice(0, 3).map((r) => r.action) }, s);
}

function stageMetric(id: string, label: string, successes: number, n: number, detail: string): Metric {
  const r = rateEstimate(successes, n);
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
    detail: `${detail}${r.interval ? `; ${intervalText(r)} (estimate)` : ""}`,
    href: "/analytics",
  };
}

export function replyBottleneck(s: CoachSnapshot): CoachReply {
  const f = s.facts.funnel;
  if (f.applied === 0) {
    return finalizeReply({ kind: "bottleneck", content: "There's no funnel to analyze yet: you have 0 submitted applications [funnel.applied]. Log the ones you've sent and I can show where they stall." }, s);
  }
  const extra: Metric[] = [
    stageMetric("stage.response_to_interview", "Responses that reached an interview", f.interviewed, f.responded, "Interview-stage applications ÷ applications with an employer response"),
    stageMetric("stage.interview_to_offer", "Interviews that reached an offer", f.offers, f.interviewed, "Offers ÷ interview-stage applications"),
  ];
  const lines: string[] = [
    "Here's where your applications stop, stage by stage:",
    [
      `- Applied → employer response: ${rateDisplay(rateEstimate(f.responded, f.applied))} [funnel.response_rate]`,
      `- Response → interview: ${rateDisplay(rateEstimate(f.interviewed, f.responded))} [stage.response_to_interview]`,
      `- Interview → offer: ${rateDisplay(rateEstimate(f.offers, f.interviewed))} [stage.interview_to_offer]`,
    ].join("\n"),
  ];
  const findings: string[] = [];
  const respRate = f.responded / f.applied;
  if (f.applied >= 30 && respRate < 0.1) findings.push("The first stage is the main bottleneck: after 30+ applications, fewer than 1 in 10 got a response. That usually points at targeting or résumé fit; try tailoring your résumé to a few recent postings.");
  if (f.responded >= 5 && f.interviewed / f.responded < 0.25) findings.push("Responses rarely turn into interviews. Some responses are rejections, but if screening calls aren't converting, practise a short phone-screen pitch.");
  if (f.interviewed >= 3 && f.offers === 0) findings.push("Interviews haven't turned into offers yet. Mock interviews with STAR feedback, and asking for feedback after each interview, are the best levers.");
  if (s.facts.stale.count) findings.push(`${plural(s.facts.stale.count, "application")} went quiet for 21+ days [applications.stale]; following up or closing them out keeps the funnel honest.`);
  if (findings.length === 0) {
    findings.push(
      f.applied < LOW_SAMPLE_N
        ? `With ${plural(f.applied, "application")} it's too early to name a bottleneck; most applications getting no reply is normal at any volume.`
        : "No single stage stands out against these thresholds. Most applications getting no reply is normal; keep volume steady and focus on your strongest categories.",
    );
  }
  lines.push(findings.map((x) => `- ${x}`).join("\n"));
  lines.push("Rates are observed counts; the intervals behind each chip show how uncertain they are.");
  return finalizeReply({ kind: "bottleneck", content: lines.join("\n\n"), extraMetrics: extra, actions: [{ label: "Open Analytics", href: "/analytics" }] }, s);
}

function groupLines(s: CoachSnapshot, dim: Dimension, rows: CoachSnapshot["facts"]["conversions"]["category"]): string[] {
  return qualifyingGroups(dim, rows)
    .filter((g) => s.byId[g.id])
    .sort((a, b) => (b.rate.value ?? 0) - (a.rate.value ?? 0))
    .map((g) => `- ${g.row.label}: ${rateDisplay(g.rate)}, ${intervalText(g.rate)} [${g.id}]`);
}

export function replyRoles(s: CoachSnapshot): CoachReply {
  const f = s.facts;
  const cat = groupLines(s, "category", f.conversions.category);
  const src = groupLines(s, "source", f.conversions.source);
  const parts: string[] = [];
  if (cat.length >= 2) {
    parts.push(`Response rate by ${DIMENSION_LABELS.category} (groups with at least 5 applications):\n${cat.join("\n")}`);
    const { best } = bestAndWorst("category", f.conversions.category);
    if (best) parts.push(`${best.row.label} roles are responding best so far [category.best]. Roles with similar duties and requirements are the natural place to add volume; if the intervals overlap, the gap may still be chance.`);
  } else {
    parts.push(
      `I can't compare job categories yet: at least two categories need 5 or more applications each. You have ${plural(f.funnel.applied, "submitted application")} [funnel.applied]. Fill in the Job category field on your applications so I can tell which kinds of roles respond best.`,
    );
  }
  if (src.length >= 2) parts.push(`By ${DIMENSION_LABELS.source}:\n${src.join("\n")}`);
  if (f.profile.openToApprenticeships) {
    parts.push(`Your profile says you're open to apprenticeships; ${plural(f.programs.filter(isVerifiedOpen).length, "program")} in the directory ${f.programs.filter(isVerifiedOpen).length === 1 ? "is" : "are"} verified open right now [programs.open_verified]. Apprenticeship applications can run in parallel with job applications.`);
  }
  return finalizeReply({ kind: "roles", content: parts.join("\n\n"), actions: [{ label: "Open Analytics", href: "/analytics" }] }, s);
}

export function replyPrograms(s: CoachSnapshot): CoachReply {
  const programs = s.facts.programs;
  if (programs.length === 0) {
    return finalizeReply(
      {
        kind: "programs",
        content: "The apprenticeship directory has no programs loaded yet, so there's nothing to compare. Once the directory is seeded, I'll compare programs with their verified recruitment status.",
        actions: [{ label: "Open apprenticeships", href: "/academy/apprenticeships" }],
      },
      s,
    );
  }
  const rank = (p: (typeof programs)[number]) => (isVerifiedOpen(p) ? 0 : p.recruitmentStatus === "CLOSED" ? 2 : 1);
  const sorted = [...programs].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const lines = sorted.map((p) => {
    const facts = [
      `${p.region}${p.isUnion ? ", union" : ", non-union"}`,
      p.durationYears ? `about ${p.durationYears} years` : null,
      p.startingWage ? `starting wage: ${p.startingWage.length > 140 ? `${p.startingWage.slice(0, 137)}…` : p.startingWage} (${p.startingWageVerified ? "verified" : "unverified"})` : "starting wage not published in the directory",
      p.interestStatus ? `your status: ${p.interestStatus.toLowerCase()}` : null,
    ].filter(Boolean);
    return `- **${p.name}**: ${programStatusText(p)} [${programMetricId(p)}]. ${facts.join("; ")}.`;
  });
  const content = [
    `Here are the ${plural(programs.length, "program")} in the directory, verified-open first [programs.open_verified]:`,
    lines.join("\n"),
    "Only programs whose OPEN status carries a check date are shown as accepting applications. For anything unverified or closed, the program's own site or office is the reliable source, and windows can open or close between checks.",
  ].join("\n\n");
  return finalizeReply({ kind: "programs", content, actions: [{ label: "Open apprenticeships", href: "/academy/apprenticeships" }] }, s);
}

export function replySalary(s: CoachSnapshot): CoachReply {
  const f = s.facts;
  const parts: string[] = [
    `Your targets are ${s.byId["goals.salary_immediate"]!.display} now [goals.salary_immediate] and ${s.byId["goals.salary_long_term"]!.display} long term [goals.salary_long_term].`,
  ];
  if (s.byId["offers.best_annualized"]) parts.push(`Your highest open offer works out to ${s.byId["offers.best_annualized"]!.display} [offers.best_annualized]; that annualized figure is an estimate that leaves out overtime and benefits.`);
  const wages = f.programs.filter((p) => p.startingWage);
  if (wages.length) {
    parts.push(
      `Apprenticeship pay is usually a schedule that steps up as you complete hours and classes. What the directory has on file:\n${wages
        .slice(0, 4)
        .map((p) => `- ${p.name}: ${p.startingWage!.length > 180 ? `${p.startingWage!.slice(0, 177)}…` : p.startingWage} (${p.startingWageVerified ? "verified" : "unverified"}, checked ${p.verifiedOn ?? "never"}) [${programMetricId(p)}]`)
        .join("\n")}`,
    );
  }
  parts.push(
    "For a year-by-year view, the Salary Simulator's \"Compare paths\" tab puts a job now next to a paid apprenticeship over 5–10 years, with the wage steps, hours and overtime assumptions you choose. Its numbers are estimates from your inputs, not promises of raises, overtime or placement dates.",
  );
  return finalizeReply(
    {
      kind: "salary",
      content: parts.join("\n\n"),
      actions: [
        { label: "Compare paths", href: "/salary/compare" },
        { label: "Open the Salary Simulator", href: "/salary" },
      ],
    },
    s,
  );
}

export function replyHelp(s: CoachSnapshot, intro?: string): CoachReply {
  const content = [
    intro ?? "I'm your CareerQuest Advisor. I only use numbers from your own records, and every number I quote has a chip you can open to see it.",
    [
      "Things you can ask:",
      "- \"How am I doing?\": a summary of your funnel and this week",
      "- \"What should I do today?\": your priorities, most urgent first",
      "- \"Where are my applications stalling?\": bottleneck analysis",
      "- \"Which roles fit me best?\": response rates by job category and source",
      "- \"Draft a follow-up email\" or \"Cover letter draft\" for an application (drafts only, never sent)",
      "- \"Tailor my résumé\" for an application, or \"What skills am I missing?\"",
      "- \"Mock interview\": practice questions with STAR feedback",
      "- \"Compare apprenticeship programs\" and \"Explain salary progression\"",
    ].join("\n"),
  ].join("\n\n");
  return finalizeReply(
    {
      kind: "help",
      content,
      quickReplies: [
        { label: "How am I doing?", text: "How am I doing?" },
        { label: "What should I do today?", text: "What should I do today?" },
        { label: "Mock interview", text: "Mock interview" },
      ],
    },
    s,
  );
}

export function replyFallback(s: CoachSnapshot): CoachReply {
  const top = evaluateRules(s)[0];
  const intro = top
    ? `The built-in rules engine answers with fixed tools rather than free conversation, and it didn't recognise that request. Your current top priority is **${top.title}.** ${top.body}`
    : "The built-in rules engine answers with fixed tools rather than free conversation, and it didn't recognise that request.";
  return { ...replyHelp(s, intro), kind: "unknown" };
}

// ---------------------------------------------------------------------------
// Application-based tools
// ---------------------------------------------------------------------------

/** Find the application a message refers to by company or title. */
export function resolveApplication(text: string, apps: readonly ApplicationChoice[]): { match: ApplicationChoice | null; candidates: ApplicationChoice[] } {
  const t = ` ${normalizeCompany(normalizeMessage(text))} `;
  const scored = apps
    .map((a) => {
      const company = normalizeCompany(a.companyName);
      const title = normalizeCompany(a.positionTitle);
      let score = 0;
      if (company.length >= 3 && t.includes(` ${company} `)) score += 2;
      else if (company.split(" ")[0] && company.split(" ")[0]!.length >= 4 && t.includes(` ${company.split(" ")[0]} `)) score += 1;
      if (title.length >= 5 && t.includes(` ${title} `)) score += 1;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  if (scored.length === 0) return { match: null, candidates: apps.slice(0, 5) };
  const top = scored[0]!.score;
  const best = scored.filter((x) => x.score === top).map((x) => x.a);
  return best.length === 1 ? { match: best[0]!, candidates: [] } : { match: null, candidates: best.slice(0, 5) };
}

const PICK_TEXT: Partial<Record<CoachIntent, string>> = {
  follow_up: "Draft a follow-up email",
  cover_letter: "Cover letter draft",
  tailor: "Tailor my résumé",
};

export function replyPickApplication(s: CoachSnapshot, intent: CoachIntent, candidates: readonly ApplicationChoice[]): CoachReply {
  if (candidates.length === 0) {
    return finalizeReply(
      {
        kind: "pick_application",
        content: "This tool works on one of your applications, and you don't have any active ones yet [funnel.applied]. Log an application first.",
        actions: [{ label: "Log an application", href: "/applications/new" }],
      },
      s,
    );
  }
  const verb = PICK_TEXT[intent] ?? "Use";
  return finalizeReply(
    {
      kind: "pick_application",
      content: `Which application should I use? Pick one below, or choose it in the "Application" menu under the chat box.`,
      quickReplies: candidates.map((c) => ({ label: `${c.companyName} · ${c.positionTitle}`, text: `${verb} for ${c.companyName}`, applicationId: c.id })),
    },
    s,
  );
}

export function replyFollowUp(s: CoachSnapshot, app: ApplicationDoc, opts: { userName: string; now: Date }): CoachReply {
  const { draft, notes } = followUpEmail(app, { userName: opts.userName, timeZone: s.facts.timezone, now: opts.now });
  const content = [
    `Here's a draft for **${app.companyName} · ${app.positionTitle}**. Review it, edit it in your own words, and send it from your email yourself. CareerQuest never sends anything for you.`,
    notes.map((n) => `- ${n}`).join("\n"),
    s.facts.followUps.overdue ? `You have ${plural(s.facts.followUps.overdue, "overdue follow-up")} in total [followups.overdue]. After you send this one, record it on the application so it counts.` : "After you send it, record the follow-up on the application so it counts.",
  ].join("\n\n");
  return finalizeReply({ kind: "follow_up", content, drafts: [draft], actions: [{ label: "Open the application", href: `/applications/${app.id}` }] }, s);
}

function fitMetric(app: ApplicationDoc, matched: number, total: number, score: number | null): Metric {
  return {
    id: "fit.score",
    label: `Résumé match with the ${app.companyName} posting`,
    value: score,
    display: score === null ? "No key terms found in the posting" : `${pct(score)} of the posting's key terms (${matched} of ${total} terms)`,
    basis: "estimate",
    detail: "Keyword heuristic: weighted share of the posting's key terms that also appear in your latest résumé. It does not measure how qualified you are.",
    href: `/applications/${app.id}`,
  };
}

function needResume(s: CoachSnapshot, kind: ReplyKind): CoachReply {
  return finalizeReply(
    {
      kind,
      content: "I need your résumé text for this, and none is saved yet [resume.versions]. Paste it under Résumés; I'll only ever reuse what it says.",
      actions: [{ label: "Add a résumé", href: "/coach/resumes" }],
    },
    s,
  );
}

function needDescription(s: CoachSnapshot, app: ApplicationDoc, kind: ReplyKind): CoachReply {
  return finalizeReply(
    {
      kind,
      content: `The ${app.companyName} application has no job description saved, so there's nothing to compare your résumé against. Paste the posting text into the application's Job description field and ask again.`,
      actions: [{ label: "Edit the application", href: `/applications/${app.id}/edit` }],
    },
    s,
  );
}

export function replyTailor(s: CoachSnapshot, app: ApplicationDoc, resume: ResumeDoc | null): CoachReply {
  if (!resume) return needResume(s, "tailor");
  if (!app.jobDescription?.trim()) return needDescription(s, app, "tailor");
  const fit = analyzeFit(app.jobDescription, resume.content);
  const metric = fitMetric(app, fit.matched.length, fit.keywords.length, fit.score);
  const parts: string[] = [
    `Comparing your résumé **${resume.name}** with the **${app.companyName} · ${app.positionTitle}** posting: your résumé covers ${metric.display} [fit.score].`,
  ];
  if (fit.matched.length) parts.push(`Already in your résumé: ${fit.matched.map((k) => k.display).join(", ")}.`);
  if (fit.missing.length) {
    parts.push(
      `The posting mentions these and your résumé doesn't: ${fit.missing.slice(0, 10).map((k) => k.display).join(", ")}. Add one only if it's true for you (for example, a certification you hold or a tool you've used); otherwise it's a gap to close or to address honestly in an interview.`,
    );
  }
  if (fit.suggestions.length) {
    parts.push(
      [
        "Suggested edits (each one only reuses what your résumé already says):",
        ...fit.suggestions.map((sg) =>
          sg.kind === "emphasize"
            ? `- Move up: "${sg.suggested}". ${sg.reason}`
            : sg.kind === "wording"
              ? `- Reword: "${sg.original}" → "${sg.suggested}". ${sg.reason}`
              : `- Add near the top: "${sg.suggested}". ${sg.reason}`,
        ),
      ].join("\n"),
    );
  } else {
    parts.push("I didn't find a safe rewrite: none of your résumé lines use the posting's key terms yet. The gaps above are the place to start.");
  }
  const draft = tailoredResumeDraft(resume.content, fit);
  if (draft) parts.push("Below is a tailored copy with those edits applied. It only reorders and rewords lines already in your résumé; read every line before you use it, and save it as a new version under Résumés if you want to keep it.");
  if (s.byId["funnel.response_rate"] && s.facts.funnel.applied >= LOW_SAMPLE_N) parts.push(`For context, your overall response rate is ${s.byId["funnel.response_rate"]!.display} [funnel.response_rate].`);
  return finalizeReply(
    {
      kind: "tailor",
      content: parts.join("\n\n"),
      drafts: draft ? [{ title: `Tailored résumé draft: ${app.companyName}`, body: draft }] : undefined,
      extraMetrics: [metric],
      actions: [
        { label: "Edit résumé", href: `/coach/resumes?edit=${resume.id}` },
        { label: "Open the application", href: `/applications/${app.id}` },
      ],
    },
    s,
  );
}

export function replyCoverLetter(s: CoachSnapshot, app: ApplicationDoc, resume: ResumeDoc | null, opts: { userName: string }): CoachReply {
  const fit = resume && app.jobDescription?.trim() ? analyzeFit(app.jobDescription, resume.content) : null;
  const draft = coverLetter(app, {
    userName: opts.userName,
    matchedTerms: fit ? fit.matched.map((k) => k.display) : [],
    missingTerms: fit ? fit.missing.map((k) => k.display) : [],
  });
  const notes: string[] = [];
  if (!resume) notes.push("No résumé is saved [resume.versions], so the draft has no résumé points to work from.");
  if (!app.jobDescription?.trim()) notes.push("The application has no job description saved, so the draft can't point at the posting's requirements.");
  notes.push("Every [bracketed] part is a placeholder for something only you know. Fill it in with true details or delete it; nothing here has been sent.");
  const extra = fit ? [fitMetric(app, fit.matched.length, fit.keywords.length, fit.score)] : [];
  const content = [
    `Here's a cover letter skeleton for **${app.companyName} · ${app.positionTitle}**${fit ? `, built around the terms your résumé shares with the posting [fit.score]` : ""}.`,
    notes.map((n) => `- ${n}`).join("\n"),
  ].join("\n\n");
  return finalizeReply({ kind: "cover_letter", content, drafts: [draft], extraMetrics: extra, actions: [{ label: "Open the application", href: `/applications/${app.id}` }] }, s);
}

export function replyResumeAlignment(s: CoachSnapshot, postings: readonly PostingDoc[], resume: ResumeDoc | null): CoachReply {
  if (!resume) return needResume(s, "resume_alignment");
  if (postings.length === 0) {
    return finalizeReply(
      {
        kind: "resume_alignment",
        content: "None of your applications has a job description saved, so I can't measure résumé alignment yet. Paste the posting text into an application's Job description field, then ask again or ask me to tailor your résumé for that application.",
        actions: [{ label: "Open the tracker", href: "/applications" }],
      },
      s,
    );
  }
  const rows = postings.map((p) => ({ p, fit: analyzeFit(p.jobDescription, resume.content) })).filter((r) => r.fit.score !== null);
  const avg = rows.length ? rows.reduce((sum, r) => sum + (r.fit.score ?? 0), 0) / rows.length : null;
  const extra: Metric[] = [
    {
      id: "alignment.average",
      label: "Average résumé match across recent postings",
      value: avg,
      display: avg === null ? "No key terms found" : `${pct(avg)} across ${plural(rows.length, "posting")}`,
      basis: "estimate",
      n: rows.length,
      detail: `Keyword heuristic comparing "${resume.name}" with the job descriptions saved on your most recent applications`,
      href: "/applications",
    },
  ];
  const lowest = [...rows].sort((a, b) => (a.fit.score ?? 0) - (b.fit.score ?? 0)).slice(0, 3);
  const content = [
    `Your résumé **${resume.name}** covers on average ${extra[0]!.display} of the key terms in your recent postings [alignment.average].`,
    `Lowest matches:\n${lowest.map((r) => `- ${r.p.companyName} · ${r.p.positionTitle}: ${pct(r.fit.score)}; missing ${r.fit.missing.slice(0, 4).map((k) => k.display).join(", ") || "nothing major"}`).join("\n")}`,
    "A low match doesn't mean you're unqualified; it means the posting's words aren't on your résumé. Pick one of these and ask me to tailor your résumé for it.",
  ].join("\n\n");
  return finalizeReply(
    {
      kind: "resume_alignment",
      content,
      extraMetrics: extra,
      quickReplies: lowest.map((r) => ({ label: `Tailor for ${r.p.companyName}`, text: `Tailor my résumé for ${r.p.companyName}`, applicationId: r.p.id })),
    },
    s,
  );
}

export function replySkillGaps(s: CoachSnapshot, postings: readonly PostingDoc[], resume: ResumeDoc | null): CoachReply {
  const parts: string[] = [];
  const extra: Metric[] = [];
  if (postings.length) {
    const gaps = aggregateGaps(postings, resume?.content ?? null);
    const missing = gaps.filter((g) => !g.inResume && (g.postings >= 2 || postings.length < 3)).slice(0, 8);
    extra.push({
      id: "gaps.postings_analyzed",
      label: "Job descriptions analyzed for skill gaps",
      value: postings.length,
      display: `${plural(postings.length, "posting")}${resume ? `, compared with "${resume.name}"` : ", no résumé saved"}`,
      basis: "observed",
      detail: "Most recent applications that have a job description saved",
      href: "/applications",
    });
    if (missing.length) {
      parts.push(
        `Requirements that come up in your recent postings [gaps.postings_analyzed]${resume ? " but aren't on your résumé" : ""}:\n${missing.map((g) => `- ${g.display}: in ${plural(g.postings, "posting")}`).join("\n")}`,
      );
      parts.push("If you already have one of these, add it to your résumé. If not, it's a candidate for training; tools and certifications are often quicker to pick up than they look.");
    } else {
      parts.push(`Your résumé already mentions the requirements that repeat across your recent postings [gaps.postings_analyzed].`);
    }
  } else {
    parts.push("None of your applications has a job description saved, so I can't compare posting requirements with your résumé yet.");
  }
  const tracks = s.facts.academy.tracks.filter((t) => t.total > 0);
  if (tracks.length) {
    const weakest = [...tracks].sort((a, b) => a.completed / a.total - b.completed / b.total).slice(0, 2);
    parts.push(
      `On the technical side, your least-covered Academy tracks are ${weakest.map((t) => `${t.label} (${t.completed} of ${t.total}) [academy.track.${slugId(t.key)}]`).join(" and ")}.${s.byId["quiz.recent_average"] ? ` Your recent quiz average is ${s.byId["quiz.recent_average"]!.display} [quiz.recent_average].` : ""} Academy lessons are study material, not field experience or a credential.`,
    );
  }
  return finalizeReply({ kind: "skill_gaps", content: parts.join("\n\n"), extraMetrics: extra, actions: [{ label: "Open the Academy", href: "/academy" }] }, s);
}

// ---------------------------------------------------------------------------
// Mock interview
// ---------------------------------------------------------------------------

export function replyInterviewStart(s: CoachSnapshot, role: InterviewRole | null): CoachReply {
  if (!role) {
    return finalizeReply(
      {
        kind: "mock_interview",
        content: "Which role should I interview you for?",
        quickReplies: INTERVIEW_ROLES.map((r) => ({ label: INTERVIEW_ROLE_LABELS[r], text: `Mock interview: ${INTERVIEW_ROLE_LABELS[r]}`, role: r })),
        interview: null,
      },
      s,
    );
  }
  const state = startInterviewState(role);
  const upcoming = s.facts.interviews.next ? ` You have an interview coming up with ${s.facts.interviews.next.company} [interviews.next], so this is good timing.` : "";
  const content = [
    `Mock interview for **${INTERVIEW_ROLE_LABELS[role]}**: ${state.total} questions, one at a time. After each answer you get STAR-based feedback. It's a keyword heuristic, so use it as a checklist, not a score.${upcoming}`,
    questionPrompt(state),
  ].join("\n\n");
  return finalizeReply({ kind: "interview", content, interview: state, quickReplies: [{ label: "Skip", text: "skip" }, { label: "Stop", text: "stop" }] }, s);
}

export function replyInterviewTurn(s: CoachSnapshot, state: InterviewState, message: string, command: "stop" | "skip" | null): CoachReply {
  const turn = continueInterview(state, message, command);
  return finalizeReply(
    {
      kind: "interview",
      content: turn.content,
      interview: turn.state,
      quickReplies: turn.state.active
        ? [
            { label: "Skip", text: "skip" },
            { label: "Stop", text: "stop" },
          ]
        : [{ label: "Another mock interview", text: "Mock interview" }],
    },
    s,
  );
}
