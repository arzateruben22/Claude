// The contract every platform connector implements. Connectors are pure API clients: they never touch the
// database, never log tokens, and take `fetch` as a parameter so tests can replace it. The studio (domain +
// worker) owns when to publish, what is approved, and how tokens are stored (sealed, server-side only).
export type Platform = "youtube" | "tiktok" | "instagram";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms when the access token stops working */
  expiresAt: number;
  scopes: string[];
  /** anything the platform needs again later (e.g. TikTok open_id, Instagram user id, YouTube channel id) */
  extra?: Record<string, string>;
}

export interface AccountInfo {
  accountId: string;       // UC… channel id, TikTok open_id, Instagram professional account id
  handle: string;          // "@restframe" (with the @) when the platform has one, else the display name
  displayName: string;
  profileUrl: string;      // the account's public page, built only from platform-returned values
  avatarUrl?: string;
}

export interface PublishInput {
  /** absolute path of the final file on this machine */
  filePath: string;
  fileSizeBytes: number;
  /** an https URL the platform can fetch the file from (Instagram only; signed and short-lived) */
  publicVideoUrl?: string;
  title: string;
  description: string;     // YouTube description / TikTok+Instagram caption (hashtags already included)
  tags?: string[];
  /** SubRip captions text (YouTube), when there are any */
  captionsSrt?: string;
  coverPath?: string;      // a local jpg for the thumbnail/cover, when the platform takes one
  disclosures: { aiVoice: boolean; aiVisuals: boolean; branded: boolean };
  /** TikTok: how the post is published. "inbox" sends it to the owner's TikTok inbox to finish in the app
   *  (works for unaudited apps); "direct" posts it (private-only until the app passes TikTok's audit). */
  mode?: "inbox" | "direct";
  /** platform privacy for direct posts; connectors default to the safest choice */
  privacy?: "public" | "private";
  languageCode?: string;   // "en"
}

export interface PublishResult {
  /** what actually happened; the studio records only "published" as a verified publication */
  status: "published" | "processing" | "private" | "inbox";
  postId: string;
  postUrl: string;         // "" when the platform doesn't give one yet (processing/inbox)
  note: string;            // one line for the audit log and the owner ("posted private: app unaudited")
  raw?: Record<string, unknown>;
}

export interface Metrics {
  views?: number; likes?: number; comments?: number; shares?: number; avg_view_duration_s?: number; followers_gained?: number;
  retrievedAt: string;
}

export interface Capabilities {
  directPublish: boolean;        // can the connector make a public post by itself (given app status)?
  captionsUpload: boolean;
  thumbnail: boolean;
  scheduling: boolean;           // platform-side scheduled publish
  metrics: boolean;
  /** one honest paragraph on the platform's conditions (audit, testing mode, token lifetime) */
  conditions: string;
}

export type Fetch = typeof fetch;

export interface PlatformConnector {
  platform: Platform;
  capabilities: Capabilities;
  /** true when the environment has this platform's app credentials */
  configured(env?: NodeJS.ProcessEnv): boolean;
  /** which env vars it needs, for the Accounts screen's setup card */
  envVars: string[];
  authUrl(o: { state: string; redirectUri: string; codeChallenge?: string }, env?: NodeJS.ProcessEnv): string;
  exchangeCode(o: { code: string; redirectUri: string; codeVerifier?: string }, env?: NodeJS.ProcessEnv, f?: Fetch): Promise<TokenSet>;
  refresh(t: TokenSet, env?: NodeJS.ProcessEnv, f?: Fetch): Promise<TokenSet>;
  whoAmI(t: TokenSet, f?: Fetch): Promise<AccountInfo>;
  publish(t: TokenSet, input: PublishInput, onProgress: (fraction: number, message: string) => Promise<boolean> | boolean, f?: Fetch): Promise<PublishResult>;
  /** after "processing": ask the platform again */
  publishStatus?(t: TokenSet, postId: string, f?: Fetch): Promise<PublishResult>;
  metrics?(t: TokenSet, postId: string, f?: Fetch): Promise<Metrics>;
}

export class ConnectorError extends Error {
  constructor(public code: "auth" | "quota" | "rejected" | "network" | "unsupported" | "invalid", message: string, public retryable = false, public raw?: unknown) { super(message); }
}
