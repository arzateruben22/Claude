// Lumevina — Supabase Edge Function: studio-digest
//
// Evelyn's morning email (and a notification on her phone): orders from the
// last day, what's waiting to ship, client questions waiting for her, and
// what's running low. It also sends gift certificates dated for today.
// Nothing to report: nothing is sent.
//
// Run it every morning with Supabase cron (server/README.md → Lumevina Studio):
//   POST with the header x-studio-key: <STUDIO_KEY>
// Deploy:  supabase functions deploy studio-digest --no-verify-jwt
// Secrets: STUDIO_KEY, OWNER_EMAIL, RESEND_API_KEY, FROM_EMAIL, SITE_URL

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { esc, money, page, sendEmail } from "../_shared/mail.ts";
import { pushAll } from "../_shared/notify.ts";
import { emailGift } from "../_shared/orders.ts";
import { studioOk } from "../_shared/studio.ts";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

Deno.serve(async (req) => {
  if (!studioOk(req)) return new Response("studio key", { status: 401 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = new Date(Date.now() - 24 * 36e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [orders, toShip, waiting, products, dated] = await Promise.all([
    db.from("orders").select("total_cents, name, email, delivery").eq("status", "paid").gte("paid_at", since).then((r: any) => r.data ?? []),
    db.from("shipments").select("name, ship_by, items").eq("status", "to_ship").order("ship_by").then((r: any) => r.data ?? []),
    db.from("questions").select("name, kind, text, due_at").eq("status", "waiting").order("due_at").then((r: any) => r.data ?? []),
    db.from("products").select("name, stock, low_at, hidden").eq("hidden", false).not("stock", "is", null).then((r: any) => r.data ?? []),
    db.from("gift_cards").select("*").is("delivered_at", null).lte("send_date", today).eq("status", "active").then((r: any) => r.data ?? []),
  ]);
  const low = products.filter((p: any) => p.stock <= p.low_at);

  // gift certificates dated for today (or a day the email was missed)
  let giftsSent = 0;
  for (const g of dated) {
    if (await emailGift(g, "")) {
      await db.from("gift_cards").update({ delivered_at: new Date().toISOString() }).eq("code", g.code);
      giftsSent++;
    }
  }

  const parts: string[] = [];
  const bits: string[] = [];
  if (orders.length) {
    const sum = orders.reduce((s: number, o: any) => s + (o.total_cents ?? 0), 0);
    bits.push(plural(orders.length, "new order"));
    parts.push(`<h2 style="font-size:16px;margin:18px 0 6px">${plural(orders.length, "new order")} · ${money(sum)}</h2><ul style="padding-left:18px;margin:0">` +
      orders.map((o: any) => `<li>${esc(o.name || o.email)} · ${money(o.total_cents ?? 0)}${o.delivery === "pickup" ? " · pickup" : ""}</li>`).join("") + "</ul>");
  }
  if (toShip.length) {
    bits.push(`${toShip.length} to ship`);
    parts.push(`<h2 style="font-size:16px;margin:18px 0 6px">To ship</h2><ul style="padding-left:18px;margin:0">` +
      toShip.map((s: any) => `<li>${esc(s.name)} · by ${day(s.ship_by)}</li>`).join("") + "</ul>");
  }
  if (waiting.length) {
    bits.push(plural(waiting.length, "question"));
    parts.push(`<h2 style="font-size:16px;margin:18px 0 6px">Client questions waiting for you</h2><ul style="padding-left:18px;margin:0">` +
      waiting.map((q: any) => `<li>${esc(q.name)}: "${esc(String(q.text).slice(0, 90))}" · reply by ${day(q.due_at)}</li>`).join("") + "</ul>");
  }
  if (low.length) {
    bits.push(`${low.length} running low`);
    parts.push(`<h2 style="font-size:16px;margin:18px 0 6px">Running low</h2><ul style="padding-left:18px;margin:0">` +
      low.map((p: any) => `<li>${esc(p.name)} · ${p.stock === 0 ? "sold out" : p.stock + " left"}</li>`).join("") + "</ul>");
  }
  if (giftsSent) parts.push(`<p style="font-size:14px;margin-top:16px">${plural(giftsSent, "dated gift certificate")} went out this morning.</p>`);
  if (!bits.length) return new Response(giftsSent ? `gifts ${giftsSent}` : "nothing to report", { status: 200 });

  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const subject = "Today at Lumevina: " + bits.join(", ");
  const owner = Deno.env.get("OWNER_EMAIL");
  if (owner) await sendEmail(owner, subject, page("Good morning, Evelyn", parts.join("") +
    (site ? `<p style="margin-top:18px"><a href="${esc(site)}/dashboard.html" style="color:#161412">Open Lumevina Studio</a></p>` : "")));
  await pushAll(db, { title: "Good morning ✨", body: bits.join(" · "), url: "dashboard.html", tag: "digest" });
  return new Response("sent", { status: 200 });
});
