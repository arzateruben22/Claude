import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { askClaude, COACH_MODEL, type LlmClient } from "@/lib/coach/anthropic";
import { SYSTEM_PROMPT, buildMessages } from "@/lib/coach/prompt";
import { buildSnapshot } from "@/lib/coach/snapshot";
import type { CoachFacts } from "@/lib/coach/types";

const facts: CoachFacts = {
  generatedAt: "2026-10-22T19:00:00.000Z",
  timezone: "America/Los_Angeles",
  todayKey: "2026-10-22",
  weekStartKey: "2026-10-19",
  profile: { name: "Ada Lopez", onboardingComplete: true, dailyTarget: 5, weeklyTarget: 25, workdaysPerWeek: 5, immediateSalaryTarget: 80000, longTermSalaryTarget: 150000, openToApprenticeships: true, primaryTrade: "ELECTRICIAN" },
  campaign: { started: true, beyond: false, day: 30, lengthDays: 90, phase: 1, phaseName: "Launch", daysRemaining: 61 },
  funnel: { total: 80, applied: 75, responded: 6, screened: 4, interviewed: 2, offers: 0, hired: 0 },
  conversions: { category: [], source: [], resume: [] },
  week: { applied: 15, target: 25, dailyTarget: 5, expectedByYesterday: 10, activeDays: 3, todayApplied: 5, todayIsWorkday: true },
  followUps: { overdue: 0, dueToday: 0, firstOverdueId: null },
  stale: { count: 0, items: [] },
  streak: { current: 4, longest: 9, consecutiveActiveDays: 3 },
  academy: { tracks: [], lessonsCompleted: 0, lessonsTotal: 0, inProgress: 0, next: null, daysSinceActivity: null, recentQuizzes: [] },
  hours: { selfReported: 0, verified: 0, entries: 0, daysSinceLast: null },
  interviews: { upcoming7d: 0, attended: 2, next: null },
  offers: { open: [] },
  resumes: { count: 0, latestName: null, latestId: null, defaultId: null },
  programs: [],
  xp: { total: 0 },
};
const snapshot = buildSnapshot(facts);

function message(over: Partial<BetaMessage> = {}): BetaMessage {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: COACH_MODEL,
    content: [{ type: "text", text: "You've submitted 75 applications [funnel.applied] and your response rate is 8% [funnel.response_rate] [made.up.metric]." }],
    stop_reason: "end_turn",
    stop_sequence: null,
    ...over,
  } as unknown as BetaMessage;
}

function fakeClient(impl: (body: MessageCreateParamsNonStreaming) => Promise<BetaMessage>) {
  const create = vi.fn((body: MessageCreateParamsNonStreaming, options?: { timeout?: number; maxRetries?: number }) => {
    void options; // recorded by the mock; asserted via create.mock.calls
    return impl(body);
  });
  const client: LlmClient = { beta: { messages: { create } } };
  return { client, create };
}

const headers = new Headers();

describe("Anthropic provider", () => {
  it("sends the documented request: model, effort, fallbacks, stable system prompt, metrics in the user turn", async () => {
    const { client, create } = fakeClient(async () => message());
    const out = await askClaude(client, { snapshot, history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hello [funnel.applied]" }], question: "How am I doing?" });
    expect(out.ok).toBe(true);
    const body = create.mock.calls[0]![0];
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(16000);
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(body.fallbacks).toBe("default");
    expect(body.system).toBe(SYSTEM_PROMPT);
    for (const forbidden of ["temperature", "top_p", "top_k", "thinking"]) expect(body).not.toHaveProperty(forbidden);
    // The system prompt carries no user data; the metrics JSON is in the final user turn.
    expect(SYSTEM_PROMPT).not.toContain("Ada");
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const last = body.messages[body.messages.length - 1]!;
    expect(last.role).toBe("user");
    expect(String(last.content)).toContain('"id":"funnel.applied"');
    expect(String(last.content)).toContain("My question: How am I doing?");
    expect(body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    // Request options are SDK options (timeout/retries), not API parameters.
    expect(create.mock.calls[0]![1]).toEqual({ timeout: 120_000, maxRetries: 1 });
  });

  it("keeps known citations and drops unknown ones", async () => {
    const { client } = fakeClient(async () => message());
    const out = await askClaude(client, { snapshot, history: [], question: "How am I doing?" });
    if (!out.ok) throw new Error("expected ok");
    expect(out.citations).toEqual(["funnel.applied", "funnel.response_rate"]);
    expect(out.text).not.toContain("made.up.metric");
  });

  it("treats a refusal as a fallback to RULES", async () => {
    const { client } = fakeClient(async () => message({ stop_reason: "refusal", content: [] }));
    const out = await askClaude(client, { snapshot, history: [], question: "x" });
    expect(out).toMatchObject({ ok: false, reason: "refusal" });
  });

  it("treats an empty answer as a fallback", async () => {
    const { client } = fakeClient(async () => message({ content: [] }));
    expect(await askClaude(client, { snapshot, history: [], question: "x" })).toMatchObject({ ok: false, reason: "empty" });
  });

  it.each([
    ["auth", () => new Anthropic.AuthenticationError(401, { type: "error" }, "bad key", headers)],
    ["rate_limit", () => new Anthropic.RateLimitError(429, { type: "error" }, "slow down", headers)],
    ["bad_request", () => new Anthropic.BadRequestError(400, { type: "error" }, "nope", headers)],
    ["api_error", () => new Anthropic.InternalServerError(500, { type: "error" }, "boom", headers)],
    ["api_error", () => new Anthropic.APIConnectionError({ message: "offline" })],
    ["unknown", () => new Error("weird")],
  ] as const)("maps %s errors most-specific first", async (reason, make) => {
    const { client } = fakeClient(async () => {
      throw make();
    });
    const out = await askClaude(client, { snapshot, history: [], question: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe(reason);
      expect(out.notice).toMatch(/rules engine answered instead/);
    }
  });

  it("builds alternating turns starting with the user and ending with the metrics turn", () => {
    const msgs = buildMessages(snapshot, [{ role: "assistant", content: "orphan" }, { role: "user", content: "a" }, { role: "user", content: "b" }, { role: "assistant", content: "c" }, { role: "user", content: "pending" }], "q");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[0]!.content).toBe("a\n\nb");
  });
});
