// The YouTube connector against a mocked fetch: no network, no real tokens. The upload tests use a ~20 MiB file in
// the OS temp directory so the 8 MiB chunking, the 308 resume and the on-disk reads are exercised for real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { uploadTuning, youtube } from "../src/integrations/youtube";
import { ConnectorError, type PublishInput, type TokenSet } from "../src/integrations/types";

const asEnv = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const env = asEnv({ GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "shh" });
const token = (): TokenSet => ({ accessToken: "ya29.test", refreshToken: "1//refresh", expiresAt: Date.now() + 3_600_000, scopes: [], extra: { channelId: "UC1" } });

interface Call { url: URL; method: string; headers: Record<string, string>; bytes: Buffer | null }
type Route = (c: Call, n: number) => Response | Promise<Response>;

/** A fetch stand-in that records every call (lower-cased headers, body snapshot) and answers through `route`. */
function server(route: Route) {
  const calls: Call[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    const body = init?.body ?? null;
    const bytes = typeof body === "string" ? Buffer.from(body) : body instanceof Uint8Array ? Buffer.from(body) : null;
    const c: Call = { url, method: init?.method ?? "GET", headers, bytes };
    calls.push(c);
    return route(c, calls.length);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const empty = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });
const apiError = (code: number, reason: string, message = reason) => json(code, { error: { code, message, errors: [{ domain: "youtube.quota", reason, message }] } });
const failure = async (p: Promise<unknown>): Promise<ConnectorError> => {
  try { await p; } catch (e) { if (e instanceof ConnectorError) return e; throw e; }
  throw new Error("expected a ConnectorError");
};

// ---------------------------------------------------------------- the 20 MiB test file

const SIZE = 20 * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;
let dir: string, filePath: string, coverPath: string;
const savedDelays = uploadTuning.retryDelaysMs;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prism-youtube-"));
  filePath = path.join(dir, "final.mp4");
  const buf = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i++) buf[i] = i % 251;           // byte at offset p is p % 251, so chunk reads can be checked
  fs.writeFileSync(filePath, buf);
  coverPath = path.join(dir, "cover.jpg");
  fs.writeFileSync(coverPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]));
  uploadTuning.retryDelaysMs = [0, 0, 0];
});
afterAll(() => {
  uploadTuning.retryDelaysMs = savedDelays;
  fs.rmSync(dir, { recursive: true, force: true });
});

const input = (o: Partial<PublishInput> = {}): PublishInput => ({
  filePath, fileSizeBytes: SIZE,
  title: "Which ball lands first?", description: "Drop two balls. #physics", tags: ["physics", "gravity"],
  disclosures: { aiVoice: true, aiVisuals: true, branded: false }, privacy: "public", languageCode: "en",
  ...o,
});

interface ChunkSeen { start: number; end: number; len: number; first: number; last: number; serverHad: number }

/** A fake YouTube: resumable session, chunk PUTs with 308/Range, captions and thumbnails. */
function ytServer(o: { acceptFirstOnly?: number; failChunk?: number; captions?: number; thumb?: number; storedPrivacy?: string } = {}) {
  const session = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=AEnB2Uq";
  const video = () => ({ id: "vid123", status: { privacyStatus: o.storedPrivacy ?? "public", uploadStatus: "uploaded" } });
  const chunks: ChunkSeen[] = [];
  let received = 0, chunkPuts = 0;
  const { f, calls } = server((c) => {
    if (c.method === "POST" && c.url.pathname === "/upload/youtube/v3/videos") return empty(200, { location: session });
    if (c.method === "PUT" && c.url.href === session) {
      const cr = c.headers["content-range"] ?? "";
      if (/^bytes \*\/\d+$/.test(cr)) return received >= SIZE ? json(200, video()) : empty(308, received ? { range: `bytes=0-${received - 1}` } : {});
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr);
      if (!m) return json(400, { error: { code: 400, message: `bad Content-Range ${cr}` } });
      const start = Number(m[1]), end = Number(m[2]), b = c.bytes ?? Buffer.alloc(0);
      chunks.push({ start, end, len: b.length, first: b[0], last: b[b.length - 1], serverHad: received });
      chunkPuts++;
      if (o.failChunk === chunkPuts) return empty(503);
      received = o.acceptFirstOnly && chunkPuts === 1 ? o.acceptFirstOnly : end + 1;
      return received >= SIZE ? json(200, video()) : empty(308, { range: `bytes=0-${received - 1}` });
    }
    if (c.method === "POST" && c.url.pathname === "/upload/youtube/v3/captions")
      return o.captions ? apiError(o.captions, "forbidden", "caption rejected") : json(200, { id: "cap1" });
    if (c.method === "POST" && c.url.pathname === "/upload/youtube/v3/thumbnails/set")
      return o.thumb ? json(o.thumb, { error: { code: o.thumb, message: "The channel is not eligible for custom thumbnails.", errors: [{ reason: "forbidden" }] } }) : json(200, { items: [{ default: { url: "https://i.ytimg.com/vi/vid123/default.jpg" } }] });
    return json(404, { error: { code: 404, message: `unexpected ${c.method} ${c.url.href}` } });
  });
  return { f, calls, chunks, session };
}

// ---------------------------------------------------------------- tests

describe("youtube: configuration and OAuth", () => {
  it("is configured only with both Google credentials", () => {
    expect(youtube.envVars).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    expect(youtube.configured(env)).toBe(true);
    expect(youtube.configured(asEnv({ GOOGLE_CLIENT_ID: "x" }))).toBe(false);
    expect(youtube.configured(asEnv({}))).toBe(false);
  });

  it("builds the consent URL with every parameter, PKCE included", () => {
    const u = new URL(youtube.authUrl({ state: "st4te", redirectUri: "https://studio.example/api/oauth/youtube", codeChallenge: "ch4ll" }, env));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "cid.apps.googleusercontent.com",
      redirect_uri: "https://studio.example/api/oauth/youtube",
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: "st4te",
      code_challenge: "ch4ll",
      code_challenge_method: "S256",
    });
    const plain = new URL(youtube.authUrl({ state: "s", redirectUri: "https://studio.example/cb" }, env));
    expect(plain.searchParams.has("code_challenge")).toBe(false);
    expect(plain.searchParams.has("code_challenge_method")).toBe(false);
    expect(() => youtube.authUrl({ state: "s", redirectUri: "https://x" }, asEnv({}))).toThrow(ConnectorError);
  });

  it("exchanges the code with a form-encoded POST and builds the token set", async () => {
    const { f, calls } = server(() => json(200, { access_token: "ya29.new", expires_in: 3600, refresh_token: "1//r", scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", token_type: "Bearer" }));
    const before = Date.now();
    const t = await youtube.exchangeCode({ code: "4/0Acode", redirectUri: "https://studio.example/cb", codeVerifier: "v3rifier" }, env, f);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.href).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(calls[0].bytes!.toString()))).toEqual({
      code: "4/0Acode", client_id: "cid.apps.googleusercontent.com", client_secret: "shh", redirect_uri: "https://studio.example/cb", grant_type: "authorization_code", code_verifier: "v3rifier",
    });
    expect(t.accessToken).toBe("ya29.new");
    expect(t.refreshToken).toBe("1//r");
    expect(t.scopes).toEqual(["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]);
    expect(t.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000 - 60_000);
    expect(t.expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000 - 60_000);
    expect(t.extra).toEqual({});
  });

  it("refreshes with the stored refresh token and keeps it when Google omits it", async () => {
    const { f, calls } = server(() => json(200, { access_token: "ya29.fresh", expires_in: 3599, token_type: "Bearer" }));
    const t = await youtube.refresh(token(), env, f);
    expect(Object.fromEntries(new URLSearchParams(calls[0].bytes!.toString()))).toEqual({ client_id: "cid.apps.googleusercontent.com", client_secret: "shh", refresh_token: "1//refresh", grant_type: "refresh_token" });
    expect(t.accessToken).toBe("ya29.fresh");
    expect(t.refreshToken).toBe("1//refresh");
    expect(t.extra).toEqual({ channelId: "UC1" });
    const noRefresh = await failure(youtube.refresh({ ...token(), refreshToken: undefined }, env, f));
    expect(noRefresh.code).toBe("auth");
  });

  it("maps invalid_grant on refresh to an auth error", async () => {
    const { f } = server(() => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }));
    const e = await failure(youtube.refresh(token(), env, f));
    expect(e.code).toBe("auth");
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("expired or revoked");
  });
});

describe("youtube: whoAmI", () => {
  const channel = (snippet: Record<string, unknown>) => json(200, { items: [{ id: "UC123", snippet: { title: "Rest Frame", thumbnails: { default: { url: "https://yt3.ggpht.com/a.jpg" } }, ...snippet } }] });

  it("uses the @handle for the handle and profile URL", async () => {
    const { f, calls } = server(() => channel({ customUrl: "@restframe" }));
    const t = token();
    const me = await youtube.whoAmI(t, f);
    expect(calls[0].url.href).toBe("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true");
    expect(calls[0].headers.authorization).toBe("Bearer ya29.test");
    expect(me).toEqual({ accountId: "UC123", displayName: "Rest Frame", handle: "@restframe", profileUrl: "https://www.youtube.com/@restframe", avatarUrl: "https://yt3.ggpht.com/a.jpg" });
    expect(t.extra?.channelId).toBe("UC123");
  });

  it("falls back to the title and the /channel/ URL without a custom URL, and adds a missing @", async () => {
    const none = server(() => channel({}));
    expect(await youtube.whoAmI(token(), none.f)).toMatchObject({ handle: "Rest Frame", profileUrl: "https://www.youtube.com/channel/UC123" });
    const bare = server(() => channel({ customUrl: "restframe" }));
    expect(await youtube.whoAmI(token(), bare.f)).toMatchObject({ handle: "@restframe", profileUrl: "https://www.youtube.com/restframe" });
    const empty = server(() => json(200, { items: [] }));
    expect((await failure(youtube.whoAmI(token(), empty.f))).code).toBe("rejected");
  });
});

describe("youtube: publish (resumable upload)", () => {
  it("opens the session with the right metadata, PUTs 8 MiB chunks from disk, adds captions and thumbnail", async () => {
    const yt = ytServer();
    const progress: number[] = [];
    const srt = "1\n00:00:00,120 --> 00:00:01,685\nWhich ball\n";
    const r = await youtube.publish(token(), input({ captionsSrt: srt, coverPath }), (fr, msg) => { progress.push(fr); expect(msg).toMatch(/MiB/); return true; }, yt.f);

    // 1) the resumable init
    const init = yt.calls[0];
    expect(init.method).toBe("POST");
    expect(init.url.origin + init.url.pathname).toBe("https://www.googleapis.com/upload/youtube/v3/videos");
    expect(init.url.searchParams.get("uploadType")).toBe("resumable");
    expect(init.url.searchParams.get("part")).toBe("snippet,status");
    expect(init.headers.authorization).toBe("Bearer ya29.test");
    expect(init.headers["content-type"]).toMatch(/^application\/json/);
    expect(init.headers["x-upload-content-type"]).toBe("video/mp4");
    expect(init.headers["x-upload-content-length"]).toBe(String(SIZE));
    expect(JSON.parse(init.bytes!.toString())).toEqual({
      snippet: { title: "Which ball lands first?", description: "Drop two balls. #physics", tags: ["physics", "gravity"], categoryId: "27", defaultLanguage: "en", defaultAudioLanguage: "en" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: true, embeddable: true, license: "youtube" },
    });

    // 2) the chunks: contiguous Content-Ranges, bytes read from the right offsets
    const puts = yt.calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => c.headers["content-range"])).toEqual([
      `bytes 0-${CHUNK - 1}/${SIZE}`,
      `bytes ${CHUNK}-${2 * CHUNK - 1}/${SIZE}`,
      `bytes ${2 * CHUNK}-${SIZE - 1}/${SIZE}`,
    ]);
    for (const c of puts) { expect(c.url.href).toBe(yt.session); expect(c.headers.authorization).toBe("Bearer ya29.test"); expect(c.headers["content-type"]).toBe("video/mp4"); }
    for (const ch of yt.chunks) {
      expect(ch.len).toBe(ch.end - ch.start + 1);
      expect(ch.first).toBe(ch.start % 251);
      expect(ch.last).toBe(ch.end % 251);
    }
    expect(progress).toEqual([CHUNK / SIZE, (2 * CHUNK) / SIZE, 1]);

    // 3) captions as multipart/related with the SRT text
    const cap = yt.calls.find((c) => c.url.pathname === "/upload/youtube/v3/captions")!;
    expect(cap.method).toBe("POST");
    expect(cap.url.searchParams.get("uploadType")).toBe("multipart");
    expect(cap.url.searchParams.get("part")).toBe("snippet");
    const boundary = /^multipart\/related; boundary=(\S+)$/.exec(cap.headers["content-type"])![1];
    const body = cap.bytes!.toString();
    const parts = body.split(`--${boundary}`);
    expect(parts).toHaveLength(4);                                 // "", json part, srt part, "--"
    expect(parts[1]).toContain("Content-Type: application/json");
    expect(JSON.parse(parts[1].split("\r\n\r\n")[1].trim())).toEqual({ snippet: { videoId: "vid123", language: "en", name: "English", isDraft: false } });
    expect(parts[2]).toContain("Content-Type: application/octet-stream");
    expect(parts[2].split("\r\n\r\n")[1]).toBe(`${srt}\r\n`);
    expect(parts[3]).toBe("--");

    // 4) the thumbnail
    const thumb = yt.calls.find((c) => c.url.pathname === "/upload/youtube/v3/thumbnails/set")!;
    expect(thumb.method).toBe("POST");
    expect(thumb.url.searchParams.get("videoId")).toBe("vid123");
    expect(thumb.headers["content-type"]).toBe("image/jpeg");
    expect(thumb.bytes!.equals(fs.readFileSync(coverPath))).toBe(true);

    expect(r.status).toBe("processing");
    expect(r.postId).toBe("vid123");
    expect(r.postUrl).toBe("https://www.youtube.com/watch?v=vid123");
    expect(r.note).toContain("captions attached (en)");
    expect(r.note).toContain("thumbnail set");
    expect(yt.calls).toHaveLength(1 + 3 + 1 + 1);
  });

  it("publishes private with containsSyntheticMedia false and skips captions/thumbnail when there are none", async () => {
    const yt = ytServer({ storedPrivacy: "private" });
    const r = await youtube.publish(token(), input({ privacy: "private", disclosures: { aiVoice: false, aiVisuals: false, branded: false }, tags: undefined, languageCode: undefined }), () => true, yt.f);
    const meta = JSON.parse(yt.calls[0].bytes!.toString());
    expect(meta.status.privacyStatus).toBe("private");
    expect(meta.status.containsSyntheticMedia).toBe(false);
    expect(meta.snippet).toEqual({ title: "Which ball lands first?", description: "Drop two balls. #physics", categoryId: "27" });
    expect(r.status).toBe("private");
    expect(r.note).toBe("uploaded as private");
    expect(yt.calls).toHaveLength(4);
  });

  it("defaults to private when no privacy is given", async () => {
    const yt = ytServer({ storedPrivacy: "private" });
    const r = await youtube.publish(token(), input({ privacy: undefined }), () => true, yt.f);
    expect(JSON.parse(yt.calls[0].bytes!.toString()).status.privacyStatus).toBe("private");
    expect(r.status).toBe("private");
  });

  it("reports private when YouTube stores a requested-public upload as private (unaudited project)", async () => {
    const yt = ytServer({ storedPrivacy: "private" });
    const r = await youtube.publish(token(), input(), () => true, yt.f);
    expect(r.status).toBe("private");
    expect(r.note).toMatch(/stored the video as private/);
    expect(r.note).toMatch(/audit/);
  });

  it("resumes from the Range header when a 308 reports a partial chunk", async () => {
    const partial = 4 * 1024 * 1024;
    const yt = ytServer({ acceptFirstOnly: partial });
    const progress: number[] = [];
    await youtube.publish(token(), input(), (fr) => { progress.push(fr); return true; }, yt.f);
    expect(yt.calls.filter((c) => c.method === "PUT").map((c) => c.headers["content-range"])).toEqual([
      `bytes 0-${CHUNK - 1}/${SIZE}`,
      `bytes ${partial}-${partial + CHUNK - 1}/${SIZE}`,
      `bytes ${partial + CHUNK}-${SIZE - 1}/${SIZE}`,
    ]);
    for (const ch of yt.chunks) { expect(ch.start).toBe(ch.serverHad); expect(ch.first).toBe(ch.start % 251); expect(ch.last).toBe(ch.end % 251); }
    expect(progress).toEqual([partial / SIZE, (partial + CHUNK) / SIZE, 1]);
  });

  it("probes the session after a 5xx on a chunk and resumes where Google is", async () => {
    const yt = ytServer({ failChunk: 2 });
    const r = await youtube.publish(token(), input(), () => true, yt.f);
    expect(yt.calls.filter((c) => c.method === "PUT").map((c) => c.headers["content-range"])).toEqual([
      `bytes 0-${CHUNK - 1}/${SIZE}`,
      `bytes ${CHUNK}-${2 * CHUNK - 1}/${SIZE}`,                  // 503
      `bytes */${SIZE}`,                                          // status probe: 308, Range up to CHUNK-1
      `bytes ${CHUNK}-${2 * CHUNK - 1}/${SIZE}`,                  // resent
      `bytes ${2 * CHUNK}-${SIZE - 1}/${SIZE}`,
    ]);
    expect(r.postId).toBe("vid123");
  });

  it("stops and throws 'cancelled' when onProgress returns false", async () => {
    const yt = ytServer();
    const e = await failure(youtube.publish(token(), input({ captionsSrt: "1\n00:00:00,000 --> 00:00:01,000\nx\n" }), () => false, yt.f));
    expect(e.code).toBe("invalid");
    expect(e.message).toBe("cancelled");
    expect(yt.calls.filter((c) => c.method === "PUT")).toHaveLength(1);
    expect(yt.calls.some((c) => c.url.pathname.endsWith("/captions"))).toBe(false);
  });

  it("keeps the publish when captions or the thumbnail fail, and explains a thumbnail 403", async () => {
    const yt = ytServer({ captions: 400, thumb: 403 });
    const r = await youtube.publish(token(), input({ captionsSrt: "1\n00:00:00,000 --> 00:00:01,000\nx\n", coverPath }), () => true, yt.f);
    expect(r.status).toBe("processing");
    expect(r.postId).toBe("vid123");
    expect(r.note).toContain("captions not attached: captions.insert: caption rejected");
    expect(r.note).toMatch(/thumbnail not set: the channel is not verified for custom thumbnails/);
  });

  it("refuses inputs that YouTube would reject after the upload", async () => {
    const yt = ytServer();
    expect((await failure(youtube.publish(token(), input({ title: "x".repeat(101) }), () => true, yt.f))).code).toBe("invalid");
    expect((await failure(youtube.publish(token(), input({ title: "<b>no</b>" }), () => true, yt.f))).code).toBe("invalid");
    expect((await failure(youtube.publish(token(), input({ fileSizeBytes: SIZE - 1 }), () => true, yt.f))).code).toBe("invalid");
    expect((await failure(youtube.publish(token(), input({ filePath: path.join(dir, "missing.mp4") }), () => true, yt.f))).code).toBe("invalid");
    expect(yt.calls).toHaveLength(0);
  });
});

describe("youtube: status, metrics and error mapping", () => {
  const videos = (v: Record<string, unknown>) => json(200, { items: [{ id: "vid123", ...v }] });

  it("maps publishStatus from privacy and processing", async () => {
    const done = server(() => videos({ status: { privacyStatus: "public", uploadStatus: "processed" }, processingDetails: { processingStatus: "succeeded" } }));
    const s1 = await youtube.publishStatus!(token(), "vid123", done.f);
    expect(done.calls[0].url.href).toBe("https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=vid123");
    expect(s1).toMatchObject({ status: "published", postId: "vid123", postUrl: "https://www.youtube.com/watch?v=vid123" });
    const busy = server(() => videos({ status: { privacyStatus: "public", uploadStatus: "uploaded" }, processingDetails: { processingStatus: "processing" } }));
    expect((await youtube.publishStatus!(token(), "vid123", busy.f)).status).toBe("processing");
    const priv = server(() => videos({ status: { privacyStatus: "private", uploadStatus: "processed" }, processingDetails: { processingStatus: "succeeded" } }));
    expect((await youtube.publishStatus!(token(), "vid123", priv.f)).status).toBe("private");
    const rejected = server(() => videos({ status: { privacyStatus: "public", uploadStatus: "rejected", rejectionReason: "copyright" } }));
    const e = await failure(youtube.publishStatus!(token(), "vid123", rejected.f));
    expect(e.code).toBe("rejected");
    expect(e.message).toContain("copyright");
  });

  it("reads view, like and comment counts", async () => {
    const { f, calls } = server(() => videos({ statistics: { viewCount: "1203", likeCount: "88", commentCount: "7", favoriteCount: "0" } }));
    const m = await youtube.metrics!(token(), "vid123", f);
    expect(calls[0].url.href).toBe("https://www.googleapis.com/youtube/v3/videos?part=statistics&id=vid123");
    expect(m).toMatchObject({ views: 1203, likes: 88, comments: 7 });
    expect(Number.isNaN(Date.parse(m.retrievedAt))).toBe(false);
  });

  it("maps 401 to auth", async () => {
    const { f } = server(() => json(401, { error: { code: 401, message: "Invalid Credentials", errors: [{ reason: "authError" }] } }));
    const e = await failure(youtube.whoAmI(token(), f));
    expect(e.code).toBe("auth");
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("Invalid Credentials");
  });

  it("maps 403 quotaExceeded to a non-retryable quota error that explains the daily units", async () => {
    const { f, calls } = server(() => apiError(403, "quotaExceeded", "The request cannot be completed because you have exceeded your quota."));
    const e = await failure(youtube.publish(token(), input(), () => true, f));
    expect(calls).toHaveLength(1);                                 // nothing uploaded
    expect(e.code).toBe("quota");
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("10,000");
    expect(e.message).toContain("1,600");
    const u = await failure(youtube.publish(token(), input(), () => true, server(() => apiError(403, "uploadLimitExceeded")).f));
    expect(u.code).toBe("quota");
  });

  it("maps a 403 without a quota reason to rejected, with the API's message", async () => {
    const { f } = server(() => json(403, { error: { code: 403, message: "The video is not embeddable.", errors: [{ reason: "forbidden" }] } }));
    const e = await failure(youtube.metrics!(token(), "vid123", f));
    expect(e.code).toBe("rejected");
    expect(e.message).toContain("The video is not embeddable.");
  });

  it("maps 5xx and thrown fetches to retryable network errors", async () => {
    const e500 = await failure(youtube.metrics!(token(), "vid123", server(() => new Response("Backend Error", { status: 500 })).f));
    expect(e500.code).toBe("network");
    expect(e500.retryable).toBe(true);
    const init500 = await failure(youtube.publish(token(), input(), () => true, server(() => empty(502)).f));
    expect(init500.code).toBe("network");
    expect(init500.retryable).toBe(true);
    const thrown = await failure(youtube.whoAmI(token(), server(() => { throw new TypeError("fetch failed"); }).f));
    expect(thrown.code).toBe("network");
    expect(thrown.retryable).toBe(true);
  });

  it("never puts the access token in an error", async () => {
    const { f } = server(() => json(500, { error: { code: 500, message: "boom" } }));
    const e = await failure(youtube.whoAmI(token(), f));
    expect(JSON.stringify({ m: e.message, raw: e.raw })).not.toContain("ya29.test");
  });
});
