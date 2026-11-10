// Wiring: builds the request handler out of injected parts. Nothing here reads the
// environment, opens a file on its own initiative or looks at the wall clock, so a test
// can build the whole app around an in-memory database, a fixed clock, a local key set
// and a silent logger.
//
// The pieces with memory (sign-in nonces, rate-limit windows, the count of refused
// sign-ins) are created here, once per app, and die with the process. That is deliberate:
// each is short-lived by design and none of it belongs in the database.

import { createContext } from './domain/context.js';
import { recordAudit } from './domain/audit.js';
import { checkIntegrity } from './domain/integrity.js';
import { appendTombstone } from './db/tombstones.js';
import { createNonceStore } from './auth/nonces.js';
import { createRateLimiter } from './auth/rateLimit.js';
import { NONCE_TTL_SECONDS, authRoutes } from './http/authRoutes.js';
import { adminRoutes } from './http/adminRoutes.js';
import { memberRoutes } from './http/memberRoutes.js';
import { createPipeline } from './http/pipeline.js';
import { createRouter } from './http/router.js';
import { createStaticFiles } from './http/static.js';

// docs/API.md §2 item 5.
const SIGN_IN_WINDOW_MS = 60_000;
const SIGN_IN_LIMIT_PER_CLIENT = 10;
const SIGN_IN_LIMIT_OVERALL = 60;
// docs/API.md §3: at most one auth.denied audit row per minute.
const DENIED_ROW_INTERVAL_MS = 60_000;
const MAX_DENIAL_REASONS = 24;

const describe = (error) => ({ name: String(error?.name ?? 'Error'), message: String(error?.message ?? '').slice(0, 300) });

/**
 * Counts refused sign-ins in memory and writes them to the audit trail in batches.
 *
 * Why batches: the sign-in routes can be called by anyone, and the audit table is
 * permanent. One row per refusal would let a stranger grow it without limit; one row
 * per minute, carrying only a count and reason codes, cannot.
 */
function createDeniedSignIns({ db, clock, logger }) {
  const pending = new Map();
  let lastWrittenAt = Number.NEGATIVE_INFINITY;

  function flushIfDue() {
    if (pending.size === 0) return;
    const now = clock.now().getTime();
    if (now - lastWrittenAt < DENIED_ROW_INTERVAL_MS) return;
    // Reason codes are written as values, never as keys: the audit trail refuses keys
    // that look like they could name a secret, and some reason codes do.
    const reasons = [...pending].sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => ({ code, count }));
    const count = reasons.reduce((sum, item) => sum + item.count, 0);
    pending.clear();
    lastWrittenAt = now;
    try {
      recordAudit(createContext({ db, clock }), { action: 'auth.denied', entityType: 'auth', detail: { count, reasons } });
    } catch (error) {
      // Losing a tally must never turn a refused sign-in into a server error.
      logger.error({ event: 'error', request_id: null, ...describe(error) });
    }
  }

  return {
    /** @param {string} reason  a short code; anything unexpected is counted as "other" */
    note(reason) {
      const code = typeof reason === 'string' && /^[a-z_]{1,40}$/.test(reason) && (pending.has(reason) || pending.size < MAX_DENIAL_REASONS) ? reason : 'other';
      pending.set(code, (pending.get(code) ?? 0) + 1);
      flushIfDue();
    },
    flushIfDue,
  };
}

/**
 * @param {{
 *   config: ReturnType<import('./config.js').loadConfig>,
 *   db: import('./db/sqlite.js').Db,
 *   clock: { now(): Date },
 *   registry: ReturnType<import('./platforms/registry.js').createPlatformRegistry>,
 *   googleVerifier?: { verify: Function } | null,   required when config.authMode is "google"
 *   devLogin?: { attempt: Function, isLocked: Function } | null,   required when config.authMode is "dev"
 *   logger: { info(entry: object): void, error(entry: object): void },
 *   tombstonePath: string }} parts
 * @returns {{ handle: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void,
 *             close: () => void, routes: { method: string, path: string, audience: string }[] }}
 */
export function createApp({ config, db, clock, registry, googleVerifier = null, devLogin = null, logger, tombstonePath }) {
  if (!config || !db) throw new TypeError('createApp: config and db are required');
  if (typeof clock?.now !== 'function') throw new TypeError('createApp: clock is required');
  if (typeof logger?.info !== 'function' || typeof logger?.error !== 'function') throw new TypeError('createApp: logger must have info() and error()');
  if (typeof tombstonePath !== 'string' || tombstonePath.length === 0) throw new TypeError('createApp: tombstonePath is required');
  // The adapters decide whether results are simulated; they must be the ones the configuration asked for.
  if (registry?.mode !== config.platformMode) throw new TypeError('createApp: the platform registry does not match PLATFORM_MODE');
  if (config.authMode === 'google' && typeof googleVerifier?.verify !== 'function') throw new TypeError('createApp: googleVerifier is required when AUTH_MODE=google');
  if (config.authMode === 'dev' && typeof devLogin?.attempt !== 'function') throw new TypeError('createApp: devLogin is required when AUTH_MODE=dev');

  const denied = createDeniedSignIns({ db, clock, logger });

  /**
   * What must follow a committed erasure: the id goes into the tombstone file, so a
   * restored backup is erased again at the next start, and the integrity check runs.
   * @returns {boolean} whether the tombstone was written
   */
  function afterErasure(memberId, at) {
    let recorded = false;
    try {
      appendTombstone(tombstonePath, memberId, at);
      recorded = true;
    } catch (error) {
      logger.error({ event: 'tombstone_not_written', request_id: null, ...describe(error) });
    }
    const report = checkIntegrity(db);
    if (!report.ok) logger.error({ event: 'integrity_violation', request_id: null, checks: report.violations.map((item) => `${item.check}(${item.count})`) });
    return recorded;
  }

  const router = createRouter([
    ...authRoutes({
      config,
      registry,
      nonces: createNonceStore({ clock, ttlMs: NONCE_TTL_SECONDS * 1000 }),
      googleVerifier,
      devLogin,
      limits: {
        perClient: createRateLimiter({ clock, limit: SIGN_IN_LIMIT_PER_CLIENT, windowMs: SIGN_IN_WINDOW_MS }),
        overall: createRateLimiter({ clock, limit: SIGN_IN_LIMIT_OVERALL, windowMs: SIGN_IN_WINDOW_MS }),
      },
      denied,
    }),
    ...memberRoutes({ config, registry, logger, afterErasure }),
    ...adminRoutes({ config, db, registry, afterErasure }),
  ]);

  const pipeline = createPipeline({
    config,
    db,
    clock,
    router,
    staticFiles: createStaticFiles({ publicDir: config.publicDir }),
    logger,
    // A tally left over from a burst of refusals is written by the next request after the minute is up.
    beforeEach: denied.flushIfDue,
  });

  return Object.freeze({
    /** A node:http request listener. It never throws and never rejects. */
    handle(req, res) {
      pipeline(req, res).catch((error) => {
        logger.error({ event: 'error', request_id: null, ...describe(error) });
        res.destroy();
      });
    },
    /** Writes what is still owed to the audit trail. The database belongs to the caller and stays open. */
    close() {
      denied.flushIfDue();
    },
    routes: router.list(),
  });
}
