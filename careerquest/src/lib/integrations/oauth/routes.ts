import "server-only";
/**
 * Shared handlers behind /api/oauth/{google,microsoft}/{start,callback}. They only translate between
 * HTTP (cookies, form fields, redirects) and the testable flow functions in ./flow.ts.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl, readIntegrationEnv } from "../env";
import { isSameOriginRequest } from "../http-guards";
import { DEFAULT_HISTORY_DAYS } from "../registry";
import { beginOAuth, completeOAuth } from "./flow";
import { INTEGRATION_FOR, type OAuthProviderKey } from "./providers";
import { oauthCookieName, oauthCookiePath } from "./state";

function redirectTo(path: string, req: Request): NextResponse {
  return NextResponse.redirect(appUrl(path, readIntegrationEnv(), req.url), 303);
}

function clearStateCookie(res: NextResponse, key: OAuthProviderKey): NextResponse {
  res.cookies.set(oauthCookieName(key), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: oauthCookiePath(key),
    maxAge: 0,
  });
  return res;
}

/** POST from the consent dialog's form: sets the sealed state cookie and redirects to the provider. */
export async function handleOAuthStart(req: Request, key: OAuthProviderKey): Promise<NextResponse> {
  const env = readIntegrationEnv();
  const user = await getSessionUser();
  if (!user) return redirectTo(`/login?next=${encodeURIComponent("/integrations")}`, req);
  if (!isSameOriginRequest(req, env)) return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  if (!rateLimit(`oauth-start:${user.id}`, 10, 10 * 60_000).ok) return redirectTo("/integrations?oauthError=rate_limited", req);

  const form = await req.formData().catch(() => null);
  const days = Number(form?.get("historyDays") ?? DEFAULT_HISTORY_DAYS);
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return redirectTo(`/login?next=${encodeURIComponent("/integrations")}`, req);

  const begin = beginOAuth({ key, userId: user.id, sessionToken, historyDays: days, env });
  if (!begin.ok) return redirectTo(`/integrations?oauthError=${begin.code}`, req);

  const res = NextResponse.redirect(begin.authorizeUrl, 303);
  res.cookies.set(begin.cookie.name, begin.cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: begin.cookie.path,
    maxAge: begin.cookie.maxAge,
  });
  return res;
}

/** GET redirect back from the provider: validates state + session, exchanges the code, stores tokens encrypted. */
export async function handleOAuthCallback(req: Request, key: OAuthProviderKey): Promise<NextResponse> {
  const env = readIntegrationEnv();
  const user = await getSessionUser();
  if (!user) return clearStateCookie(redirectTo(`/login?next=${encodeURIComponent("/integrations")}`, req), key);

  const jar = await cookies();
  const params = new URL(req.url).searchParams;
  const result = await completeOAuth({
    key,
    params,
    cookieValue: jar.get(oauthCookieName(key))?.value ?? null,
    userId: user.id,
    sessionToken: jar.get(SESSION_COOKIE)?.value ?? "",
    env,
    fetch: (input, init) => fetch(input, init),
  });

  if (!result.ok) {
    await audit("integration.connect_failed", {
      userId: user.id,
      entityType: "IntegrationConnection",
      metadata: { provider: INTEGRATION_FOR[key], code: result.code },
    });
    return clearStateCookie(redirectTo(`/integrations?oauthError=${result.code}&provider=${INTEGRATION_FOR[key]}`, req), key);
  }
  return clearStateCookie(redirectTo(`/integrations?connected=${result.provider}`, req), key);
}
