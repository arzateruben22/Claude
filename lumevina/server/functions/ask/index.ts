// Lumevina — Supabase Edge Function: ask
//
// The live version of Ask Lumevina (js/ask.js). Everyday questions get an
// instant answer from Claude, grounded only in Lumevina's own facts below.
// Anything personal goes to Evelyn: it's saved to `questions` with a drafted
// reply she checks and sends from the dashboard (Client questions).
//
// Safety comes first and doesn't depend on the model: the same keyword rules
// as the website run before any AI call, so reactions, pregnancy,
// medications, skin conditions and "what should I use on my skin" always go
// to Evelyn, and anything that sounds like an emergency is told to call 911.
// The model can also hand off on its own (the hand_to_evelyn tool) when a
// question isn't covered by the facts. It never diagnoses, and never answers
// for Evelyn on a personal question.
//
// Request:  POST { message, history?: [{role, content}], name?, email? }
//           with the client's Supabase session, if signed in (members are
//           looked up from it and promised a reply within 24 hours).
// Response: { answer } or { handoff: kind, due_at, urgent? }
//
// Deploy:  supabase functions deploy ask
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@2";
import { CATALOG } from "../_shared/catalog.ts";

const MODEL = "claude-haiku-4-5-20251001";     // fast and inexpensive for FAQ-sized answers
const MEMBER_HOURS = 24;
const GUEST_HOURS = 48;

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// ── the same hand-off rules as js/ask.js ──
const URGENT = /(can'?t|cannot|hard to|trouble|struggling to) breathe|throat (is )?(closing|swelling|tight)|swell.*(lips?|tongue|throat)|(lips?|tongue|throat).*swell|anaphyla|faint|pass(ed|ing) out/i;
const KINDS: [string, RegExp][] = [
  ["reaction", /react|rash|burn|swell|swollen|itch|hives|allerg|blister|bleed|infect|\bpus\b|ooz|scab|stinging|irritat|peeling/i],
  ["pregnancy", /pregnan|expecting|breastfeed|nursing|trying to conceive/i],
  ["medication", /accutane|isotretinoin|tretinoin|retin-?a|prescri|medicat|antibiotic|spironolactone|birth control|chemo|radiation|laser|surgery/i],
  ["condition", /eczema|psoriasis|rosacea|dermatitis|lupus|cold sore|herpes|melasma|mole|lump|cyst|fungal|perioral/i],
  ["skin", /\bmy (skin|face|acne|breakouts?|pores|spots|scars?|pigment|wrinkles|texture)\b|for my skin|purging|(breaking|broke|break) ?out after/i],
];
const ruleKind = (t: string) => URGENT.test(t) ? "urgent" : (KINDS.find(([, re]) => re.test(t))?.[0] ?? null);

// ── what the assistant may say: Lumevina's facts, nothing else ──
const menu = Object.values(CATALOG)
  .filter((s) => s.price_cents > 0)
  .map((s) => `- ${s.name}: $${s.price_cents / 100}`).join("\n");
const FACTS = `Lumevina Aesthetics Spa, Woodland Hills, CA. Owner and esthetician: Evelyn.
Hours: Tuesday to Saturday, 8 AM to 6 PM. Closed Sundays and Mondays, except extra Mondays every other week, members first.
Location: exact address in the confirmation email. Free parking lot. On arrival, wait in the car and text before coming up.
Booking: online, any time. Every booking takes a non-refundable deposit that goes toward the total.
Cancelling: at least 48 hours ahead with the link in the confirmation email; the deposit moves to a new date in the same month. Same-day changes keep the deposit and add a $43 fee. Saturdays can't be moved or cancelled. No-shows are charged 50%. 10-minute grace period for late arrivals.
Payment: cash preferred; cards accepted with a fee. Services are non-refundable; reach out within 24 hours if anything comes up after a visit.
Before a facial: stop retinol or prescription retinoids 5-7 days before; pause exfoliating acids 2-3 days before; no facial waxing or shaving for 2 days; wait 2 weeks after Botox or fillers (or book the facial the same day before injections); wait 2 weeks after permanent makeup; don't book on the day of a big event. Accutane, recent laser, cosmetic surgery, radiation or chemo: wait 6-12 months or bring physician clearance.
After a facial: no makeup the rest of the day; no workouts or heavy sweating for 24 hours (a week after a body peel); no facial waxing or shaving for 2 days.
Memberships: Glow $159/month (one Custom Facial, Custom + Dermaplaning, or Monthly Acne Treatment a month) and Ageless $209/month (everything in Glow plus the Ageless Grace Facial, a finishing add-on every other visit, 15% off the shelf). Bank up to 2 facials, pause one month a year, cancel online after 3 months, 10% off the shelf, 15% off add-ons, and members can ask Evelyn anything with a reply within 24 hours.
Gift certificates never expire and work for any treatment.
Glow Routine: Evelyn's product picks sent monthly, from $75.
Menu:
${menu}`;

const SYSTEM = `You are Ask Lumevina, the assistant for Evelyn's spa. Answer in a warm, short, personal voice (1-3 sentences), using ONLY the facts below.
If a question is about the client's own skin, a reaction, a condition, pregnancy, medication, which product suits them, or anything the facts don't cover, do not answer it: call hand_to_evelyn.
Never diagnose, never guess a price or a policy, never promise results.

${FACTS}`;

const DRAFT_SYSTEM = `Draft a reply from Evelyn, a licensed esthetician, to a client's question. Evelyn will read and edit it before sending; it is never sent automatically.
Warm, short, first person, signed "— Evelyn". Don't diagnose. Ask for a photo in natural light when seeing the skin would help.
For reactions, name the red flags (spreading, worsening, swelling around eyes or lips) and say to see a doctor if they appear. For pregnancy or medications, suggest checking with their doctor.
Use only these facts about the spa:
${FACTS}`;

async function claude(body: Record<string, unknown>) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, ...body }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  return await res.json();
}

const text = (msg: { content: { type: string; text?: string }[] }) =>
  msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const { message, history = [], name, email } = await req.json();
  const q = String(message ?? "").trim().slice(0, 600);
  if (!q) return json({ error: "Empty question" }, 400);

  // who's asking: a signed-in client, and whether they're a member
  const db = admin();
  let client: { id: string; name: string; email: string } | null = null;
  let member = false;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt) {
    const { data } = await db.auth.getUser(jwt);
    if (data.user) {
      const { data: c } = await db.from("clients").select("id, name, email").eq("id", data.user.id).single();
      client = c;
      const { count } = await db.from("memberships").select("id", { count: "exact", head: true })
        .eq("client_id", data.user.id).neq("status", "cancelled");
      member = (count ?? 0) > 0;
    }
  }

  // 1) the rules, before any AI
  let kind = ruleKind(q);

  // 2) everyday questions: Claude, with a way to hand off
  if (!kind) {
    const reply = await claude({
      system: SYSTEM,
      messages: [...history.slice(-8), { role: "user", content: q }],
      tools: [{
        name: "hand_to_evelyn",
        description: "Send the question to Evelyn when it's personal, medical, about the client's own skin or products for it, or not covered by the facts.",
        input_schema: { type: "object", properties: {
          kind: { type: "string", enum: ["reaction", "pregnancy", "medication", "condition", "skin", "request", "other"] } },
          required: ["kind"] },
      }],
    });
    const call = reply.content.find((b: { type: string }) => b.type === "tool_use");
    if (!call) return json({ answer: text(reply) });
    kind = call.input.kind ?? "other";
  }

  // 3) hand-off: save it with a drafted reply for Evelyn
  const who = client ?? { id: null, name: String(name ?? "").trim(), email: String(email ?? "").trim() };
  if (!who.name || !who.email) return json({ handoff: kind, needs_contact: true, urgent: kind === "urgent" });
  const draftMsg = await claude({ system: DRAFT_SYSTEM, messages: [{ role: "user", content: `Client: ${who.name}\nQuestion: ${q}` }] });
  const due_at = new Date(Date.now() + (member ? MEMBER_HOURS : GUEST_HOURS) * 36e5).toISOString();
  await db.from("questions").insert({
    client_id: who.id, name: who.name, email: who.email, member, kind, text: q, draft: text(draftMsg), due_at,
  });
  return json({ handoff: kind, due_at, urgent: kind === "urgent" });
});
