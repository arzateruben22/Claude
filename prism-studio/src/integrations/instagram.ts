// Instagram connector: "Instagram API with Instagram Login" (Business Login for Instagram; no Facebook Page or
// Facebook Login needed). Reels are published from a public https URL through a media container. Pure API client:
// no database, no logging of tokens, `fetch` injected.
//
// Verified against Meta's documentation by web search on 2026-10-25 (developers.facebook.com itself was not reachable
// from this environment): Business Login endpoints and scopes, graph.instagram.com host and v26.0 in Meta's own
// examples, container status codes, content_publishing_limit, error subcodes 2207051/2207042, plays→views. Re-check.
import {
  ConnectorError,
  type AccountInfo, type Fetch, type Metrics, type PlatformConnector, type PublishResult, type TokenSet,
} from "./types";

/** Graph API versions live about two years; v26.0 was released 2026-07-29. Bump when Meta retires it. */
export const GRAPH_VERSION = "v26.0";
export const GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const AUTHORIZE = "https://www.instagram.com/oauth/authorize";
const TOKEN = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"];
const CAPTION_MAX = 2200;
const LONG_LIVED_SECONDS = 60 * 86400;
/** Meta's Instagram Login guide says 50 API posts per rolling 24 h; the live value comes from content_publishing_limit. */
const DEFAULT_QUOTA = 50;

type Json = Record<string, any>;

export interface InstagramOptions {
  /** ms between container status polls (default 5 s; tests pass 0) */
  pollIntervalMs?: number;
  /** how long publish() waits for the container before returning "processing" (default ~5 min) */
  pollTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function env(name: string, e: NodeJS.ProcessEnv): string {
  const v = e[name];
  if (!v) throw new ConnectorError("invalid", `${name} is not set`);
  return v;
}

function qs(fields: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) p.set(k, v);
  return p.toString();
}

const bearer = (t: TokenSet) => ({ Authorization: `Bearer ${t.accessToken}` });
const formHeaders = (t: TokenSet) => ({ ...bearer(t), "Content-Type": "application/x-www-form-urlencoded" });

/** Maps a Graph API `error` object (plus the HTTP status) to a ConnectorError. Nearly every Graph error is typed
 *  "OAuthException" (rate limits and bad parameters included), so the numeric codes are checked first and the bare
 *  type only decides when no code is present. */
function mapGraphError(status: number, err: Json | undefined, raw: unknown): ConnectorError {
  const code = Number(err?.code ?? NaN);
  const sub = Number(err?.error_subcode ?? NaN);
  const text = err?.error_user_msg ?? err?.message ?? `HTTP ${status}`;
  const detail = `Instagram ${Number.isFinite(code) ? code : status}${Number.isFinite(sub) ? `/${sub}` : ""}: ${text}`;
  if ([4, 17, 32, 613].includes(code) || sub === 2207051 || sub === 2207042)
    return new ConnectorError("quota", `${detail} (Instagram publishing/rate limit; try again later)`, true, raw);
  if (code === 190 || code === 102 || code === 10 || (code >= 200 && code <= 299))
    return new ConnectorError("auth", `${detail}; reconnect the Instagram account`, false, raw);
  if (status >= 500 || code === 1 || code === 2) return new ConnectorError("network", detail, true, raw);
  if (!Number.isFinite(code) && err?.type === "OAuthException") return new ConnectorError("auth", `${detail}; reconnect the Instagram account`, false, raw);
  return new ConnectorError("rejected", detail, false, raw);
}

/** On an insights call, Graph's code 10 ("(#10) Not enough viewers for the media to show insights") and the 200–299
 *  permission family are about that one post, not the token: a refusal for this post only (never "reconnect", which
 *  would stop publishing too). Code 190 and an OAuthException without a code stay auth failures. */
function insightsRefusal(err: unknown): ConnectorError | null {
  if (!(err instanceof ConnectorError) || err.code !== "auth") return null;
  const code = Number(((err.raw as Json | undefined)?.error as Json | undefined)?.code ?? NaN);
  if (code !== 10 && !(code >= 200 && code <= 299)) return null;
  const why = code === 10 ? "Instagram has no insights for this post yet (too few viewers, or too new)"
    : "Instagram refused this post's insights; if every post says this, reconnect to grant the insights permission";
  return new ConnectorError("rejected", err.message.replace(/; reconnect the Instagram account$/, `; ${why}`), false, err.raw);
}

/** One Graph API request; returns the parsed JSON (throws a ConnectorError for `error` bodies and non-2xx). */
async function graph<T = Json>(f: Fetch, url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try { res = await f(url, init); } catch (e) { throw new ConnectorError("network", `Instagram: ${(e as Error).message}`, true, e); }
  const text = await res.text();
  let json: Json | undefined;
  try { json = text ? (JSON.parse(text) as Json) : {}; } catch { json = undefined; }
  if (!json) {
    if (res.status >= 500) throw new ConnectorError("network", `Instagram HTTP ${res.status}`, true, text.slice(0, 300));
    throw new ConnectorError("rejected", `Instagram HTTP ${res.status}: ${text.slice(0, 200)}`, false, text.slice(0, 300));
  }
  if (!res.ok || json.error) throw mapGraphError(res.status, json.error as Json | undefined, json);
  return json as T;
}

interface Me { id?: string; user_id?: string | number; username?: string; name?: string; profile_picture_url?: string; account_type?: string }

const me = (t: TokenSet, f: Fetch) => graph<Me>(f, `${GRAPH}/me?fields=user_id,username,name,profile_picture_url,account_type`, { method: "GET", headers: bearer(t) });

export function createInstagram(options: InstagramOptions = {}): PlatformConnector {
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const pollTimeoutMs = options.pollTimeoutMs ?? 300_000;
  const sleep = options.sleep ?? defaultSleep;

  async function userIdOf(t: TokenSet, f: Fetch): Promise<string> {
    if (t.extra?.userId) return t.extra.userId;
    const m = await me(t, f);
    const id = m.user_id ?? m.id;
    if (!id) throw new ConnectorError("auth", "Instagram did not return the professional account id; reconnect the account", false, m);
    return String(id);
  }

  /** media_publish + permalink: the last two steps, shared by publish() and publishStatus(). */
  async function finish(t: TokenSet, userId: string, containerId: string, f: Fetch, note: string): Promise<PublishResult> {
    const pub = await graph(f, `${GRAPH}/${userId}/media_publish`, { method: "POST", headers: formHeaders(t), body: qs({ creation_id: containerId }) });
    const mediaId = String(pub.id ?? "");
    if (!mediaId) throw new ConnectorError("rejected", "Instagram media_publish returned no id", false, pub);
    let permalink = "";
    try {
      const m = await graph(f, `${GRAPH}/${mediaId}?fields=permalink,id`, { method: "GET", headers: bearer(t) });
      permalink = typeof m.permalink === "string" ? m.permalink : "";
    } catch { /* the post exists; the link can be fetched later */ }
    return { status: "published", postId: mediaId, postUrl: permalink, note: `Published on Instagram as a Reel.${note}`, raw: { containerId, mediaId, permalink } };
  }

  async function containerStatus(t: TokenSet, containerId: string, f: Fetch): Promise<{ code: string; text: string; raw: Json }> {
    const s = await graph(f, `${GRAPH}/${containerId}?fields=status_code,status`, { method: "GET", headers: bearer(t) });
    return { code: String(s.status_code ?? ""), text: typeof s.status === "string" ? s.status : "", raw: s };
  }

  const rejectedContainer = (code: string, text: string, raw: unknown) =>
    new ConnectorError("rejected", `Instagram could not process the video (${code}${text ? `: ${text}` : ""})${code === "EXPIRED" ? "; the container was not published within 24 h" : ""}`, false, raw);

  return {
    platform: "instagram",
    envVars: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
    capabilities: {
      directPublish: true,
      captionsUpload: false,
      thumbnail: false,       // cover_url needs a public URL and thumb_offset is optional; Instagram picks the frame
      scheduling: false,
      metrics: true,
      conditions:
        `Instagram API with Instagram Login (Business Login; no Facebook Page or Facebook Login needed) on graph.instagram.com ${GRAPH_VERSION}. ` +
        "Requires a professional account (Business or Creator), and the owner must have a role (admin, developer or tester) on the Meta app: no App Review is needed for the owner's own account; App Review plus Business Verification are needed only to publish for other people's accounts. " +
        "Reels only: the video must stay reachable from a public https URL while Instagram fetches it (the studio signs a short-lived one), and processing can take minutes. " +
        "Instagram allows 50 API-published posts per rolling 24 h per account (Meta's newer general docs say 100; the connector reads the live limit from content_publishing_limit before posting). " +
        "Captions up to 2200 characters; no custom cover (Instagram picks the frame), no captions upload, no platform-side scheduling. " +
        "Long-lived tokens last 60 days and can be refreshed by the studio once they are at least 24 h old; an expired token means reconnecting the account.",
    },

    configured(e = process.env) { return Boolean(e.INSTAGRAM_APP_ID && e.INSTAGRAM_APP_SECRET); },

    authUrl(o, e = process.env) {
      // Business Login has no PKCE; `codeChallenge` is ignored. Meta documents comma-separated scopes.
      const p = new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID", e),
        redirect_uri: o.redirectUri,
        response_type: "code",
        scope: INSTAGRAM_SCOPES.join(","),
        state: o.state,
      });
      return `${AUTHORIZE}?${p.toString().replace(/%2C/g, ",")}`;
    },

    async exchangeCode(o, e = process.env, f = fetch) {
      const clientId = env("INSTAGRAM_APP_ID", e);
      const secret = env("INSTAGRAM_APP_SECRET", e);
      // 1. short-lived token (1 h). Errors here look like { error_type, code, error_message }.
      let res: Response;
      try {
        res = await f(TOKEN, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: qs({ client_id: clientId, client_secret: secret, grant_type: "authorization_code", redirect_uri: o.redirectUri, code: o.code }),
        });
      } catch (err) { throw new ConnectorError("network", `Instagram: ${(err as Error).message}`, true, err); }
      const text = await res.text();
      let json: Json = {};
      try { json = text ? (JSON.parse(text) as Json) : {}; } catch { json = {}; }
      if (res.status >= 500) throw new ConnectorError("network", `Instagram token endpoint HTTP ${res.status}`, true);
      // Meta's docs show the payload both flat and wrapped in `data: [ {...} ]`; accept either.
      const row: Json = Array.isArray(json.data) ? (json.data[0] ?? {}) : json;
      if (!res.ok || json.error_type || json.error || !row.access_token) {
        const why = json.error_message ?? json.error?.message ?? json.error_type ?? `HTTP ${res.status}`;
        throw new ConnectorError("auth", `Instagram did not issue a token (${why}); reconnect the account`, false, { error_type: json.error_type, code: json.code, error_message: json.error_message });
      }
      const userId = String(row.user_id ?? "");
      const perms: string[] = Array.isArray(row.permissions) ? row.permissions.map(String)
        : typeof row.permissions === "string" && row.permissions ? row.permissions.split(",").map((s: string) => s.trim()).filter(Boolean)
        : INSTAGRAM_SCOPES;   // Meta normally returns them; fall back to what the owner was asked to grant
      // 2. long-lived token (60 days)
      const long = await graph(f, `${GRAPH}/access_token?${qs({ grant_type: "ig_exchange_token", client_secret: secret, access_token: row.access_token })}`, { method: "GET" });
      if (!long.access_token) throw new ConnectorError("auth", "Instagram did not return a long-lived token; reconnect the account", false, { token_type: long.token_type });
      const extra: Record<string, string> = {};
      if (userId) extra.userId = userId;
      return {
        accessToken: String(long.access_token),
        expiresAt: Date.now() + Number(long.expires_in ?? LONG_LIVED_SECONDS) * 1000,
        scopes: perms,
        extra,
      } satisfies TokenSet;
    },

    async refresh(t, _e = process.env, f = fetch) {
      if (t.expiresAt <= Date.now()) throw new ConnectorError("auth", "the Instagram token has expired and cannot be refreshed; reconnect the account");
      // Instagram refuses to refresh a token younger than 24 h. Long-lived tokens live 60 days, so one with more than
      // 59 days left is younger than that: nothing to do yet.
      if (t.expiresAt - Date.now() > (LONG_LIVED_SECONDS - 86400) * 1000) return t;
      let json: Json;
      try {
        json = await graph(f, `${GRAPH}/refresh_access_token?${qs({ grant_type: "ig_refresh_token", access_token: t.accessToken })}`, { method: "GET" });
      } catch (err) {
        if (err instanceof ConnectorError && err.code === "network") throw err;
        const why = err instanceof Error ? err.message : String(err);
        throw new ConnectorError("auth", `Instagram refused to refresh the token (${why}); it refreshes only when at least 24 h old and not expired. Reconnect the account if this persists`, false, err instanceof ConnectorError ? err.raw : undefined);
      }
      if (!json.access_token) throw new ConnectorError("auth", "Instagram returned no refreshed token; reconnect the account", false, { token_type: json.token_type });
      return { ...t, accessToken: String(json.access_token), expiresAt: Date.now() + Number(json.expires_in ?? LONG_LIVED_SECONDS) * 1000 };
    },

    async whoAmI(t, f = fetch) {
      const m = await me(t, f);
      const type = String(m.account_type ?? "").toUpperCase();   // Meta writes "Business" / "Media_Creator" in places
      const username = String(m.username ?? "");
      if (type !== "BUSINESS" && type !== "MEDIA_CREATOR")
        throw new ConnectorError("unsupported", `Instagram account ${username ? `@${username} ` : ""}is ${type || "not a professional account"}; switch it to a Business or Creator account in the Instagram app`, false, m);
      return {
        accountId: String(m.user_id ?? t.extra?.userId ?? m.id ?? ""),
        handle: username ? `@${username}` : String(m.name ?? ""),
        displayName: String(m.name ?? username),
        profileUrl: username ? `https://www.instagram.com/${username}/` : "",
        avatarUrl: m.profile_picture_url,
      } satisfies AccountInfo;
    },

    async publish(t, input, onProgress, f = fetch) {
      const step = async (fraction: number, message: string) => {
        if ((await onProgress(fraction, message)) === false) throw new ConnectorError("invalid", "cancelled");
      };
      const videoUrl = input.publicVideoUrl;
      if (!videoUrl) throw new ConnectorError("invalid", "Instagram fetches the video itself: publish needs publicVideoUrl (a public https URL of the exact approved file)");
      if (!/^https:\/\//i.test(videoUrl)) throw new ConnectorError("invalid", "publicVideoUrl must be an https URL");
      const userId = await userIdOf(t, f);

      // 1. rolling 24 h publishing limit
      await step(0.05, "Checking Instagram's publishing limit");
      const lim = await graph(f, `${GRAPH}/${userId}/content_publishing_limit?fields=quota_usage,config`, { method: "GET", headers: bearer(t) });
      const row: Json = Array.isArray(lim.data) ? (lim.data[0] ?? {}) : lim;
      const used = Number(row.quota_usage ?? 0);
      const total = Number(row.config?.quota_total ?? DEFAULT_QUOTA);
      if (used >= total) throw new ConnectorError("quota", `Instagram's publishing limit is used up (${used}/${total} API posts in the last 24 h); try again later`, true, lim);
      const quotaNote = ` ${used + 1}/${total} API posts in this 24 h window.`;

      // 2. media container (Instagram downloads the video from the URL)
      await step(0.1, "Creating the Reel container");
      const caption = (input.description || input.title || "").slice(0, CAPTION_MAX);
      // cover_url would need a public URL too and coverPath is local, so Instagram picks the cover frame.
      const container = await graph(f, `${GRAPH}/${userId}/media`, {
        method: "POST", headers: formHeaders(t),
        body: qs({ media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" }),
      });
      const containerId = String(container.id ?? "");
      if (!containerId) throw new ConnectorError("rejected", "Instagram returned no container id", false, container);

      // 3. wait for Instagram to fetch and process it
      const started = Date.now();
      const deadline = started + pollTimeoutMs;
      for (;;) {
        const s = await containerStatus(t, containerId, f);
        if (s.code === "FINISHED" || s.code === "PUBLISHED") break;
        if (s.code === "ERROR" || s.code === "EXPIRED") throw rejectedContainer(s.code, s.text, s.raw);
        if (Date.now() >= deadline)
          return { status: "processing", postId: containerId, postUrl: "", note: `Instagram is still processing the video (${s.code || "pending"}); ask again with publishStatus, which publishes it when it is ready.${quotaNote}`, raw: s.raw };
        await step(0.2 + 0.6 * Math.min(1, (Date.now() - started) / pollTimeoutMs), `Instagram is processing the video (${s.code || "pending"})`);
        await sleep(pollIntervalMs);
      }

      // 4 + 5. publish and fetch the permalink; nothing can be cancelled after this point
      await step(0.9, "Publishing the Reel");
      const result = await finish(t, userId, containerId, f, quotaNote);
      await onProgress(1, "Published on Instagram");
      return result;
    },

    async publishStatus(t, postId, f = fetch) {
      // `postId` is the container id handed back with "processing". A FINISHED container is published here.
      const s = await containerStatus(t, postId, f);
      if (s.code === "FINISHED") return finish(t, await userIdOf(t, f), postId, f, "");
      if (s.code === "ERROR" || s.code === "EXPIRED") throw rejectedContainer(s.code, s.text, s.raw);
      if (s.code === "PUBLISHED")
        return { status: "published", postId, postUrl: "", note: "Instagram reports this container as already published; the media id and link are not returned for a container.", raw: s.raw };
      return { status: "processing", postId, postUrl: "", note: `Instagram is still processing the video (${s.code || "pending"}).`, raw: s.raw };
    },

    async metrics(t, postId, f = fetch) {
      const url = (metric: string) => `${GRAPH}/${postId}/insights?metric=${metric}`;
      let j: Json;
      try {
        try {
          j = await graph(f, url("views,reach,likes,comments,shares,saved"), { method: "GET", headers: bearer(t) });
        } catch (err) {
          // older media / API versions know `plays` instead of `views`
          if (!(err instanceof ConnectorError) || err.code !== "rejected") throw err;
          j = await graph(f, url("plays,reach,likes,comments,shares,saved"), { method: "GET", headers: bearer(t) });
        }
      } catch (err) {
        throw insightsRefusal(err) ?? err;
      }
      const rows = (Array.isArray(j.data) ? j.data : []) as Json[];
      const pick = (name: string): number | undefined => {
        const m = rows.find((r) => r.name === name);
        const v = m?.total_value?.value ?? m?.values?.[0]?.value;
        return v === undefined || v === null ? undefined : Number(v);
      };
      return { views: pick("views") ?? pick("plays"), likes: pick("likes"), comments: pick("comments"), shares: pick("shares"), retrievedAt: new Date().toISOString() } satisfies Metrics;
    },
  };
}

export const instagram: PlatformConnector = createInstagram();
