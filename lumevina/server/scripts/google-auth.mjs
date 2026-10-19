// One-time: let the website read and write Evelyn's Google Calendar.
//
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node server/scripts/google-auth.mjs
//
// 1. In Google Cloud Console: create a project, enable the Google Calendar
//    API, and create an OAuth client of type "Desktop app". Copy its ID and
//    secret into the command above.
// 2. Run it on a computer with a browser. It prints a link: open it, sign in
//    with the Google account her GlossGenius syncs to, and allow access.
// 3. It prints the refresh token. Save the three values in Supabase:
//      supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=...
//
// Nothing is stored by this script; the token only goes to your terminal.

import http from "node:http";

const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
if (!id || !secret) { console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first."); process.exit(1); }
const PORT = 53682, redirect = `http://127.0.0.1:${PORT}/`;
const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent",
  // read busy times and write the website's bookings; nothing else
  scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy",
});

http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) { res.end("No code in the link. Try again."); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  res.end(j.refresh_token ? "Done. Go back to the terminal." : "Google didn't return a refresh token. See the terminal.");
  if (j.refresh_token) console.log("\nGOOGLE_REFRESH_TOKEN=" + j.refresh_token + "\n");
  else console.error(j);
  process.exit(0);
}).listen(PORT, "127.0.0.1", () => console.log("Open this link and sign in with her Google account:\n\n" + auth + "\n"));
