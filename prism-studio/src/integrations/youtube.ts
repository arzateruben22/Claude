// YouTube connector: the Data API v3 through the owner's Google sign-in. A pure API client (see types.ts): no
// database, no logging, and every network call goes through the injected `f` so tests never touch the network.
//
// Endpoint shapes follow videos.insert, the resumable upload protocol, captions.insert and thumbnails.set as
// documented up to 2026-10-25. The sandbox that wrote this file could not open developers.google.com, so the
// points marked UNVERIFIED below were written from memory of those pages and should be checked against them.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AccountInfo, Capabilities, Fetch, Metrics, PlatformConnector, PublishInput, PublishResult, TokenSet } from "./types";
import { ConnectorError } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const MIB = 1024 * 1024;
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Upload tuning, exported so tests can shorten the back-off. Google wants chunks in multiples of 256 KiB. */
export const uploadTuning = { chunkBytes: 8 * MIB, retryDelaysMs: [1000, 3000, 9000] };

// ---------------------------------------------------------------- errors

// Error reasons from the Data API's error table. quotaExceeded/dailyLimitExceeded are the project's daily units;
// uploadLimitExceeded is videos.insert's "too many uploads" (UNVERIFIED whether it is per day or per channel).
const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "uploadLimitExceeded"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
// 403s that mean "the token is no good", not "the request is wrong": only reconnecting fixes them.
const AUTH_REASONS = new Set(["authError", "insufficientPermissions", "invalidCredentials", "expired", "lockedDomainExpired"]);

interface ApiErrorBody {
  /** Data API: an object; OAuth token endpoint: a string such as "invalid_grant" */
  error?: string | { code?: number; message?: string; errors?: { reason?: string; message?: string }[] };
  error_description?: string;
}

async function readBody(res: Response): Promise<{ json: Record<string, unknown> | undefined; text: string }> {
  let text = "";
  try { text = await res.text(); } catch { /* unreadable body: the status is still informative */ }
  try { return { json: text ? (JSON.parse(text) as Record<string, unknown>) : undefined, text }; } catch { return { json: undefined, text }; }
}

function mapError(where: string, status: number, json: Record<string, unknown> | undefined, text: string): ConnectorError {
  const body = (json ?? {}) as ApiErrorBody;
  const oauth = typeof body.error === "string" ? body.error : "";
  const detail = typeof body.error === "object" && body.error ? body.error : undefined;
  const reasons = (detail?.errors ?? []).map((e) => e.reason ?? "");
  const msg = detail?.message || body.error_description || oauth || text.slice(0, 200) || `HTTP ${status}`;
  const raw = json ?? text;                                   // response bodies never contain our tokens
  if (status === 401 || oauth === "invalid_grant" || reasons.some((r) => AUTH_REASONS.has(r)))
    return new ConnectorError("auth", `${where}: ${msg}. Reconnect the YouTube account.`, false, raw);
  if (status === 403 && reasons.some((r) => QUOTA_REASONS.has(r)))
    return new ConnectorError("quota", `${where}: YouTube Data API quota exhausted (${msg}). The default is 10,000 units per day per project and one upload costs about 1,600 units; the quota resets at midnight Pacific time.`, false, raw);
  if (status === 429 || (status === 403 && reasons.some((r) => RATE_REASONS.has(r))))
    return new ConnectorError("quota", `${where}: YouTube rate limit (${msg}). Wait a minute and retry.`, true, raw);
  if (status >= 500) return new ConnectorError("network", `${where}: YouTube answered ${status}.`, true, raw);
  return new ConnectorError("rejected", `${where}: ${msg}`, false, raw);
}

/** fetch that turns thrown network errors into retryable ConnectorErrors. */
async function send(f: Fetch, where: string, url: string, init: RequestInit): Promise<Response> {
  try { return await f(url, init); }
  catch (e) { throw new ConnectorError("network", `${where}: ${e instanceof Error ? e.message : "fetch failed"}`, true); }
}

/** fetch + JSON, throwing the mapped ConnectorError on any non-2xx. */
async function call<T>(f: Fetch, where: string, url: string, init: RequestInit): Promise<T> {
  const res = await send(f, where, url, init);
  const { json, text } = await readBody(res);
  if (!res.ok) throw mapError(where, res.status, json, text);
  return (json ?? {}) as T;
}

// ---------------------------------------------------------------- OAuth

function creds(env: NodeJS.ProcessEnv): { clientId: string; clientSecret: string } {
  const clientId = env.GOOGLE_CLIENT_ID, clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ConnectorError("invalid", "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set");
  return { clientId, clientSecret };
}

interface TokenResponse { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; token_type?: string }

async function tokenRequest(f: Fetch, where: string, form: Record<string, string>): Promise<TokenResponse> {
  const r = await call<TokenResponse>(f, where, TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });
  if (!r.access_token) throw new ConnectorError("rejected", `${where}: Google returned no access token`, false);
  return r;
}

/** expiresAt is a minute early so a token is refreshed before Google stops accepting it. */
function toTokenSet(r: TokenResponse, prev?: TokenSet): TokenSet {
  return {
    accessToken: r.access_token as string,
    refreshToken: r.refresh_token ?? prev?.refreshToken,     // refresh responses usually omit it: keep the old one
    expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000,
    scopes: r.scope ? r.scope.split(" ").filter(Boolean) : prev?.scopes ?? [...SCOPES],
    extra: { ...prev?.extra },                                 // channelId arrives via whoAmI; keep whatever is there
  };
}

const bearer = (t: TokenSet): Record<string, string> => ({ Authorization: `Bearer ${t.accessToken}` });

// ---------------------------------------------------------------- resources

interface VideoResource {
  id?: string;
  status?: { privacyStatus?: string; uploadStatus?: string; rejectionReason?: string; failureReason?: string };
  processingDetails?: { processingStatus?: string; processingFailureReason?: string };
  statistics?: Record<string, string | undefined>;
  [k: string]: unknown;
}
interface ChannelList { items?: { id?: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }[] }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const mib = (n: number) => (n / MIB).toFixed(n < 10 * MIB ? 1 : 0);

/** "bytes=0-999999" on a 308 means the first 1,000,000 bytes are stored; no header means none are. */
function receivedBytes(range: string | null): number {
  const m = /bytes=(\d+)-(\d+)/.exec(range ?? "");
  return m ? Number(m[2]) + 1 : 0;
}

/** One chunk straight from disk: the file is never held in memory as a whole. */
function readChunk(fd: number, position: number, len: number): Buffer<ArrayBuffer> {
  const buf = Buffer.allocUnsafe(len);
  let got = 0;
  while (got < len) {
    const n = fs.readSync(fd, buf, got, len - got, position + got);
    if (n <= 0) throw new ConnectorError("invalid", "the video file is shorter than its recorded size");
    got += n;
  }
  return buf;
}

/** Checks the inputs that would otherwise fail after an expensive upload, and returns the file size. */
function checkInput(input: PublishInput): number {
  let size: number;
  try { size = fs.statSync(input.filePath).size; } catch { throw new ConnectorError("invalid", `video file not found: ${input.filePath}`); }
  if (size <= 0) throw new ConnectorError("invalid", "the video file is empty");
  if (input.fileSizeBytes && input.fileSizeBytes !== size)
    throw new ConnectorError("invalid", `the video file changed since approval (${input.fileSizeBytes} bytes approved, ${size} on disk)`);
  const title = input.title.trim();
  if (!title || title.length > 100 || /[<>]/.test(title)) throw new ConnectorError("invalid", "YouTube titles are 1-100 characters and may not contain < or >");
  if (Buffer.byteLength(input.description, "utf8") > 5000 || /[<>]/.test(input.description))
    throw new ConnectorError("invalid", "YouTube descriptions are at most 5,000 bytes and may not contain < or >");
  return size;
}

type Progress = (fraction: number, message: string) => Promise<boolean> | boolean;

/**
 * Resumable upload: PUT the file in chunks to the session URI. 308 means "stored up to the Range header, send the
 * rest"; a 5xx or a dropped connection is followed by a status probe (`Content-Range: bytes * /total`) and a
 * resume from where Google says it is; 200/201 carries the video resource.
 */
async function uploadFile(f: Fetch, auth: Record<string, string>, session: string, filePath: string, total: number, onProgress: Progress): Promise<VideoResource> {
  const fd = fs.openSync(filePath, "r");
  try {
    let offset = 0, failures = 0, stalls = 0, probe = false;
    for (;;) {
      const len = probe ? 0 : Math.min(uploadTuning.chunkBytes, total - offset);
      const headers: Record<string, string> = { ...auth, "Content-Range": probe ? `bytes */${total}` : `bytes ${offset}-${offset + len - 1}/${total}` };
      if (!probe) headers["Content-Type"] = "video/mp4";
      const body = probe ? undefined : readChunk(fd, offset, len);
      const sent = !probe;
      probe = false;
      let res: Response | undefined;
      // redirect: "manual" keeps the 308 (a redirect status to fetch) as a plain response we can read
      try { res = await f(session, { method: "PUT", redirect: "manual", headers, body }); } catch { res = undefined; }
      if (!res || res.status >= 500) {
        if (failures >= uploadTuning.retryDelaysMs.length)
          throw new ConnectorError("network", `upload interrupted at ${mib(offset)} of ${mib(total)} MiB; retry the publish`, true);
        await sleep(uploadTuning.retryDelaysMs[failures++]);
        probe = true;                                          // ask the session what it has before resending
        continue;
      }
      failures = 0;
      if (res.status === 308) {
        const received = receivedBytes(res.headers.get("range"));
        // No progress: a chunk Google discarded, or a probe that says "all stored" without ever returning the resource.
        const stalled = sent ? received <= offset : received >= total;
        if (stalled && ++stalls >= 3) throw new ConnectorError("network", "YouTube keeps answering 308 without progress; retry the publish", true);
        if (!stalled) stalls = 0;
        offset = received;
        if (offset >= total) probe = true;                     // everything stored but no resource yet: ask again
        // An abandoned session simply expires on Google's side; no video is created from a partial upload.
        if (sent && (await onProgress(offset / total, `uploaded ${mib(offset)} of ${mib(total)} MiB`)) === false)
          throw new ConnectorError("invalid", "cancelled");
        continue;
      }
      const { json, text } = await readBody(res);
      if (res.ok) {
        // The last chunk completes the video, so a "stop" here comes too late to honour: report, don't throw.
        if (sent) await onProgress(1, `uploaded ${mib(total)} of ${mib(total)} MiB`);
        return (json ?? {}) as VideoResource;
      }
      if (res.status === 404) throw new ConnectorError("network", "the upload session expired before the file was complete; retry the publish", true, json ?? text);
      throw mapError("video upload", res.status, json, text);
    }
  } finally { fs.closeSync(fd); }
}

function languageName(code: string): string {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
}

/** captions.insert as multipart/related: part 1 the snippet JSON, part 2 the SubRip text. ~400 quota units. */
async function addCaptions(f: Fetch, auth: Record<string, string>, videoId: string, srt: string, language: string): Promise<void> {
  const boundary = `prism_${randomUUID()}`;
  const meta = JSON.stringify({ snippet: { videoId, language, name: languageName(language), isDraft: false } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, "utf8"),
    Buffer.from(srt, "utf8"),
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);
  await call(f, "captions.insert", `${UPLOAD}/captions?uploadType=multipart&part=snippet`, {
    method: "POST",
    headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** thumbnails.set with the image as the body (~50 quota units). Returns the note line; never throws. */
async function setThumbnail(f: Fetch, auth: Record<string, string>, videoId: string, coverPath: string): Promise<string> {
  let image: Buffer<ArrayBuffer>;
  try { image = fs.readFileSync(coverPath); } catch { return "thumbnail not set: cover file missing"; }
  if (image.length > 2 * MIB) return "thumbnail not set: the cover is over YouTube's 2 MB limit";
  const type = path.extname(coverPath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  try {
    const res = await send(f, "thumbnails.set", `${UPLOAD}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
      method: "POST", headers: { ...auth, "Content-Type": type }, body: image,
    });
    if (res.ok) return "thumbnail set";
    const { json, text } = await readBody(res);
    const err = mapError("thumbnails.set", res.status, json, text);
    // A plain 403 here is YouTube's "channel not eligible": custom thumbnails need a phone-verified channel.
    if (res.status === 403 && err.code === "rejected") return "thumbnail not set: the channel is not verified for custom thumbnails (verify its phone number in YouTube Studio); the auto-generated one stays";
    return `thumbnail not set: ${err.message}`;
  } catch (e) { return `thumbnail not set: ${e instanceof Error ? e.message : String(e)}`; }
}

// ---------------------------------------------------------------- the connector

export const youtube: PlatformConnector = {
  platform: "youtube",
  envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  capabilities: {
    directPublish: true,
    captionsUpload: true,
    thumbnail: true,
    scheduling: false,
    metrics: true,
    conditions:
      "YouTube Data API v3 with the owner's Google sign-in (scopes youtube.upload and youtube.readonly). These conditions were written on 2026-10-25 from Google's documentation as remembered; the build sandbox could not open developers.google.com, so confirm each point there before relying on it. " +
      "(1) Token lifetime: while the Google Cloud project's OAuth consent screen is in Testing status, refresh tokens expire after 7 days and only listed test users can sign in, so unattended uploads need the consent screen published to production. " +
      "(2) youtube.upload is a sensitive scope: a production app that Google has not verified shows the 'unverified app' warning at sign-in, which the owner can click through as the app's only user; Google's app verification removes the warning. " +
      "(3) Separately from OAuth verification, videos uploaded through videos.insert from an API project that has not passed YouTube's API compliance audit are locked to private; when that happens the connector reports the post as private, and public uploads by API need the audit. " +
      "(4) status.containsSyntheticMedia is YouTube's altered-or-synthetic-content disclosure and is set from the 'AI visuals' disclosure; the AI-voice and branded-content disclosures have no known Data API field and stay in the description. " +
      "(5) Quota: 10,000 units per day per project by default, reset at midnight Pacific time; videos.insert costs about 1,600 units, captions.insert about 400 and thumbnails.set about 50, so roughly six uploads a day; a quota error is reported as not retryable. " +
      "(6) Custom thumbnails need a phone-verified channel; a refusal there is written into the note, not treated as a failed publish. Platform-side scheduling is not offered: the studio decides when to upload.",
  },

  configured(env = process.env) {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  },

  authUrl(o, env = process.env) {
    const { clientId } = creds(env);
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: o.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",                 // a refresh token, for unattended uploads
      prompt: "consent",                      // Google only re-issues a refresh token when consent is shown again
      include_granted_scopes: "true",
      state: o.state,
    });
    if (o.codeChallenge) { p.set("code_challenge", o.codeChallenge); p.set("code_challenge_method", "S256"); }
    return `${AUTH_URL}?${p.toString()}`;
  },

  async exchangeCode(o, env = process.env, f = fetch) {
    const { clientId, clientSecret } = creds(env);
    const form: Record<string, string> = { code: o.code, client_id: clientId, client_secret: clientSecret, redirect_uri: o.redirectUri, grant_type: "authorization_code" };
    if (o.codeVerifier) form.code_verifier = o.codeVerifier;
    return toTokenSet(await tokenRequest(f, "token exchange", form));
  },

  async refresh(t, env = process.env, f = fetch) {
    const { clientId, clientSecret } = creds(env);
    if (!t.refreshToken) throw new ConnectorError("auth", "no refresh token stored for this YouTube account. Reconnect it.");
    const r = await tokenRequest(f, "token refresh", { client_id: clientId, client_secret: clientSecret, refresh_token: t.refreshToken, grant_type: "refresh_token" });
    return toTokenSet(r, t);
  },

  async whoAmI(t, f = fetch) {
    const r = await call<ChannelList>(f, "channels.list", `${API}/channels?part=snippet&mine=true`, { headers: bearer(t) });
    const ch = r.items?.[0];
    if (!ch?.id) throw new ConnectorError("rejected", "this Google account has no YouTube channel; create one in YouTube first");
    const s = ch.snippet ?? {};
    const title = s.title || ch.id;
    // customUrl is "@handle" for channels with a handle. UNVERIFIED whether legacy forms without "@" still appear;
    // the handle gets the "@" added, the profile URL uses the value as returned.
    const custom = s.customUrl?.trim() || "";
    t.extra = { ...t.extra, channelId: ch.id };               // so the studio can store the channel id with the token
    return {
      accountId: ch.id,
      displayName: title,
      handle: custom ? (custom.startsWith("@") ? custom : `@${custom}`) : title,
      profileUrl: custom ? `https://www.youtube.com/${custom}` : `https://www.youtube.com/channel/${ch.id}`,
      avatarUrl: s.thumbnails?.default?.url,
    };
  },

  async publish(t, input, onProgress, f = fetch) {
    const total = checkInput(input);
    const auth = bearer(t);
    const wantPublic = input.privacy === "public";           // anything else is private: the safest choice
    const language = input.languageCode || "en";

    // 1) open the resumable session with the metadata; the file follows in chunks
    const metadata = {
      snippet: { title: input.title, description: input.description, tags: input.tags, categoryId: "27" /* Education */, defaultLanguage: input.languageCode, defaultAudioLanguage: input.languageCode },
      status: {
        privacyStatus: wantPublic ? "public" : "private",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: input.disclosures.aiVisuals, // YouTube's altered/synthetic content disclosure
        embeddable: true,
        license: "youtube",
      },
    };
    const init = await send(f, "videos.insert", `${UPLOAD}/videos?uploadType=resumable&part=snippet,status`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(total) },
      body: JSON.stringify(metadata),
    });
    if (!init.ok) { const { json, text } = await readBody(init); throw mapError("videos.insert", init.status, json, text); }
    const session = init.headers.get("location");
    if (!session) throw new ConnectorError("network", "videos.insert: YouTube opened no upload session (no Location header)", true);

    // 2) the file
    const video = await uploadFile(f, auth, session, input.filePath, total, onProgress);
    const id = video.id;
    if (!id) throw new ConnectorError("network", "the upload finished but YouTube returned no video id", true, video);
    const stored = video.status?.privacyStatus;
    const isPublic = stored ? stored === "public" : wantPublic;
    const notes: string[] = [];
    if (wantPublic && !isPublic) notes.push(`YouTube stored the video as ${stored} although public was requested (API projects that have not passed YouTube's compliance audit are limited to private uploads)`);
    else notes.push(isPublic ? "uploaded as public; YouTube is processing it" : "uploaded as private");

    // 3) captions and 4) thumbnail: the video exists now, so neither may fail the publish (a retry would upload it twice)
    if (input.captionsSrt) {
      try { await addCaptions(f, auth, id, input.captionsSrt, language); notes.push(`captions attached (${language})`); }
      catch (e) { notes.push(`captions not attached: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (input.coverPath) notes.push(await setThumbnail(f, auth, id, input.coverPath));

    return { status: isPublic ? "processing" : "private", postId: id, postUrl: watchUrl(id), note: notes.join("; "), raw: video };
  },

  async publishStatus(t, postId, f = fetch) {
    const r = await call<{ items?: VideoResource[] }>(f, "videos.list", `${API}/videos?part=status,processingDetails&id=${encodeURIComponent(postId)}`, { headers: bearer(t) });
    const v = r.items?.[0];
    if (!v) throw new ConnectorError("rejected", `video ${postId} no longer exists on YouTube`);
    const privacy = v.status?.privacyStatus, upload = v.status?.uploadStatus, processing = v.processingDetails?.processingStatus;
    if (upload === "rejected" || upload === "failed")
      throw new ConnectorError("rejected", `YouTube ${upload} the video: ${v.status?.rejectionReason ?? v.status?.failureReason ?? "no reason given"}`, false, v);
    if (processing === "failed" || processing === "terminated")
      throw new ConnectorError("rejected", `YouTube processing ${processing}: ${v.processingDetails?.processingFailureReason ?? "no reason given"}`, false, v);
    const base = { postId, postUrl: watchUrl(postId), raw: v as Record<string, unknown> };
    if (privacy !== "public") return { ...base, status: "private", note: `${privacy ?? "not public"} on YouTube` };
    if (processing === "succeeded" || (!processing && upload === "processed")) return { ...base, status: "published", note: "public and processed" };
    return { ...base, status: "processing", note: `public; YouTube is still processing (${processing ?? upload ?? "status unknown"})` };
  },

  async metrics(t, postId, f = fetch) {
    const r = await call<{ items?: VideoResource[] }>(f, "videos.list", `${API}/videos?part=statistics&id=${encodeURIComponent(postId)}`, { headers: bearer(t) });
    const s = r.items?.[0]?.statistics;
    if (!s) throw new ConnectorError("rejected", `video ${postId} no longer exists on YouTube`);
    const num = (k: string) => (s[k] === undefined ? undefined : Number(s[k]));
    return { views: num("viewCount"), likes: num("likeCount"), comments: num("commentCount"), retrievedAt: new Date().toISOString() };
  },
};
