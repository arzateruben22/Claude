// Lumevina — text messages (Twilio): appointment reminders and waitlist
// openings, only to clients who said yes to texts. Without the Twilio
// secrets it does nothing, so the rest works while texting isn't set up.
//
// Secrets: TWILIO_SID, TWILIO_TOKEN, and TWILIO_FROM (her texting number,
//          +1…) or TWILIO_MESSAGING_SID (a Messaging Service, for A2P 10DLC)

/** "(818) 555-0134" → "+18185550134"; anything that isn't a US number → "" */
export const toE164 = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 10 ? "+1" + d : d.length === 11 && d[0] === "1" ? "+" + d : "";
};

export async function sendSMS(to: unknown, body: string) {
  const sid = Deno.env.get("TWILIO_SID"), token = Deno.env.get("TWILIO_TOKEN");
  const from = Deno.env.get("TWILIO_FROM"), service = Deno.env.get("TWILIO_MESSAGING_SID");
  const num = toE164(to);
  if (!sid || !token || (!from && !service) || !num) return false;
  const f = new URLSearchParams({ To: num, Body: body.slice(0, 600) });
  if (service) f.set("MessagingServiceSid", service); else f.set("From", from!);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: f,
  }).catch((e) => { console.error("sms", String(e)); return null; });
  if (res && !res.ok) console.error("sms", res.status, await res.text().catch(() => ""));
  return !!res?.ok;
}
