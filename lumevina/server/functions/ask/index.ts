// Lumevina — Supabase Edge Function: ask
//
// The live Ask Lumevina. A client's question comes in; Claude answers it from
// Evelyn's own playbook, the FAQ and policies, and her shelf (all packed into
// ../_shared/knowledge.ts by knowledge/scripts/build-bundle.mjs), in her
// voice, ending with a next step. Anything personal or medical, anything her
// playbook doesn't cover, and anything on her hard-lines list goes to her:
// it's saved to `questions` with a drafted reply she checks and sends from
// the dashboard (Client questions).
//
// Safety doesn't depend on the model. The same hand-off rules as the website
// (js/ask-rules.js, copied into the bundle) run before any AI call, so
// reactions, pregnancy, medications, named conditions, "my skin" questions and
// emergencies always go to Evelyn. The model can also hand off on its own with
// the hand_to_evelyn tool. A safety refusal from the model is treated as a
// hand-off too. The website keeps its keyword answers for when this function
// isn't reachable.
//
// Request:  POST { message, history?: [{role, content}], name?, email?, handoff? }
//           with the client's Supabase session when signed in. `handoff` (a
//           kind) skips the answer and saves the question for Evelyn.
// Response: { answer } or { handoff: kind, due_at?, needs_contact?, urgent? }
//           or, when Claude can't be reached, a 5xx { error } that tells the
//           website to fall back to its keyword answers.
//
// Deploy:  supabase functions deploy ask
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
// Cost: the stable part of the prompt (instructions, FAQ, playbook, shelf) is
// cached for an hour, so each question pays mostly for its own few hundred
// tokens. Check usage.cache_read_input_tokens in the logs.

import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  BUILT_AT, PROMPT, FACTS, KNOWLEDGE, KNOWLEDGE_EMPTY, HARD_LINES, VOICE, SHELF, RULES, type Rule,
} from "../_shared/knowledge.ts";

const MODEL = "claude-opus-5-5";
const MEMBER_HOURS = 24;
const GUEST_HOURS = 48;
const KIND_SET = new Set(["urgent", "reaction", "pregnancy", "medication", "condition", "skin", "request", "other"]);

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

// ── the rules: plain code, before any AI ──
const rx = (r: Rule) => new RegExp(r.source, r.flags);
const URGENT = rx(RULES.urgent);
const KINDS = RULES.kinds.map((k) => ({ kind: k.kind, any: k.any.map(rx), both: k.both?.map(rx) }));
const ruleKind = (t: string): string | null => {
  if (URGENT.test(t)) return "urgent";
  for (const k of KINDS) {
    if (k.any.some((r) => r.test(t)) || (k.both && k.both.every((r) => r.test(t)))) return k.kind;
  }
  return null;
};

// ── what the assistant knows: stable text, cached; stock last, never cached ──
const shelfLine = (p: typeof SHELF[number]) =>
  `- ${p.name} (${p.brand}, ${p.type}${p.size ? ", " + p.size : ""}): $${p.price}${p.about ? ". " + p.about : ""}`;
const STABLE = [
  PROMPT,
  "# About the studio, FAQ and policies\n\n" + FACTS,
  "# Evelyn's Skin Playbook\n\n" + (KNOWLEDGE_EMPTY
    ? "Evelyn hasn't filled her playbook in yet. So there is nothing here about skin concerns, aftercare details, routines or how to use her products: every question of that kind goes to her with hand_to_evelyn. You can still answer from the FAQ, the policies and the shelf list."
    : KNOWLEDGE),
  HARD_LINES ? "# Her hard lines\n\n" + HARD_LINES : "",
  VOICE ? "# Her voice\n\n" + VOICE : "",
  "# Her shelf (every product the website sells)\n\n" + SHELF.map(shelfLine).join("\n"),
].filter(Boolean).join("\n\n");

const stockWord = (n: number | null) => n == null ? "ask Evelyn" : n <= 0 ? "out of stock, can be requested" : n <= 3 ? `only ${n} left` : "in stock";
const stockBlock = async (db: ReturnType<typeof admin>) => {
  // live counts from the products table when it exists; otherwise the catalog's
  const live = new Map<string, number | null>();
  try {
    const { data } = await db.from("products").select("id, stock");
    for (const row of data ?? []) live.set(row.id, row.stock);
  } catch { /* no products table yet: the bundle's counts stand */ }
  return "# Stock right now\n\n" + SHELF.map((p) => `- ${p.name}: ${stockWord(live.has(p.id) ? live.get(p.id)! : p.stock)}`).join("\n");
};

const HANDOFF_TOOL = {
  name: "hand_to_evelyn",
  description: "Send this question to Evelyn instead of answering it. Use it for anything personal or medical, anything about the client's own skin or which products suit them that her playbook doesn't answer, anything on her hard-lines list, anything not covered by what you know, and any request to talk to her. For an emergency use kind \"urgent\".",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["urgent", "reaction", "pregnancy", "medication", "condition", "skin", "request", "other"] },
      why: { type: "string", description: "One short line for Evelyn: what the client is asking for." },
    },
    required: ["kind", "why"],
    additionalProperties: false,
  },
} as const;

const DRAFT = [
  "Draft a reply from Evelyn, a licensed esthetician, to a client's question. Evelyn reads and edits every draft before it's sent; nothing goes out automatically.",
  "Write in her voice (her notes are below when she has written them): warm, short, first person. Don't diagnose. Ask for a photo in natural light when seeing the skin would help.",
  "For a reaction, name the signs that mean a doctor: spreading, worsening, swelling around the eyes or lips. For pregnancy or medications, suggest checking with their doctor too.",
  "Use only the facts below. Recommend only products from her shelf, and only if her playbook supports it.",
  "", "# Facts", FACTS, "", KNOWLEDGE_EMPTY ? "" : "# Her playbook\n" + KNOWLEDGE, HARD_LINES ? "# Her hard lines\n" + HARD_LINES : "", VOICE ? "# Her voice\n" + VOICE : "",
  "# Her shelf", SHELF.map(shelfLine).join("\n"),
].filter((s) => s !== "").join("\n");

const textOf = (msg: { content: { type: string; text?: string }[] }) =>
  msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();

/* consecutive turns of one role are joined, so the history always alternates */
type Turn = { role: "user" | "assistant"; content: string };
const tidy = (history: unknown): Turn[] => {
  const out: Turn[] = [];
  for (const h of Array.isArray(history) ? history.slice(-8) : []) {
    const role = h?.role === "assistant" ? "assistant" : "user";
    const content = String(h?.content ?? "").trim().slice(0, 1200);
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += "\n" + content; else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
};

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const q = String(body.message ?? "").trim().slice(0, 600);
  if (!q) return json({ error: "Empty question" }, 400);

  // who's asking: a signed-in client, and whether they're a member
  const db = admin();
  let client: { id: string; name: string; email: string } | null = null;
  let member = false;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt);
    if (data.user) {
      const { data: c } = await db.from("clients").select("id, name, email").eq("id", data.user.id).single();
      client = c;
      const { count } = await db.from("memberships").select("id", { count: "exact", head: true })
        .eq("client_id", data.user.id).neq("status", "cancelled");
      member = (count ?? 0) > 0;
    }
  }

  // 1) the rules, before any AI; or a hand-off the website already decided on
  let kind: string | null = KIND_SET.has(String(body.handoff)) ? String(body.handoff) : ruleKind(q.toLowerCase());
  let why = "";

  try {
    // 2) an everyday question: Claude, from the bundle, with a way to hand off
    if (!kind) {
      const reply = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 1024,                              // answers are a few sentences by design
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",                          // a safety decline re-runs on a fallback model
        output_config: { effort: "low" },              // a chat route: quick, short answers
        system: [
          { type: "text", text: STABLE, cache_control: { type: "ephemeral", ttl: "1h" } },
          { type: "text", text: await stockBlock(db) },
        ],
        tools: [HANDOFF_TOOL],
        tool_choice: { type: "auto" },
        messages: [...tidy(body.history), { role: "user", content: q }],
      });
      console.log(JSON.stringify({ built: BUILT_AT, stop: reply.stop_reason, cached: reply.usage.cache_read_input_tokens, wrote: reply.usage.cache_creation_input_tokens, out: reply.usage.output_tokens }));

      if (reply.stop_reason === "refusal") kind = "other";
      const call = reply.content.find((b) => b.type === "tool_use");
      if (call && call.type === "tool_use") {
        const input = call.input as { kind?: string; why?: string };
        kind = KIND_SET.has(String(input.kind)) ? String(input.kind) : "other";
        why = String(input.why ?? "");
      } else if (!kind) {
        const answer = textOf(reply);
        if (answer) return json({ answer });
        kind = "other";                                // nothing usable came back: Evelyn answers
      }
    }

    // 3) hand-off: save it for Evelyn with a drafted reply, once we know who's asking
    const who = client ?? { id: null, name: String(body.name ?? "").trim(), email: String(body.email ?? "").trim() };
    if (!who.name || !who.email) return json({ handoff: kind, needs_contact: true, urgent: kind === "urgent" });
    const draftMsg = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 600,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: DRAFT, cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [{ role: "user", content: `Client: ${who.name}\nKind: ${kind}${why ? `\nWhat they need: ${why}` : ""}\nQuestion: ${q}` }],
    });
    const draft = draftMsg.stop_reason === "refusal" ? "" : textOf(draftMsg);
    const due_at = new Date(Date.now() + (member ? MEMBER_HOURS : GUEST_HOURS) * 36e5).toISOString();
    await db.from("questions").insert({
      client_id: who.id, name: who.name, email: who.email, member, kind, text: q, draft, due_at,
    });
    return json({ handoff: kind, due_at, urgent: kind === "urgent" });
  } catch (err) {
    // the website falls back to its keyword answers on any 5xx
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "assistant_not_configured" }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "assistant_busy" }, 503);
    if (err instanceof Anthropic.APIConnectionError) return json({ error: "assistant_unreachable" }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: "assistant_error", status: err.status }, 502);
    throw err;
  }
});
