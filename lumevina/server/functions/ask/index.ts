// Lumevina — Supabase Edge Function: ask
//
// The live Ask Lumevina. A client's question comes in; Claude answers it from
// Evelyn's own playbook, the FAQ and policies, and her shelf (all packed into
// ../_shared/knowledge.ts by knowledge/scripts/build-bundle.mjs), in her
// voice, ending with a next step. Anything personal or medical, anything her
// playbook doesn't cover, and anything on her hard-lines list goes to her:
// once the client taps Send to Evelyn, it's saved to `questions` with a
// drafted reply she checks and sends from the dashboard (Client questions).
//
// It can also look things up (../_shared/lookups.ts): where a shop order is
// (a signed-in client's own, or anyone's with the order number and email
// from the receipt), and what's left on a gift certificate. And when it names
// products from her shelf that the client can buy now, Add to bag buttons go
// under the answer (show_products).
//
// A signed-in client also brings their file (../_shared/plans.ts): the skin
// plan Evelyn wrote for them, a few answers from their pre-visit form, their
// visits, and questions she has already answered. With a plan on file, "my
// routine" questions are answered from it instead of waiting for her; changing
// the plan, or anything about a reaction, still goes to her.
//
// Photos: a client can add up to three to a question for Evelyn (the website
// shrinks them to JPEGs). They're stored privately (../_shared/photos.ts) and
// the draft writer sees them, to make the draft specific and to ask for a
// clearer one when needed, and writes Evelyn a plain line on what they show.
// It never names a condition from a photo: that's hers to judge.
//
// Safety doesn't depend on the model. The same hand-off rules as the website
// (js/ask-rules.js, copied into the bundle) run before any AI call, so
// reactions, pregnancy, medications, named conditions, "my skin" questions and
// emergencies always go to Evelyn. The model can also hand off on its own with
// the hand_to_evelyn tool. A safety refusal from the model is treated as a
// hand-off too. The website keeps its keyword answers for when this function
// isn't reachable.
//
// Requests, with the client's Supabase session when signed in (Authorization:
// Bearer <their access token>; the anon key otherwise):
//   POST { message, history?: [{role, content}], name?, email? }
//     → { answer, products?: [shelf ids], links?: [{label, url}] }
//     or { handoff: kind, why?, urgent? }   (nothing is saved yet: the website asks first)
//     or, when Claude can't be reached, a 5xx { error } that tells the website
//     to fall back to its keyword answers.
//   POST { handoff: kind, message, id?, why?, name?, email?, photos?: ["data:image/jpeg;base64,…"] }
//     the client tapped Send to Evelyn: saves it with a draft and tells her.
//     → { handoff, id, due_at, urgent?, photos } or { handoff, needs_contact: true }
//     `id` (a uuid the website makes) makes a retry safe: the same id saves once.
//
// Deploy:  supabase functions deploy ask
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
// Cost: the stable part of the prompt (instructions, FAQ, playbook, shelf, the
// tools) is cached for an hour, so each question pays mostly for its own few
// hundred tokens. A look-up adds one more short round. Check
// usage.cache_read_input_tokens in the logs.

import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  BUILT_AT, PROMPT, FACTS, FACTS_V3, KNOWLEDGE, KNOWLEDGE_EMPTY, HARD_LINES, VOICE, SHELF, RULES, type Rule,
} from "../_shared/knowledge.ts";
import { clientFile } from "../_shared/plans.ts";
import { notifyOwner } from "../_shared/notify.ts";
import { EMAIL, giftBalance, lookUpOrder } from "../_shared/lookups.ts";
import { readPhotos, savePhotos, type Photo } from "../_shared/photos.ts";

const MODEL = "claude-opus-5-5";
const MEMBER_HOURS = 24;
const GUEST_HOURS = 48;
const KIND_SET = new Set(["urgent", "reaction", "pregnancy", "medication", "condition", "skin", "request", "other"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUNDS = 4;                                 // an answer, plus up to three rounds of looking things up

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
// v2 or v3 facts (booking on GlossGenius or here, membership and points): the
// website says which it runs (js/site-config.js, ?preview=v3 included), else
// the SITE_VERSION secret. Each is cached on its own.
type Site = "v2" | "v3";
const siteOf = (v: unknown): Site => v === "v3" || v === "v2" ? v : Deno.env.get("SITE_VERSION") === "v3" ? "v3" : "v2";
const factsFor = (site: Site) => site === "v3" ? FACTS_V3 : FACTS;
const stableFor = (site: Site) => [
  PROMPT,
  "# About the studio, FAQ and policies\n\n" + factsFor(site),
  "# Evelyn's Skin Playbook\n\n" + (KNOWLEDGE_EMPTY
    ? "Evelyn hasn't filled her playbook in yet. So there is nothing here about skin concerns, aftercare details, routines or how to use her products: every question of that kind goes to her with hand_to_evelyn. You can still answer from the FAQ, the policies and the shelf list."
    : KNOWLEDGE),
  HARD_LINES ? "# Her hard lines\n\n" + HARD_LINES : "",
  VOICE ? "# Her voice\n\n" + VOICE : "",
  "# Her shelf (every product the website sells)\n\n" + SHELF.map((p) => shelfLine(p) + ` [id: ${p.id}]`).join("\n"),
  [
    "# Looking things up",
    "- Where an order is (did it ship, tracking, is it ready for pickup): use look_up_order, then tell them in a sentence or two. A tracking link appears under your answer by itself, so don't write the link out. If it can't be found, ask them to check the number and the email, or offer to send it to Evelyn.",
    "- What's left on a gift certificate: use gift_balance with the code they typed. Refer to it by its last four characters.",
    "- When you name shelf products the client can buy right now (they asked about one, want to reorder, or want to buy what's in their own plan), call show_products with their ids in the same turn as your answer, so Add to bag buttons appear under it. Only products in stock or with a few left. Don't offer products nobody asked about.",
    "- A refund, a return, a missing or damaged package, a wrong item or a new shipping address: hand it to Evelyn (kind \"request\").",
  ].join("\n"),
].filter(Boolean).join("\n\n");
const STABLE: Record<Site, string> = { v2: stableFor("v2"), v3: stableFor("v3") };

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

// the signed-in client's file: after the cached part, never cached, never shown to anyone else
const fileBlock = (name: string, file: { hasPlan: boolean; text: string }) => [
  `# The client you're talking to`,
  `${name || "This client"} is signed in. Their file, from Evelyn's records:`,
  file.text,
  `How to use this file:`,
  file.hasPlan
    ? `- Answer questions about their own routine from Evelyn's plan: which product, when, in what order, how much, how often, what to avoid, what comes next. Say it's from the plan Evelyn wrote for them, and use their first name now and then.`
    : `- Evelyn hasn't written a plan for them yet, so questions about their own routine go to her with hand_to_evelyn (kind "skin").`,
  `- Never change or add to the plan. Adding, stopping or swapping a product, moving up a strength, a new concern, or anything about how their skin is reacting goes to Evelyn with hand_to_evelyn.`,
  `- If anything under "Cautions on file" bears on the question, hand it to Evelyn.`,
  `- The file is theirs, so you may tell them what's in it. Keep answers as short as always.`,
].join("\n\n");

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

const ORDER_TOOL = {
  name: "look_up_order",
  description: "Look up a shop order: paid, being packed, shipped (with tracking), or waiting for pickup. A signed-in client's own orders need no details: pass \"\" for both. Anyone else needs the order number from their receipt email (it starts with LUM-) and the email they ordered with; ask for whichever is missing before calling. Never guess either.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      order_number: { type: "string", description: "As the client typed it, or \"\"." },
      email: { type: "string", description: "The email the order was placed with, or \"\"." },
    },
    required: ["order_number", "email"],
    additionalProperties: false,
  },
} as const;

const GIFT_TOOL = {
  name: "gift_balance",
  description: "What's left on a Lumevina gift certificate. Needs the full code the client typed (LUM-XXXX-XXXX); never guess or complete one.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { code: { type: "string" } },
    required: ["code"],
    additionalProperties: false,
  },
} as const;

const SHOW_TOOL = {
  name: "show_products",
  description: "Put Add to bag buttons under your answer for shelf products you name in it. Use the ids from her shelf list.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { ids: { type: "array", items: { type: "string", enum: SHELF.map((p) => p.id) } } },
    required: ["ids"],
    additionalProperties: false,
  },
} as const;

const TOOLS = [HANDOFF_TOOL, ORDER_TOOL, GIFT_TOOL, SHOW_TOOL];

const draftFor = (site: Site) => [
  "Draft a reply from Evelyn, a licensed esthetician, to a client's question. Evelyn reads and edits every draft before it's sent; nothing goes out automatically.",
  "Write in her voice (her notes are below when she has written them): warm, short, first person. Don't diagnose. Ask for a photo in natural light when seeing the skin would help.",
  "For a reaction, name the signs that mean a doctor: spreading, worsening, swelling around the eyes or lips. For pregnancy or medications, suggest checking with their doctor too.",
  "Use only the facts below. Recommend only products from her shelf, and only if her playbook supports it.",
  "",
  "When the client sent photos, they're attached. Look at them only to make the draft specific to what they asked about, and to judge whether they're clear enough. Never name, guess or rule out a condition from a photo, and never call it normal or fine: Evelyn decides that. If a photo is blurry, dark, filtered, too far away or doesn't show the area, the draft asks for another, close up in daylight. With a clear photo, the draft doesn't ask for one again.",
  "",
  "Reply with JSON: \"draft\" is the message to the client. \"photo_note\" is one or two plain lines for Evelyn on what the photos show (which area; colour, size, spread, texture; whether they're clear enough to judge), describing, never diagnosing; \"\" when there are no photos.",
  "", "# Facts", factsFor(site), "", KNOWLEDGE_EMPTY ? "" : "# Her playbook\n" + KNOWLEDGE, HARD_LINES ? "# Her hard lines\n" + HARD_LINES : "", VOICE ? "# Her voice\n" + VOICE : "",
  "# Her shelf", SHELF.map(shelfLine).join("\n"),
].filter((s) => s !== "").join("\n");
const DRAFT: Record<Site, string> = { v2: draftFor("v2"), v3: draftFor("v3") };

const DRAFT_FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: { draft: { type: "string" }, photo_note: { type: "string" } },
    required: ["draft", "photo_note"],
    additionalProperties: false,
  },
};

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

// what a look-up tells the model (and any tracking links for the website)
type Call = { id: string; name: string; input: unknown };
const runLookup = async (db: ReturnType<typeof admin>, signedIn: string | null, c: Call, links: { label: string; url: string }[]) => {
  try {
    if (c.name === "look_up_order") {
      const r = await lookUpOrder(db, signedIn, c.input as { order_number?: string; email?: string });
      links.push(...(r.links ?? []));
      return JSON.stringify({ found: r.found, need: r.need, orders: r.orders });
    }
    if (c.name === "gift_balance") return JSON.stringify(await giftBalance(db, (c.input as { code?: string }).code));
    if (c.name === "show_products") return "Shown under your answer.";
  } catch (e) {
    console.error(c.name, e);
    return "The look-up didn't work just now. Say so, and offer to send the question to Evelyn.";
  }
  return "Unknown tool.";
};

// the draft Evelyn checks, and a plain line on what any photos show; never fails the save
const writeDraft = async (site: Site, who: { name: string }, kind: string, why: string, q: string, fileText: string | null, photos: Photo[]) => {
  try {
    const msg = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 900,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: DRAFT_FORMAT },
      system: [{ type: "text", text: DRAFT[site], cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [{
        role: "user",
        content: [
          ...photos.map((ph) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: ph.base64 } })),
          { type: "text" as const, text: `Client: ${who.name}\nKind: ${kind}${why ? `\nWhat they need: ${why}` : ""}\nQuestion: ${q}` +
            (photos.length ? `\nPhotos attached: ${photos.length}` : "\nNo photos.") +
            (fileText ? `\n\nTheir file (use it to make the draft specific to them; don't change their plan in the draft unless Evelyn would):\n${fileText}` : "") },
        ],
      }],
    });
    if (msg.stop_reason === "refusal") return { draft: "", note: "" };
    const out = JSON.parse(textOf(msg));
    return { draft: String(out.draft ?? "").trim(), note: photos.length ? String(out.photo_note ?? "").trim() : "" };
  } catch (e) {
    console.error("draft", e);                     // she still gets the question, just without a draft
    return { draft: "", note: "" };
  }
};

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const q = String(body.message ?? "").trim().slice(0, 600);
  const site = siteOf(body.site);
  if (!q) return json({ error: "Empty question" }, 400);

  // who's asking: a signed-in client, whether they're a member, and their file
  const db = admin();
  let client: { id: string | null; name: string; email: string } | null = null;
  let member = false;
  let file: Awaited<ReturnType<typeof clientFile>> = null;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt);
    const user = data.user;
    if (user?.email) {
      const { data: c } = await db.from("clients").select("id, name, email").eq("id", user.id).maybeSingle();
      client = { id: c?.id ?? null, name: c?.name || String(user.user_metadata?.name ?? "") || String(body.name ?? "").trim(), email: user.email };
      const { count } = await db.from("memberships").select("id", { count: "exact", head: true })
        .eq("client_id", user.id).neq("status", "cancelled");
      member = (count ?? 0) > 0;
      file = await clientFile(db, user.email, c?.id ?? null).catch((e) => { console.error(e); return null; });
    }
  }

  // ── the client tapped Send to Evelyn: save it with a draft (and any photos), then tell her ──
  if (KIND_SET.has(String(body.handoff))) {
    const kind = String(body.handoff);
    const who = client ?? { id: null, name: String(body.name ?? "").trim().slice(0, 120), email: String(body.email ?? "").trim().slice(0, 200) };
    if (!who.name || !EMAIL.test(who.email)) return json({ handoff: kind, needs_contact: true, urgent: kind === "urgent" });
    const id = UUID.test(String(body.id)) ? String(body.id).toLowerCase() : crypto.randomUUID();
    const { data: had } = await db.from("questions").select("id, due_at, photos").eq("id", id).maybeSingle();
    if (had) return json({ handoff: kind, id, due_at: had.due_at, urgent: kind === "urgent", photos: had.photos.length });   // a retry

    const why = String(body.why ?? "").trim().slice(0, 200);
    const photos = readPhotos(body.photos);
    const paths = await savePhotos(db, id, photos);
    const { draft, note } = await writeDraft(site, who, kind, why, q, file?.text ?? null, photos);
    const due_at = new Date(Date.now() + (member ? MEMBER_HOURS : GUEST_HOURS) * 36e5).toISOString();
    const { error } = await db.from("questions").insert({
      id, client_id: who.id, name: who.name, email: who.email, member, kind, text: q, why: why || null,
      draft, photos: paths, photo_note: note || null, due_at,
    });
    if (error) { console.error("question", error); return json({ error: "not_saved" }, 500); }
    await notifyOwner(db, {
      kind: "question", email: true, url: "dashboard.html#client-questions",
      title: kind === "urgent" ? `Urgent: ${who.name} needs you` : `New question from ${who.name}`,
      body: q.slice(0, 200) + (paths.length ? `\n\n${paths.length === 1 ? "A photo is" : paths.length + " photos are"} attached.` : "") +
        (draft ? "\n\nA reply is drafted for you in the dashboard." : ""),
    }).catch((e) => console.error("notify", e));
    return json({ handoff: kind, id, due_at, urgent: kind === "urgent", photos: paths.length });
  }

  // 1) the rules, before any AI. A "my skin" question from a client with a
  //    plan on file goes to Claude with their plan; everything else the rules
  //    catch goes to Evelyn (the website asks the client first).
  let kind: string | null = ruleKind(q.toLowerCase());
  if (kind === "skin" && file?.hasPlan) kind = null;
  if (kind) return json({ handoff: kind, urgent: kind === "urgent" });

  // 2) an everyday question: Claude, from the bundle, with look-ups and a way to hand off
  try {
    const signedIn = client?.email ?? null;
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [...tidy(body.history), { role: "user", content: q }];
    const system = [
      { type: "text" as const, text: STABLE[site], cache_control: { type: "ephemeral" as const, ttl: "1h" as const } },
      ...(file && client ? [{ type: "text" as const, text: fileBlock(client.name, file) }] : []),
      { type: "text" as const, text: (signedIn ? `The client is signed in as ${signedIn}, so look_up_order finds their own orders without details.` : "The client isn't signed in.") +
        "\n\n" + await stockBlock(db) },
    ];
    const products: string[] = [];
    const links: { label: string; url: string }[] = [];
    let why = "";

    for (let round = 0; round < ROUNDS; round++) {
      const reply = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 1024,                              // answers are a few sentences by design
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",                          // a safety decline re-runs on a fallback model
        output_config: { effort: "low" },              // a chat route: quick, short answers
        system,
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages,
      });
      console.log(JSON.stringify({ built: BUILT_AT, round, file: file ? (file.hasPlan ? "plan" : "file") : "none", stop: reply.stop_reason, cached: reply.usage.cache_read_input_tokens, wrote: reply.usage.cache_creation_input_tokens, out: reply.usage.output_tokens }));

      if (reply.stop_reason === "refusal") { kind = "other"; break; }
      const calls = reply.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
      const hand = calls.find((c) => c.name === "hand_to_evelyn");
      if (hand) {
        const input = hand.input as { kind?: string; why?: string };
        kind = KIND_SET.has(String(input.kind)) ? String(input.kind) : "other";
        why = String(input.why ?? "");
        break;
      }
      for (const c of calls) {
        if (c.name !== "show_products") continue;
        for (const id of (c.input as { ids?: string[] }).ids ?? []) if (!products.includes(id)) products.push(id);
      }
      const answer = textOf(reply);
      // done: no look-ups pending (Add to bag buttons need no second round once the answer is written)
      if (reply.stop_reason !== "tool_use" || (answer && calls.every((c) => c.name === "show_products"))) {
        if (!answer) break;
        return json({ answer, ...(products.length ? { products: products.slice(0, 6) } : {}), ...(links.length ? { links } : {}) });
      }
      messages.push({ role: "assistant", content: reply.content });
      const results = [];
      for (const c of calls) results.push({ type: "tool_result" as const, tool_use_id: c.id, content: await runLookup(db, signedIn, c, links) });
      messages.push({ role: "user", content: results });
    }
    return json({ handoff: kind ?? "other", ...(why ? { why } : {}), urgent: kind === "urgent" });   // nothing usable came back: Evelyn answers
  } catch (err) {
    // the website falls back to its keyword answers on any 5xx
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "assistant_not_configured" }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "assistant_busy" }, 503);
    if (err instanceof Anthropic.APIConnectionError) return json({ error: "assistant_unreachable" }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: "assistant_error", status: err.status }, 502);
    throw err;
  }
});
