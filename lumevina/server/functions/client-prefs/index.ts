// Lumevina — Supabase Edge Function: client-prefs (v3)
//
// The "Stop these emails" link at the bottom of review requests, "time for
// your next facial", "running low?" and the invitation. It carries the
// email and a token only the server can make (../_shared/contacts.ts →
// emailToken), so nobody can unsubscribe someone else. Appointment
// confirmations and reminders still go out: those are about their visit.
//
// GET ?e=<email>&t=<token>   → a small page saying it's done
// Deploy: supabase functions deploy client-prefs --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { emailToken, norm } from "../_shared/contacts.ts";
import { page } from "../_shared/mail.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = norm(url.searchParams.get("e"));
  const token = url.searchParams.get("t") ?? "";
  const html = (title: string, body: string, status = 200) =>
    new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumevina</title>` + page(title, body),
      { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!email || token.length !== 32 || token !== (await emailToken(email))) {
    return html("That link didn't work.", `<p style="font-size:15px">Reply to any email from Evelyn and she'll take you off the list.</p>`, 400);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await db.from("contacts").update({ email_ok: false }).eq("email", email);
  return html("You're unsubscribed.", `<p style="font-size:15px;line-height:1.55">No more review requests, reminders to rebook, or "running low?" emails. You'll still get confirmations and reminders for appointments you book.</p>`);
});
