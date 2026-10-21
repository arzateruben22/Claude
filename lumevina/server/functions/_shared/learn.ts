// Lumevina — how the chat learns from Evelyn, with her approval.
//
// When she replies to a question the chat handed her (functions/studio →
// answer), suggestLesson asks Claude whether her reply holds a general
// answer other clients could use, and if so writes it as one: no names, no
// dates, nothing about that client's own skin or products, in her words. It
// waits in learned_answers as "suggested" until she approves, edits or
// dismisses it (dashboard → Teach the chat). Approved answers join what the
// chat knows for everyone (learnedBlock, in functions/ask).
//
// Medical and personal kinds (a reaction, pregnancy, medication, a skin
// condition, an emergency) are never suggested: those stay hers to answer.

// deno-lint-ignore-file no-explicit-any
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";

const MODEL = "claude-fable-5-1";
export const TEACHABLE = new Set(["skin", "other"]);
export const LEARNED_CAP = 120;   // approved answers the chat reads, newest first

const FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: { teach: { type: "boolean" }, question: { type: "string" }, answer: { type: "string" } },
    required: ["teach", "question", "answer"],
    additionalProperties: false,
  },
};

const RULES = [
  "Evelyn Romero, a licensed esthetician, just answered a client's question by email. Decide whether her reply contains a general answer that would help other clients who ask the same thing, and if it does, write it down for her website's assistant. She approves every one before it's used.",
  "",
  "- teach is false when the reply only makes sense for this one client (it depends on their skin, their products, their plan or their history), when it's mostly about booking a visit or a one-off arrangement, when it's medical or about a reaction, pregnancy, medication or a condition, or when there's no real answer in it.",
  "- question: the question as any client might ask it, one short sentence, with no names or personal details.",
  "- answer: her answer, general, in her own words and voice, two to five sentences. Keep her product names, timings and amounts. Remove names, dates, greetings and sign-offs, and anything specific to this client. Add nothing she didn't say: no new advice, claims, products or numbers.",
  "- When teach is false, question and answer are empty strings.",
].join("\n");

const textOf = (msg: { content: { type: string; text?: string }[] }) =>
  msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();

/** Suggest a general answer from her reply; saves it as "suggested". Never throws. */
export async function suggestLesson(db: any, q: { id: string; kind: string; text: string }, reply: string) {
  if (!TEACHABLE.has(q.kind) || reply.trim().length < 40 || !Deno.env.get("ANTHROPIC_API_KEY")) return null;
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const msg = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 700,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: FORMAT },
      system: [{ type: "text", text: RULES }],
      messages: [{ role: "user", content: `The client asked: ${q.text}\n\nEvelyn replied:\n${reply}` }],
    });
    if (msg.stop_reason === "refusal") return null;
    const out = JSON.parse(textOf(msg));
    const question = String(out.question ?? "").trim().slice(0, 300), answer = String(out.answer ?? "").trim().slice(0, 1500);
    if (!out.teach || !question || !answer) return null;
    const { data } = await db.from("learned_answers").insert({ question, answer, kind: q.kind, source_question: q.id }).select("id").single();
    return data?.id ?? null;
  } catch (e) {
    console.error("lesson", e);
    return null;
  }
}

/** What she approved, for the chat's prompt (empty when there's nothing yet). */
export async function learnedBlock(db: any) {
  const { data } = await db.from("learned_answers").select("question, answer").eq("status", "approved")
    .order("decided_at", { ascending: false }).limit(LEARNED_CAP).then((r: any) => r, () => ({ data: [] }));
  if (!data?.length) return "";
  return "# More answers from Evelyn\n\nShe approved these from her own replies to clients. Use them like her playbook.\n\n" +
    data.map((l: any) => `Q: ${l.question}\nA: ${l.answer}`).join("\n\n");
}
