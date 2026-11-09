// The one interface every platform adapter implements, mock or live.
//
//   adapter.platform                      'youtube' | 'tiktok'
//   adapter.mode                          'mock' | 'live'
//   adapter.capabilities()                array from capabilities.js
//   await adapter.fetchVideoStats(id)     { ok: true, stats, fetched_at, source } | { ok: false, error }
//   await adapter.checkVideoOwnership({ platformVideoId, memberChannelId })   -> CheckResult
//   await adapter.checkComment({ platformVideoId, memberChannelId })          -> CheckResult (informational only)
//   await adapter.checkLike({ platformVideoId, memberChannelId })             -> CheckResult (always 'unsupported' today)
//
// Adapters NEVER throw for expected conditions (missing credentials, quota, not found,
// unsupported). They return a result that says so, and the caller shows it honestly.
//
// CheckResult.outcome
//   attested        the platform itself confirmed it          -> may become "verified"
//   not_attested    the platform was asked and did not confirm -> stays "unverified"
//   unsupported     the platform cannot answer this at all     -> stays "unverified", say why
//   not_configured  no credentials / adapter not connected     -> stays "unverified", say why
//   unavailable     the API failed (quota, outage, forbidden)  -> stays "unverified", retry later
//
// Only `attested` may ever lead to a "verified" status.

export const PLATFORMS = Object.freeze(['youtube', 'tiktok']);
export const CHECK_OUTCOMES = Object.freeze(['attested', 'not_attested', 'unsupported', 'not_configured', 'unavailable']);
export const ERROR_CODES = Object.freeze(['not_configured', 'not_found', 'quota_exceeded', 'forbidden', 'unavailable', 'unsupported']);

const RETRYABLE = new Set(['quota_exceeded', 'unavailable']);

/** @returns {{ ok: false, error: { code: string, message: string, retryable: boolean } }} */
export function failure(code, message) {
  if (!ERROR_CODES.includes(code)) throw new TypeError(`unknown adapter error code: ${code}`);
  return { ok: false, error: { code, message, retryable: RETRYABLE.has(code) } };
}

/** @param {{ views?: number|null, likes?: number|null, comments?: number|null }} stats */
export function statsResult(stats, { fetchedAt, source }) {
  return {
    ok: true,
    stats: { views: stats.views ?? null, likes: stats.likes ?? null, comments: stats.comments ?? null },
    fetched_at: fetchedAt,
    source,
  };
}

/**
 * @param {'attested'|'not_attested'|'unsupported'|'not_configured'|'unavailable'} outcome
 * @param {string} reason    plain-language explanation, safe to show
 * @param {Record<string, unknown>} [evidence]  ids, counts and flags only
 */
export function checkResult(outcome, reason, evidence = {}) {
  if (!CHECK_OUTCOMES.includes(outcome)) throw new TypeError(`unknown check outcome: ${outcome}`);
  return { outcome, reason, evidence };
}

/** Maps an adapter error to the check outcome a caller should record. */
export function outcomeForError(error) {
  if (error.code === 'not_configured') return 'not_configured';
  if (error.code === 'unsupported') return 'unsupported';
  if (error.code === 'not_found') return 'not_attested';
  return 'unavailable';
}

const METHODS = ['capabilities', 'fetchVideoStats', 'checkVideoOwnership', 'checkComment', 'checkLike'];

/** Throws if `adapter` does not implement the contract. Used by the registry and by tests. */
export function assertAdapter(adapter) {
  if (!adapter || !PLATFORMS.includes(adapter.platform)) throw new TypeError('adapter.platform must be youtube or tiktok');
  if (adapter.mode !== 'mock' && adapter.mode !== 'live') throw new TypeError('adapter.mode must be mock or live');
  for (const method of METHODS) {
    if (typeof adapter[method] !== 'function') throw new TypeError(`adapter.${method} must be a function`);
  }
  return adapter;
}
