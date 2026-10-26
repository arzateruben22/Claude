// Lumevina — what a signed-in client has bought from Evelyn's shelf, for their chat file.
//
// Paid orders, on the website or at the studio (orders.source), newest first: each
// product once, with when they last bought it, how many times, and, from Evelyn's
// rule of thumb for how long a bottle lasts (the shelf card's "lasts", via the
// bundle's lastsMonths), when it may be running low. Nothing here is advice: it tells
// the chat which product "my serum" means, so an answer about using it is about the
// one they own, and lets it mention a reorder once when a bottle is probably near
// the bottom.
//
//   bought(db, email)   → Bought[]
//   boughtText(list)    → the lines for the client's file ("" when they've bought nothing)

// deno-lint-ignore-file no-explicit-any
import { SHELF } from "./knowledge.ts";

export type Bought = {
  id: string; name: string;
  last: string;              // when they last bought it (ISO)
  times: number;             // orders it was in
  qty: number;               // bottles in all
  where: "web" | "studio";   // the last time
  lowAt: string | null;      // when the last bottle(s) may run low, from her rule of thumb; null when she hasn't said
  low: boolean;              // that date is within two weeks, or past
};

const day = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const SOON = 14 * 864e5;

export async function bought(db: any, email: string): Promise<Bought[]> {
  const { data } = await db.from("orders").select("items, source, paid_at, created_at")
    .eq("email", email.toLowerCase()).eq("status", "paid").order("paid_at", { ascending: false }).limit(40);
  const seen = new Map<string, Bought>();
  for (const o of data ?? []) {
    const at = String(o.paid_at ?? o.created_at ?? "");
    for (const it of (Array.isArray(o.items) ? o.items : []) as { id: string; name: string; qty: number; kind?: string }[]) {
      if (!it?.id || it.kind) continue;   // treatments, discounts and tips aren't products
      const qty = Math.max(1, Number(it.qty) || 1);
      const have = seen.get(it.id);
      if (have) { have.times++; have.qty += qty; continue; }
      const card = SHELF.find((p) => p.id === it.id);
      const months = card?.lastsMonths ?? null;
      const lowAt = months && at ? new Date(new Date(at).getTime() + months * qty * 30.4 * 864e5) : null;
      seen.set(it.id, {
        id: it.id, name: card?.name ?? String(it.name ?? it.id), last: at, times: 1, qty,
        where: o.source === "studio" ? "studio" : "web",
        lowAt: lowAt ? lowAt.toISOString() : null, low: !!lowAt && lowAt.getTime() <= Date.now() + SOON,
      });
    }
  }
  return [...seen.values()];
}

export function boughtText(list: Bought[]) {
  if (!list.length) return "";
  return "Their Lumevina products, bought here (newest first):\n" + list.map((b) =>
    `- ${b.name}: ${b.where === "studio" ? "at the studio" : "on the website"}, ${day(b.last)}` +
    (b.times > 1 ? `, ${b.times} times so far` : "") + (b.qty > b.times ? ` (${b.qty} in all)` : "") +
    (b.lowAt ? b.low ? "; probably running low by now" : `; may run low around ${day(b.lowAt)}` : "")).join("\n");
}
