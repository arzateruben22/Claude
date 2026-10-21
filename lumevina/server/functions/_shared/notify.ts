// Lumevina — telling Evelyn (Lumevina Studio): one call records the alert
// (the dashboard's feed and the morning email read it), pushes it to every
// phone she turned notifications on for, and, for orders and questions,
// emails her too.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys),
//          OWNER_EMAIL (where her alerts and morning email go)

// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";
import { esc, page, sendEmail } from "./mail.ts";

export type Alert = { kind: "order" | "question" | "low_stock" | "gift" | "test" | "booking" | "cancel" | "member" | "waitlist" | "consult"; title: string; body?: string; url?: string; email?: boolean };

let vapidSet = false;
const vapid = () => {
  if (vapidSet) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:" + (Deno.env.get("OWNER_EMAIL") ?? "hello@lumevina.com"), pub, priv);
  vapidSet = true;
  return true;
};

/** Push one alert to every phone; drops phones that turned it off. Returns how many got it. */
export async function pushAll(db: any, a: { title: string; body?: string; url?: string; tag?: string }) {
  if (!vapid()) return 0;
  const { data } = await db.from("studio_push").select("endpoint, subscription");
  let sent = 0;
  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(a), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("studio_push").delete().eq("endpoint", row.endpoint);
      else console.error("push", e?.statusCode ?? e);
    }
  }
  return sent;
}

export async function notifyOwner(db: any, a: Alert) {
  await db.from("studio_alerts").insert({ kind: a.kind, title: a.title, body: a.body ?? null, url: a.url ?? null })
    .then(() => {}, (e: unknown) => console.error("alert", e));
  await pushAll(db, { title: a.title, body: a.body, url: a.url, tag: a.kind }).catch((e) => console.error("push", e));
  const owner = Deno.env.get("OWNER_EMAIL");
  if (owner && a.email) {
    const site = Deno.env.get("SITE_URL") ?? "";
    await sendEmail(owner, a.title, page(a.title,
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;white-space:pre-line">${esc(a.body ?? "")}</p>` +
      (site && a.url ? `<p><a href="${esc(site.replace(/\/$/, "") + "/" + a.url.replace(/^\//, ""))}" style="color:#161412">Open the dashboard</a></p>` : "")));
  }
}
