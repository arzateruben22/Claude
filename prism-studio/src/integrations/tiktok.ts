// TikTok connector: Login Kit (OAuth v2 with optional PKCE) + Content Posting API (upload-to-inbox or direct post,
// chunked FILE_UPLOAD) + Display API for metrics. Pure API client: no database, no logging of tokens, `fetch` injected.
//
// Verified against TikTok's documentation by web search on 2026-10-25 (developers.tiktok.com itself was not reachable
// from this environment): endpoints, privacy_level values, the floor-division chunk rule and its 5-64 MB bounds,
// status/fetch response fields, the unaudited-client restriction and error names. Re-check before relying on it.
import fs from "node:fs";
import {
  ConnectorError,
  type AccountInfo, type Fetch, type Metrics, type PlatformConnector, type PublishInput, type PublishResult, type TokenSet,
} from "./types";

const AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";
/** user.info.profile is what returns `username` and `profile_deep_link`; user.info.basic gives only open_id, avatar and
 *  display_name. All five scopes must be enabled on the app in the TikTok developer portal. */
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "video.publish", "video.upload", "video.list"];
/** 10 MiB. TikTok: every chunk except the last must be 5 MB..64 MB; the last one absorbs the remainder (up to 128 MB);
 *  a file smaller than one chunk is uploaded as a single chunk whose chunk_size is the whole file. */
export const CHUNK_SIZE = 10 * 1024 * 1024;
const TITLE_MAX = 2200;
const PRIVACY = { public: "PUBLIC_TO_EVERYONE", private: "SELF_ONLY" } as const;

type Json = Record<string, any>;

export interface TikTokOptions {
  /** ms between status polls (default 3 s; tests pass 0) */
  pollIntervalMs?: number;
  /** how long publish() waits for TikTok to finish before returning "processing" (default ~2 min) */
  pollTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** TikTok's chunking: total_chunk_count = floor(size / chunk_size); the last chunk takes the remainder. */
export function chunkPlan(size: number, chunkSize = CHUNK_SIZE): { chunkSize: number; count: number; ranges: Array<[number, number]> } {
  if (size <= 0) throw new ConnectorError("invalid", "the video file is empty");
  const cs = Math.min(chunkSize, size);
  const count = Math.max(1, Math.floor(size / cs));
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) ranges.push([i * cs, i === count - 1 ? size - 1 : (i + 1) * cs - 1]);
  return { chunkSize: cs, count, ranges };
}

function env(name: string, e: NodeJS.ProcessEnv): string {
  const v = e[name];
  if (!v) throw new ConnectorError("invalid", `${name} is not set`);
  return v;
}

function form(fields: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) p.set(k, v);
  return p.toString();
}

/** Maps a Content Posting / Display API `error` object (plus the HTTP status) to a ConnectorError. */
function mapApiError(status: number, err: Json | undefined, raw: unknown): ConnectorError {
  const code: string = typeof err?.code === "string" ? err.code : "";
  const detail = err?.message ? `${code}: ${err.message}` : code || `HTTP ${status}`;
  if (status >= 500 || code === "internal_error") return new ConnectorError("network", `TikTok ${detail}`, true, raw);
  if (code === "access_token_invalid" || code === "scope_not_authorized" || code === "token_not_authorized")
    return new ConnectorError("auth", `TikTok ${detail}; the connection needs to be renewed`, false, raw);
  if (code === "rate_limit_exceeded") return new ConnectorError("quota", `TikTok ${detail}; retry in a minute`, true, raw);
  if (code.startsWith("spam_risk_") || code === "reached_active_user_cap")
    return new ConnectorError("quota", `TikTok ${detail}`, false, raw);
  if (code === "unaudited_client_can_only_post_to_private_accounts")
    return new ConnectorError("rejected", "TikTok rejected the direct post: this app has not passed TikTok's audit, so it may only post SELF_ONLY and the TikTok account must be private at posting time. Use inbox mode (finish in the TikTok app) or a private direct post until the audit.", false, raw);
  if (code === "privacy_level_option_mismatch")
    return new ConnectorError("rejected", `TikTok ${detail}: the privacy level is not one TikTok offers this account (creator_info/query lists the options)`, false, raw);
  if (code.startsWith("unaudited_") || code.startsWith("invalid_")) return new ConnectorError("rejected", `TikTok ${detail}`, false, raw);
  if (status === 401) return new ConnectorError("auth", `TikTok ${detail}`, false, raw);
  return new ConnectorError("rejected", `TikTok ${detail}`, false, raw);
}

/** One JSON request. Every TikTok v2 response carries `error: { code, message, log_id }` with code "ok" on success
 *  (TikTok sometimes reports an error inside an HTTP 200, so both are checked). Returns `data`. */
async function api<T = Json>(f: Fetch, url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try { res = await f(url, init); } catch (e) { throw new ConnectorError("network", `TikTok: ${(e as Error).message}`, true, e); }
  const text = await res.text();
  let json: Json | undefined;
  try { json = text ? (JSON.parse(text) as Json) : {}; } catch { json = undefined; }
  if (!json) {
    if (res.status >= 500) throw new ConnectorError("network", `TikTok HTTP ${res.status}`, true, text.slice(0, 300));
    throw new ConnectorError("rejected", `TikTok HTTP ${res.status}: ${text.slice(0, 200)}`, false, text.slice(0, 300));
  }
  const err = json.error as Json | undefined;
  if (!res.ok || (err && err.code && err.code !== "ok")) throw mapApiError(res.status, err, json);
  return (json.data ?? {}) as T;
}

const bearer = (t: TokenSet) => ({ Authorization: `Bearer ${t.accessToken}` });
const jsonHeaders = (t: TokenSet) => ({ ...bearer(t), "Content-Type": "application/json; charset=UTF-8" });

/** POST https://open.tiktokapis.com/v2/oauth/token/ (form-encoded). Error shape here is { error, error_description, log_id }. */
async function tokenRequest(f: Fetch, fields: Record<string, string | undefined>, previous?: TokenSet): Promise<TokenSet> {
  let res: Response;
  try {
    res = await f(`${API}/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" }, body: form(fields) });
  } catch (e) { throw new ConnectorError("network", `TikTok: ${(e as Error).message}`, true, e); }
  const text = await res.text();
  let json: Json = {};
  try { json = text ? (JSON.parse(text) as Json) : {}; } catch { json = {}; }
  if (res.status >= 500) throw new ConnectorError("network", `TikTok token endpoint HTTP ${res.status}`, true);
  if (!res.ok || json.error || !json.access_token) {
    const why = json.error ? `${json.error}${json.error_description ? `: ${json.error_description}` : ""}` : `HTTP ${res.status}`;
    // the error body never contains tokens; the form (which does) is not attached
    throw new ConnectorError("auth", `TikTok did not issue a token (${why}); reconnect the account`, false, { error: json.error, error_description: json.error_description, log_id: json.log_id });
  }
  const expiresIn = Number(json.expires_in ?? 86400);
  const scopes = typeof json.scope === "string" && json.scope ? json.scope.split(",").map((s: string) => s.trim()).filter(Boolean) : previous?.scopes ?? [];
  const openId = typeof json.open_id === "string" && json.open_id ? json.open_id : previous?.extra?.openId;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : previous?.refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scopes,
    extra: { ...(previous?.extra ?? {}), ...(openId ? { openId } : {}) },
  };
}

interface CreatorInfo {
  creator_avatar_url?: string; creator_username?: string; creator_nickname?: string;
  privacy_level_options?: string[]; comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

interface StatusData { status?: string; fail_reason?: string; publicaly_available_post_id?: Array<string | number>; uploaded_bytes?: number }

const TERMINAL = new Set(["PUBLISH_COMPLETE", "SEND_TO_USER_INBOX", "FAILED"]);

function postUrlFor(handle: string | undefined, postId: string | undefined): string {
  const h = handle?.replace(/^@/, "");
  return h && postId ? `https://www.tiktok.com/@${h}/video/${postId}` : "";
}

/** Turns a status/fetch payload into a PublishResult. `expected` is what the caller asked for ("published" for a
 *  PUBLIC_TO_EVERYONE direct post, "private" for SELF_ONLY, "inbox" for an inbox upload); publishStatus() does not
 *  know it and infers from whether TikTok returned a public post id (see the comment there). */
function resultFrom(data: StatusData, publishId: string, handle: string | undefined, expected: "published" | "private" | "inbox" | undefined, extraNote: string): PublishResult {
  const status = String(data.status ?? "");
  const ids = (data.publicaly_available_post_id ?? []).map(String).filter(Boolean);
  const postId = ids[0];
  const raw = { status, fail_reason: data.fail_reason, publicaly_available_post_id: ids, uploaded_bytes: data.uploaded_bytes, publish_id: publishId };
  if (status === "FAILED") throw new ConnectorError("rejected", `TikTok failed the post${data.fail_reason ? `: ${data.fail_reason}` : ""}`, false, raw);
  if (status === "SEND_TO_USER_INBOX")
    return { status: "inbox", postId: publishId, postUrl: "", note: `Sent to the owner's TikTok inbox: open the inbox notification in the TikTok app, add the caption and post it.${extraNote}`, raw };
  if (status === "PUBLISH_COMPLETE") {
    const final = expected === "inbox" || expected === undefined ? (postId ? "published" : "private") : expected;
    if (final === "published")
      return { status: "published", postId: postId ?? publishId, postUrl: postUrlFor(handle, postId), note: `Published on TikTok (PUBLIC_TO_EVERYONE).${postUrlFor(handle, postId) ? "" : " TikTok returned no post id/handle yet, so there is no link."}${extraNote}`, raw };
    return { status: "private", postId: postId ?? publishId, postUrl: postUrlFor(handle, postId), note: `Posted to TikTok as SELF_ONLY (private): only the owner can see it until it is made public in the TikTok app.${extraNote}`, raw };
  }
  return { status: "processing", postId: publishId, postUrl: "", note: `TikTok is still processing the post (${status || "unknown status"}); ask again with publishStatus.${extraNote}`, raw };
}

export function createTikTok(options: TikTokOptions = {}): PlatformConnector {
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const pollTimeoutMs = options.pollTimeoutMs ?? 120_000;
  const sleep = options.sleep ?? defaultSleep;

  const statusFetch = (t: TokenSet, publishId: string, f: Fetch) =>
    api<StatusData>(f, `${API}/post/publish/status/fetch/`, { method: "POST", headers: jsonHeaders(t), body: JSON.stringify({ publish_id: publishId }) });

  return {
    platform: "tiktok",
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    capabilities: {
      directPublish: false,   // until TikTok audits the app: direct posts are private-only
      captionsUpload: false,
      thumbnail: false,       // the cover is the frame at video_cover_timestamp_ms; no image upload
      scheduling: false,
      metrics: true,
      conditions:
        "TikTok Content Posting API through the owner's Login Kit authorization (scopes user.info.basic, user.info.profile, video.publish, video.upload, video.list; all five must be enabled on the TikTok app). " +
        "Until TikTok audits the app, Direct Post is limited to private (SELF_ONLY) posts, to at most 5 posting users per 24 h, and the TikTok account must be private at posting time; a direct public post fails with unaudited_client_can_only_post_to_private_accounts. " +
        "Upload-to-inbox is the practical path until the audit: the video lands in the owner's TikTok inbox and the owner adds the caption and posts it in the TikTok app. " +
        "After the audit, direct public posts work within TikTok's caps (6 init requests per minute per user, spam-risk limits on posts per day, and each account's max video duration from creator_info/query, which the studio does not measure). " +
        "is_aigc is TikTok's AI-generated content label and is set from the AI voice/visuals disclosures; TikTok does not allow branded content on a SELF_ONLY post. " +
        "No cover upload (the cover is the frame at 1 s), no captions upload, no platform-side scheduling. Access tokens last 24 h and refresh tokens about a year; the studio refreshes them.",
    },

    configured(e = process.env) { return Boolean(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET); },

    authUrl(o, e = process.env) {
      const p = new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY", e),
        scope: TIKTOK_SCOPES.join(","),
        response_type: "code",
        redirect_uri: o.redirectUri,
        state: o.state,
      });
      if (o.codeChallenge) { p.set("code_challenge", o.codeChallenge); p.set("code_challenge_method", "S256"); }
      // TikTok documents the scope list with literal commas; keep them readable (servers decode %2C the same way).
      return `${AUTHORIZE}?${p.toString().replace(/%2C/g, ",")}`;
    },

    exchangeCode(o, e = process.env, f = fetch) {
      return tokenRequest(f, {
        client_key: env("TIKTOK_CLIENT_KEY", e),
        client_secret: env("TIKTOK_CLIENT_SECRET", e),
        code: o.code,
        grant_type: "authorization_code",
        redirect_uri: o.redirectUri,
        code_verifier: o.codeVerifier,
      });
    },

    refresh(t, e = process.env, f = fetch) {
      if (!t.refreshToken) return Promise.reject(new ConnectorError("auth", "TikTok connection has no refresh token; reconnect the account"));
      return tokenRequest(f, {
        client_key: env("TIKTOK_CLIENT_KEY", e),
        client_secret: env("TIKTOK_CLIENT_SECRET", e),
        grant_type: "refresh_token",
        refresh_token: t.refreshToken,
      }, t);
    },

    async whoAmI(t, f = fetch) {
      // username/profile_deep_link need user.info.profile; asking for them without it is refused, so ask only when granted
      // (an empty scope list means "unknown": try).
      const profileScope = t.scopes.length === 0 || t.scopes.includes("user.info.profile");
      const fields = ["open_id", "union_id", "avatar_url", "display_name", ...(profileScope ? ["username", "profile_deep_link"] : [])];
      const data = await api(f, `${API}/user/info/?fields=${fields.join(",")}`, { method: "GET", headers: bearer(t) });
      const u = (data.user ?? {}) as Json;
      let username: string | undefined = typeof u.username === "string" && u.username ? u.username : undefined;
      if (!username) {
        // Content Posting API (video.publish) also knows the handle
        try {
          const c = await api<CreatorInfo>(f, `${API}/post/publish/creator_info/query/`, { method: "POST", headers: jsonHeaders(t) });
          if (c.creator_username) username = c.creator_username;
        } catch { /* keep the display name as handle */ }
      }
      const displayName = String(u.display_name ?? username ?? "");
      return {
        accountId: String(u.open_id ?? t.extra?.openId ?? ""),
        handle: username ? `@${username}` : displayName,
        displayName,
        profileUrl: username ? `https://www.tiktok.com/@${username}` : typeof u.profile_deep_link === "string" ? u.profile_deep_link : "",
        avatarUrl: typeof u.avatar_url === "string" ? u.avatar_url : undefined,
      } satisfies AccountInfo;
    },

    async publish(t, input, onProgress, f = fetch) {
      const step = async (fraction: number, message: string) => {
        if ((await onProgress(fraction, message)) === false) throw new ConnectorError("invalid", "cancelled");
      };
      const mode = input.mode ?? "inbox";
      const privacy = PRIVACY[input.privacy ?? "private"];
      const expected = mode === "inbox" ? "inbox" : privacy === "PUBLIC_TO_EVERYONE" ? "published" : "private";

      let size: number;
      try { size = fs.statSync(input.filePath).size; } catch (e) { throw new ConnectorError("invalid", `cannot read ${input.filePath}: ${(e as Error).message}`); }
      if (input.fileSizeBytes && input.fileSizeBytes !== size)
        throw new ConnectorError("invalid", `the file on disk is ${size} bytes but the approved export says ${input.fileSizeBytes}; re-approve the export`);

      // 1. what this creator may post (privacy options, duration cap, handle)
      await step(0.02, "Asking TikTok what this account may post");
      const creator = await api<CreatorInfo>(f, `${API}/post/publish/creator_info/query/`, { method: "POST", headers: jsonHeaders(t) });
      const handle = t.extra?.handle || creator.creator_username;
      const maxSec = creator.max_video_post_duration_sec;
      // The studio does not know the video's duration here, so the cap is surfaced instead of enforced.
      const durationNote = maxSec ? ` TikTok's max duration for this account is ${maxSec} s (not checked here).` : "";
      if (mode === "direct") {
        const offered = creator.privacy_level_options;
        if (Array.isArray(offered) && offered.length && !offered.includes(privacy))
          throw new ConnectorError("rejected", `TikTok offers only ${offered.join(", ")} for this account, not ${privacy}${privacy === "PUBLIC_TO_EVERYONE" ? " (a private TikTok account cannot post publicly; unaudited apps may only post SELF_ONLY)" : ""}`, false, creator);
        if (input.disclosures.branded && privacy === "SELF_ONLY")
          throw new ConnectorError("rejected", "TikTok does not allow branded content on a SELF_ONLY post; use inbox mode or a public post (after the audit)", false, creator);
      }

      // 2. init
      const plan = chunkPlan(size);
      const source_info = { source: "FILE_UPLOAD", video_size: size, chunk_size: plan.chunkSize, total_chunk_count: plan.count };
      let init: { publish_id?: string; upload_url?: string };
      if (mode === "direct") {
        const title = (input.description || input.title || "").slice(0, TITLE_MAX);
        const post_info = {
          title,
          privacy_level: privacy,
          disable_duet: creator.duet_disabled ?? false,
          disable_comment: creator.comment_disabled ?? false,
          disable_stitch: creator.stitch_disabled ?? false,
          video_cover_timestamp_ms: 1000,
          is_aigc: Boolean(input.disclosures.aiVoice || input.disclosures.aiVisuals),
          brand_content_toggle: Boolean(input.disclosures.branded),
          brand_organic_toggle: false,
        };
        await step(0.05, `Starting a direct TikTok post (${privacy})`);
        init = await api(f, `${API}/post/publish/video/init/`, { method: "POST", headers: jsonHeaders(t), body: JSON.stringify({ post_info, source_info }) });
      } else {
        await step(0.05, "Starting an upload to the owner's TikTok inbox");
        init = await api(f, `${API}/post/publish/inbox/video/init/`, { method: "POST", headers: jsonHeaders(t), body: JSON.stringify({ source_info }) });
      }
      const publishId = String(init.publish_id ?? "");
      const uploadUrl = String(init.upload_url ?? "");
      if (!publishId || !uploadUrl) throw new ConnectorError("rejected", "TikTok did not return publish_id and upload_url", false, init);

      // 3. chunked upload, read from disk one chunk at a time
      const fd = fs.openSync(input.filePath, "r");
      try {
        for (let i = 0; i < plan.count; i++) {
          const [start, end] = plan.ranges[i];
          const len = end - start + 1;
          const buf = new Uint8Array(len);
          let got = 0;
          while (got < len) {
            const n = fs.readSync(fd, buf, got, len - got, start + got);
            if (n === 0) throw new ConnectorError("invalid", `${input.filePath} ended at byte ${start + got}, expected ${size}`);
            got += n;
          }
          let res: Response;
          try {
            res = await f(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "video/mp4", "Content-Length": String(len), "Content-Range": `bytes ${start}-${end}/${size}` },
              body: buf,
            });
          } catch (e) { throw new ConnectorError("network", `TikTok upload: ${(e as Error).message}`, true, e); }
          if (!res.ok) {
            const body = (await res.text().catch(() => "")).slice(0, 300);
            if (res.status >= 500) throw new ConnectorError("network", `TikTok upload HTTP ${res.status} on chunk ${i + 1}/${plan.count}`, true, body);
            throw new ConnectorError("rejected", `TikTok upload HTTP ${res.status} on chunk ${i + 1}/${plan.count}: ${body}`, false, body);
          }
          await step(0.1 + 0.7 * ((i + 1) / plan.count), `Uploaded chunk ${i + 1} of ${plan.count} to TikTok`);
        }
      } finally { fs.closeSync(fd); }

      // 4. poll until TikTok reports a terminal status (or the time budget runs out → "processing")
      const deadline = Date.now() + pollTimeoutMs;
      for (;;) {
        const data = await statusFetch(t, publishId, f);
        const status = String(data.status ?? "");
        if (TERMINAL.has(status)) return resultFrom(data, publishId, handle, expected, durationNote);
        if (Date.now() >= deadline) return resultFrom(data, publishId, handle, expected, durationNote);
        await step(0.85, `TikTok is processing the upload (${status || "pending"})`);
        await sleep(pollIntervalMs);
      }
    },

    async publishStatus(t, postId, f = fetch) {
      // `postId` is the publish_id. Without the original request we cannot know whether a PUBLISH_COMPLETE was a public
      // or a SELF_ONLY post; a returned public post id is read as "published", none as "private". The studio knows what it
      // asked for and should trust that over this inference.
      const data = await statusFetch(t, postId, f);
      return resultFrom(data, postId, t.extra?.handle, undefined, "");
    },

    async metrics(t, postId, f = fetch) {
      const data = await api(f, `${API}/video/query/?fields=id,like_count,comment_count,share_count,view_count`, {
        method: "POST", headers: jsonHeaders(t), body: JSON.stringify({ filters: { video_ids: [postId] } }),
      });
      const v = ((data.videos ?? []) as Json[]).find((x) => String(x.id) === String(postId)) ?? ((data.videos ?? []) as Json[])[0];
      if (!v) throw new ConnectorError("rejected", `TikTok returned no video for ${postId}`, false, data);
      const num = (x: unknown) => (typeof x === "number" ? x : x === undefined || x === null ? undefined : Number(x));
      return { views: num(v.view_count), likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count), retrievedAt: new Date().toISOString() } satisfies Metrics;
    },
  };
}

export const tiktok: PlatformConnector = createTikTok();
