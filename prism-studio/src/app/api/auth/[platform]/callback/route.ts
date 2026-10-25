// The platform sends the owner back here. The route is public (the proxy opens /api/auth/), so it trusts
// nothing but the sealed state cookie set by /start; it then exchanges the code, asks the platform who the
// account is, and stores the sealed grant on that destination.
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/owner";
import { OAUTH_COOKIE, readOauthState, redirectUriFor } from "@/lib/oauth-state";
import { connectorFor } from "@/integrations";
import type { Platform } from "@/integrations/types";
import { db } from "@/db/client";
import { saveConnection } from "@/domain/connections";
import { cookies } from "next/headers";

export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(req.url);
  const done = (q: string) => { const r = NextResponse.redirect(new URL(`/connections?${q}`, url.origin)); r.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 }); return r; };
  if (!(await isOwner())) return done("error=" + encodeURIComponent("Sign in first, then connect again."));
  const st = readOauthState((await cookies()).get(OAUTH_COOKIE)?.value, url.searchParams.get("state"), platform);
  if (!st) return done("error=" + encodeURIComponent("The connect attempt expired or didn't match. Try again."));
  const err = url.searchParams.get("error") || url.searchParams.get("error_description");
  if (err) return done("error=" + encodeURIComponent(`${platform} said: ${err}`));
  const code = url.searchParams.get("code");
  const connector = connectorFor(platform as Platform);
  if (!code || !connector) return done("error=" + encodeURIComponent("No authorization code came back."));
  try {
    const origin = process.env.PUBLIC_ORIGIN || url.origin;
    const tokens = await connector.exchangeCode({ code, redirectUri: redirectUriFor(origin, platform), codeVerifier: st.verifier });
    const account = await connector.whoAmI(tokens);
    await saveConnection(db(), { destinationId: st.destinationId, platform: platform as Platform, tokens: { ...tokens, extra: { ...(tokens.extra ?? {}), handle: account.handle.replace(/^@/, "") } }, account });
    return done(`connected=${encodeURIComponent(account.handle)}#dest-${st.destinationId}`);
  } catch (e) {
    return done("error=" + encodeURIComponent((e as Error).message.slice(0, 300)));
  }
}
