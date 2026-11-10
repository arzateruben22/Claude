// Verifies a Google ID token: the `credential` the Sign in with Google button hands to
// the page, which the page posts to POST /api/auth/google. See docs/API.md §3 and
// docs/PLATFORM_CAPABILITIES.md §3.
//
// This module answers one question only: "did Google issue this token, for this app,
// just now, in answer to the nonce we handed out?" It does NOT decide who may sign in:
// domain/users.js resolveSignIn() applies the allowlist and the identity rules to the
// claims returned here.
//
// Every failure is an IdTokenError. To a client it is always the contract's
// `401 sign_in_denied` with one generic sentence, so a response never says which check
// failed. `reason` is a short code for the caller's in-memory counters and the
// `auth.denied` audit row. The token, its claims and the library's own error are never
// attached to it: a jose claim error carries the whole payload, e-mail address included.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../lib/errors.js';
import { safeEqual } from '../lib/ids.js';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = Object.freeze(['accounts.google.com', 'https://accounts.google.com']);
/** A token is accepted for ten minutes after Google issued it, however long Google says it lives. */
export const MAX_TOKEN_AGE_SECONDS = 600;

// Real ID tokens are between one and two thousand characters. Anything far beyond that is
// not one, and is refused before any decoding or key lookup is spent on it.
const MAX_TOKEN_LENGTH = 8192;
// Same bound as domain/users.js resolveSignIn and Google's documented maximum for `sub`.
const MAX_SUB_LENGTH = 255;

const SIGN_IN_DENIED_MESSAGE = 'Sign-in was not accepted. Reload the page and try again; if it keeps happening, ask an admin to check your access.';

/**
 * Why a token was refused. For counters and audit rows only; never sent to a client.
 *   malformed         not a compact JWT, or a required claim is absent or of the wrong type
 *   wrong_algorithm   signed with anything but RS256 (this is where `alg: none` and HS256 land)
 *   unknown_key       no key in Google's set matches the token's key id
 *   keys_unavailable  Google's key set could not be loaded (network, time-out, bad response)
 *   bad_signature     the signature does not verify
 *   wrong_audience    issued for another app
 *   wrong_issuer      not issued by Google
 *   expired           past its `exp`
 *   too_old           issued more than ten minutes ago
 *   not_yet_valid     `iat` or `nbf` is in the future (a slow server clock looks like this)
 *   bad_subject       `sub` is absent, empty, not text or longer than 255 characters
 *   bad_nonce         the nonce is absent or wrong, or the caller had none to compare with
 *   verifier_error    anything unexpected; treated as a refusal so that a fault can never sign someone in
 */
export const ID_TOKEN_REASONS = Object.freeze([
  'malformed',
  'wrong_algorithm',
  'unknown_key',
  'keys_unavailable',
  'bad_signature',
  'wrong_audience',
  'wrong_issuer',
  'expired',
  'too_old',
  'not_yet_valid',
  'bad_subject',
  'bad_nonce',
  'verifier_error',
]);

/**
 * The one error verify() throws. It is an AppError (and keeps that name), so if it ever
 * reaches the HTTP error handler untouched the client still gets exactly
 * `401 sign_in_denied` and nothing else.
 */
export class IdTokenError extends AppError {
  /** @param {string} reason  one of ID_TOKEN_REASONS */
  constructor(reason) {
    if (!ID_TOKEN_REASONS.includes(reason)) throw new TypeError(`unknown ID token reason: ${reason}`);
    super(401, 'sign_in_denied', SIGN_IN_DENIED_MESSAGE);
    this.reason = reason;
  }
}

const CLAIM_REASONS = Object.freeze({ iss: 'wrong_issuer', aud: 'wrong_audience' });
const FUTURE_CLAIM_REASONS = Object.freeze({ iat: 'not_yet_valid', nbf: 'not_yet_valid' });

/** Maps a jose error to a reason code. Only `code`, `claim` and `reason` are read; the message and payload are dropped. */
function reasonFor(error) {
  switch (error?.code) {
    case 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED':
      return 'bad_signature';
    case 'ERR_JOSE_ALG_NOT_ALLOWED':
      return 'wrong_algorithm';
    case 'ERR_JWT_EXPIRED':
      return error.claim === 'iat' ? 'too_old' : 'expired';
    case 'ERR_JWT_CLAIM_VALIDATION_FAILED':
      if (Object.hasOwn(CLAIM_REASONS, error.claim)) return CLAIM_REASONS[error.claim];
      if (error.reason === 'check_failed' && Object.hasOwn(FUTURE_CLAIM_REASONS, error.claim)) return FUTURE_CLAIM_REASONS[error.claim];
      return 'malformed';
    case 'ERR_JWS_INVALID':
    case 'ERR_JWT_INVALID':
    case 'ERR_JOSE_NOT_SUPPORTED':
      return 'malformed';
    default:
      return 'verifier_error';
  }
}

const UNKNOWN_KEY_CODES = new Set(['ERR_JWKS_NO_MATCHING_KEY', 'ERR_JWKS_MULTIPLE_MATCHING_KEYS']);

/**
 * Google's published signing keys, fetched on first use and cached by jose (re-fetched
 * when a token names a key id it has not seen). Nothing is requested until the first
 * token is verified. Exported so the HTTP layer never needs to import jose itself.
 */
export function googleKeySet() {
  return createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
}

/**
 * @param {{ clientId: string, keySet: Function, clock: { now(): Date } }} options
 *        `keySet` is a jose key-set function: googleKeySet() in production,
 *        createLocalJWKSet(...) in tests.
 * @returns {((idToken: unknown, options?: { expectedNonce?: unknown }) => Promise<{ sub: string, email: string|undefined, emailVerified: boolean, hostedDomain: string|undefined }>) & { verify: Function }}
 *        The verifier. It can be called directly or as `verifier.verify(...)`; both are
 *        the same function.
 */
export function createGoogleVerifier({ clientId, keySet, clock }) {
  // jose skips the audience check altogether when it is given no audience. A missing
  // client id must therefore stop the server, not accept tokens issued to any app.
  if (typeof clientId !== 'string' || clientId.length === 0) throw new TypeError('createGoogleVerifier: clientId is required');
  if (typeof keySet !== 'function') throw new TypeError('createGoogleVerifier: keySet must be a jose key-set function');
  if (typeof clock?.now !== 'function') throw new TypeError('createGoogleVerifier: clock is required');

  // A failure to LOAD the keys is ours or Google's, not the visitor's. It gets its own
  // reason so that an outage is not counted as a forged token.
  const resolveKey = async (protectedHeader, token) => {
    try {
      return await keySet(protectedHeader, token);
    } catch (error) {
      throw new IdTokenError(UNKNOWN_KEY_CODES.has(error?.code) ? 'unknown_key' : 'keys_unavailable');
    }
  };

  /**
   * @param {unknown} idToken  the `credential` string from the page
   * @param {{ expectedNonce?: unknown }} [options]  the nonce this browser was given (its cookie)
   */
  async function verify(idToken, options) {
    // Without a nonce to compare with, the token cannot be tied to a sign-in this server
    // started, so it is refused before anything else is looked at.
    const expectedNonce = options?.expectedNonce;
    if (typeof expectedNonce !== 'string' || expectedNonce.length === 0) throw new IdTokenError('bad_nonce');
    // jose would also accept bytes; a credential from a JSON body is always text.
    if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > MAX_TOKEN_LENGTH) throw new IdTokenError('malformed');

    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, resolveKey, {
        // RS256 only: this is what refuses `alg: none` and an HS256 token "signed" with
        // the public key, before any key is fetched or any claim is read.
        algorithms: ['RS256'],
        audience: clientId,
        issuer: [...GOOGLE_ISSUERS],
        // jose treats `exp` as optional unless told otherwise; `iat` is required by maxTokenAge.
        requiredClaims: ['exp'],
        maxTokenAge: MAX_TOKEN_AGE_SECONDS,
        currentDate: clock.now(),
        // No leeway: "not expired" and "at most ten minutes old" mean exactly that. The
        // price is that a server clock running behind Google's refuses fresh tokens as
        // not_yet_valid, which the reason counters make visible.
        clockTolerance: 0,
      }));
    } catch (error) {
      throw error instanceof IdTokenError ? error : new IdTokenError(reasonFor(error));
    }

    // jose accepts an `aud` LIST that merely contains our client id. Google issues a
    // single audience; a token that is also addressed to someone else is not for us.
    if (payload.aud !== clientId) throw new IdTokenError('wrong_audience');
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > MAX_SUB_LENGTH) throw new IdTokenError('bad_subject');
    if (!safeEqual(payload.nonce, expectedNonce)) throw new IdTokenError('bad_nonce');

    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      // Strictly the boolean: resolveSignIn binds an address only when Google itself says it is verified.
      emailVerified: payload.email_verified === true,
      hostedDomain: typeof payload.hd === 'string' ? payload.hd : undefined,
    };
  }

  verify.verify = verify;
  return Object.freeze(verify);
}
