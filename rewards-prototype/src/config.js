// Environment -> validated, frozen configuration (docs/API.md §1).
//
// This is the ONLY module that is handed the environment. Nothing else in the codebase
// reads process.env: src/server.js and scripts/seed.js pass it in here and use the result.
//
// Rules protected here:
//   * AUTH_MODE, PLATFORM_MODE and APP_ORIGIN have no defaults. A forgotten variable must
//     stop the boot, not quietly choose simulated sign-in, sample data or a weaker cookie.
//   * The security posture follows APP_ORIGIN (https, or http on this machine only),
//     never NODE_ENV.
//   * Every problem is reported in one error, so a deployment is put right in one pass
//     instead of one restart per mistake.
//   * A message names the variable and the rule. It never repeats a value: a value may be
//     the dev sign-in code or somebody's e-mail address, and start-up errors end up in logs.
//
// What can only be decided with the database open (is there an admin, has Google sign-in
// ever been used, is there simulated data, does the integrity check pass) is decided in
// src/server.js.

import { existsSync, realpathSync } from 'node:fs';
import { isIP } from 'node:net';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUTH_MODES = Object.freeze(['google', 'dev']);
export const PLATFORM_MODES = Object.freeze(['mock', 'live']);

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_DATABASE_PATH = './data/rewards.db';
const DEFAULT_SESSION_TTL_HOURS = 168;
const MAX_SESSION_TTL_HOURS = 720;
const MAX_TRUST_PROXY_HOPS = 3;
const MIN_DEV_LOGIN_CODE_LENGTH = 16;
const GOOGLE_CLIENT_ID = /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/;
// The same deliberately simple shape as lib/validate.js: the list is typed by the owner.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Plain http is for a browser on this machine only (matches src/auth/cookies.js).
const LOCAL_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

/** Thrown by loadConfig(). `problems` holds one sentence per mistake, all of them. */
export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`The configuration is not valid (${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = Object.freeze([...problems]);
  }
}

/** A variable that is unset, empty or only spaces counts as not set. */
function read(env, name) {
  const value = env?.[name];
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

function wholeNumber(text) {
  return /^\d{1,9}$/.test(text) ? Number(text) : Number.NaN;
}

function isLoopback(host) {
  if (host === 'localhost') return true;
  if (isIP(host) === 4) return host.startsWith('127.');
  return isIP(host) === 6 && (host === '::1' || host === '0:0:0:0:0:0:0:1');
}

/**
 * The path with its nearest existing ancestor resolved through symbolic links, so that a
 * link leading into public/ is seen for what it is even before the file exists.
 */
function canonical(path) {
  const missing = [];
  let existing = path;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return path;
    missing.unshift(basename(existing));
    existing = parent;
  }
  return join(realpathSync(existing), ...missing);
}

function isInside(child, parent) {
  const hop = relative(parent, child);
  return hop === '' || (hop !== '..' && !hop.startsWith(`..${sep}`) && !isAbsolute(hop));
}

/**
 * @param {Record<string, string|undefined>} env  process.env, or a plain object in tests
 * @param {{ publicDir?: string }} [options]  where static files live (tests point this at a temporary folder)
 * @returns {Readonly<{
 *   authMode: 'google'|'dev', platformMode: 'mock'|'live',
 *   appOrigin: string, secureOrigin: boolean, expectedHost: string,
 *   host: string, port: number, databasePath: string, tombstonePath: string, publicDir: string,
 *   googleClientId: string|null, adminEmails: readonly string[],
 *   sessionTtlHours: number, trustProxyHops: number, devLoginCode: string|null }>}
 * @throws {ConfigError} listing every problem found
 */
export function loadConfig(env, { publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  const problems = [];

  const authMode = read(env, 'AUTH_MODE');
  if (authMode === undefined) problems.push('AUTH_MODE is required: set it to "google" or "dev". There is no default.');
  else if (!AUTH_MODES.includes(authMode)) problems.push('AUTH_MODE must be exactly "google" or "dev".');

  const platformMode = read(env, 'PLATFORM_MODE');
  if (platformMode === undefined) problems.push('PLATFORM_MODE is required: set it to "mock" or "live". There is no default.');
  else if (!PLATFORM_MODES.includes(platformMode)) problems.push('PLATFORM_MODE must be exactly "mock" or "live".');

  const appOrigin = read(env, 'APP_ORIGIN');
  let originUrl = null;
  if (appOrigin === undefined) {
    problems.push('APP_ORIGIN is required: the exact origin the app is opened at, for example https://rewards.example.test or http://localhost:8787. There is no default.');
  } else {
    try {
      originUrl = new URL(appOrigin);
    } catch {
      problems.push('APP_ORIGIN must be an origin such as https://rewards.example.test or http://localhost:8787.');
    }
    if (originUrl && originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
      problems.push('APP_ORIGIN must start with https:// (or http:// for localhost).');
    } else if (originUrl) {
      // Requests are checked against this string exactly (Origin and Host), so it has to
      // be spelled the way a browser spells an origin.
      if (originUrl.origin !== appOrigin) {
        problems.push('APP_ORIGIN must be a bare origin: scheme, host and an optional non-default port, in lower case, with no path, query or trailing slash.');
      }
      if (originUrl.protocol === 'http:' && !LOCAL_ORIGIN_HOSTS.has(originUrl.hostname)) {
        problems.push('APP_ORIGIN may use http:// only for localhost, 127.0.0.1 or [::1]. Anything else must be https://.');
      }
    }
  }

  const host = read(env, 'HOST') ?? DEFAULT_HOST;
  if (authMode === 'dev' && !isLoopback(host)) {
    problems.push('HOST must be a loopback address (127.0.0.1, ::1 or localhost) when AUTH_MODE=dev: simulated sign-in is never offered on a network interface.');
  }

  const portText = read(env, 'PORT');
  const port = portText === undefined ? DEFAULT_PORT : wholeNumber(portText);
  if (!Number.isInteger(port) || port > 65535) problems.push('PORT must be a whole number from 0 to 65535.');

  const googleClientId = read(env, 'GOOGLE_CLIENT_ID');
  if (authMode === 'google' && (googleClientId === undefined || !GOOGLE_CLIENT_ID.test(googleClientId))) {
    problems.push('GOOGLE_CLIENT_ID is required when AUTH_MODE=google and must end in .apps.googleusercontent.com.');
  }

  const adminEmails = [];
  (read(env, 'ADMIN_EMAILS') ?? '').split(',').forEach((entry, index) => {
    const address = entry.trim().toLowerCase();
    if (address.length === 0) return;
    if (address.length > 254 || !EMAIL.test(address)) problems.push(`ADMIN_EMAILS entry ${index + 1} is not an e-mail address.`);
    else if (!adminEmails.includes(address)) adminEmails.push(address);
  });

  const ttlText = read(env, 'SESSION_TTL_HOURS');
  const sessionTtlHours = ttlText === undefined ? DEFAULT_SESSION_TTL_HOURS : wholeNumber(ttlText);
  if (!Number.isInteger(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > MAX_SESSION_TTL_HOURS) {
    problems.push(`SESSION_TTL_HOURS must be a whole number from 1 to ${MAX_SESSION_TTL_HOURS}.`);
  }

  const hopsText = read(env, 'TRUST_PROXY_HOPS');
  const trustProxyHops = hopsText === undefined ? 0 : wholeNumber(hopsText);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops > MAX_TRUST_PROXY_HOPS) {
    problems.push(`TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS}.`);
  }

  // Read without trimming: the code is compared character for character.
  const devLoginCode = typeof env?.DEV_LOGIN_CODE === 'string' && env.DEV_LOGIN_CODE.length > 0 ? env.DEV_LOGIN_CODE : undefined;
  if (devLoginCode !== undefined && devLoginCode.length < MIN_DEV_LOGIN_CODE_LENGTH) {
    problems.push(`DEV_LOGIN_CODE must be at least ${MIN_DEV_LOGIN_CODE_LENGTH} characters. Leave it unset to get a random code at every start.`);
  }

  // Everything under public/ is served to anyone who asks for it by name.
  const databasePath = resolve(read(env, 'DATABASE_PATH') ?? DEFAULT_DATABASE_PATH);
  const resolvedPublicDir = resolve(publicDir);
  if (isInside(databasePath, resolvedPublicDir) || isInside(canonical(databasePath), canonical(resolvedPublicDir))) {
    problems.push('DATABASE_PATH must not be inside public/: files there are served to browsers.');
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze({
    authMode,
    platformMode,
    appOrigin,
    secureOrigin: originUrl.protocol === 'https:',
    // What the Host header must say: host, plus the port unless it is the scheme's default.
    expectedHost: originUrl.host,
    host,
    port,
    databasePath,
    // Next to the database, so the list of erased ids travels with the file it guards.
    tombstonePath: `${databasePath}.tombstones.jsonl`,
    publicDir: resolvedPublicDir,
    googleClientId: authMode === 'google' ? googleClientId : null,
    adminEmails: Object.freeze(adminEmails),
    sessionTtlHours,
    trustProxyHops,
    devLoginCode: authMode === 'dev' ? (devLoginCode ?? null) : null,
  });
}
