// Lumevina — sending email (Resend), shared by every function that writes to
// clients or to Evelyn. Without RESEND_API_KEY it does nothing, so the rest
// still works while email isn't set up.
//
// Secrets: RESEND_API_KEY, FROM_EMAIL ("Lumevina <hello@her-domain>")

export const esc = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const money = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });

export async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("FROM_EMAIL") ?? "Lumevina <hello@lumevina.com>",
      to, subject, html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  }).catch((e) => { console.error("email", e); return null; });
  return !!res?.ok;
}

/** A plain, warm email body in the site's colors. */
export function page(title: string, body: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#161412;background:#F5F1EA">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7D5A44">Lumevina Aesthetics Spa</p>
  <h1 style="margin:0 0 16px;font-size:22px;letter-spacing:-.02em">${esc(title)}</h1>
  ${body}
  <p style="margin:24px 0 0;font-size:12px;color:#7D5A44">Lumevina Aesthetics Spa · Woodland Hills, CA</p>
</div>`;
}
