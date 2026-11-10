// Start-up, in the exact order of docs/API.md §1:
//
//   read config -> open database -> migrate -> install default tiers if none ->
//   create admins from ADMIN_EMAILS if there is no admin at all -> the refusals that need
//   the database -> re-erase any tombstoned member that reappeared -> integrity check ->
//   delete expired sessions (and, in google mode, every dev session) -> listen
//
// Rules protected here:
//   * The server either starts in a state it can vouch for, or does not start. Every
//     refusal says what is wrong in a sentence, and all refusals that apply are reported
//     together.
//   * A database that has seen real Google sign-ins is never served with simulated
//     sign-in, and a database holding simulated platform data is never served as live.
//   * A person who was erased stays erased, even if an older backup has been restored.
//   * The dev sign-in code is shown once, on the terminal, and goes nowhere else: not to
//     the request log, not into any response.
//
// Only this file and scripts/seed.js hand the environment to src/config.js.

import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { openDatabase } from './db/sqlite.js';
import { migrate } from './db/migrate.js';
import { readTombstones } from './db/tombstones.js';
import { createContext } from './domain/context.js';
import { replayErasures } from './domain/erasure.js';
import { assertIntegrity } from './domain/integrity.js';
import { ensureDefaultTiers } from './domain/tiers.js';
import { bootstrapAdmins } from './domain/users.js';
import { createDevLogin, generateDevLoginCode } from './auth/devLogin.js';
import { createGoogleVerifier, googleKeySet } from './auth/googleIdToken.js';
import { purgeExpiredSessions, purgeSessionsByMethod } from './auth/sessions.js';
import { systemClock } from './lib/clock.js';
import { DEMO_CHANNEL_PREFIX } from './platforms/mockData.js';
import { createPlatformRegistry } from './platforms/registry.js';

/** Thrown by start() when the database is not one this configuration may serve. */
export class StartupRefusal extends Error {
  /** @param {string[]} problems  one sentence each */
  constructor(problems) {
    super(`Refusing to start (${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'StartupRefusal';
    this.problems = Object.freeze([...problems]);
  }
}

const has = (db, sql, params) => db.get(sql, params) !== undefined;

/** The refusals of docs/API.md §1 that can only be decided by looking at the data. */
function databaseRefusals(db, config) {
  const problems = [];
  if (config.authMode === 'google' && !has(db, "SELECT 1 AS found FROM users WHERE role = 'admin' LIMIT 1")) {
    problems.push('There is no admin account and ADMIN_EMAILS names nobody who could become one. Set ADMIN_EMAILS to the address of the first admin.');
  }
  if (config.authMode === 'dev' && (has(db, 'SELECT 1 AS found FROM users WHERE google_sub IS NOT NULL LIMIT 1') || has(db, "SELECT 1 AS found FROM sessions WHERE auth_method = 'google' LIMIT 1"))) {
    problems.push('This database has been used with Google sign-in. It is never served with AUTH_MODE=dev; use a separate database for local work.');
  }
  if (config.platformMode === 'live') {
    // A check that was simulated but did not attest leaves its record on the claim too.
    if (has(db, "SELECT 1 AS found FROM claims WHERE verification_source = 'mock_adapter' OR verification_detail LIKE '%\"adapter_mode\":\"mock\"%' LIMIT 1")) {
      problems.push('This database holds submissions checked by the simulated adapter. It cannot be served with PLATFORM_MODE=live.');
    }
    if (has(db, "SELECT 1 AS found FROM videos WHERE stats_source = 'mock_adapter' LIMIT 1")) {
      problems.push('This database holds simulated video statistics. It cannot be served with PLATFORM_MODE=live.');
    }
    if (has(db, 'SELECT 1 AS found FROM members WHERE substr(youtube_channel_id, 1, ?) = ? LIMIT 1', [DEMO_CHANNEL_PREFIX.length, DEMO_CHANNEL_PREFIX])) {
      problems.push('This database holds a demo channel link from the sample data. It cannot be served with PLATFORM_MODE=live.');
    }
  }
  return problems;
}

/** The default request log: one JSON object per line, stamped by the application clock. */
const jsonLines = (stream, clock) => (entry) => stream.write(`${JSON.stringify({ at: clock.now().toISOString(), ...entry })}\n`);

/**
 * Boots the server.
 * @param {Record<string, string|undefined>} env  process.env, or a plain object in tests
 * @param {{ clock?: { now(): Date },
 *           logger?: { info(entry: object): void, error(entry: object): void },
 *           announce?: (text: string) => void,
 *           keySet?: Function }} [parts]
 *        Replaceable parts, for tests: the clock, the request log, where the dev sign-in
 *        code is shown (the terminal by default), and the Google key set (a local one, so
 *        no test touches the network).
 * @returns {Promise<{ server: import('node:http').Server, app: ReturnType<typeof createApp>,
 *                     config: ReturnType<typeof loadConfig>, close: () => Promise<void> }>}
 * @throws {import('./config.js').ConfigError | StartupRefusal}
 */
export async function start(env, { clock = systemClock, logger, announce = (text) => process.stdout.write(`${text}\n`), keySet } = {}) {
  const config = loadConfig(env);
  const log = logger ?? { info: jsonLines(process.stdout, clock), error: jsonLines(process.stderr, clock) };

  const db = openDatabase(config.databasePath);
  let server;
  try {
    migrate(db);
    const system = createContext({ db, clock });
    ensureDefaultTiers(system);
    bootstrapAdmins(system, config.adminEmails);

    const problems = databaseRefusals(db, config);
    if (problems.length > 0) throw new StartupRefusal(problems);

    const erasedAgain = replayErasures(system, readTombstones(config.tombstonePath));
    if (erasedAgain.length > 0) log.info({ event: 'erasures_replayed', count: erasedAgain.length });

    try {
      assertIntegrity(db);
    } catch (error) {
      const checks = (error.violations ?? []).map((item) => `${item.check} (${item.count})`).join(', ');
      throw new StartupRefusal([`The database fails its integrity self-check: ${checks || 'the check could not be completed'}.`]);
    }

    purgeExpiredSessions(system);
    if (config.authMode === 'google') purgeSessionsByMethod(system, 'dev');

    const registry = createPlatformRegistry({ mode: config.platformMode, clock });
    let googleVerifier = null;
    let devLogin = null;
    if (config.authMode === 'google') {
      googleVerifier = createGoogleVerifier({ clientId: config.googleClientId, keySet: keySet ?? googleKeySet(), clock });
    } else {
      const code = config.devLoginCode ?? generateDevLoginCode();
      devLogin = createDevLogin({ code });
      // A code that came from the environment is already known to whoever set it; only a
      // generated one needs showing, and it is shown here and nowhere else.
      announce(config.devLoginCode ? 'Dev sign-in is ON (simulated sign-in). The code is the one set in DEV_LOGIN_CODE.' : `Dev sign-in is ON (simulated sign-in). Code for this run: ${code}`);
    }

    const app = createApp({ config, db, clock, registry, googleVerifier, devLogin, logger: log, tombstonePath: config.tombstonePath });
    server = createServer(app.handle);
    // Slow or stalled clients are cut off rather than held open.
    server.headersTimeout = 10_000;
    server.requestTimeout = 30_000;
    await new Promise((resolvePromise, rejectPromise) => {
      server.once('error', rejectPromise);
      server.listen(config.port, config.host, () => {
        server.off('error', rejectPromise);
        resolvePromise();
      });
    });
    log.info({ event: 'listening', origin: config.appOrigin, port: server.address().port, auth_mode: config.authMode, platform_mode: config.platformMode });

    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await new Promise((resolvePromise) => {
        server.close(() => resolvePromise());
        server.closeAllConnections();
      });
      app.close();
      db.close();
    };
    return { server, app, config, close };
  } catch (error) {
    server?.close();
    db.close();
    throw error;
  }
}

function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  try {
    const running = await start(process.env);
    const stop = () => {
      running.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    // The two refusal types explain themselves; anything else is a fault worth a stack trace.
    process.stderr.write(`${error?.name === 'ConfigError' || error?.name === 'StartupRefusal' ? error.message : (error?.stack ?? error)}\n`);
    process.exitCode = 1;
  }
}
