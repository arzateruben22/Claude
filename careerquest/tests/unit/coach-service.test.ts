import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { prisma } from "@/lib/db";
import { todayInTz } from "@/lib/dates";
import { getCoachSnapshot } from "@/lib/coach/metrics";
import { LLM_HOURLY_LIMIT, clearCoachMessages, listCoachMessages, sendCoachMessage } from "@/lib/coach/service";
import { deleteResume, listResumes, saveResume, setDefaultResume } from "@/lib/coach/resumes";
import { evaluateRules } from "@/lib/coach/rules";
import { programMetricId } from "@/lib/coach/snapshot";
import type { LlmClient } from "@/lib/coach/anthropic";

const TZ = "America/Los_Angeles";
const now = new Date();
const DAY = 86_400_000;
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const programSlugs = [`coach-test-open-${suffix}`, `coach-test-unverified-${suffix}`];

let userId = "";
let otherUserId = "";
let otherAppId = "";
let acmeId = "";

function fakeLlm(impl: (body: MessageCreateParamsNonStreaming) => Promise<BetaMessage>) {
  const create = vi.fn(impl);
  const client: LlmClient = { beta: { messages: { create } } };
  return { client, create };
}

function reply(text: string, stop: string = "end_turn"): BetaMessage {
  return { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: text ? [{ type: "text", text }] : [], stop_reason: stop, stop_sequence: null } as unknown as BetaMessage;
}

async function app(data: {
  company: string;
  title: string;
  category?: string;
  status?: "SUBMITTED" | "SCREENING" | "INTERVIEWING" | "REJECTED";
  appliedDaysAgo: number;
  updatedDaysAgo?: number;
  followUpDaysAgo?: number;
  jobDescription?: string;
  forUser?: string;
}) {
  const status = data.status ?? "SUBMITTED";
  const applied = ago(data.appliedDaysAgo);
  const row = await prisma.application.create({
    data: {
      userId: data.forUser ?? userId,
      companyName: data.company,
      normalizedCompany: data.company.toLowerCase(),
      positionTitle: data.title,
      normalizedTitle: data.title.toLowerCase(),
      jobCategory: data.category ?? null,
      status,
      appliedAt: applied,
      statusUpdatedAt: ago(data.updatedDaysAgo ?? data.appliedDaysAgo),
      followUpAt: data.followUpDaysAgo !== undefined ? ago(data.followUpDaysAgo) : null,
      jobDescription: data.jobDescription ?? null,
      statusHistory:
        status === "SUBMITTED"
          ? { create: [{ toStatus: "SUBMITTED", occurredAt: applied, verified: true }] }
          : { create: [{ toStatus: "SUBMITTED", occurredAt: applied, verified: true }, { fromStatus: "SUBMITTED", toStatus: status, occurredAt: ago(Math.max(0, data.appliedDaysAgo - 3)), verified: true }] },
    },
    select: { id: true },
  });
  return row.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `coach-test+${suffix}@careerquest.test`,
      name: "Ada Lopez",
      passwordHash: "not-a-real-hash",
      profile: { create: { timezone: TZ, onboardingCompletedAt: ago(30), openToApprenticeships: true } },
      stats: { create: { totalXp: 500, currentStreak: 3, longestStreak: 5 } },
      campaigns: { create: [{ campaign: "GET_HIRED", startedAt: todayInTz(TZ, ago(30)) }] },
    },
    select: { id: true },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `coach-test-other+${suffix}@careerquest.test`, name: "Other User", passwordHash: "x", profile: { create: { timezone: TZ } } },
    select: { id: true },
  });
  otherUserId = other.id;

  // 6 construction-coordinator applications, 3 with an employer response.
  for (let i = 0; i < 6; i++) {
    await app({ company: `Builder ${i}`, title: "Construction Coordinator", category: "Construction coordinator", status: i < 3 ? "SCREENING" : "REJECTED", appliedDaysAgo: 10 + i, updatedDaysAgo: 2 });
  }
  // 6 apprentice applications with no response and no activity for 25+ days (stale).
  for (let i = 0; i < 6; i++) {
    await app({ company: `Sparky ${i}`, title: "Apprentice Electrician", category: "Apprentice electrician", appliedDaysAgo: 25 + i });
  }
  // One with an overdue follow-up, with a job description for tailoring.
  acmeId = await app({
    company: "Acme Electric",
    title: "Electrical Helper",
    category: "Apprentice electrician",
    appliedDaysAgo: 5,
    updatedDaysAgo: 5,
    followUpDaysAgo: 2,
    jobDescription:
      "Electrical helper for commercial tenant improvements. Must follow lockout/tagout, read blueprints and use a multimeter. OSHA 10 required. Conduit bending experience preferred. Lockout/tagout training provided.",
  });
  otherAppId = await app({ company: "Secret Corp", title: "Foreman", appliedDaysAgo: 3, forUser: otherUserId });

  // Interview in ~30 hours, prep not done.
  await prisma.interview.create({ data: { userId, applicationId: acmeId, type: "PHONE_SCREEN", scheduledAt: new Date(now.getTime() + 30 * 3_600_000) } });

  await prisma.resumeVersion.create({
    data: {
      userId,
      name: "Trades résumé",
      content: "Warehouse Associate, Acme Logistics\n- Followed LOTO procedures on conveyor maintenance with the site electrician\n- Read construction drawings to stage materials\nCertifications: OSHA 10",
    },
  });

  await prisma.apprenticeshipProgram.create({
    data: { slug: programSlugs[0]!, name: "Coach Test Open JATC", sponsor: "Test", region: "Orange County", isUnion: true, recruitmentStatus: "OPEN", verifiedOn: new Date("2026-10-20T00:00:00Z") },
  });
  await prisma.apprenticeshipProgram.create({
    data: { slug: programSlugs[1]!, name: "Coach Test Unverified Program", sponsor: "Test", region: "Los Angeles County", recruitmentStatus: "UNVERIFIED", verifiedOn: new Date("2026-10-21T00:00:00Z") },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
  await prisma.apprenticeshipProgram.deleteMany({ where: { slug: { in: programSlugs } } });
});

describe("coach metrics snapshot (DB)", () => {
  it("computes the funnel, conversions, follow-ups, stale records and interviews from persisted data", async () => {
    const s = await getCoachSnapshot(userId, now);
    expect(s.byId["funnel.applied"]!.value).toBe(13);
    expect(s.byId["funnel.responses"]!.value).toBe(7); // 3 screening + 3 rejected + Acme (an interview is scheduled)
    expect(s.byId["category.best"]!.label).toContain("Construction coordinator");
    expect(s.byId["category.best"]!.n).toBe(6);
    expect(s.byId["category.worst"]!.label).toContain("Apprentice electrician");
    expect(s.byId["followups.overdue"]!.value).toBe(1);
    expect(s.byId["applications.stale"]!.value).toBe(6);
    expect(s.byId["interviews.next"]!.display).toContain("Acme Electric");
    expect(s.byId["resume.versions"]!.value).toBe(1);
    expect(s.byId[programMetricId({ slug: programSlugs[0]! })]!.value).toBe("OPEN");
    expect(s.byId[programMetricId({ slug: programSlugs[1]! })]!.display).toContain("check the program's site");
    // Another user's application never leaks into this snapshot.
    expect(JSON.stringify(s)).not.toContain("Secret Corp");
  });

  it("drives recommendations that cite real metrics", async () => {
    const s = await getCoachSnapshot(userId, now);
    const recs = evaluateRules(s);
    const ids = recs.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["interview-soon", "followups-overdue", "stale-applications", "strongest-category", "apprenticeship-open"]));
    for (const r of recs) for (const c of r.citations) expect(s.byId[c]).toBeDefined();
  });
});

describe("coach chat (DB)", () => {
  it("answers with the rules engine and persists both messages with cited metrics", async () => {
    const { user, reply } = await sendCoachMessage(userId, { text: "How am I doing?" }, { llm: null, now });
    expect(user.role).toBe("USER");
    expect(reply.provider).toBe("RULES");
    expect(reply.content).toContain("You've submitted 13 applications [funnel.applied]");
    expect(reply.citations.map((c) => c.id)).toEqual(expect.arrayContaining(["funnel.applied", "funnel.responses"]));
    expect(reply.citations.find((c) => c.id === "funnel.applied")!.display).toBe("13");
    const stored = await prisma.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(stored.slice(-2).map((m) => m.role)).toEqual(["USER", "ASSISTANT"]);
  });

  it("uses Claude when configured, with this user's metrics in the user turn, and keeps only known citations", async () => {
    const { client, create } = fakeLlm(async () => reply("You've sent 13 applications [funnel.applied]; 1 follow-up is overdue [followups.overdue] [secret.metric]."));
    const res = await sendCoachMessage(userId, { text: "Anything else I should know?" }, { llm: client, now });
    expect(res.reply.provider).toBe("ANTHROPIC");
    expect(res.reply.citations.map((c) => c.id)).toEqual(["funnel.applied", "followups.overdue"]);
    expect(res.reply.content).not.toContain("secret.metric");
    const body = create.mock.calls[0]![0];
    const last = body.messages[body.messages.length - 1]!;
    expect(String(last.content)).toContain('"id":"funnel.applied"');
    expect(String(last.content)).not.toContain("Secret Corp");
    expect(body.system).not.toContain("Ada");
  });

  it("falls back to RULES with a notice on a refusal", async () => {
    const { client } = fakeLlm(async () => reply("", "refusal"));
    const res = await sendCoachMessage(userId, { text: "What should I do today?" }, { llm: client, now });
    expect(res.reply.provider).toBe("RULES");
    expect(res.reply.notice).toMatch(/declined/);
    expect(res.reply.content).toMatch(/most urgent first/);
  });

  it("enforces the hourly LLM limit and degrades to RULES", async () => {
    await prisma.coachMessage.createMany({
      data: Array.from({ length: LLM_HOURLY_LIMIT }, (_, i) => ({ userId, role: "ASSISTANT" as const, content: `old ${i}`, provider: "ANTHROPIC", createdAt: new Date(now.getTime() - 60_000) })),
    });
    const { client, create } = fakeLlm(async () => reply("unused"));
    const res = await sendCoachMessage(userId, { text: "Where am I stuck in the funnel?" }, { llm: client, now });
    expect(create).not.toHaveBeenCalled();
    expect(res.reply.provider).toBe("RULES");
    expect(res.reply.notice).toMatch(/limit of 20 AI answers per hour/);
    await clearCoachMessages(userId);
  });

  it("tool intents stay on the deterministic tools even when Claude is configured", async () => {
    const { client, create } = fakeLlm(async () => reply("should not be used"));
    const res = await sendCoachMessage(userId, { text: "Draft a follow-up email for Acme Electric" }, { llm: client, now });
    expect(create).not.toHaveBeenCalled();
    expect(res.reply.provider).toBe("RULES");
    expect(res.reply.drafts?.[0]?.body).toContain("Electrical Helper position at Acme Electric");
    expect(res.reply.content).toMatch(/never sends anything/);
  });

  it("never uses another user's application", async () => {
    const res = await sendCoachMessage(userId, { text: "Draft a follow-up email", applicationId: otherAppId }, { llm: null, now });
    expect(res.reply.kind).toBe("pick_application");
    expect(JSON.stringify(res.reply)).not.toContain("Secret Corp");
  });

  it("tailors the latest résumé to an application and stores the match metric", async () => {
    const res = await sendCoachMessage(userId, { text: "Tailor my résumé", applicationId: acmeId }, { llm: null, now });
    expect(res.reply.kind).toBe("tailor");
    expect(res.reply.content).toContain("[fit.score]");
    expect(res.reply.citations.map((c) => c.id)).toContain("fit.score");
    expect(res.reply.content).toContain('"Followed lockout/tagout (LOTO) procedures on conveyor maintenance with the site electrician"');
    expect(res.reply.content).toMatch(/multimeter/);
    expect(res.reply.drafts?.[0]?.title).toBe("Tailored résumé draft: Acme Electric");
    expect(res.reply.drafts?.[0]?.body).toContain("Followed lockout/tagout (LOTO) procedures");
  });

  it("runs an interactive mock interview across messages", async () => {
    const start = await sendCoachMessage(userId, { text: "Mock interview: Apprentice electrician", role: "apprentice-electrician" }, { llm: null, now });
    expect(start.reply.interview?.active).toBe(true);
    expect(start.reply.content).toMatch(/Question 1 of 6/);
    const answer = await sendCoachMessage(
      userId,
      { text: "Last year while I was helping a contractor, I decided to take an algebra class at night because I enjoy hands-on work. I practiced with tools every weekend. As a result I passed the class and I am ready for a five-year apprenticeship." },
      { llm: null, now },
    );
    expect(answer.reply.content).toMatch(/Feedback: (Strong|Developing|Needs work)/);
    expect(answer.reply.content).toMatch(/Question 2 of 6/);
    const stop = await sendCoachMessage(userId, { text: "stop" }, { llm: null, now });
    expect(stop.reply.interview?.active).toBe(false);
    expect(stop.reply.content).toMatch(/summary/);
    const after = await sendCoachMessage(userId, { text: "How am I doing?" }, { llm: null, now });
    expect(after.reply.kind).toBe("status");
  });

  it("lists and clears the conversation", async () => {
    const list = await listCoachMessages(userId);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.createdAt <= list[i]!.createdAt).toBe(true);
    expect(await clearCoachMessages(userId)).toBe(list.length);
    expect(await listCoachMessages(userId)).toEqual([]);
  });
});

describe("résumé versions (DB)", () => {
  it("creates, updates, sets the default and deletes only the owner's versions", async () => {
    const a = await saveResume(userId, { name: "Coordinator résumé", content: "Coordinated schedules and RFIs for tenant improvement projects.", isDefault: true }, now);
    expect(a.ok && a.created).toBe(true);
    if (!a.ok) throw new Error("save failed");
    let list = await listResumes(userId);
    expect(list.filter((r) => r.isDefault).map((r) => r.id)).toEqual([a.id]);
    const b = await saveResume(userId, { name: "Second", content: "Another version of my résumé text here.", isDefault: true }, now);
    if (!b.ok) throw new Error("save failed");
    list = await listResumes(userId);
    expect(list.filter((r) => r.isDefault).map((r) => r.id)).toEqual([b.id]);
    expect(await setDefaultResume(userId, a.id)).toBe(true);
    expect((await listResumes(userId)).find((r) => r.isDefault)!.id).toBe(a.id);
    // Another user can't update or delete these.
    expect(await saveResume(otherUserId, { id: a.id, name: "hijack", content: "hijacked content goes here", isDefault: false }, now)).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteResume(otherUserId, a.id)).toBe(false);
    expect(await deleteResume(userId, b.id)).toBe(true);
    expect((await listResumes(userId)).map((r) => r.id)).not.toContain(b.id);
  });
});
