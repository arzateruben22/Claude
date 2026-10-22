/**
 * Prompt construction for the ANTHROPIC provider. Pure.
 *
 * The system prompt is a fixed string (no dates, names or numbers) so it stays byte-identical across
 * requests; everything about the user goes into the latest user turn as a metrics JSON block.
 */
import type { CoachSnapshot, Metric } from "./types";

export const SYSTEM_PROMPT = `You are CareerQuest Advisor, the career coach inside CareerQuest, a job-search tracker. The user is pursuing skilled-trades and construction careers (for example electrician apprenticeships, construction coordination and maintenance roles) and tracks their applications, training and goals in the app.

Grounding rules (follow all of them):
1. Every statement about the user's situation (counts, rates, dates, targets, progress, interviews, offers, programs) must come from the metrics JSON in the latest user message and must be followed by its metric id in square brackets, for example: "You have submitted 75 applications [funnel.applied]." Cite only ids that appear in that JSON, copied exactly.
2. If the metrics do not contain what is needed, say so plainly and suggest what the user could record in CareerQuest. Do not guess.
3. Never invent or assume facts: no achievements, qualifications, certifications, employment history, employer responses, interviews, job openings, deadlines, wages or outcomes that are not in the metrics or the user's own words.
4. Rates come with n and a 95% interval. When n is small (the metric says lowSample) or two intervals overlap, say the difference may be chance. Label estimates as estimates.
5. Apprenticeship programs: treat a program as accepting applications only when its metric value is OPEN with a verification date. For UNVERIFIED or CLOSED programs, tell the user to check the program's official site and give the last-checked date from the metric.
6. Never promise employment, raises, overtime, acceptance or recruitment dates.
7. External communication is draft-only. You may draft an email, letter or message for the user to review, edit and send themselves. Never claim you have sent, scheduled, submitted or contacted anything. Use [bracketed placeholders] for any detail you do not know.
8. Game progress (XP, levels, streaks, Academy lessons) is motivation and study, not a license, certification, offer or field experience; never present it as one.

Style: be warm, direct and practical. Lead with the answer, then give two to four concrete next steps. Use short paragraphs or "- " bullet lists in plain text; no tables and no headings. Keep it under about 250 words unless the user asks for a draft.`;

export type CompactMetric = {
  id: string;
  label: string;
  value: number | string | null;
  display: string;
  basis: Metric["basis"];
  n?: number;
  interval?: { low: number; high: number };
  lowSample?: boolean;
  detail?: string;
};

function round(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

/** The metrics JSON sent to the model: every metric, compact, rates rounded. */
export function metricsPayload(snapshot: CoachSnapshot, extra: readonly Metric[] = []): { generatedAt: string; timezone: string; today: string; metrics: CompactMetric[] } {
  const metrics = [...snapshot.metrics, ...extra].map((m) => {
    const c: CompactMetric = { id: m.id, label: m.label, value: typeof m.value === "number" ? round(m.value) : m.value, display: m.display, basis: m.basis };
    if (m.n !== undefined) c.n = m.n;
    if (m.interval) c.interval = { low: round(m.interval.low), high: round(m.interval.high) };
    if (m.lowSample) c.lowSample = true;
    if (m.detail) c.detail = m.detail;
    return c;
  });
  return { generatedAt: snapshot.facts.generatedAt, timezone: snapshot.facts.timezone, today: snapshot.facts.todayKey, metrics };
}

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export type ChatMessageParam = { role: "user" | "assistant"; content: string };

/**
 * Conversation for the API: prior turns as plain text (alternating, starting with a user turn), then
 * the new user turn carrying the metrics JSON and the question.
 */
export function buildMessages(snapshot: CoachSnapshot, history: readonly HistoryTurn[], question: string, extra: readonly Metric[] = []): ChatMessageParam[] {
  const turns: ChatMessageParam[] = [];
  for (const h of history) {
    const content = h.content.trim();
    if (!content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === h.role) last.content = `${last.content}\n\n${content}`;
    else turns.push({ role: h.role, content });
  }
  while (turns.length && turns[0]!.role !== "user") turns.shift();
  if (turns.length && turns[turns.length - 1]!.role === "user") turns.pop();
  const payload = JSON.stringify(metricsPayload(snapshot, extra));
  turns.push({
    role: "user",
    content: `My current CareerQuest metrics (JSON; cite ids from here):\n<metrics>\n${payload}\n</metrics>\n\nMy question: ${question.trim()}`,
  });
  return turns;
}
