import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { askClaude, defaultLlmClient, type LlmClient } from "./anthropic";
import { detectIntent, detectInterviewRole, interviewCommand, type CoachIntent, type InterviewRole } from "./intents";
import { parseMeta, toJson, toMessageView, type CoachMessageView, type CoachProvider, type StoredMessageMeta } from "./messages";
import { getCoachSnapshot } from "./metrics";
import type { HistoryTurn } from "./prompt";
import {
  finalizeReply,
  replyBottleneck,
  replyCoverLetter,
  replyFallback,
  replyFollowUp,
  replyHelp,
  replyInterviewStart,
  replyInterviewTurn,
  replyPickApplication,
  replyPrograms,
  replyResumeAlignment,
  replyRoles,
  replySalary,
  replySkillGaps,
  replyStatus,
  replyTailor,
  replyToday,
  resolveApplication,
  type ApplicationChoice,
  type ApplicationDoc,
  type CoachReply,
  type PostingDoc,
  type ResumeDoc,
} from "./replies";
import { citeMetrics } from "./snapshot";
import type { CoachSnapshot, Metric } from "./types";

/**
 * Advisor chat orchestration: picks the provider, runs it, and persists the exchange.
 *
 * Routing:
 * - A running mock interview treats every message as an answer ("skip"/"stop" are commands).
 * - Tool intents (mock interview, follow-up email, cover letter, résumé tailoring/alignment, skill
 *   gaps, apprenticeship comparison, salary progression) always use the deterministic RULES tools,
 *   so drafts never contain invented facts and rewrites only reuse the résumé.
 * - Open questions (progress, priorities, bottlenecks, best-fit roles, anything else) go to the
 *   ANTHROPIC provider when ANTHROPIC_API_KEY is set and the user is under the hourly limit; on a
 *   refusal, error or limit the RULES answer is used with a visible notice.
 */

export const MAX_MESSAGE_LENGTH = 4000;
export const LLM_HOURLY_LIMIT = 20;
const HOUR_MS = 3_600_000;
const HISTORY_FOR_LLM = 10;
const HISTORY_TURN_CHARS = 2000;
/** A mock interview left unanswered this long is over; the next message is a normal question. */
const INTERVIEW_IDLE_MS = 6 * HOUR_MS;
const CHOICES_LIMIT = 50;
const POSTINGS_LIMIT = 15;

export type SendMessageInput = { text: string; applicationId?: string | null; role?: InterviewRole | null };

export type SendMessageDeps = {
  now?: Date;
  /** LLM client override: undefined = from env (ANTHROPIC_API_KEY), null = disabled. */
  llm?: LlmClient | null;
};

export type SendMessageResult = { user: CoachMessageView; reply: CoachMessageView };

const ACTIVE_FOR_TOOLS = ["SAVED", "PREPARING", "SUBMITTED", "CONFIRMED", "SCREENING", "INTERVIEWING", "OFFER", "NO_RESPONSE"] as const;

export async function listApplicationChoices(userId: string): Promise<ApplicationChoice[]> {
  return prisma.application.findMany({
    where: { userId, mergedIntoId: null, archivedAt: null, status: { in: [...ACTIVE_FOR_TOOLS] } },
    orderBy: { updatedAt: "desc" },
    take: CHOICES_LIMIT,
    select: { id: true, companyName: true, positionTitle: true, status: true },
  });
}

async function loadApplicationDoc(userId: string, id: string, now: Date): Promise<ApplicationDoc | null> {
  const a = await prisma.application.findFirst({
    where: { id, userId, mergedIntoId: null },
    select: {
      id: true,
      companyName: true,
      positionTitle: true,
      status: true,
      requisitionNumber: true,
      source: true,
      appliedAt: true,
      jobDescription: true,
      recruiterContact: { select: { name: true } },
      interviews: {
        where: { scheduledAt: { lte: now }, outcome: { notIn: ["CANCELLED", "NO_SHOW"] } },
        orderBy: { scheduledAt: "desc" },
        take: 1,
        select: { scheduledAt: true, attendedAt: true },
      },
    },
  });
  if (!a) return null;
  const last = a.interviews[0];
  return {
    id: a.id,
    companyName: a.companyName,
    positionTitle: a.positionTitle,
    status: a.status,
    requisitionNumber: a.requisitionNumber,
    sourceLabel: a.source === "OTHER" ? null : (SOURCE_LABELS[a.source as ApplicationSource] ?? null),
    appliedAt: a.appliedAt ? a.appliedAt.toISOString() : null,
    recruiterName: a.recruiterContact?.name ?? null,
    lastInterviewAt: last ? (last.attendedAt ?? last.scheduledAt).toISOString() : null,
    jobDescription: a.jobDescription,
  };
}

export async function latestResume(userId: string): Promise<ResumeDoc | null> {
  const r = await prisma.resumeVersion.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, content: true, updatedAt: true } });
  return r ? { id: r.id, name: r.name, content: r.content, updatedAt: r.updatedAt.toISOString() } : null;
}

async function recentPostings(userId: string): Promise<PostingDoc[]> {
  const rows = await prisma.application.findMany({
    where: { userId, mergedIntoId: null, jobDescription: { not: null } },
    orderBy: { createdAt: "desc" },
    take: POSTINGS_LIMIT * 2,
    select: { id: true, companyName: true, positionTitle: true, jobDescription: true },
  });
  return rows
    .filter((r): r is typeof r & { jobDescription: string } => Boolean(r.jobDescription && r.jobDescription.trim().length >= 40))
    .slice(0, POSTINGS_LIMIT);
}

/** Whether the user may make another LLM call now (durable count + in-process attempt limiter). */
async function llmAllowed(userId: string, now: Date): Promise<boolean> {
  const recent = await prisma.coachMessage.count({
    where: { userId, role: "ASSISTANT", provider: "ANTHROPIC", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
  });
  if (recent >= LLM_HOURLY_LIMIT) return false;
  return rateLimit(`coach-llm:${userId}`, LLM_HOURLY_LIMIT, HOUR_MS).ok;
}

function rulesAnswer(intent: CoachIntent, snapshot: CoachSnapshot): CoachReply {
  switch (intent) {
    case "status":
      return replyStatus(snapshot);
    case "today":
      return replyToday(snapshot);
    case "bottleneck":
      return replyBottleneck(snapshot);
    case "roles":
      return replyRoles(snapshot);
    case "help":
      return replyHelp(snapshot);
    default:
      return replyFallback(snapshot);
  }
}

type Routed = { reply: CoachReply; provider: CoachProvider; model?: string };

type HistoryRow = { role: "USER" | "ASSISTANT"; content: string; metrics: unknown; createdAt: Date };

async function route(userId: string, input: SendMessageInput, text: string, snapshot: CoachSnapshot, history: HistoryRow[], deps: SendMessageDeps, now: Date): Promise<Routed> {
  const lastAssistant = [...history].reverse().find((h) => h.role === "ASSISTANT");
  const fresh = lastAssistant && now.getTime() - lastAssistant.createdAt.getTime() < INTERVIEW_IDLE_MS;
  const state = lastAssistant && fresh ? parseMeta(lastAssistant.metrics).interview : null;
  const command = interviewCommand(text);

  if (state?.active && !input.role) {
    return { reply: replyInterviewTurn(snapshot, state, text, command), provider: "RULES" };
  }

  let intent = detectIntent(text);
  if (input.role) intent = "mock_interview";
  else if (input.applicationId && intent === "resume_alignment") intent = "tailor";

  switch (intent) {
    case "mock_interview":
      return { reply: replyInterviewStart(snapshot, input.role ?? detectInterviewRole(text)), provider: "RULES" };
    case "follow_up":
    case "cover_letter":
    case "tailor": {
      let app: ApplicationDoc | null = null;
      if (input.applicationId) app = await loadApplicationDoc(userId, input.applicationId, now);
      if (!app) {
        const choices = await listApplicationChoices(userId);
        const { match, candidates } = resolveApplication(text, choices);
        if (match) app = await loadApplicationDoc(userId, match.id, now);
        if (!app) return { reply: replyPickApplication(snapshot, intent, candidates.length ? candidates : choices.slice(0, 5)), provider: "RULES" };
      }
      if (intent === "follow_up") return { reply: replyFollowUp(snapshot, app, { userName: snapshot.facts.profile.name, now }), provider: "RULES" };
      const resume = await latestResume(userId);
      if (intent === "cover_letter") return { reply: replyCoverLetter(snapshot, app, resume, { userName: snapshot.facts.profile.name }), provider: "RULES" };
      return { reply: replyTailor(snapshot, app, resume), provider: "RULES" };
    }
    case "resume_alignment": {
      const [postings, resume] = await Promise.all([recentPostings(userId), latestResume(userId)]);
      return { reply: replyResumeAlignment(snapshot, postings, resume), provider: "RULES" };
    }
    case "skill_gaps": {
      const [postings, resume] = await Promise.all([recentPostings(userId), latestResume(userId)]);
      return { reply: replySkillGaps(snapshot, postings, resume), provider: "RULES" };
    }
    case "programs":
      return { reply: replyPrograms(snapshot), provider: "RULES" };
    case "salary":
      return { reply: replySalary(snapshot), provider: "RULES" };
    default:
      break;
  }

  const fallback = rulesAnswer(intent, snapshot);
  const llm = deps.llm === undefined ? defaultLlmClient() : deps.llm;
  if (!llm || intent === "help") return { reply: fallback, provider: "RULES" };
  if (!(await llmAllowed(userId, now))) {
    return {
      reply: { ...fallback, notice: `You've reached the limit of ${LLM_HOURLY_LIMIT} AI answers per hour, so the built-in rules engine answered instead. AI answers resume within the hour.` },
      provider: "RULES",
    };
  }
  const turns: HistoryTurn[] = history.slice(-HISTORY_FOR_LLM).map((h) => ({
    role: h.role === "USER" ? "user" : "assistant",
    content: h.content.slice(0, HISTORY_TURN_CHARS),
  }));
  const outcome = await askClaude(llm, { snapshot, history: turns, question: text });
  if (!outcome.ok) return { reply: { ...fallback, notice: outcome.notice }, provider: "RULES" };
  return {
    reply: finalizeReply({ kind: intent, content: outcome.text, citations: outcome.citations }, snapshot),
    provider: "ANTHROPIC",
    model: outcome.model,
  };
}

/**
 * Answer one Advisor message and persist the exchange (both rows in one transaction). Never sends
 * anything outside CareerQuest; drafts are stored on the reply for the user to copy.
 */
export async function sendCoachMessage(userId: string, input: SendMessageInput, deps: SendMessageDeps = {}): Promise<SendMessageResult> {
  const now = deps.now ?? new Date();
  const text = input.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) throw new Error("Message is empty");

  const [snapshot, recent] = await Promise.all([
    getCoachSnapshot(userId, now),
    prisma.coachMessage.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_FOR_LLM + 2,
      select: { role: true, content: true, metrics: true, createdAt: true },
    }),
  ]);
  const history = recent.reverse();
  const { reply, provider, model } = await route(userId, input, text, snapshot, history, deps, now);

  const metricMap: Record<string, Metric> = { ...snapshot.byId };
  for (const m of reply.extraMetrics ?? []) metricMap[m.id] = m;
  const userMeta: StoredMessageMeta = {
    v: 1,
    citations: [],
    context: input.applicationId || input.role ? { applicationId: input.applicationId ?? undefined, role: input.role ?? undefined } : undefined,
  };
  const replyMeta: StoredMessageMeta = {
    v: 1,
    kind: reply.kind,
    citations: citeMetrics(metricMap, reply.citations),
    notice: reply.notice,
    actions: reply.actions,
    quickReplies: reply.quickReplies,
    drafts: reply.drafts,
    interview: reply.interview ?? null,
    model,
  };

  const [userRow, replyRow] = await prisma.$transaction([
    prisma.coachMessage.create({
      data: { userId, role: "USER", content: text, provider, metrics: toJson(userMeta) as Prisma.InputJsonValue, createdAt: now },
    }),
    prisma.coachMessage.create({
      data: {
        userId,
        role: "ASSISTANT",
        content: reply.content,
        provider,
        metrics: toJson(replyMeta) as Prisma.InputJsonValue,
        createdAt: new Date(Math.max(Date.now(), now.getTime() + 1)),
      },
    }),
  ]);
  return { user: toMessageView(userRow), reply: toMessageView(replyRow) };
}

/** The most recent messages, oldest first. */
export async function listCoachMessages(userId: string, limit = 60): Promise<CoachMessageView[]> {
  const rows = await prisma.coachMessage.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.reverse().map(toMessageView);
}

export async function clearCoachMessages(userId: string): Promise<number> {
  const res = await prisma.coachMessage.deleteMany({ where: { userId } });
  return res.count;
}
