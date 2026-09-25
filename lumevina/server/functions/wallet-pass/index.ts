// Lumevina — Supabase Edge Function: wallet-pass
//
// The Glow Card in Apple Wallet. One pass per client, kept up to date:
//
//   Front   Glow Points, dollars ready to use, the next visit, member plan.
//   Code    A QR code that is the client's referral link: a friend scans it
//           with their camera for $15 off a first visit, and the client earns
//           150 points when that visit is done. No scanner needed at the spa.
//   Timing  relevantDate = the next visit, so iOS can surface the card that
//           day; a location at the spa, so it can surface on arrival.
//   Back    "I'm here" (texts Evelyn, per the arrival policy), book again,
//           move a visit, the referral code, how points work.
//   Updates Wallet's web service below: when points or the next visit change,
//           registered devices get a silent push and fetch the new pass,
//           showing a note like "+25 Glow Points".
//
// Routes (all under /functions/v1/wallet-pass):
//   GET  /                         the signed-in client's pass (.pkpass)
//   POST /notify {client_id}       service role only: push an update to devices
//   Apple's PassKit web service, called by Wallet itself:
//   POST   /v1/devices/:device/registrations/:passType/:serial
//   DELETE /v1/devices/:device/registrations/:passType/:serial
//   GET    /v1/devices/:device/registrations/:passType?passesUpdatedSince=
//   GET    /v1/passes/:passType/:serial
//   POST   /v1/log
//
// Needs an Apple Developer account ($99/yr) and a Pass Type ID certificate.
// See server/README.md → Apple Wallet. NOT YET RUN: it can't be tested until
// those certificates exist.
//
// Deploy:  supabase functions deploy wallet-pass --no-verify-jwt
//          (Wallet calls the /v1 routes without a Supabase session; they're
//          checked with the pass's own auth token instead)
// Secrets: PASS_TYPE_ID, APPLE_TEAM_ID, PASS_SIGNER_CERT, PASS_SIGNER_KEY,
//          PASS_SIGNER_KEY_PASSPHRASE, APPLE_WWDR_CERT (PEM text), SITE_URL,
//          SPA_SMS (e.g. +18185550123), SPA_LAT, SPA_LNG

import { createClient } from "npm:@supabase/supabase-js@2";
import { PKPass } from "npm:passkit-generator@3";
import { Buffer } from "node:buffer";

const env = (k: string) => Deno.env.get(k) ?? "";
const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const BASE = `${env("SUPABASE_URL")}/functions/v1/wallet-pass`;

const money = (n: number) => `$${n}`;
const when = (d: string, startMin: number) => {
  const dt = new Date(`${d}T00:00:00`);
  const h = Math.floor(startMin / 60), m = startMin % 60;
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    ` · ${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const iso = (d: string, startMin: number) =>
  new Date(`${d}T${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}:00-07:00`).toISOString();

// images are served by the website itself
const img = async (path: string) => Buffer.from(await (await fetch(`${env("SITE_URL")}/${path}`)).arrayBuffer());

async function buildPass(clientId: string) {
  const db = admin();
  const { data: client } = await db.from("clients").select().eq("id", clientId).single();
  if (!client) throw new Error("no client");
  let { data: wp } = await db.from("wallet_passes").select().eq("client_id", clientId).maybeSingle();
  if (!wp) ({ data: wp } = await db.from("wallet_passes").insert({ client_id: clientId }).select().single());

  const { data: bal } = await db.from("reward_balances").select("points").eq("client_id", clientId).maybeSingle();
  const points = bal?.points ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const { data: next } = await db.from("bookings").select("date,start_min")
    .eq("client_id", clientId).in("status", ["pending", "held"]).gte("date", today)
    .order("date").order("start_min").limit(1).maybeSingle();
  const { data: plan } = await db.from("memberships").select("plan")
    .eq("client_id", clientId).neq("status", "cancelled").maybeSingle();

  const icon = await img("img/apple-touch-icon.png");
  const pass = new PKPass({
    "icon.png": icon, "icon@2x.png": icon, "logo.png": icon, "logo@2x.png": icon,
  }, {
    wwdr: env("APPLE_WWDR_CERT"),
    signerCert: env("PASS_SIGNER_CERT"),
    signerKey: env("PASS_SIGNER_KEY"),
    signerKeyPassphrase: env("PASS_SIGNER_KEY_PASSPHRASE"),
  }, {
    formatVersion: 1,
    passTypeIdentifier: env("PASS_TYPE_ID"),
    teamIdentifier: env("APPLE_TEAM_ID"),
    organizationName: "Lumevina Aesthetics Spa",
    description: "Lumevina Glow Card",
    serialNumber: wp.serial,
    authenticationToken: wp.auth_token,
    webServiceURL: BASE,
    logoText: "LUMEVINA",
    foregroundColor: "rgb(26, 15, 19)",
    backgroundColor: "rgb(240, 194, 207)",
    labelColor: "rgb(92, 58, 70)",
  });
  pass.type = "storeCard";

  pass.headerFields.push({ key: "points", label: "GLOW POINTS", value: points, changeMessage: "Glow Points: %@" });
  pass.primaryFields.push({ key: "ready", label: "READY TO USE", value: `${money(Math.floor(points / 100) * 10)} off` });
  pass.secondaryFields.push(
    { key: "next", label: "NEXT VISIT", value: next ? when(next.date, next.start_min) : "Book your next glow",
      changeMessage: next ? "Next visit: %@" : undefined },
    { key: "plan", label: "MEMBER", value: plan ? (plan.plan === "ageless" ? "Ageless" : "Glow") : "Glow Rewards",
      textAlignment: "PKTextAlignmentRight" },
  );
  const sms = `sms:${env("SPA_SMS")}&body=${encodeURIComponent("Hi Evelyn, I'm here!")}`;
  pass.backFields.push(
    { key: "here", label: "At the spa?", value: "Text Evelyn “I’m here”",
      attributedValue: `<a href="${sms}">Text Evelyn “I’m here”</a>` },
    { key: "book", label: "Book again", value: env("SITE_URL"),
      attributedValue: `<a href="${env("SITE_URL")}/#services">Book your next visit</a>` },
    { key: "ref", label: "Your referral code", value: `${client.ref_code}: a friend gets $15 off a first visit, you earn 150 points.` },
    { key: "how", label: "How points work", value: "1 point per $1 on deposits and gifts; 100 points = $10 off. Double on Wax Wednesday. +25 when a non-member’s next visit is within 5 weeks (handed back if that visit is cancelled). +50 in your birthday month." },
  );
  pass.setBarcodes({
    message: `${env("SITE_URL")}/?ref=${encodeURIComponent(client.ref_code)}`,
    format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1",
    altText: `Friends scan for $15 off · ${client.ref_code}`,
  });
  if (env("SPA_LAT") && env("SPA_LNG")) {
    pass.setLocations({ latitude: Number(env("SPA_LAT")), longitude: Number(env("SPA_LNG")),
      relevantText: "At Lumevina? Tap to tell Evelyn you’re here." });
  }
  if (next) pass.setRelevantDate(new Date(iso(next.date, next.start_min)));
  return { buffer: pass.getAsBuffer(), updated: wp.updated_at };
}

// a silent push tells each registered device to fetch the new pass
async function notify(clientId: string) {
  const db = admin();
  const { data: wp } = await db.from("wallet_passes").select("serial").eq("client_id", clientId).maybeSingle();
  if (!wp) return 0;
  const { data: regs } = await db.from("wallet_registrations").select("push_token").eq("serial", wp.serial);
  if (!regs?.length) return 0;
  // Wallet pushes are sent with the Pass Type ID certificate itself (mutual TLS to APNs)
  const client = Deno.createHttpClient({ cert: env("PASS_SIGNER_CERT"), key: env("PASS_SIGNER_KEY") });
  await Promise.all(regs.map((r) => fetch(`https://api.push.apple.com/3/device/${r.push_token}`, {
    method: "POST", client, headers: { "apns-topic": env("PASS_TYPE_ID") }, body: "{}",
  }).catch(() => null)));
  return regs.length;
}

const passAuth = async (req: Request, serial: string) => {
  const token = (req.headers.get("Authorization") ?? "").replace(/^ApplePass /, "");
  const { data } = await admin().from("wallet_passes").select("serial").eq("serial", serial).eq("auth_token", token).maybeSingle();
  return !!data;
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/wallet-pass/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const db = admin();

  // the signed-in client downloads their pass ("Add to Apple Wallet")
  if (req.method === "GET" && parts.length === 0) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "") || url.searchParams.get("token") || "";
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return new Response("Sign in first", { status: 401 });
    const { buffer } = await buildPass(user.id);
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'attachment; filename="Lumevina-Glow-Card.pkpass"' } });
  }

  // the booking and rewards code asks for an update to be pushed
  if (req.method === "POST" && parts[0] === "notify") {
    if (req.headers.get("Authorization") !== `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`) return new Response("", { status: 401 });
    const { client_id } = await req.json();
    return Response.json({ pushed: await notify(client_id) });
  }

  // ── Apple's PassKit web service ──
  if (parts[0] === "v1" && parts[1] === "devices" && parts[3] === "registrations") {
    const device = parts[2], serial = parts[5];
    if (req.method === "POST" && serial) {
      if (!(await passAuth(req, serial))) return new Response("", { status: 401 });
      const { pushToken } = await req.json();
      const { error } = await db.from("wallet_registrations").upsert({ device_id: device, serial, push_token: pushToken });
      return new Response("", { status: error ? 500 : 201 });
    }
    if (req.method === "DELETE" && serial) {
      if (!(await passAuth(req, serial))) return new Response("", { status: 401 });
      await db.from("wallet_registrations").delete().eq("device_id", device).eq("serial", serial);
      return new Response("", { status: 200 });
    }
    if (req.method === "GET") {
      const since = url.searchParams.get("passesUpdatedSince");
      const { data: regs } = await db.from("wallet_registrations").select("serial").eq("device_id", device);
      const serials = (regs ?? []).map((r) => r.serial);
      if (!serials.length) return new Response("", { status: 204 });
      let q = db.from("wallet_passes").select("serial,updated_at").in("serial", serials);
      if (since) q = q.gt("updated_at", since);
      const { data: passes } = await q;
      if (!passes?.length) return new Response("", { status: 204 });
      const last = passes.map((p) => p.updated_at).sort().pop();
      return Response.json({ serialNumbers: passes.map((p) => p.serial), lastUpdated: last });
    }
  }
  if (req.method === "GET" && parts[0] === "v1" && parts[1] === "passes") {
    const serial = parts[3];
    if (!(await passAuth(req, serial))) return new Response("", { status: 401 });
    const { data: wp } = await db.from("wallet_passes").select("client_id").eq("serial", serial).single();
    const { buffer, updated } = await buildPass(wp!.client_id);
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": new Date(updated).toUTCString() } });
  }
  if (req.method === "POST" && parts[0] === "v1" && parts[1] === "log") {
    console.log("wallet log", await req.text());
    return new Response("", { status: 200 });
  }
  return new Response("Not found", { status: 404 });
});
