import { describe, expect, it } from "vitest";
import { GRAPH, GRAPH_VERSION, INSTAGRAM_SCOPES, createInstagram, instagram } from "../src/integrations/instagram";
import { ConnectorError, type Fetch, type PublishInput, type TokenSet } from "../src/integrations/types";

// ---- a recording fetch mock -------------------------------------------------------------------------------------
interface Call { url: string; method: string; headers: Record<string, string>; body?: unknown; form?: Record<string, string> }
function mockFetch(route: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f: Fetch = async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const body = init?.body;
    const form = typeof body === "string" && headers["content-type"]?.includes("x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(body)) : undefined;
    const call: Call = { url: String(input), method: (init?.method ?? "GET").toUpperCase(), headers, body, form };
    calls.push(call);
    return route(call, calls.length);
  };
  return { f, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const graphError = (code: number, status = 400, extra: Record<string, unknown> = {}) => json({ error: { message: `error ${code}`, type: "OAuthException", code, fbtrace_id: "T", ...extra } }, status);
const pathOf = (url: string) => { const u = new URL(url); return u.pathname.replace(`/${GRAPH_VERSION}`, ""); };

const env = { INSTAGRAM_APP_ID: "app123", INSTAGRAM_APP_SECRET: "sec456" } as unknown as NodeJS.ProcessEnv;
const token: TokenSet = { accessToken: "IGAA.secret", expiresAt: Date.now() + 30 * 86_400_000, scopes: INSTAGRAM_SCOPES, extra: { userId: "1784100" } };
const fast = createInstagram({ pollIntervalMs: 0, pollTimeoutMs: 5000 });
const input = (extra: Partial<PublishInput> = {}): PublishInput => ({
  filePath: "/tmp/x.mp4", fileSizeBytes: 1234, publicVideoUrl: "https://media.example/signed/x.mp4?sig=abc",
  title: "Thrown or dropped?", description: "Which lands first? #physics", disclosures: { aiVoice: true, aiVisuals: false, branded: false }, ...extra,
});

describe("instagram: oauth", () => {
  it("uses graph.instagram.com with a pinned version", () => {
    expect(GRAPH).toBe(`https://graph.instagram.com/${GRAPH_VERSION}`);
    expect(GRAPH_VERSION).toMatch(/^v\d+\.0$/);
    expect(instagram.configured(env)).toBe(true);
    expect(instagram.configured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(instagram.envVars).toEqual(["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"]);
  });

  it("builds the Business Login authorize URL", () => {
    const url = new URL(instagram.authUrl({ state: "st", redirectUri: "https://studio.example/cb" }, env));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("app123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://studio.example/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("exchanges the code for a short-lived token, then a long-lived one, keeping user_id", async () => {
    const { f, calls } = mockFetch((c) => {
      if (c.url === "https://api.instagram.com/oauth/access_token") return json({ data: [{ access_token: "short", user_id: 1784100, permissions: "instagram_business_basic,instagram_business_content_publish" }] });
      if (pathOf(c.url) === "/access_token") return json({ access_token: "long.lived", token_type: "bearer", expires_in: 5183944 });
      throw new Error(`unexpected ${c.url}`);
    });
    const before = Date.now();
    const t = await instagram.exchangeCode({ code: "the-code", redirectUri: "https://studio.example/cb" }, env, f);
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].form).toEqual({ client_id: "app123", client_secret: "sec456", grant_type: "authorization_code", redirect_uri: "https://studio.example/cb", code: "the-code" });
    const long = new URL(calls[1].url);
    expect(long.origin + long.pathname).toBe(`${GRAPH}/access_token`);
    expect(long.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(long.searchParams.get("client_secret")).toBe("sec456");
    expect(long.searchParams.get("access_token")).toBe("short");
    expect(t.accessToken).toBe("long.lived");
    expect(t.refreshToken).toBeUndefined();
    expect(t.scopes).toEqual(["instagram_business_basic", "instagram_business_content_publish"]);
    expect(t.extra).toEqual({ userId: "1784100" });
    expect(t.expiresAt).toBeGreaterThanOrEqual(before + 5183944 * 1000);
  });

  it("accepts the flat token payload too and maps a bad code to auth", async () => {
    const { f } = mockFetch((c) => c.url.startsWith("https://api.instagram.com/") ? json({ access_token: "short", user_id: "99", permissions: ["instagram_business_basic"] }) : json({ access_token: "long", token_type: "bearer", expires_in: 5184000 }));
    const t = await instagram.exchangeCode({ code: "c", redirectUri: "https://x/cb" }, env, f);
    expect(t.extra).toEqual({ userId: "99" });
    expect(t.scopes).toEqual(["instagram_business_basic"]);
    const { f: bad } = mockFetch(() => json({ error_type: "OAuthException", code: 400, error_message: "Invalid authorization code" }, 400));
    const err = await instagram.exchangeCode({ code: "c", redirectUri: "https://x/cb" }, env, bad).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("auth");
    expect(err.message).toContain("Invalid authorization code");
  });

  it("refreshes a long-lived token with ig_refresh_token", async () => {
    const { f, calls } = mockFetch(() => json({ access_token: "refreshed", token_type: "bearer", expires_in: 5184000 }));
    const t = await instagram.refresh(token, env, f);
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe(`${GRAPH}/refresh_access_token`);
    expect(u.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(u.searchParams.get("access_token")).toBe("IGAA.secret");
    expect(t.accessToken).toBe("refreshed");
    expect(t.extra).toEqual({ userId: "1784100" });
    expect(t.expiresAt).toBeGreaterThan(Date.now() + 59 * 86_400_000);
  });

  it("refresh: too young is a no-op, expired or refused means reconnect", async () => {
    const { f, calls } = mockFetch(() => graphError(190));
    const young = { ...token, expiresAt: Date.now() + 60 * 86_400_000 - 1000 };
    expect(await instagram.refresh(young, env, f)).toBe(young);
    expect(calls).toHaveLength(0);
    const expired = await instagram.refresh({ ...token, expiresAt: Date.now() - 1 }, env, f).catch((e) => e);
    expect(expired.code).toBe("auth");
    expect(calls).toHaveLength(0);
    const refused = await instagram.refresh(token, env, f).catch((e) => e);
    expect(refused.code).toBe("auth");
    expect(refused.message).toMatch(/reconnect/i);
  });

  it("whoAmI accepts professional accounts and refuses personal ones", async () => {
    const { f, calls } = mockFetch(() => json({ id: "app-scoped", user_id: "1784100", username: "prism.science", name: "Prism", profile_picture_url: "https://scontent.cdninstagram.com/p.jpg", account_type: "MEDIA_CREATOR" }));
    const me = await instagram.whoAmI(token, f);
    expect(calls[0].url).toBe(`${GRAPH}/me?fields=user_id,username,name,profile_picture_url,account_type`);
    expect(calls[0].headers.authorization).toBe("Bearer IGAA.secret");
    expect(me).toEqual({ accountId: "1784100", handle: "@prism.science", displayName: "Prism", profileUrl: "https://www.instagram.com/prism.science/", avatarUrl: "https://scontent.cdninstagram.com/p.jpg" });
    const { f: biz } = mockFetch(() => json({ user_id: "1", username: "b", name: "B", account_type: "Business" }));
    expect((await instagram.whoAmI(token, biz)).handle).toBe("@b");
    const { f: personal } = mockFetch(() => json({ user_id: "2", username: "p", name: "P", account_type: "PERSONAL" }));
    const err = await instagram.whoAmI(token, personal).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("unsupported");
  });
});

describe("instagram: publish", () => {
  function router(o: { quotaUsed?: number; quotaTotal?: number; statuses?: string[]; statusText?: string } = {}) {
    const statuses = o.statuses ?? ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"];
    let polls = 0;
    return (c: Call) => {
      const p = pathOf(c.url);
      if (p === "/1784100/content_publishing_limit") return json({ data: [{ quota_usage: o.quotaUsed ?? 3, config: { quota_total: o.quotaTotal ?? 50, quota_duration: 86400 } }] });
      if (p === "/1784100/media") return json({ id: "container-1" });
      if (p === "/container-1") { const code = statuses[Math.min(polls++, statuses.length - 1)]; return json({ status_code: code, status: o.statusText ?? (code === "FINISHED" ? "Finished: Media has been uploaded and it is ready to be published." : code), id: "container-1" }); }
      if (p === "/1784100/media_publish") return json({ id: "media-9" });
      if (p === "/media-9") return json({ permalink: "https://www.instagram.com/reel/Cx1/", id: "media-9" });
      throw new Error(`unexpected ${c.method} ${c.url}`);
    };
  }

  it("runs the full Reels flow: limit, container, poll, publish, permalink", async () => {
    const { f, calls } = mockFetch(router());
    const progress: Array<[number, string]> = [];
    const r = await fast.publish(token, input(), (fr, msg) => { progress.push([fr, msg]); return true; }, f);
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      "GET /1784100/content_publishing_limit", "POST /1784100/media", "GET /container-1", "GET /container-1", "GET /container-1", "POST /1784100/media_publish", "GET /media-9",
    ]);
    expect(new URL(calls[0].url).searchParams.get("fields")).toBe("quota_usage,config");
    expect(calls[1].form).toEqual({ media_type: "REELS", video_url: "https://media.example/signed/x.mp4?sig=abc", caption: "Which lands first? #physics", share_to_feed: "true" });
    expect(calls[1].headers.authorization).toBe("Bearer IGAA.secret");
    expect(new URL(calls[2].url).searchParams.get("fields")).toBe("status_code,status");
    expect(calls[5].form).toEqual({ creation_id: "container-1" });
    expect(new URL(calls[6].url).searchParams.get("fields")).toBe("permalink,id");
    expect(calls.every((c) => !c.url.includes("IGAA.secret"))).toBe(true);   // token only in the header
    expect(r.status).toBe("published");
    expect(r.postId).toBe("media-9");
    expect(r.postUrl).toBe("https://www.instagram.com/reel/Cx1/");
    expect(r.note).toContain("4/50");
    const fractions = progress.map(([fr]) => fr);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it("needs publicVideoUrl", async () => {
    const { f, calls } = mockFetch(router());
    const err = await fast.publish(token, input({ publicVideoUrl: undefined }), () => true, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("invalid");
    expect(calls).toHaveLength(0);
    const http = await fast.publish(token, input({ publicVideoUrl: "http://plain.example/x.mp4" }), () => true, f).catch((e) => e);
    expect(http.code).toBe("invalid");
  });

  it("stops with quota when the 24 h limit is used up", async () => {
    const { f, calls } = mockFetch(router({ quotaUsed: 50, quotaTotal: 50 }));
    const err = await fast.publish(token, input(), () => true, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("quota");
    expect(err.retryable).toBe(true);
    expect(err.message).toContain("50/50");
    expect(calls).toHaveLength(1);
  });

  it("container ERROR → rejected with the status text", async () => {
    const { f, calls } = mockFetch(router({ statuses: ["IN_PROGRESS", "ERROR"], statusText: "Error: The video format is not supported." }));
    const err = await fast.publish(token, input(), () => true, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("rejected");
    expect(err.message).toContain("ERROR");
    expect(err.message).toContain("video format is not supported");
    expect(calls.some((c) => pathOf(c.url) === "/1784100/media_publish")).toBe(false);
    const { f: exp } = mockFetch(router({ statuses: ["EXPIRED"] }));
    const e2 = await fast.publish(token, input(), () => true, exp).catch((e) => e);
    expect(e2.code).toBe("rejected");
  });

  it("Graph error 190 → auth; rate-limit codes → quota; 5xx → network", async () => {
    const { f } = mockFetch(() => graphError(190, 401));
    const err = await fast.publish(token, input(), () => true, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("auth");
    const { f: f4 } = mockFetch(() => graphError(4, 400));
    expect((await fast.publish(token, input(), () => true, f4).catch((e) => e)).code).toBe("quota");
    const { f: fSub } = mockFetch(() => graphError(368, 400, { error_subcode: 2207051 }));
    const sub = await fast.publish(token, input(), () => true, fSub).catch((e) => e);
    expect(sub.code).toBe("quota"); expect(sub.retryable).toBe(true);
    const { f: f9007 } = mockFetch(() => graphError(9007, 400));
    expect((await fast.publish(token, input(), () => true, f9007).catch((e) => e)).code).toBe("rejected");
    const { f: f5 } = mockFetch(() => new Response("<html>502</html>", { status: 502 }));
    const net = await fast.publish(token, input(), () => true, f5).catch((e) => e);
    expect(net.code).toBe("network"); expect(net.retryable).toBe(true);
  });

  it("cancels before media_publish", async () => {
    const { f, calls } = mockFetch(router());
    const err = await fast.publish(token, input(), (_fr, msg) => !/Publishing/.test(msg), f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("cancelled");
    expect(calls.some((c) => pathOf(c.url) === "/1784100/media_publish")).toBe(false);
  });

  it("returns processing when the budget runs out; publishStatus publishes a FINISHED container", async () => {
    const slow = createInstagram({ pollIntervalMs: 0, pollTimeoutMs: 0 });
    const { f } = mockFetch(router({ statuses: ["IN_PROGRESS"] }));
    const r = await slow.publish(token, input(), () => true, f);
    expect(r.status).toBe("processing");
    expect(r.postId).toBe("container-1");
    expect(r.postUrl).toBe("");
    const { f: later, calls } = mockFetch(router({ statuses: ["FINISHED"] }));
    const r2 = await instagram.publishStatus!(token, "container-1", later);
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual(["GET /container-1", "POST /1784100/media_publish", "GET /media-9"]);
    expect(r2.status).toBe("published");
    expect(r2.postUrl).toBe("https://www.instagram.com/reel/Cx1/");
  });

  it("looks up the user id when the token has none", async () => {
    const rest = router();
    const { f, calls } = mockFetch((c) => pathOf(c.url) === "/me" ? json({ user_id: "1784100", username: "prism.science", account_type: "BUSINESS" }) : rest(c));
    const r = await fast.publish({ ...token, extra: undefined }, input(), () => true, f);
    expect(pathOf(calls[0].url)).toBe("/me");
    expect(r.status).toBe("published");
  });
});

describe("instagram: metrics", () => {
  it("reads insights, falling back to plays when views is rejected", async () => {
    const { f, calls } = mockFetch(() => json({ data: [
      { name: "views", period: "lifetime", values: [{ value: 1200 }], title: "Views", id: "media-9/insights/views/lifetime" },
      { name: "reach", period: "lifetime", values: [{ value: 900 }] },
      { name: "likes", period: "lifetime", values: [{ value: 40 }] },
      { name: "comments", period: "lifetime", values: [{ value: 5 }] },
      { name: "shares", period: "lifetime", values: [{ value: 7 }] },
      { name: "saved", period: "lifetime", values: [{ value: 11 }] },
    ] }));
    const m = await instagram.metrics!(token, "media-9", f);
    expect(calls[0].url).toBe(`${GRAPH}/media-9/insights?metric=views,reach,likes,comments,shares,saved`);
    expect(m).toMatchObject({ views: 1200, likes: 40, comments: 5, shares: 7 });
    const { f: old, calls: oldCalls } = mockFetch((c) => c.url.includes("metric=views") ? graphError(100, 400, { message: "(#100) metric[0] must be one of the following values: plays, ..." }) : json({ data: [{ name: "plays", total_value: { value: 300 } }, { name: "likes", total_value: { value: 2 } }] }));
    const m2 = await instagram.metrics!(token, "media-9", old);
    expect(oldCalls[1].url).toBe(`${GRAPH}/media-9/insights?metric=plays,reach,likes,comments,shares,saved`);
    expect(m2).toMatchObject({ views: 300, likes: 2 });
  });
});

describe("instagram: capabilities", () => {
  it("states the conditions", () => {
    expect(instagram.platform).toBe("instagram");
    expect(instagram.capabilities).toMatchObject({ directPublish: true, captionsUpload: false, thumbnail: false, scheduling: false, metrics: true });
    expect(instagram.capabilities.conditions).toMatch(/Business or Creator/);
    expect(instagram.capabilities.conditions).toMatch(/50 API-published posts/);
    expect(instagram.capabilities.conditions).toMatch(/public https URL/);
    expect(instagram.capabilities.conditions).toMatch(/60 days/);
  });
});
