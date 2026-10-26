// Lumevina — skin plans and the client's file, shared by the client-plans and
// ask functions.
//
// A plan is what Evelyn writes for one client in her dashboard (Clients →
// Skin plan); js/skin-plans.js keeps the same shape in the browser:
//   { skinType, concerns[], goal, phase, morning[], night[], weekly[],
//     avoid, next, note, log[] }
//   morning / night / weekly: [{ id, name, how }]   id = a shelf product, or "" for one she names
//   log: [{ at: "YYYY-MM-DD", text }]               her visit notes, newest first
//
// clientFile() gathers what the assistant may know about a signed-in client:
// the plan, their skin profile and what they've told the chat before
// (profiles.ts), a few answers from their pre-visit form, their visits, and
// the questions Evelyn has already answered for them.

// deno-lint-ignore-file no-explicit-any
import { CATALOG } from "./catalog.ts";
import { SHELF } from "./knowledge.ts";
import { profileParts } from "./profiles.ts";
import { bought, boughtText } from "./bought.ts";

export const SKIN_TYPES = ["Dry", "Normal", "Combination", "Oily", "Sensitive", "Acne-prone"];

const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const steps = (v: unknown): { id: string; name: string; how: string }[] => (Array.isArray(v) ? v : []).slice(0, 12).map((x: any) => {
  const id = str(x?.id, 60);
  const shelf = SHELF.find((p) => p.id === id);
  return { id: shelf ? id : "", name: shelf ? shelf.name : str(x?.name, 80), how: str(x?.how, 300) };
}).filter((x) => x.name);

const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** A plan as stored: every field bounded, products checked against the shelf. */
export function cleanPlan(p: any) {
  const concerns: string[] = list(p?.concerns).slice(0, 8).map((c) => str(c, 60)).filter(Boolean);
  const log: { at: string; text: string }[] = list(p?.log).slice(0, 40).map((e) => ({
    at: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.at)) ? String(e.at) : new Date().toISOString().slice(0, 10),
    text: str(e?.text, 600),
  })).filter((e) => e.text);
  return {
    skinType: SKIN_TYPES.includes(p?.skinType) ? String(p.skinType) : "",
    concerns,
    goal: str(p?.goal, 400),
    phase: str(p?.phase, 600),
    morning: steps(p?.morning),
    night: steps(p?.night),
    weekly: steps(p?.weekly),
    avoid: str(p?.avoid, 600),
    next: str(p?.next, 400),
    note: str(p?.note, 800),
    log,
  };
}
export type Plan = ReturnType<typeof cleanPlan>;

const day = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const stepLines = (list: Plan["morning"]) => list.map((s, i) => `  ${i + 1}. ${s.name}${s.how ? `: ${s.how}` : ""}`).join("\n");

/** The plan as plain text, for the assistant and for drafts. */
export function planText(p: Plan, updated?: string) {
  const out = [`Evelyn's plan for them${updated ? ` (updated ${day(updated)})` : ""}:`];
  if (p.skinType) out.push(`- Skin type: ${p.skinType}`);
  if (p.concerns.length) out.push(`- Working on: ${p.concerns.join(", ")}`);
  if (p.goal) out.push(`- Their goal: ${p.goal}`);
  if (p.phase) out.push(`- Where they are now: ${p.phase}`);
  if (p.morning.length) out.push("- Morning:\n" + stepLines(p.morning));
  if (p.night.length) out.push("- Night:\n" + stepLines(p.night));
  if (p.weekly.length) out.push("- Once or twice a week:\n" + stepLines(p.weekly));
  if (p.avoid) out.push(`- Avoid for now: ${p.avoid}`);
  if (p.next) out.push(`- Next step: ${p.next}`);
  if (p.note) out.push(`- Her note to them: ${p.note}`);
  if (p.log.length) out.push("- Her visit notes, newest first:\n" + p.log.slice(0, 6).map((e) => `  ${day(e.at)}: ${e.text}`).join("\n"));
  return out.join("\n");
}

const answer = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")).trim();
const said = (v: unknown) => { const a = answer(v); return a && !/^(no|none|n\/a|-)$/i.test(a) ? a : ""; };

/**
 * What the assistant knows about this signed-in client, or null when there's
 * nothing on file. hasPlan says whether Evelyn has written their routine.
 */
export async function clientFile(db: any, email: string, clientId: string | null) {
  email = email.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const visits = (col: string, v: string): Promise<any[]> => db.from("bookings").select("id, date, services")
    .eq(col, v).in("status", ["pending", "held", "completed"]).order("date", { ascending: false }).limit(8)
    .then((r: any) => r.data ?? [], () => []);
  const [planRow, intake, asGuest, asClient, answered, mine, shelf] = await Promise.all([
    db.from("client_plans").select("plan, updated_at").eq("email", email).maybeSingle().then((r: any) => r.data, () => null),
    db.from("intake_forms").select("answers, signed_at").eq("email", email).maybeSingle().then((r: any) => r.data, () => null),
    visits("guest_email", email),
    clientId ? visits("client_id", clientId) : Promise.resolve([] as any[]),
    db.from("questions").select("text, reply, answered_at").eq("email", email).eq("status", "answered")
      .order("answered_at", { ascending: false }).limit(4).then((r: any) => r.data ?? [], () => []),
    profileParts(db, email).catch(() => ({ parts: [] as string[], hasProfile: false, supplements: false })),
    bought(db, email).catch(() => []),
  ]);
  const seen = new Set();
  const bookings = [...asGuest, ...asClient].filter((b: any) => !seen.has(b.id) && seen.add(b.id))
    .sort((x: any, y: any) => (x.date < y.date ? 1 : -1));

  const parts: string[] = [];
  const plan = planRow ? cleanPlan(planRow.plan) : null;
  if (plan) parts.push(planText(plan, planRow.updated_at));
  parts.push(...mine.parts);
  if (shelf.length) parts.push(boughtText(shelf));

  const a = intake?.answers ?? null;
  if (a) {
    const lines = [
      said(a.goals) && `goals: ${said(a.goals)}`,
      said(a.challenges) && `skin challenges: ${said(a.challenges)}`,
      said(a.current_products) && `products they use: ${said(a.current_products)}`,
      said(a.using) && `using now: ${said(a.using)}`,
      said(a.last_retinol) && `last retinol: ${said(a.last_retinol)}`,
      said(a.last_exfoliated) && `last exfoliated: ${said(a.last_exfoliated)}`,
    ].filter(Boolean);
    if (lines.length) parts.push(`From their pre-visit form (${day(intake.signed_at)}): ${lines.join("; ")}.`);
    const cautions = [
      answer(a.pregnant) === "Yes" && "pregnant, trying to conceive or nursing",
      answer(a.acne_meds) === "Yes" && "on acne medication",
      said(a.conditions) && `health conditions: ${said(a.conditions)}`,
      said(a.allergies) && `allergies: ${said(a.allergies)}`,
      said(a.medications) && `medications: ${said(a.medications)}`,
    ].filter(Boolean);
    if (cautions.length) parts.push(`Cautions on file: ${cautions.join("; ")}.`);
  }

  const name = (ids: unknown) => (Array.isArray(ids) ? ids : []).map((id) => CATALOG[String(id)]?.name ?? String(id)).join(" + ");
  const past = bookings.filter((b: any) => b.date < today).slice(0, 5);
  const next = bookings.filter((b: any) => b.date >= today).pop();
  if (past.length || next) {
    parts.push("Visits: " + [
      ...past.map((b: any) => `${day(b.date)}: ${name(b.services)}`),
      next ? `next booked: ${day(next.date)}, ${name(next.services)}` : "",
    ].filter(Boolean).join("; ") + ". (Visits booked on her GlossGenius page aren't listed here.)");
  }

  if (answered.length) {
    parts.push("Questions Evelyn has already answered for them, newest first:\n" + answered.map((q: any) =>
      `- ${day(q.answered_at)}. They asked: "${str(q.text, 300)}" She replied: "${str(q.reply, 600)}"`).join("\n"));
  }

  if (!parts.length) return null;
  return { hasPlan: !!plan, plan, hasProfile: mine.hasProfile, supplements: mine.supplements, hasProducts: shelf.length > 0, text: parts.join("\n\n") };
}
