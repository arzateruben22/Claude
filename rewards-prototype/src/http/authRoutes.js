// Sign-in, sign-out and "who am I" (docs/API.md §3), plus the health check.
//
// Rules protected here:
//   * Every refused Google sign-in gets the same answer: same status, same code, same
//     sentence, same cookies. The response never says whether the token, the nonce or the
//     allowlist said no. The reason goes to the in-memory counter only.
//   * A nonce is spent the first time it is presented, before anything else is looked at.
//   * Signing in never keeps the session a cookie already names: a token planted in the
//     browser beforehand dies here, and the person gets a fresh one.
//   * Sign-in attempts are rate-limited per client and overall, before any checking work.
//   * The dev sign-in route exists only when AUTH_MODE=dev, and the Google route only
//     when AUTH_MODE=google. In the other mode the path is simply not there (404).
//   * What a client learns about an account is { id, email, role, member_id } of the
//     account that is signed in, and nothing about any other.

import { AppError, isAppError, tooManyRequests } from '../lib/errors.js';
import * as v from '../lib/validate.js';
import { resolveSignIn } from '../domain/users.js';
import { clearNonceCookie, clearSessionCookie, cookieNames, nonceCookie, sessionCookie } from '../auth/cookies.js';
import { csrfTokenFor } from '../auth/csrf.js';
import { IdTokenError } from '../auth/googleIdToken.js';
import { createSession, destroySession } from '../auth/sessions.js';

/** How long a sign-in nonce (and its cookie) lives: the ten minutes of docs/API.md §3. */
export const NONCE_TTL_SECONDS = 600;

// One sentence for every refusal, taken from the verifier so the two can never drift apart.
const DENIED_MESSAGE = new IdTokenError('verifier_error').message;
const DENIAL_CODES = new Set(['sign_in_denied', 'not_signed_in']);

const accountView = (user) => ({ id: user.id, email: user.email, role: user.role, member_id: user.member_id });

/**
 * @param {{
 *   config: { authMode: 'google'|'dev', appOrigin: string, googleClientId: string|null, sessionTtlHours: number },
 *   registry: { simulated: boolean },
 *   nonces: { issue(): string, consume(nonce: unknown): boolean },
 *   googleVerifier: { verify(idToken: unknown, options: { expectedNonce: unknown }): Promise<object> } | null,
 *   devLogin: { attempt(ctx: object, input: object): object, isLocked(): boolean } | null,
 *   limits: { perClient: { check(key: string): { allowed: boolean, retryAfterSeconds: number } },
 *             overall: { check(key: string): { allowed: boolean, retryAfterSeconds: number } } },
 *   denied: { note(reason: string): void } }} deps
 * @returns {import('./router.js').Route[]}
 */
export function authRoutes({ config, registry, nonces, googleVerifier, devLogin, limits, denied }) {
  const names = cookieNames(config.appOrigin);

  /** Counts one sign-in attempt against both limits; refuses with 429 when either is used up. */
  function admit(client) {
    // The per-client limit is asked first, so one noisy client uses up its own allowance
    // and not everybody's.
    const own = limits.perClient.check(client);
    const verdict = own.allowed ? limits.overall.check('all') : own;
    if (verdict.allowed) return;
    denied.note('rate_limited');
    throw tooManyRequests('Too many sign-in attempts. Wait a moment and try again.', { retry_after_seconds: verdict.retryAfterSeconds });
  }

  function startSession(system, user, authMethod, cookies) {
    destroySession(system, cookies[names.session]);
    const session = createSession(system, { userId: user.id, authMethod, ttlHours: config.sessionTtlHours });
    return { body: { user: accountView(user) }, cookies: [sessionCookie(config.appOrigin, session)] };
  }

  function authConfig() {
    const body = { auth_mode: config.authMode, demo_mode: registry.simulated };
    if (config.authMode === 'google') {
      const nonce = nonces.issue();
      return {
        body: { ...body, google_client_id: config.googleClientId, nonce },
        cookies: [nonceCookie(config.appOrigin, { nonce, maxAgeSeconds: NONCE_TTL_SECONDS })],
      };
    }
    return { body: { ...body, dev_login: { locked: devLogin.isLocked() } } };
  }

  async function googleSignIn({ system, body, cookies, client }) {
    admit(client);
    const presentedNonce = cookies[names.nonce];
    const spendNonce = clearNonceCookie(config.appOrigin);
    const refuse = (reason) => {
      denied.note(reason);
      return { status: 401, body: new AppError(401, 'sign_in_denied', DENIED_MESSAGE).toJSON(), cookies: [spendNonce] };
    };
    if (!nonces.consume(presentedNonce)) return refuse('bad_nonce');
    const { credential } = v.only(body, ['credential']);
    try {
      const identity = await googleVerifier.verify(credential, { expectedNonce: presentedNonce });
      const resolved = resolveSignIn(system, identity);
      if (!resolved) return refuse('not_allowlisted');
      const reply = startSession(system, resolved.user, 'google', cookies);
      return { ...reply, cookies: [spendNonce, ...reply.cookies] };
    } catch (error) {
      if (isAppError(error) && DENIAL_CODES.has(error.code)) return refuse(typeof error.reason === 'string' ? error.reason : 'account_not_active');
      throw error;
    }
  }

  function devSignIn({ system, body, cookies, client }) {
    admit(client);
    const input = v.only(body, ['email', 'code']);
    let user;
    try {
      user = devLogin.attempt(system, input);
    } catch (error) {
      if (isAppError(error) && typeof error.reason === 'string') denied.note(error.reason);
      throw error;
    }
    return startSession(system, user, 'dev', cookies);
  }

  function signOut({ system, body, sessionToken }) {
    v.only(body, []);
    destroySession(system, sessionToken);
    return { body: { ok: true }, cookies: [clearSessionCookie(config.appOrigin)] };
  }

  const whoAmI = ({ user, sessionToken }) => ({
    body: { user: accountView(user), csrf_token: csrfTokenFor(sessionToken), auth_mode: config.authMode, demo_mode: registry.simulated },
  });

  return [
    { method: 'GET', path: '/healthz', audience: 'public', handler: () => ({ body: { ok: true }, headers: { 'Cache-Control': 'no-store' } }) },
    { method: 'GET', path: '/api/auth/config', audience: 'public', handler: authConfig },
    config.authMode === 'google'
      ? { method: 'POST', path: '/api/auth/google', audience: 'public', signIn: true, handler: googleSignIn }
      : { method: 'POST', path: '/api/auth/dev-login', audience: 'public', signIn: true, handler: devSignIn },
    { method: 'POST', path: '/api/auth/logout', audience: 'signed_in', handler: signOut },
    { method: 'GET', path: '/api/session', audience: 'signed_in', handler: whoAmI },
  ];
}
