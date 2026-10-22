/**
 * OAuth (Gmail + Outlook) with fake providers: authorization URL with PKCE S256, scopes and redirect_uri
 * from APP_URL; sealed state cookie bound to the session; state/session/expiry rejections; code
 * exchange with tokens encrypted at rest (plaintext never in the DB); refresh; disconnect revokes and
 * wipes. No network access.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decryptSecret, sha256 } from "@/lib/crypto";
import type { FetchLike } from "@/lib/integrations/adapters/types";
import { connectionTokenSource, disconnectConnection, saveOAuthConnection } from "@/lib/integrations/connections";
import { beginOAuth, completeOAuth } from "@/lib/integrations/oauth/flow";
import { getOAuthConfig, hasMailScope, microsoftTenant } from "@/lib/integrations/oauth/providers";
import { codeChallengeS256, openOAuthState, sessionBinding } from "@/lib/integrations/oauth/state";
import type { IntegrationEnv } from "@/lib/integrations/registry";

const ENV: IntegrationEnv = {
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-secret",
  MICROSOFT_CLIENT_ID: "ms-client-id",
  MICROSOFT_CLIENT_SECRET: "ms-secret",
  MICROSOFT_TENANT: "common",
  APP_URL: "https://careerquest.test/",
};

const ACCESS = "ya29.ACCESS-PLAINTEXT-123";
const REFRESH = "1//REFRESH-PLAINTEXT-456";
const SESSION = "session-token-abc";

let userId = "";
let otherUserId = "";

function idToken(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.sig`;
}

type Call = { url: string; method: string; body: URLSearchParams | null; headers: Record<string, string> };

function provider(handlers: Record<string, (c: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fn: FetchLike = async (url, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const call: Call = { url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? new URLSearchParams(init.body) : null, headers };
    calls.push(call);
    const key = Object.keys(handlers).find((k) => url.startsWith(k));
    if (!key) throw new TypeError(`unexpected fetch ${url}`);
    return handlers[key]!(call);
  };
  return { fn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function start(key: "google" | "microsoft", days = 180, uid = userId, session = SESSION, now = new Date()) {
  const res = beginOAuth({ key, userId: uid, sessionToken: session, historyDays: days, env: ENV, now });
  if (!res.ok) throw new Error("not configured");
  const url = new URL(res.authorizeUrl);
  return { res, url, state: url.searchParams.get("state")! };
}

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  userId = (await prisma.user.create({ data: { email: `oauth+${stamp}@careerquest.test`, passwordHash: "x", name: "OAuth Test" } })).id;
  otherUserId = (await prisma.user.create({ data: { email: `oauth-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" } })).id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

describe("authorization request", () => {
  it("builds a Google authorization-code + PKCE (S256) request with read-only scopes and offline access", () => {
    const { res, url, state } = start("google");
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe(ENV.GOOGLE_CLIENT_ID);
    expect(p.get("redirect_uri")).toBe("https://careerquest.test/api/oauth/google/callback");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("scope")).toBe("openid email https://www.googleapis.com/auth/gmail.readonly");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(state.length).toBeGreaterThanOrEqual(32);

    if (!res.ok) return;
    expect(res.cookie).toMatchObject({ name: "cq_oauth_google", path: "/api/oauth/google", maxAge: 600 });
    const sealed = openOAuthState(res.cookie.value)!;
    expect(sealed.p).toBe("google");
    expect(sealed.d).toBe(180);
    expect(p.get("code_challenge")).toBe(codeChallengeS256(sealed.cv));
    expect(sealed.sh).toBe(sha256(state));
    expect(sealed.b).toBe(sessionBinding(userId, SESSION));
    // Neither the verifier nor the state is readable from the cookie.
    expect(res.cookie.value).not.toContain(sealed.cv);
    expect(res.cookie.value).not.toContain(state);
    expect(openOAuthState(res.cookie.value.slice(0, -2) + "xx")).toBeNull();
  });

  it("builds a Microsoft identity platform v2 request", () => {
    const { url } = start("microsoft", 30);
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe("offline_access Mail.Read User.Read");
    expect(url.searchParams.get("redirect_uri")).toBe("https://careerquest.test/api/oauth/microsoft/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("response_mode")).toBe("query");
  });

  it("refuses to start without client configuration and sanitizes the tenant", () => {
    expect(beginOAuth({ key: "google", userId, sessionToken: SESSION, historyDays: 90, env: { APP_URL: ENV.APP_URL } })).toEqual({ ok: false, code: "not_configured" });
    expect(getOAuthConfig("microsoft", { ...ENV, APP_URL: null })).toBeNull();
    expect(microsoftTenant({ MICROSOFT_TENANT: "contoso.onmicrosoft.com" })).toBe("contoso.onmicrosoft.com");
    expect(microsoftTenant({ MICROSOFT_TENANT: "evil.com/x?y=" })).toBe("common");
    const odd = beginOAuth({ key: "google", userId, sessionToken: SESSION, historyDays: 45, env: ENV });
    expect(odd.ok && openOAuthState(odd.cookie.value)!.d).toBe(90);
  });

  it("recognizes granted mail scopes", () => {
    expect(hasMailScope("google", ["openid", "https://www.googleapis.com/auth/gmail.readonly"])).toBe(true);
    expect(hasMailScope("google", ["openid", "email"])).toBe(false);
    expect(hasMailScope("microsoft", ["https://graph.microsoft.com/Mail.Read", "User.Read"])).toBe(true);
    expect(hasMailScope("microsoft", ["Mail.ReadBasic"])).toBe(false);
  });
});

describe("callback validation", () => {
  const unusedFetch: FetchLike = async () => {
    throw new Error("must not call the provider");
  };

  it("rejects a mismatched state, another session, an expired attempt, a missing cookie and user cancellation", async () => {
    const { res, state } = start("google");
    if (!res.ok) return;
    const params = (s: string) => new URLSearchParams({ code: "auth-code", state: s });
    const common = { key: "google" as const, cookieValue: res.cookie.value, userId, sessionToken: SESSION, env: ENV, fetch: unusedFetch };

    expect(await completeOAuth({ ...common, params: params("forged-state") })).toEqual({ ok: false, code: "state_mismatch" });
    expect(await completeOAuth({ ...common, params: params(state), sessionToken: "another-session" })).toEqual({ ok: false, code: "session_mismatch" });
    expect(await completeOAuth({ ...common, params: params(state), userId: otherUserId })).toEqual({ ok: false, code: "session_mismatch" });
    expect(await completeOAuth({ ...common, params: params(state), now: new Date(Date.now() + 11 * 60_000) })).toEqual({ ok: false, code: "expired" });
    expect(await completeOAuth({ ...common, params: params(state), cookieValue: null })).toEqual({ ok: false, code: "missing_state" });
    expect(await completeOAuth({ ...common, key: "microsoft", params: params(state) })).toEqual({ ok: false, code: "state_mismatch" });
    expect(await completeOAuth({ ...common, params: new URLSearchParams({ error: "access_denied", state }) })).toEqual({ ok: false, code: "access_denied" });
    expect(await completeOAuth({ ...common, params: new URLSearchParams({ state }) })).toEqual({ ok: false, code: "provider_error" });
    expect(await prisma.integrationConnection.count({ where: { userId } })).toBe(0);
  });

  it("refuses a grant without mail access and revokes it", async () => {
    const { res, state } = start("google");
    if (!res.ok) return;
    const google = provider({
      "https://oauth2.googleapis.com/token": () => json({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "openid email" }),
      "https://oauth2.googleapis.com/revoke": () => new Response("", { status: 200 }),
    });
    const out = await completeOAuth({
      key: "google",
      params: new URLSearchParams({ code: "c", state }),
      cookieValue: res.cookie.value,
      userId,
      sessionToken: SESSION,
      env: ENV,
      fetch: google.fn,
    });
    expect(out).toEqual({ ok: false, code: "scope_missing" });
    expect(google.calls.map((c) => c.url)).toEqual(["https://oauth2.googleapis.com/token", "https://oauth2.googleapis.com/revoke"]);
    expect(google.calls[1]!.body!.get("token")).toBe("r");
    expect(await prisma.integrationConnection.count({ where: { userId } })).toBe(0);
  });

  it("reports a rejected code exchange", async () => {
    const { res, state } = start("google");
    if (!res.ok) return;
    const google = provider({ "https://oauth2.googleapis.com/token": () => json({ error: "invalid_grant" }, 400) });
    const out = await completeOAuth({ key: "google", params: new URLSearchParams({ code: "c", state }), cookieValue: res.cookie.value, userId, sessionToken: SESSION, env: ENV, fetch: google.fn });
    expect(out).toEqual({ ok: false, code: "exchange_failed" });
  });
});

describe("Gmail connect → refresh → disconnect", () => {
  let connectionId = "";

  it("exchanges the code with the PKCE verifier and stores tokens encrypted (plaintext never in the DB)", async () => {
    const { res, state } = start("google", 180);
    if (!res.ok) return;
    const verifier = openOAuthState(res.cookie.value)!.cv;
    const google = provider({
      "https://oauth2.googleapis.com/token": () =>
        json({
          access_token: ACCESS,
          refresh_token: REFRESH,
          expires_in: 3599,
          token_type: "Bearer",
          scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly",
          id_token: idToken({ aud: ENV.GOOGLE_CLIENT_ID, email: "Ruben.Test@gmail.com", email_verified: true }),
        }),
    });
    const out = await completeOAuth({
      key: "google",
      params: new URLSearchParams({ code: "4/0AUTH-CODE", state, scope: "email" }),
      cookieValue: res.cookie.value,
      userId,
      sessionToken: SESSION,
      env: ENV,
      fetch: google.fn,
    });
    expect(out).toMatchObject({ ok: true, provider: "GMAIL", accountEmail: "ruben.test@gmail.com" });
    if (!out.ok) return;
    connectionId = out.connectionId;

    const body = google.calls[0]!.body!;
    expect(google.calls[0]!.method).toBe("POST");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("4/0AUTH-CODE");
    expect(body.get("code_verifier")).toBe(verifier);
    expect(body.get("redirect_uri")).toBe("https://careerquest.test/api/oauth/google/callback");
    expect(body.get("client_secret")).toBe("google-secret");

    const row = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(row).toMatchObject({ userId, provider: "GMAIL", status: "CONNECTED", accountEmail: "ruben.test@gmail.com", syncEnabled: true, settings: { historyDays: 180 } });
    expect(row.scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    const raw = JSON.stringify(row);
    expect(raw).not.toContain(ACCESS);
    expect(raw).not.toContain(REFRESH);
    expect(decryptSecret(row.accessTokenEnc!)).toBe(ACCESS);
    expect(decryptSecret(row.refreshTokenEnc!)).toBe(REFRESH);
    expect(row.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 3500_000);
    const audit = await prisma.auditLog.findFirst({ where: { userId, action: "integration.connected", entityId: connectionId } });
    expect(JSON.stringify(audit?.metadata)).not.toContain(ACCESS);
  });

  it("reconnecting the same account updates the row and keeps the refresh token when none is re-issued", async () => {
    const saved = await saveOAuthConnection(userId, {
      provider: "GMAIL",
      accountEmail: "RUBEN.TEST@gmail.com",
      accessToken: "ya29.SECOND",
      refreshToken: null,
      expiresIn: 3600,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      historyDays: 180,
    });
    expect(saved.id).toBe(connectionId);
    expect(decryptSecret(saved.refreshTokenEnc!)).toBe(REFRESH);
    expect(decryptSecret(saved.accessTokenEnc!)).toBe("ya29.SECOND");
  });

  it("refreshes an expired access token and stores the new one encrypted", async () => {
    await prisma.integrationConnection.update({ where: { id: connectionId }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } });
    const conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const google = provider({ "https://oauth2.googleapis.com/token": () => json({ access_token: "ya29.REFRESHED", expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.readonly" }) });
    const tokens = connectionTokenSource(conn, { env: ENV, fetch: google.fn });
    expect(await tokens.get()).toBe("ya29.REFRESHED");
    expect(google.calls[0]!.body!.get("grant_type")).toBe("refresh_token");
    expect(google.calls[0]!.body!.get("refresh_token")).toBe(REFRESH);
    const after = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(decryptSecret(after.accessTokenEnc!)).toBe("ya29.REFRESHED");
    expect(JSON.stringify(after)).not.toContain("ya29.REFRESHED");
    expect(decryptSecret(after.refreshTokenEnc!)).toBe(REFRESH);
    // A second get() uses the cached, still-valid token.
    expect(await tokens.get()).toBe("ya29.REFRESHED");
    expect(google.calls).toHaveLength(1);
  });

  it("disconnect revokes at Google, wipes tokens and can delete imported email records", async () => {
    await prisma.emailMessage.createMany({
      data: [
        { userId, provider: "GMAIL", externalId: `oauth-test-1-${connectionId}`, connectionId, subject: "Application received" },
        { userId, provider: "EML", externalId: `oauth-test-2-${connectionId}`, subject: "Kept: imported from a file" },
      ],
    });
    const google = provider({ "https://oauth2.googleapis.com/revoke": () => new Response("", { status: 200 }) });
    expect(await disconnectConnection(otherUserId, connectionId, { deleteEmails: true, fetch: google.fn })).toBeNull();
    expect(google.calls).toHaveLength(0);

    const res = await disconnectConnection(userId, connectionId, { deleteEmails: true, fetch: google.fn });
    expect(res).toEqual({ revoke: "revoked", deletedEmails: 1 });
    expect(google.calls[0]!.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(google.calls[0]!.body!.get("token")).toBe(REFRESH);
    const row = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(row).toMatchObject({ status: "DISCONNECTED", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null, syncCursor: null });
    expect(await prisma.emailMessage.count({ where: { userId, connectionId } })).toBe(0);
    expect(await prisma.emailMessage.count({ where: { userId, provider: "EML" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { userId, action: "integration.disconnected", entityId: connectionId } })).toBe(1);
  });

  it("still wipes tokens when Google cannot be reached", async () => {
    const conn = await saveOAuthConnection(userId, {
      provider: "GMAIL",
      accountEmail: "second@gmail.com",
      accessToken: "ya29.X",
      refreshToken: "1//Y",
      expiresIn: 3600,
      scopes: [],
      historyDays: 30,
    });
    const down: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await disconnectConnection(userId, conn.id, { deleteEmails: false, fetch: down })).toEqual({ revoke: "failed", deletedEmails: 0 });
    const row = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(row.accessTokenEnc).toBeNull();
    expect(row.refreshTokenEnc).toBeNull();
  });
});

describe("Outlook connect", () => {
  it("exchanges the code at the v2 token endpoint, reads the address from Graph /me and stores tokens encrypted", async () => {
    const { res, state } = start("microsoft", 90);
    if (!res.ok) return;
    const ms = provider({
      "https://login.microsoftonline.com/common/oauth2/v2.0/token": () =>
        json({ token_type: "Bearer", scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read", expires_in: 3600, access_token: "EwB-MS-ACCESS", refresh_token: "M.R3-MS-REFRESH" }),
      "https://graph.microsoft.com/v1.0/me": () => json({ mail: null, userPrincipalName: "Ruben@Outlook.com" }),
    });
    const out = await completeOAuth({ key: "microsoft", params: new URLSearchParams({ code: "M.C-code", state }), cookieValue: res.cookie.value, userId, sessionToken: SESSION, env: ENV, fetch: ms.fn });
    expect(out).toMatchObject({ ok: true, provider: "OUTLOOK", accountEmail: "ruben@outlook.com" });
    expect(ms.calls[0]!.body!.get("scope")).toBe("offline_access Mail.Read User.Read");
    expect(ms.calls[0]!.body!.get("code_verifier")).toBe(openOAuthState(res.cookie.value)!.cv);
    expect(ms.calls[1]!.headers.authorization).toBe("Bearer EwB-MS-ACCESS");
    const row = await prisma.integrationConnection.findFirstOrThrow({ where: { userId, provider: "OUTLOOK" } });
    expect(JSON.stringify(row)).not.toContain("EwB-MS-ACCESS");
    expect(JSON.stringify(row)).not.toContain("M.R3-MS-REFRESH");

    // Microsoft has no per-token revocation endpoint: tokens are wiped and the user is told to remove the app.
    const noCalls = provider({});
    expect(await disconnectConnection(userId, row.id, { deleteEmails: false, fetch: noCalls.fn })).toEqual({ revoke: "not_supported", deletedEmails: 0 });
    expect(noCalls.calls).toHaveLength(0);
  });
});
