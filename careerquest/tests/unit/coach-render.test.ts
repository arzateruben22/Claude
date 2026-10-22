import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/coach", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { PrioritiesCard } from "@/components/coach/priorities-card";
import { MetricsCard } from "@/components/coach/metrics-card";
import { RichText, metricsById } from "@/components/coach/rich-text";
import { ChatPanel } from "@/components/coach/chat-panel";
import { ResumeManager } from "@/components/coach/resume-manager";
import { CoachTabs } from "@/components/coach/coach-tabs";
import { buildSnapshot, citeMetrics } from "@/lib/coach/snapshot";
import { evaluateRules, weeklyPriorities } from "@/lib/coach/rules";
import type { CoachMessageView } from "@/lib/coach/messages";
import type { CoachFacts } from "@/lib/coach/types";

const facts: CoachFacts = {
  generatedAt: "2026-10-22T19:00:00.000Z",
  timezone: "America/Los_Angeles",
  todayKey: "2026-10-22",
  weekStartKey: "2026-10-19",
  profile: { name: "Ada", onboardingComplete: true, dailyTarget: 5, weeklyTarget: 25, workdaysPerWeek: 5, immediateSalaryTarget: 80000, longTermSalaryTarget: 150000, openToApprenticeships: true, primaryTrade: "ELECTRICIAN" },
  campaign: { started: true, beyond: false, day: 30, lengthDays: 90, phase: 1, phaseName: "Launch", daysRemaining: 61 },
  funnel: { total: 80, applied: 75, responded: 6, screened: 4, interviewed: 2, offers: 0, hired: 0 },
  conversions: {
    category: [
      { key: "Construction coordinator", label: "Construction coordinator", applied: 12, responded: 4, interviews: 1, offers: 0 },
      { key: "Apprentice electrician", label: "Apprentice electrician", applied: 40, responded: 1, interviews: 1, offers: 0 },
    ],
    source: [],
    resume: [],
  },
  week: { applied: 3, target: 25, dailyTarget: 5, expectedByYesterday: 15, activeDays: 2, todayApplied: 0, todayIsWorkday: true },
  followUps: { overdue: 2, dueToday: 0, firstOverdueId: null },
  stale: { count: 0, items: [] },
  streak: { current: 4, longest: 9, consecutiveActiveDays: 3 },
  academy: { tracks: [], lessonsCompleted: 0, lessonsTotal: 0, inProgress: 0, next: null, daysSinceActivity: null, recentQuizzes: [] },
  hours: { selfReported: 0, verified: 0, entries: 0, daysSinceLast: null },
  interviews: { upcoming7d: 0, attended: 2, next: null },
  offers: { open: [] },
  resumes: { count: 1, latestName: "Trades", latestId: null, defaultId: null },
  programs: [],
  xp: { total: 0 },
};
const snapshot = buildSnapshot(facts);

describe("coach components render", () => {
  it("priorities show three ranked items with metric chips and actions", () => {
    const recs = evaluateRules(snapshot);
    const top = weeklyPriorities(recs, 3);
    const cited = metricsById(citeMetrics(snapshot.byId, recs.flatMap((r) => r.citations)));
    const html = renderToStaticMarkup(createElement(PrioritiesCard, { priorities: top, others: recs.slice(3), metrics: cited }));
    expect(html).toContain("This week&#x27;s priorities");
    expect((html.match(/data-testid="coach-recommendation"/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('data-metric-id="followups.overdue"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/applications?sort=followUp"');
    expect(html).not.toMatch(/\[followups\.overdue\]/); // tokens become chips, never raw text
  });

  it("rich text drops unknown citations and renders bold and lists", () => {
    const cited = metricsById(citeMetrics(snapshot.byId, ["funnel.applied"]));
    const html = renderToStaticMarkup(createElement(RichText, { text: "**Hi.** You applied [funnel.applied] [fake.metric]\n\n- one\n- two", metrics: cited }));
    expect(html).toContain("<strong");
    expect(html).toContain('data-metric-id="funnel.applied"');
    expect(html).not.toContain("fake.metric");
    expect(html).toContain("<li>one</li>");
  });

  it("metrics card lists every metric with its basis", () => {
    const html = renderToStaticMarkup(createElement(MetricsCard, { metrics: snapshot.metrics }));
    expect(html).toContain("funnel.response_rate");
    expect(html).toContain("Your target");
    expect(html).toContain("95% interval");
  });

  it("chat panel renders an empty state with starter prompts and labelled inputs", () => {
    const html = renderToStaticMarkup(createElement(ChatPanel, { messages: [], applications: [{ id: "a", companyName: "Acme", positionTitle: "Helper", status: "SUBMITTED" }], llmEnabled: false, timeZone: "America/Los_Angeles" }));
    expect(html).toContain("Rules engine");
    expect(html).toContain("How am I doing?");
    expect(html).toContain("Mock interview");
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Message the Advisor<\/label>/);
    expect(html).toContain("Application (for drafts and tailoring)");
    expect(html).toContain("Acme · Helper (submitted)");
  });

  it("chat panel renders messages, provider, notice, chips, drafts and quick replies", () => {
    const messages: CoachMessageView[] = [
      { id: "1", role: "USER", content: "Draft a follow-up email", provider: "RULES", createdAt: "2026-10-22T18:00:00.000Z", citations: [] },
      {
        id: "2",
        role: "ASSISTANT",
        content: "Here's a draft. You have 2 overdue follow-ups [followups.overdue].",
        provider: "RULES",
        createdAt: "2026-10-22T18:00:01.000Z",
        citations: citeMetrics(snapshot.byId, ["followups.overdue"]),
        notice: "Claude declined this request, so the built-in rules engine answered instead.",
        drafts: [{ title: "Follow-up email: Acme", subject: "Following up", body: "Hi [Hiring manager's name]," }],
        actions: [{ label: "Open the application", href: "/applications/a" }],
        quickReplies: [{ label: "Skip", text: "skip" }],
        interview: { role: "apprentice-electrician", index: 1, total: 6, active: true, results: [] },
      },
    ];
    const html = renderToStaticMarkup(createElement(ChatPanel, { messages, applications: [], llmEnabled: true, timeZone: "America/Los_Angeles" }));
    expect(html).toContain("Claude + rules");
    expect(html).toContain("Draft · not sent");
    expect(html).toContain("Subject: Following up");
    expect(html).toContain("Claude declined this request");
    expect(html).toContain('data-metric-id="followups.overdue"');
    expect(html).toContain("Mock interview in progress");
    expect(html).toContain("Your answer");
    expect(html).toContain('href="/applications/a"');
    expect(html).toContain('value="skip"');
    expect(html).toContain("Oct 22, 11:00 AM");
  });

  it("résumé manager renders the form and the list", () => {
    const html = renderToStaticMarkup(
      createElement(ResumeManager, {
        resumes: [{ id: "r1", name: "Trades", content: "Text", fileName: null, isDefault: true, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", applicationCount: 2 }],
        editing: null,
        timeZone: "America/Los_Angeles",
      }),
    );
    expect(html).toContain("Add a résumé version");
    expect(html).toContain("Default");
    expect(html).toContain("used on 2 applications");
    expect(html).toMatch(/<label[^>]*>Résumé text<\/label>/);
    expect(renderToStaticMarkup(createElement(ResumeManager, { resumes: [], editing: null, timeZone: "UTC" }))).toContain("No résumé saved yet");
  });

  it("tabs link the advisor and résumés", () => {
    const html = renderToStaticMarkup(createElement(CoachTabs));
    expect(html).toContain('href="/coach/resumes"');
    expect(html).toContain('aria-current="page"');
  });
});
