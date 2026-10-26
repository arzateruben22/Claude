import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHUNK_SIZE, TIKTOK_SCOPES, chunkPlan, createTikTok, tiktok } from "../src/integrations/tiktok";
import { ConnectorError, type Fetch, type PublishInput, type TokenSet } from "../src/integrations/types";

// ---- a recording fetch mock -------------------------------------------------------------------------------------
interface Call { url: string; method: string; headers: Record<string, string>; body?: unknown; json?: any }
function mockFetch(route: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f: Fetch = async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const body = init?.body;
    let json: any;
    if (typeof body === "string" && headers["content-type"]?.includes("json")) { try { json = JSON.parse(body); } catch { json = undefined; } }
    const call: Call = { url: String(input), method: (init?.method ?? "GET").toUpperCase(), headers, body, json };
    calls.push(call);
    return route(call, calls.length);
  };
  return { f, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (data: unknown) => json({ data, error: { code: "ok", message: "", log_id: "L" } });
const apiError = (code: string, status = 400) => json({ data: {}, error: { code, message: `${code} happened`, log_id: "L" } }, status);

const env = { TIKTOK_CLIENT_KEY: "key123", TIKTOK_CLIENT_SECRET: "sec456" } as unknown as NodeJS.ProcessEnv;
const token: TokenSet = { accessToken: "act.secret", refreshToken: "rft.secret", expiresAt: Date.now() + 86_400_000, scopes: TIKTOK_SCOPES, extra: { openId: "open-1" } };
const creator = { creator_avatar_url: "https://p16.tiktokcdn.com/a.jpg", creator_username: "prism", creator_nickname: "Prism", privacy_level_options: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"], comment_disabled: false, duet_disabled: false, stitch_disabled: true, max_video_post_duration_sec: 600 };
const fast = createTikTok({ pollIntervalMs: 0, pollTimeoutMs: 5000 });

const MiB = 1024 * 1024;
let dir: string; let big: string; let small: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prism-tiktok-"));
  big = path.join(dir, "big.mp4");
  const pattern = Buffer.alloc(25 * MiB);
  for (let i = 0; i < pattern.length; i++) pattern[i] = i % 251;
  fs.writeFileSync(big, pattern);
  small = path.join(dir, "small.mp4");
  fs.writeFileSync(small, Buffer.alloc(1 * MiB + 5, 9));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const input = (filePath: string, extra: Partial<PublishInput> = {}): PublishInput => ({
  filePath, fileSizeBytes: fs.statSync(filePath).size, title: "Thrown or dropped?", description: "Which lands first? #physics",
  disclosures: { aiVoice: true, aiVisuals: false, branded: false }, ...extra,
});

describe("tiktok: oauth", () => {
  it("is configured only with both env vars", () => {
    expect(tiktok.configured(env)).toBe(true);
    expect(tiktok.configured({ TIKTOK_CLIENT_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(tiktok.envVars).toEqual(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]);
  });

  it("builds the v2 authorize URL (with PKCE when given)", () => {
    const url = new URL(tiktok.authUrl({ state: "st", redirectUri: "https://studio.example/cb", codeChallenge: "chal" }, env));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("key123");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,user.info.profile,video.publish,video.upload,video.list");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://studio.example/cb");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.href).toContain("scope=user.info.basic,user.info.profile,video.publish");   // literal commas
    const plain = new URL(tiktok.authUrl({ state: "s", redirectUri: "https://x/cb" }, env));
    expect(plain.searchParams.has("code_challenge")).toBe(false);
  });

  it("exchanges the code with a form POST and keeps open_id", async () => {
    const { f, calls } = mockFetch(() => json({ access_token: "act", refresh_token: "rft", open_id: "open-1", expires_in: 86400, refresh_expires_in: 31536000, scope: "user.info.basic,video.publish", token_type: "Bearer" }));
    const before = Date.now();
    const t = await tiktok.exchangeCode({ code: "the-code", redirectUri: "https://studio.example/cb", codeVerifier: "ver" }, env, f);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(String(calls[0].body));
    expect(Object.fromEntries(body)).toEqual({ client_key: "key123", client_secret: "sec456", code: "the-code", grant_type: "authorization_code", redirect_uri: "https://studio.example/cb", code_verifier: "ver" });
    expect(t.accessToken).toBe("act");
    expect(t.refreshToken).toBe("rft");
    expect(t.scopes).toEqual(["user.info.basic", "video.publish"]);
    expect(t.extra).toEqual({ openId: "open-1" });
    expect(t.expiresAt).toBeGreaterThanOrEqual(before + 86_400_000);
    expect(t.expiresAt).toBeLessThan(before + 86_400_000 + 5000);
  });

  it("maps a token error to auth without leaking the form", async () => {
    const { f } = mockFetch(() => json({ error: "invalid_grant", error_description: "code expired", log_id: "L" }, 400));
    const err = await tiktok.exchangeCode({ code: "x", redirectUri: "https://x/cb" }, env, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("auth");
    expect(err.message).toContain("invalid_grant");
    expect(JSON.stringify(err.raw)).not.toContain("sec456");
  });

  it("refreshes with grant_type=refresh_token and keeps extra", async () => {
    const { f, calls } = mockFetch(() => json({ access_token: "act2", refresh_token: "rft2", open_id: "open-1", expires_in: 86400, scope: "user.info.basic,video.publish,video.upload", token_type: "Bearer" }));
    const t = await tiktok.refresh({ ...token, extra: { openId: "open-1", handle: "prism" } }, env, f);
    const body = Object.fromEntries(new URLSearchParams(String(calls[0].body)));
    expect(body).toEqual({ client_key: "key123", client_secret: "sec456", grant_type: "refresh_token", refresh_token: "rft.secret" });
    expect(t.accessToken).toBe("act2");
    expect(t.refreshToken).toBe("rft2");
    expect(t.extra).toEqual({ openId: "open-1", handle: "prism" });
  });

  it("whoAmI reads user/info and builds the handle and profile URL", async () => {
    const { f, calls } = mockFetch(() => ok({ user: { open_id: "open-1", union_id: "u", avatar_url: "https://p16.tiktokcdn.com/a.jpg", display_name: "Prism", username: "prism", profile_deep_link: "https://vm.tiktok.com/x/" } }));
    const me = await tiktok.whoAmI(token, f);
    expect(calls[0].url).toBe("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,profile_deep_link");
    expect(calls[0].headers.authorization).toBe("Bearer act.secret");
    expect(me).toEqual({ accountId: "open-1", handle: "@prism", displayName: "Prism", profileUrl: "https://www.tiktok.com/@prism", avatarUrl: "https://p16.tiktokcdn.com/a.jpg" });
  });

  it("whoAmI falls back to creator_info for the handle without user.info.profile", async () => {
    const { f, calls } = mockFetch((c) => c.url.includes("/user/info/") ? ok({ user: { open_id: "open-1", display_name: "Prism" } }) : ok(creator));
    const me = await tiktok.whoAmI({ ...token, scopes: ["user.info.basic", "video.publish"] }, f);
    expect(calls[0].url).toBe("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name");
    expect(calls[1].url).toBe("https://open.tiktokapis.com/v2/post/publish/creator_info/query/");
    expect(me.handle).toBe("@prism");
    expect(me.profileUrl).toBe("https://www.tiktok.com/@prism");
  });

  it("maps API error codes", async () => {
    for (const [code, expected, retryable] of [["access_token_invalid", "auth", false], ["scope_not_authorized", "auth", false], ["rate_limit_exceeded", "quota", true], ["spam_risk_too_many_posts", "quota", false], ["invalid_params", "rejected", false]] as const) {
      const { f } = mockFetch(() => apiError(code, code === "rate_limit_exceeded" ? 429 : 401));
      const err = await tiktok.whoAmI(token, f).catch((e) => e);
      expect(err, code).toBeInstanceOf(ConnectorError);
      expect(err.code, code).toBe(expected);
      expect(err.retryable, code).toBe(retryable);
    }
    const { f: down } = mockFetch(() => new Response("bad gateway", { status: 502 }));
    const e5 = await tiktok.whoAmI(token, down).catch((e) => e);
    expect(e5.code).toBe("network"); expect(e5.retryable).toBe(true);
    const { f: thrown } = mockFetch(() => { throw new TypeError("fetch failed"); });
    const eT = await tiktok.whoAmI(token, thrown).catch((e) => e);
    expect(eT.code).toBe("network"); expect(eT.retryable).toBe(true);
  });
});

describe("tiktok: chunk plan", () => {
  it("uses floor division; the last chunk absorbs the remainder; small files are one chunk", () => {
    expect(chunkPlan(25 * MiB)).toEqual({ chunkSize: 10 * MiB, count: 2, ranges: [[0, 10 * MiB - 1], [10 * MiB, 25 * MiB - 1]] });
    expect(chunkPlan(50_000_123, 10_000_000).count).toBe(5);          // TikTok's own worked example
    expect(chunkPlan(50_000_123, 10_000_000).ranges[4]).toEqual([40_000_000, 50_000_122]);
    expect(chunkPlan(3 * MiB)).toEqual({ chunkSize: 3 * MiB, count: 1, ranges: [[0, 3 * MiB - 1]] });
    expect(chunkPlan(10 * MiB)).toEqual({ chunkSize: 10 * MiB, count: 1, ranges: [[0, 10 * MiB - 1]] });
    expect(CHUNK_SIZE).toBe(10 * MiB);
    expect(() => chunkPlan(0)).toThrow(ConnectorError);
  });
});

describe("tiktok: inbox upload", () => {
  it("inits, PUTs 2 chunks (10 MiB + 15 MiB) with Content-Range, polls to SEND_TO_USER_INBOX", async () => {
    const size = 25 * MiB;
    let statusCalls = 0;
    const { f, calls } = mockFetch((c) => {
      if (c.url.endsWith("/creator_info/query/")) return ok(creator);
      if (c.url.endsWith("/post/publish/inbox/video/init/")) return ok({ publish_id: "v_inbox_1", upload_url: "https://upload.example/p/1" });
      if (c.url.startsWith("https://upload.example/")) {
        const body = c.body as Uint8Array;
        const [, a, b, total] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(c.headers["content-range"]!)!.map(Number);
        expect(total).toBe(size);
        expect(body.length).toBe(b - a + 1);
        expect(body[0]).toBe(a % 251);                       // the right slice of the file was read
        expect(body[body.length - 1]).toBe(b % 251);
        return new Response(null, { status: b === size - 1 ? 201 : 206 });
      }
      if (c.url.endsWith("/post/publish/status/fetch/")) { statusCalls++; return ok(statusCalls === 1 ? { status: "PROCESSING_UPLOAD", uploaded_bytes: size } : { status: "SEND_TO_USER_INBOX", publicaly_available_post_id: [] }); }
      throw new Error(`unexpected ${c.method} ${c.url}`);
    });
    const progress: number[] = [];
    const r = await fast.publish(token, input(big), (fr) => { progress.push(fr); return true; }, f);

    const init = calls.find((c) => c.url.endsWith("/inbox/video/init/"))!;
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer act.secret");
    expect(init.headers["content-type"]).toContain("application/json");
    expect(init.json).toEqual({ source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: 10 * MiB, total_chunk_count: 2 } });

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts.map((p) => p.headers["content-range"])).toEqual([`bytes 0-${10 * MiB - 1}/${size}`, `bytes ${10 * MiB}-${size - 1}/${size}`]);
    expect(puts.map((p) => p.headers["content-length"])).toEqual([String(10 * MiB), String(15 * MiB)]);
    expect(puts.every((p) => p.headers["content-type"] === "video/mp4")).toBe(true);
    expect(puts.every((p) => p.url === "https://upload.example/p/1")).toBe(true);

    const status = calls.filter((c) => c.url.endsWith("/status/fetch/"));
    expect(status).toHaveLength(2);
    expect(status[0].json).toEqual({ publish_id: "v_inbox_1" });
    expect(calls.some((c) => c.url.endsWith("/post/publish/video/init/"))).toBe(false);   // never the direct endpoint

    expect(r.status).toBe("inbox");
    expect(r.postId).toBe("v_inbox_1");
    expect(r.postUrl).toBe("");
    expect(r.note).toMatch(/TikTok app/);
    expect(r.note).toContain("600 s");
    expect(progress.length).toBeGreaterThanOrEqual(4);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);   // monotonic
    expect(Math.max(...progress)).toBeLessThanOrEqual(1);
  });

  it("refuses when the file on disk does not match the approved size", async () => {
    const { f, calls } = mockFetch(() => ok(creator));
    const err = await fast.publish(token, input(small, { fileSizeBytes: 1 }), () => true, f).catch((e) => e);
    expect(err.code).toBe("invalid");
    expect(calls).toHaveLength(0);
  });
});

describe("tiktok: direct post", () => {
  function directRouter(o: { initError?: string; privacyOptions?: string[]; postId?: string }) {
    let statusCalls = 0;
    return (c: Call) => {
      if (c.url.endsWith("/creator_info/query/")) return ok({ ...creator, privacy_level_options: o.privacyOptions ?? creator.privacy_level_options });
      if (c.url.endsWith("/post/publish/video/init/")) return o.initError ? apiError(o.initError, 403) : ok({ publish_id: "v_pub_1", upload_url: "https://upload.example/p/2" });
      if (c.url.startsWith("https://upload.example/")) return new Response(null, { status: 201 });
      if (c.url.endsWith("/status/fetch/")) { statusCalls++; return ok(statusCalls < 3 ? { status: statusCalls === 1 ? "PROCESSING_UPLOAD" : "PROCESSING_DOWNLOAD" } : { status: "PUBLISH_COMPLETE", publicaly_available_post_id: o.postId ? [o.postId] : [] }); }
      throw new Error(`unexpected ${c.method} ${c.url}`);
    };
  }

  it("SELF_ONLY → private, with the documented post_info", async () => {
    const { f, calls } = mockFetch(directRouter({}));
    const r = await fast.publish(token, input(small, { mode: "direct", privacy: "private", disclosures: { aiVoice: false, aiVisuals: true, branded: false } }), () => true, f);
    const init = calls.find((c) => c.url.endsWith("/post/publish/video/init/"))!;
    expect(init.json).toEqual({
      post_info: { title: "Which lands first? #physics", privacy_level: "SELF_ONLY", disable_duet: false, disable_comment: false, disable_stitch: true, video_cover_timestamp_ms: 1000, is_aigc: true, brand_content_toggle: false, brand_organic_toggle: false },
      source_info: { source: "FILE_UPLOAD", video_size: MiB + 5, chunk_size: MiB + 5, total_chunk_count: 1 },
    });
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].headers["content-range"]).toBe(`bytes 0-${MiB + 4}/${MiB + 5}`);
    expect(r.status).toBe("private");
    expect(r.postId).toBe("v_pub_1");
    expect(r.note).toMatch(/SELF_ONLY/);
  });

  it("PUBLIC_TO_EVERYONE → published with the post URL from the handle", async () => {
    const { f, calls } = mockFetch(directRouter({ postId: "7300000000000000001" }));
    const r = await fast.publish({ ...token, extra: { openId: "open-1", handle: "@prism" } }, input(small, { mode: "direct", privacy: "public", disclosures: { aiVoice: false, aiVisuals: false, branded: true } }), () => true, f);
    const init = calls.find((c) => c.url.endsWith("/post/publish/video/init/"))!;
    expect(init.json.post_info.privacy_level).toBe("PUBLIC_TO_EVERYONE");
    expect(init.json.post_info.is_aigc).toBe(false);
    expect(init.json.post_info.brand_content_toggle).toBe(true);
    expect(r.status).toBe("published");
    expect(r.postId).toBe("7300000000000000001");
    expect(r.postUrl).toBe("https://www.tiktok.com/@prism/video/7300000000000000001");
  });

  it("without a stored handle, uses creator_username for the URL", async () => {
    const { f } = mockFetch(directRouter({ postId: "42" }));
    const r = await fast.publish(token, input(small, { mode: "direct", privacy: "public" }), () => true, f);
    expect(r.postUrl).toBe("https://www.tiktok.com/@prism/video/42");
  });

  it("the unaudited error → ConnectorError rejected", async () => {
    const { f, calls } = mockFetch(directRouter({ initError: "unaudited_client_can_only_post_to_private_accounts" }));
    const err = await fast.publish(token, input(small, { mode: "direct", privacy: "public" }), () => true, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("rejected");
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/audit/);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("refuses a public post when TikTok does not offer PUBLIC_TO_EVERYONE (private account)", async () => {
    const { f, calls } = mockFetch(directRouter({ privacyOptions: ["FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"] }));
    const err = await fast.publish(token, input(small, { mode: "direct", privacy: "public" }), () => true, f).catch((e) => e);
    expect(err.code).toBe("rejected");
    expect(calls).toHaveLength(1);
  });

  it("FAILED → rejected with the fail reason", async () => {
    const { f } = mockFetch((c) => {
      if (c.url.endsWith("/creator_info/query/")) return ok(creator);
      if (c.url.endsWith("/video/init/")) return ok({ publish_id: "p", upload_url: "https://upload.example/p/3" });
      if (c.method === "PUT") return new Response(null, { status: 201 });
      return ok({ status: "FAILED", fail_reason: "frame_rate_check_failed" });
    });
    const err = await fast.publish(token, input(small, { mode: "direct" }), () => true, f).catch((e) => e);
    expect(err.code).toBe("rejected");
    expect(err.message).toContain("frame_rate_check_failed");
  });

  it("returns processing when the time budget runs out, and publishStatus finishes it", async () => {
    const slow = createTikTok({ pollIntervalMs: 0, pollTimeoutMs: 0 });
    const { f } = mockFetch((c) => {
      if (c.url.endsWith("/creator_info/query/")) return ok(creator);
      if (c.url.endsWith("/video/init/")) return ok({ publish_id: "p9", upload_url: "https://upload.example/p/9" });
      if (c.method === "PUT") return new Response(null, { status: 201 });
      return ok({ status: "PROCESSING_DOWNLOAD" });
    });
    const r = await slow.publish(token, input(small, { mode: "direct" }), () => true, f);
    expect(r.status).toBe("processing");
    expect(r.postId).toBe("p9");
    const { f: later, calls } = mockFetch(() => ok({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["77"] }));
    const r2 = await tiktok.publishStatus!({ ...token, extra: { handle: "prism" } }, "p9", later);
    expect(calls[0].json).toEqual({ publish_id: "p9" });
    expect(r2.status).toBe("published");
    expect(r2.postUrl).toBe("https://www.tiktok.com/@prism/video/77");
  });
});

describe("tiktok: cancellation", () => {
  it("stops with invalid/cancelled when onProgress returns false, before any upload", async () => {
    const { f, calls } = mockFetch((c) => {
      if (c.url.endsWith("/creator_info/query/")) return ok(creator);
      if (c.url.endsWith("/init/")) return ok({ publish_id: "p", upload_url: "https://upload.example/p/4" });
      throw new Error(`unexpected ${c.method} ${c.url}`);
    });
    let n = 0;
    const err = await fast.publish(token, input(big), async () => ++n < 2, f).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("cancelled");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("stops between chunks and closes the file", async () => {
    let puts = 0;
    const { f } = mockFetch((c) => {
      if (c.url.endsWith("/creator_info/query/")) return ok(creator);
      if (c.url.endsWith("/init/")) return ok({ publish_id: "p", upload_url: "https://upload.example/p/5" });
      if (c.method === "PUT") { puts++; return new Response(null, { status: 206 }); }
      throw new Error(`unexpected ${c.method} ${c.url}`);
    });
    const err = await fast.publish(token, input(big), (_fr, msg) => !/chunk 1 of 2/.test(msg), f).catch((e) => e);
    expect(err.message).toBe("cancelled");
    expect(puts).toBe(1);
    fs.rmSync(big);                       // the descriptor was closed, so the file can go
    const pattern = Buffer.alloc(25 * MiB);
    for (let i = 0; i < pattern.length; i++) pattern[i] = i % 251;
    fs.writeFileSync(big, pattern);
  });
});

describe("tiktok: metrics", () => {
  it("queries the Display API for the post's counters", async () => {
    const { f, calls } = mockFetch(() => ok({ videos: [{ id: "77", like_count: 12, comment_count: 3, share_count: 1, view_count: 480 }] }));
    const m = await tiktok.metrics!(token, "77", f);
    expect(calls[0].url).toBe("https://open.tiktokapis.com/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count");
    expect(calls[0].json).toEqual({ filters: { video_ids: ["77"] } });
    expect(m).toMatchObject({ views: 480, likes: 12, comments: 3, shares: 1 });
    expect(typeof m.retrievedAt).toBe("string");
  });
});

describe("tiktok: capabilities", () => {
  it("is honest about the audit", () => {
    expect(tiktok.platform).toBe("tiktok");
    expect(tiktok.capabilities).toMatchObject({ directPublish: false, captionsUpload: false, thumbnail: false, scheduling: false, metrics: true });
    expect(tiktok.capabilities.conditions).toMatch(/SELF_ONLY/);
    expect(tiktok.capabilities.conditions).toMatch(/inbox/);
    expect(tiktok.capabilities.conditions).toMatch(/is_aigc/);
  });
});
