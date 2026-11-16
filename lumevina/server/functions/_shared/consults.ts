// Lumevina — consults: the gate on the actives, and the online consult
//
// Two kinds of row in `consults`:
//   gate    a client tapped "Needs a quick consult" on an active (benzoyl
//           peroxide, the stronger mandelic serums, retinoids, Hydroxi) and
//           told Evelyn about their skin. She approves (the product unlocks
//           for that email at checkout) or declines, with a line of reply.
//   online  a paid Personalized Skin Consultation (the shop's svc-online-consult,
//           $75, online or in person). Evelyn sets the time, does it, and marks
//           it done: every active unlocks for that email. Since Nov 16 no
//           certificate goes back: the $75 is the price.
//
// Approval is by email: create-checkout matches the buyer's email against
// approved rows, so a client who asked from the shop and buys with the same
// address is let through, signed in or not.

// deno-lint-ignore-file no-explicit-any
import { esc, page, sendEmail } from "./mail.ts";
import { notifyOwner } from "./notify.ts";

export const CONSULT_PRODUCT = "svc-online-consult";
export const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const isConsultItem = (id: unknown) => String(id ?? "") === CONSULT_PRODUCT;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const site = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const first = (name: unknown) => String(name ?? "").trim().split(" ")[0];

export type Approval = { all: boolean; ids: Set<string> };

/** What this email may buy without asking: every active (a done consult, or an open approval) or a list of product ids. */
export async function approvedFor(db: any, email: string): Promise<Approval> {
  const { data } = await db.from("consults").select("status, products").eq("email", norm(email)).in("status", ["approved", "done"]);
  const out: Approval = { all: false, ids: new Set() };
  for (const r of data ?? []) {
    const ids: string[] = Array.isArray(r.products) ? r.products : [];
    if (r.status === "done" || !ids.length) out.all = true;
    for (const id of ids) out.ids.add(id);
  }
  return out;
}
export const mayBuy = (a: Approval, id: string) => a.all || a.ids.has(id);

/** A client asks for an active. One waiting row per email: a second ask adds to it. */
export async function requestConsult(db: any, body: any, names: Map<string, string>) {
  const email = norm(body.email), name = clip(body.name, 120), note = clip(body.note, 2000);
  const products = [...new Set((Array.isArray(body.products) ? body.products : []).map((p: unknown) => clip(p, 80)).filter(Boolean))].slice(0, 12) as string[];
  const answers = body.answers && typeof body.answers === "object" ? body.answers : null;
  const { data: open } = await db.from("consults").select("id, products, note").eq("email", email).eq("kind", "gate").eq("status", "waiting").maybeSingle();
  let id: string;
  if (open) {
    const merged = [...new Set([...(open.products ?? []), ...products])];
    await db.from("consults").update({ products: merged, note: [open.note, note].filter(Boolean).join("\n\n"), name: name || undefined, answers: answers ?? undefined, updated_at: new Date().toISOString() }).eq("id", open.id);
    id = open.id;
  } else {
    const { data, error } = await db.from("consults").insert({ kind: "gate", status: "waiting", email, name: name || null, products, note: note || null, answers }).select("id").single();
    if (error || !data) throw error ?? new Error("insert");
    id = data.id;
  }
  const what = products.map((p) => names.get(p) ?? p).join(", ");
  await sendEmail(email, "Evelyn will look at this with you", page(name ? `Hi ${esc(first(name))},` : "Hi,",
    `<p style="font-size:15px;line-height:1.55">Got it. ${what ? `You asked about <strong>${esc(what)}</strong>. ` : ""}Evelyn reads what you wrote and replies within a day, usually sooner. If it's right for your skin she unlocks it for this email address, and you'll get a link straight to it.</p>` +
    `<p style="font-size:13px;color:#7D5A44">Reply to this email if you want to add anything, like a photo in daylight.</p>`), Deno.env.get("OWNER_EMAIL") ?? undefined);
  await notifyOwner(db, { kind: "consult", title: `${name || email} wants ${what || "an active"}`,
    body: `${note ? note.slice(0, 180) + (note.length > 180 ? "…" : "") : "No note."} Approve or decline in Consults.`, url: "dashboard.html#consults" });
  return { id, products };
}

/** Evelyn's decision on a gate request: approved (the products, or every active) or declined, with her line. */
export async function decideConsult(db: any, body: any, names: Map<string, string>) {
  const status = body.status === "declined" ? "declined" : "approved";
  const reply = clip(body.reply, 2000);
  const products = Array.isArray(body.products) ? body.products.map((p: unknown) => clip(p, 80)).filter(Boolean) : null;
  const patch: any = { status, reply: reply || null, decided_at: new Date().toISOString() };
  if (products) patch.products = products;   // she may approve fewer, or more, than they asked for; [] = every active
  const { data: c } = await db.from("consults").update(patch).eq("id", String(body.id ?? "")).eq("kind", "gate").eq("status", "waiting").select("*").maybeSingle();
  if (!c) return null;
  const list: string[] = c.products ?? [];
  const what = list.map((p) => names.get(p) ?? p);
  const shop = site() ? `${site()}/` : "";
  const who = encodeURIComponent(c.email);
  const links = list.map((p) => shop ? `<li><a href="${esc(shop)}?product=${esc(p)}&consult=${esc(who)}#shop" style="color:#161412">${esc(names.get(p) ?? p)}</a></li>` : `<li>${esc(names.get(p) ?? p)}</li>`).join("");
  const body2 = status === "approved"
    ? `<p style="font-size:15px;line-height:1.55">Evelyn looked at what you wrote${what.length ? ` and unlocked <strong>${esc(what.join(", "))}</strong>` : " and unlocked the actives"} for you. Use this email address at checkout and it goes straight through.</p>` +
      (links ? `<ul style="font-size:15px;line-height:1.7">${links}</ul>` : "") +
      (reply ? `<p style="font-size:15px;line-height:1.55;white-space:pre-line">${esc(reply)}</p>` : "")
    : `<p style="font-size:15px;line-height:1.55">Evelyn read what you wrote and doesn't want you on ${what.length ? `<strong>${esc(what.join(", "))}</strong>` : "that one"} yet.</p>` +
      (reply ? `<p style="font-size:15px;line-height:1.55;white-space:pre-line">${esc(reply)}</p>` : "") +
      `<p style="font-size:13px;color:#7D5A44">Reply to this email to talk it through, or book a Personalized Skin Consultation on the website.</p>`;
  const emailed = await sendEmail(c.email, status === "approved" ? "Evelyn unlocked it for you" : "A note from Evelyn", page(c.name ? `Hi ${esc(first(c.name))},` : "Hi,", body2), Deno.env.get("OWNER_EMAIL") ?? undefined);
  return { consult: c, emailed };
}

/** A paid online consult, from the order: the row, the client's email, and Evelyn's phone. */
export async function consultPaid(db: any, order: any, name: string) {
  const email = norm(order.email);
  const { data: c, error } = await db.from("consults").insert({ kind: "online", status: "paid", email, name: name || order.name || null, order_id: order.id }).select("id").single();
  if (error) { console.error("consult paid", error); return null; }
  const my = site() ? `${site()}/#account` : "";
  await sendEmail(email, "Your Skin Consultation with Evelyn", page(name ? `Hi ${esc(first(name))},` : "Hi,",
    `<p style="font-size:15px;line-height:1.55">Thank you. Here's how it goes:</p>` +
    `<ol style="font-size:15px;line-height:1.7">` +
    `<li>Evelyn messages you within two business days to set a time that suits you: by video, or at the studio in Woodland Hills.</li>` +
    `<li>Before you meet, fill in your skin profile${my ? ` in <a href="${esc(my)}" style="color:#161412">My Lumevina</a>` : " on the website"}: your skin type, what's going on, what you use now. A photo in daylight, no filter, helps a lot.</li>` +
    `<li>Afterwards you get her guidance on products and next steps in writing, and the actives you need are unlocked.</li></ol>`), Deno.env.get("OWNER_EMAIL") ?? undefined);
  await notifyOwner(db, { kind: "consult", title: `Skin consultation booked: ${name || email}`, body: "Paid on the website. Message them within two business days to set the time, online or at the studio.", url: "dashboard.html#consults", email: true });
  return c;
}

/** Evelyn marks a consultation done: every active unlocks for that email (no certificate: the $75 is the price). */
export async function consultDone(db: any, id: string) {
  const { data: c } = await db.from("consults").update({ status: "done", decided_at: new Date().toISOString(), products: [] }).eq("id", id).eq("kind", "online").eq("status", "paid").select("*").maybeSingle();
  if (!c) return null;
  const code: string | null = null;   // kept in the reply for the dashboard; no certificate since Nov 16
  const shop = site() ? `${site()}/?consult=${encodeURIComponent(c.email)}#shop` : "";
  await sendEmail(c.email, "Your routine, from Evelyn", page(c.name ? `Hi ${esc(first(c.name))},` : "Hi,",
    `<p style="font-size:15px;line-height:1.55">Thank you for your consultation. The actives Evelyn recommended are unlocked for this email address${shop ? ` in <a href="${esc(shop)}" style="color:#161412">the shop</a>` : ""}.</p>` +
    `<p style="font-size:13px;color:#7D5A44">Reply to this email any time with a question about your routine.</p>`), Deno.env.get("OWNER_EMAIL") ?? undefined);
  return { consult: c, code };
}
