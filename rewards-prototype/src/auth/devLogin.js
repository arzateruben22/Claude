// Dev-mode sign-in (AUTH_MODE=dev): an allowlisted address plus the code printed once in
// the terminal at start. See docs/API.md §1 and §3.
//
// Why a code at all: a dev server is often reachable through a preview link or a tunnel,
// and "type any allowlisted address" would hand accounts to whoever finds the URL. The
// code proves the person can read the terminal the server was started from.
//
// Rules protected here:
//   * The code is compared in constant time.
//   * After `maxFailures` wrong codes, dev sign-in is locked until the process restarts.
//     The count never resets, so guesses cannot be spread out, and once locked even the
//     correct code is refused, so a lock cannot be used to test guesses.
//   * A wrong code and an unknown or disabled address get the same refusal: status, code
//     and sentence are identical, so the route cannot be used to learn who is on the
//     allowlist.
//
// The code itself never appears in an error, a return value or an audit row. Each error
// carries a `reason` for the caller's in-memory counters; AppError does not serialise it.

import { randomBytes } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import { safeEqual, sha256Hex } from '../lib/ids.js';
import { findActiveUserByEmail } from '../domain/users.js';

/** DEV_LOGIN_CODE must be at least this long (docs/API.md §1). */
export const MIN_DEV_LOGIN_CODE_LENGTH = 16;

function refusal(status, code, message, reason) {
  const error = new AppError(status, code, message);
  error.reason = reason;
  return error;
}

const denied = (reason) => refusal(401, 'sign_in_denied', 'Sign-in was not accepted. Check the address and the code shown in the terminal.', reason);
const locked = () =>
  refusal(403, 'dev_login_locked', 'Dev sign-in is locked after too many wrong codes. Restart the server to unlock it.', 'locked');

/** A fresh sign-in code for one run of the server: 128 random bits, URL-safe (22 characters). */
export function generateDevLoginCode() {
  return randomBytes(16).toString('base64url');
}

/**
 * @param {{ code: string, maxFailures?: number }} options
 *        `code` is DEV_LOGIN_CODE or generateDevLoginCode(); it is held only as a hash
 */
export function createDevLogin({ code, maxFailures = 5 }) {
  // An empty or missing code would make an empty guess "correct".
  if (typeof code !== 'string' || code.length < MIN_DEV_LOGIN_CODE_LENGTH) {
    throw new TypeError(`createDevLogin: code must be at least ${MIN_DEV_LOGIN_CODE_LENGTH} characters`);
  }
  if (!Number.isInteger(maxFailures) || maxFailures < 1) throw new TypeError('createDevLogin: maxFailures must be a positive whole number');

  // Both sides are hashed before the comparison. safeEqual() answers early when lengths
  // differ, which would otherwise tell a guesser how long the code is; two hashes always
  // have the same length.
  const expectedHash = sha256Hex(code);
  let failures = 0;

  return Object.freeze({
    /**
     * @param {{ email: unknown, code: unknown }} input  as posted to /api/auth/dev-login
     * @returns {object} the account view from domain/users.js findActiveUserByEmail
     * @throws {AppError} 401 sign_in_denied, or 403 dev_login_locked once locked
     */
    attempt(ctx, { email, code: presented } = {}) {
      if (failures >= maxFailures) throw locked();
      if (typeof presented !== 'string' || !safeEqual(sha256Hex(presented), expectedHash)) {
        failures += 1;
        throw denied('wrong_code');
      }
      // Only reached with the right code, so the allowlist is never consulted for a guesser.
      const user = typeof email === 'string' ? findActiveUserByEmail(ctx, email) : null;
      if (!user) throw denied('unknown_account');
      return user;
    },

    /** Whether dev sign-in has locked itself; GET /api/auth/config reports this. */
    isLocked() {
      return failures >= maxFailures;
    },
  });
}
