import { describe, expect, it } from "vitest";
import { buildSnapshot, citeMetrics, bestAndWorst, slugId } from "@/lib/coach/snapshot";
import { RULES, RULE_IDS, evaluateRules, weeklyPriorities } from "@/lib/coach/rules";
import {
  replyBottleneck,
  replyFallback,
  replyFollowUp,
  replyPickApplication,
  replyPrograms,
  replyRoles,
  replySalary,
  replyStatus,
  replyTailor,
  replyToday,
  replyInterviewStart,
  replyInterviewTurn,
  resolveApplication,
} from "@/lib/coach/replies";
import { citationIds } from "@/lib/coach/citations";
import type { CoachFacts, CoachSnapshot, ProgramFact } from "@/lib/coach/types";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

function program(over: Partial<ProgramFact> = {}): ProgramFact {
  return {
    slug: "test-jatc",
    name: "Test Electrical JATC",
    sponsor: "Test JATC",
    region: "Orange County",
    isUnion: true,
    recruitmentStatus: "UNVERIFIED",
    verifiedOn: "2026-10-21",
    recruitmentNote: null,
    website: "https://example.org",
    applyUrl: null,
    startingWage: "$26.00/hr (40% of journeyman)",
    startingWageVerified: true,
    durationYears: 5,
    classroomHours: null,
    interestStatus: null,
    ...over,
  };
}

/** A realistic mid-campaign user with nothing urgent, so each test switches one rule on. */
function facts(over: DeepPartial<CoachFacts> = {}): CoachFacts {
  const base: CoachFacts = {
    generatedAt: "2026-10-22T19:00:00.000Z",
    timezone: "America/Los_Angeles",
    todayKey: "2026-10-22",
    weekStartKey: "2026-10-19",
    profile: {
      name: "Ada Lopez",
      onboardingComplete: true,
      dailyTarget: 5,
      weeklyTarget: 25,
      workdaysPerWeek: 5,
      immediateSalaryTarget: 80000,
      longTermSalaryTarget: 150000,
      openToApprenticeships: true,
      primaryTrade: "ELECTRICIAN",
    },
    campaign: { started: true, beyond: false, day: 30, lengthDays: 90, phase: 1, phaseName: "Launch", daysRemaining: 61 },
    funnel: { total: 80, applied: 75, responded: 6, screened: 4, interviewed: 2, offers: 0, hired: 0 },
    conversions: { category: [], source: [], resume: [] },
    week: { applied: 15, target: 25, dailyTarget: 5, expectedByYesterday: 10, activeDays: 3, todayApplied: 5, todayIsWorkday: true },
    followUps: { overdue: 0, dueToday: 0, firstOverdueId: null },
    stale: { count: 0, items: [] },
    streak: { current: 4, longest: 9, consecutiveActiveDays: 3 },
    academy: {
      tracks: [
        { key: "FUNDAMENTALS", label: "Electrical fundamentals", completed: 3, total: 8 },
        { key: "SAFETY", label: "Safety", completed: 0, total: 4 },
      ],
      lessonsCompleted: 3,
      lessonsTotal: 12,
      inProgress: 1,
      next: { key: "ohms-law", title: "Ohm's law" },
      daysSinceActivity: 2,
      recentQuizzes: [{ quizKey: "electrical-basics-quiz", label: "Electrical basics quiz", percent: 90, passed: true, at: "2026-10-20T18:00:00.000Z", href: "/academy/lessons/electrical-basics" }],
    },
    hours: { selfReported: 0, verified: 0, entries: 0, daysSinceLast: null },
    interviews: { upcoming7d: 0, attended: 2, next: null },
    offers: { open: [] },
    resumes: { count: 1, latestName: "Trades résumé", latestId: "11111111-1111-4111-8111-111111111111", defaultId: null },
    programs: [],
    xp: { total: 1200 },
  };
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? merge(a[k] as Record<string, unknown>, v as Record<string, unknown>) : v;
    }
    return out;
  };
  return merge(base as unknown as Record<string, unknown>, over as Record<string, unknown>) as unknown as CoachFacts;
}

function snap(over: DeepPartial<CoachFacts> = {}): CoachSnapshot {
  return buildSnapshot(facts(over));
}

function ids(s: CoachSnapshot) {
  return evaluateRules(s).map((r) => r.id);
}

const categories = [
  { key: "Construction coordinator", label: "Construction coordinator", applied: 12, responded: 4, interviews: 1, offers: 0 },
  { key: "Apprentice electrician", label: "Apprentice electrician", applied: 40, responded: 1, interviews: 1, offers: 0 },
  { key: "Maintenance technician", label: "Maintenance technician", applied: 15, responded: 1, interviews: 0, offers: 0 },
  { key: "Estimator", label: "Estimator", applied: 3, responded: 0, interviews: 0, offers: 0 },
];

describe("metrics snapshot", () => {
  it("gives every metric a unique id and a label", () => {
    const s = snap({ conversions: { category: categories }, programs: [program(), program({ slug: "open-one", name: "Open One", recruitmentStatus: "OPEN" })] });
    const seen = new Set<string>();
    for (const m of s.metrics) {
      expect(m.id).toMatch(/^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/);
      expect(m.label.length).toBeGreaterThan(0);
      expect(seen.has(m.id)).toBe(false);
      seen.add(m.id);
    }
    expect(s.byId["funnel.response_rate"]!.display).toBe("8% (6 of 75)");
    expect(s.byId["funnel.response_rate"]!.n).toBe(75);
    expect(s.byId["funnel.response_rate"]!.interval).not.toBeNull();
    expect(s.byId["hours.verified"]!.basis).toBe("verified");
    expect(s.byId["hours.self_reported"]!.basis).toBe("self_reported");
  });

  it("only compares groups with n ≥ 5 and labels best and worst", () => {
    const s = snap({ conversions: { category: categories } });
    expect(s.byId["category.best"]!.label).toContain("Construction coordinator");
    expect(s.byId["category.best"]!.n).toBe(12);
    expect(s.byId["category.worst"]!.label).toContain("Apprentice electrician");
    expect(s.byId["category.estimator"]).toBeUndefined(); // n = 3
    expect(s.byId[`category.${slugId("Maintenance technician")}`]).toBeDefined();
  });

  it("has no best/worst when fewer than two groups qualify", () => {
    expect(bestAndWorst("category", categories.slice(0, 1)).best).toBeNull();
    expect(snap({ conversions: { category: categories.slice(0, 1) } }).byId["category.best"]).toBeUndefined();
  });

  it("marks programs OPEN only when verified with a date", () => {
    const s = snap({
      programs: [
        program({ slug: "a", recruitmentStatus: "OPEN", verifiedOn: "2026-10-20" }),
        program({ slug: "b", recruitmentStatus: "OPEN", verifiedOn: null }),
        program({ slug: "c", recruitmentStatus: "UNVERIFIED" }),
      ],
    });
    expect(s.byId["program.a"]!.value).toBe("OPEN");
    expect(s.byId["program.a"]!.display).toContain("verified 2026-10-20");
    expect(s.byId["program.b"]!.value).toBe("UNVERIFIED");
    expect(s.byId["program.c"]!.display).toMatch(/check the program's site/);
    expect(s.byId["programs.open_verified"]!.value).toBe(1);
  });

  it("freezes cited metrics without unknown ids", () => {
    const s = snap();
    const cited = citeMetrics(s.byId, ["funnel.applied", "nope.missing", "funnel.applied"]);
    expect(cited.map((c) => c.id)).toEqual(["funnel.applied"]);
    expect(cited[0]!.display).toBe("75");
  });
});

describe("rules engine", () => {
  it("has at least 20 rules with unique ids", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
  });

  it("every recommendation cites only metrics that exist, and its tokens match its citations", () => {
    const busy = snap({
      profile: { onboardingComplete: false },
      funnel: { total: 40, applied: 35, responded: 6, screened: 2, interviewed: 3, offers: 0, hired: 0 },
      conversions: { category: categories, source: categories.map((c, i) => ({ ...c, key: `S${i}`, label: `Source ${i}` })), resume: categories.slice(0, 2) },
      week: { applied: 2, expectedByYesterday: 15, todayApplied: 0 },
      followUps: { overdue: 3, dueToday: 2, firstOverdueId: null },
      stale: { count: 2, items: [{ id: "x", company: "Acme", title: "Helper", daysSinceActivity: 30 }] },
      streak: { consecutiveActiveDays: 8 },
      hours: { selfReported: 120, verified: 0, entries: 10, daysSinceLast: 20 },
      interviews: { upcoming7d: 1, next: { id: "i", applicationId: "a", company: "Acme", title: "Helper", type: "PHONE_SCREEN", scheduledAt: "2026-10-23T17:00:00.000Z", hoursUntil: 22, prepDone: false } },
      offers: { open: [{ applicationId: "o", company: "Volt Co", title: "Apprentice", status: "RECEIVED", baseAmount: 24, period: "HOURLY", annualized: 49920, decisionDue: "2026-10-24", daysToDecision: 2 }] },
      resumes: { count: 0, latestName: null, latestId: null },
      programs: [program({ slug: "open", recruitmentStatus: "OPEN" }), program({ slug: "saved", interestStatus: "INTERESTED" })],
      academy: { recentQuizzes: [{ quizKey: "q", label: "Ohm's law quiz", percent: 40, passed: false, at: "2026-10-21T00:00:00.000Z", href: "/academy/lessons/ohms-law" }], daysSinceActivity: 12 },
      campaign: { daysRemaining: 5 },
    });
    const recs = evaluateRules(busy);
    expect(recs.length).toBeGreaterThanOrEqual(20);
    for (const r of recs) {
      expect(r.citations.length, r.id).toBeGreaterThan(0);
      for (const id of r.citations) expect(busy.byId[id], `${r.id} cites ${id}`).toBeDefined();
      for (const id of citationIds(r.body)) expect(busy.byId[id], `${r.id} body cites ${id}`).toBeDefined();
      expect(r.action.href.startsWith("/")).toBe(true);
    }
    // Sorted by priority.
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1]!.priority).toBeGreaterThanOrEqual(recs[i]!.priority);
  });

  it("weekly priorities are the top three, one per group", () => {
    const s = snap({ followUps: { overdue: 3, dueToday: 2 }, week: { applied: 2, expectedByYesterday: 15, todayApplied: 0 }, stale: { count: 1, items: [] } });
    const top = weeklyPriorities(evaluateRules(s), 3);
    expect(top).toHaveLength(3);
    expect(new Set(top.map((r) => r.group)).size).toBe(3);
    expect(top[0]!.id).toBe("followups-overdue");
  });

  it("strongest category cites interval and n", () => {
    const s = snap({ conversions: { category: categories } });
    const r = evaluateRules(s).find((x) => x.id === "strongest-category")!;
    expect(r).toBeDefined();
    expect(r.title).toBe("Your strongest response rate comes from Construction coordinator roles");
    expect(r.body).toContain("4 of 12");
    expect(r.body).toMatch(/95% interval \d+%–\d+%/);
    expect(r.citations).toEqual(["category.best", "funnel.response_rate"]);
    expect(r.action.href).toBe("/analytics?category=Construction%20coordinator");
  });

  it("follow-up backlog, volume and today's target", () => {
    expect(ids(snap({ followUps: { overdue: 2 } }))).toContain("followups-overdue");
    expect(ids(snap({ followUps: { dueToday: 1 } }))).toContain("followups-today");
    expect(ids(snap({ week: { applied: 4, expectedByYesterday: 15 } }))).toContain("volume-behind");
    expect(ids(snap())).not.toContain("volume-behind");
    expect(ids(snap({ week: { applied: 25 } }))).toContain("volume-on-target");
    expect(ids(snap({ week: { todayApplied: 1 } }))).toContain("today-target");
    expect(ids(snap({ week: { todayApplied: 1, todayIsWorkday: false } }))).not.toContain("today-target");
  });

  it("low response rate needs 30+ applications", () => {
    expect(ids(snap())).toContain("low-response-rate"); // 6 of 75
    expect(ids(snap({ funnel: { applied: 29, responded: 1 } }))).not.toContain("low-response-rate");
    expect(ids(snap({ funnel: { applied: 40, responded: 8 } }))).not.toContain("low-response-rate");
  });

  it("interview soon (prep) and practice after prep", () => {
    const next = { id: "i", applicationId: "app-1", company: "Acme", title: "Helper", type: "PHONE_SCREEN", scheduledAt: "x", hoursUntil: 30, prepDone: false };
    const r = evaluateRules(snap({ interviews: { upcoming7d: 1, next } })).find((x) => x.id === "interview-soon")!;
    expect(r.priority).toBe(98);
    expect(r.action.href).toBe("/applications/app-1");
    expect(ids(snap({ interviews: { upcoming7d: 1, next: { ...next, prepDone: true } } }))).toContain("interview-practice");
  });

  it("offer present → negotiation with the salary simulator", () => {
    const offer = { applicationId: "o", company: "Volt Co", title: "Apprentice", status: "RECEIVED", baseAmount: 24, period: "HOURLY" as const, annualized: 49920, decisionDue: null, daysToDecision: null };
    const r = evaluateRules(snap({ offers: { open: [offer] } })).find((x) => x.id === "offer-negotiation")!;
    expect(r.action.href).toBe("/salary");
    expect(r.citations).toContain("offers.open");
    expect(r.body).toMatch(/never guaranteed/);
    expect(ids(snap({ offers: { open: [{ ...offer, decisionDue: "2026-10-23", daysToDecision: 1 }] } }))).toContain("offer-decision-due");
  });

  it("stale applications suggest follow up or No Response", () => {
    const r = evaluateRules(snap({ stale: { count: 3, items: [{ id: "a", company: "Acme", title: "Helper", daysSinceActivity: 40 }] } })).find((x) => x.id === "stale-applications")!;
    expect(r.body).toMatch(/No Response/);
    expect(r.citations).toEqual(["applications.stale"]);
  });

  it("apprenticeships: only verified OPEN is recommended as open; UNVERIFIED says check the site", () => {
    const open = evaluateRules(snap({ programs: [program({ slug: "open", name: "Open JATC", recruitmentStatus: "OPEN" })] }));
    expect(open.map((r) => r.id)).toContain("apprenticeship-open");
    const noDate = evaluateRules(snap({ programs: [program({ slug: "nodate", recruitmentStatus: "OPEN", verifiedOn: null })] }));
    expect(noDate.map((r) => r.id)).not.toContain("apprenticeship-open");
    const unverified = evaluateRules(snap({ programs: [program({ slug: "u", interestStatus: "INTERESTED" })] })).find((r) => r.id === "apprenticeship-unverified")!;
    expect(unverified.body).toMatch(/check the program's site \(last checked 2026-10-21\)/);
    expect(ids(snap({ programs: [program({ slug: "open", recruitmentStatus: "OPEN", interestStatus: "APPLIED" })] }))).not.toContain("apprenticeship-open");
    expect(ids(snap({ profile: { openToApprenticeships: false }, programs: [program({ slug: "open", recruitmentStatus: "OPEN" })] }))).not.toContain("apprenticeship-open");
    expect(ids(snap({ programs: [program()] }))).toContain("apprenticeship-research");
  });

  it("academy momentum, quiz review, hours, rest", () => {
    expect(ids(snap({ academy: { daysSinceActivity: 9 } }))).toContain("academy-momentum");
    expect(ids(snap({ academy: { lessonsCompleted: 0 } }))).toContain("academy-start");
    expect(ids(snap({ academy: { recentQuizzes: [{ quizKey: "q", label: "Quiz", percent: 50, passed: false, at: "x", href: "/academy" }] } }))).toContain("quiz-review");
    expect(ids(snap({ hours: { selfReported: 40, verified: 0, entries: 5, daysSinceLast: 3 } }))).toContain("hours-unverified");
    expect(ids(snap({ hours: { selfReported: 40, verified: 40, entries: 5, daysSinceLast: 20 } }))).toEqual(expect.arrayContaining(["hours-logging"]));
    expect(ids(snap({ streak: { consecutiveActiveDays: 6 } }))).toContain("rest-day");
    expect(ids(snap({ streak: { consecutiveActiveDays: 5 } }))).not.toContain("rest-day");
  });

  it("small-n honesty and first application", () => {
    const small = evaluateRules(snap({ funnel: { total: 4, applied: 4, responded: 1, screened: 0, interviewed: 0, offers: 0, hired: 0 } })).find((r) => r.id === "small-sample")!;
    expect(small.body).toMatch(/4 applications/);
    expect(ids(snap({ funnel: { total: 0, applied: 0, responded: 0, screened: 0, interviewed: 0, offers: 0, hired: 0 } }))[0]).toBe("first-application");
  });
});

describe("rules-provider replies", () => {
  it("'how am I doing' matches the example tone and cites every number", () => {
    const s = snap({ conversions: { category: categories } });
    const r = replyStatus(s);
    expect(r.content).toContain("You've submitted 75 applications [funnel.applied], received 6 responses [funnel.responses], and attended 2 interviews [interviews.attended].");
    expect(r.content).toContain("Your strongest response rate comes from Construction coordinator roles");
    expect(r.citations).toEqual(expect.arrayContaining(["funnel.applied", "funnel.responses", "interviews.attended", "category.best", "week.applied"]));
    for (const id of r.citations) expect(s.byId[id]).toBeDefined();
  });

  it("today lists ranked priorities with actions", () => {
    const r = replyToday(snap({ followUps: { overdue: 2 } }));
    expect(r.content).toMatch(/Send 2 overdue follow-ups/);
    expect(r.actions?.[0]?.href).toBe("/applications?sort=followUp");
  });

  it("bottleneck publishes its stage metrics as extra metrics", () => {
    const r = replyBottleneck(snap({ funnel: { responded: 8, interviewed: 1 } }));
    expect(r.extraMetrics?.map((m) => m.id)).toEqual(["stage.response_to_interview", "stage.interview_to_offer"]);
    expect(r.citations).toContain("stage.response_to_interview");
    expect(r.content).toMatch(/Responses rarely turn into interviews/);
  });

  it("roles explains when there isn't enough data", () => {
    expect(replyRoles(snap()).content).toMatch(/can't compare job categories yet/);
    expect(replyRoles(snap({ conversions: { category: categories } })).content).toMatch(/Construction coordinator: 33%/);
  });

  it("program comparison is honest about verification", () => {
    const r = replyPrograms(snap({ programs: [program({ slug: "c", name: "Closed JATC", recruitmentStatus: "CLOSED" }), program({ slug: "o", name: "Open JATC", recruitmentStatus: "OPEN" })] }));
    expect(r.content.indexOf("Open JATC")).toBeLessThan(r.content.indexOf("Closed JATC"));
    expect(r.content).toMatch(/Accepting applications \(verified 2026-10-21\)/);
    expect(r.content).toMatch(/Not recruiting as of the last check/);
    expect(replyPrograms(snap()).content).toMatch(/no programs loaded/);
  });

  it("salary explanation links the simulator and makes no promises", () => {
    const r = replySalary(snap({ programs: [program()] }));
    expect(r.actions?.[0]?.href).toBe("/salary");
    expect(r.content).toMatch(/not promises/);
    expect(r.citations).toEqual(expect.arrayContaining(["goals.salary_immediate", "goals.salary_long_term", "program.test-jatc"]));
  });

  it("fallback explains the rules provider and offers help", () => {
    const r = replyFallback(snap());
    expect(r.kind).toBe("unknown");
    expect(r.quickReplies?.length).toBeGreaterThan(0);
  });

  it("resolves an application by company name and asks when ambiguous", () => {
    const apps = [
      { id: "1", companyName: "Acme Electric Inc.", positionTitle: "Apprentice Electrician", status: "SUBMITTED" },
      { id: "2", companyName: "Bright Builders", positionTitle: "Construction Coordinator", status: "SUBMITTED" },
      { id: "3", companyName: "Bright Builders", positionTitle: "Estimator", status: "SAVED" },
    ];
    expect(resolveApplication("draft a follow-up email for Acme Electric", apps).match?.id).toBe("1");
    const amb = resolveApplication("follow up with bright builders", apps);
    expect(amb.match).toBeNull();
    expect(amb.candidates.map((c) => c.id)).toEqual(["2", "3"]);
    expect(resolveApplication("follow up with bright builders estimator", apps).match?.id).toBe("3");
    const pick = replyPickApplication(snap(), "follow_up", amb.candidates);
    expect(pick.quickReplies?.map((q) => q.applicationId)).toEqual(["2", "3"]);
  });

  it("follow-up draft uses only recorded facts and placeholders", () => {
    const app = {
      id: "a1",
      companyName: "Acme Electric",
      positionTitle: "Apprentice Electrician",
      status: "SUBMITTED",
      requisitionNumber: "R-1001",
      sourceLabel: "Indeed",
      appliedAt: "2026-10-10T00:00:00.000Z",
      recruiterName: null,
      lastInterviewAt: null,
      jobDescription: null,
    };
    const r = replyFollowUp(snap(), app, { userName: "Ada Lopez", now: new Date("2026-10-22T19:00:00Z") });
    const d = r.drafts![0]!;
    expect(d.subject).toBe("Following up on my application – Apprentice Electrician (Req. R-1001)");
    expect(d.body).toContain("I applied for the Apprentice Electrician position at Acme Electric on October 10 through Indeed");
    expect(d.body).toContain("[Hiring manager's name");
    expect(d.body).toContain("Ada Lopez");
    expect(r.content).toMatch(/never sends anything/);
  });

  it("tailoring needs a résumé and a job description", () => {
    const app = { id: "a1", companyName: "Acme", positionTitle: "Helper", status: "SUBMITTED", requisitionNumber: null, sourceLabel: null, appliedAt: null, recruiterName: null, lastInterviewAt: null, jobDescription: null };
    expect(replyTailor(snap(), app, null).content).toMatch(/none is saved yet/);
    expect(replyTailor(snap(), app, { id: "r", name: "R", content: "Some résumé text here", updatedAt: "" }).content).toMatch(/no job description saved/);
  });

  it("mock interview starts with a role picker, then runs questions", () => {
    const pick = replyInterviewStart(snap(), null);
    expect(pick.quickReplies?.map((q) => q.role)).toEqual(["apprentice-electrician", "construction-coordinator", "maintenance-technician"]);
    const start = replyInterviewStart(snap(), "maintenance-technician");
    expect(start.interview?.active).toBe(true);
    expect(start.content).toMatch(/Question 1 of 6/);
    const turn = replyInterviewTurn(snap(), start.interview!, "stop", "stop");
    expect(turn.interview?.active).toBe(false);
  });
});
