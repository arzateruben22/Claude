// Start connecting a destination: owner-only, needs INTEGRATIONS_KEY, PUBLIC_ORIGIN and the platform's app
// credentials. Sets the state cookie and sends the owner to the platform's consent screen.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { isOwner } from "@/lib/owner";
import { integrationsConfigured } from "@/lib/crypto";
import { newOauthState, OAUTH_COOKIE, redirectUriFor } from "@/lib/oauth-state";
import { connectorFor } from "@/integrations";
import type { Platform } from "@/integrations/types";

export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  if (!(await isOwner())) return new Response("sign in", { status: 401 });
  const { platform } = await params;
  const url = new URL(req.url), destinationId = url.searchParams.get("destination") ?? "";
  const back = (msg: string) => NextResponse.redirect(new URL(`/connections?error=${encodeURIComponent(msg)}`, url.origin));
  const connector = connectorFor(platform as Platform);
  if (!connector) return back(`No connector for ${platform}.`);
  if (!integrationsConfigured()) return back("Set INTEGRATIONS_KEY in .env.local first (openssl rand -hex 32).");
  if (!connector.configured()) return back(`Set ${connector.envVars.join(" and ")} in .env.local first.`);
  const origin = process.env.PUBLIC_ORIGIN || url.origin;
  if (!/^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)) return back("PUBLIC_ORIGIN must be an https URL the platform can redirect to.");
  if (!/^[0-9a-f-]{36}$/.test(destinationId)) return back("Pick a destination.");
  const [dest] = await db().select().from(S.destinations).where(eq(S.destinations.id, destinationId));
  if (!dest || dest.platform !== platform) return back("That destination doesn't match the platform.");
  const st = newOauthState(destinationId, platform);
  const res = NextResponse.redirect(connector.authUrl({ state: st.state, redirectUri: redirectUriFor(origin, platform), codeChallenge: st.codeChallenge }));
  res.cookies.set(OAUTH_COOKIE, st.cookie, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/auth", maxAge: 900 });
  return res;
}
