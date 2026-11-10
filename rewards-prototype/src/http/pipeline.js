// The one path every request takes (docs/API.md §2), in this fixed order:
//
//   1. a request id
//   2. the Host check                                   421 wrong_host
//   3. route lookup (API route, else a listed static file)   404 / 405
//   4. for a state-changing request, in the contract's order:
//        Origin                                         403 bad_origin
//        content type, size, JSON object                415 / 413 / 400
//   5. the session, from the cookie                     401 not_signed_in
//        and for a state-changing request its CSRF token     403 bad_csrf
//   6. the route's audience                             403 admin_only / member_only
//   7. the handler
//   8. security headers on whatever is sent, and one log line
//
// Rules protected here:
//   * Who is acting comes from the session's account row, re-read on every request. It
//     is never taken from the body, the query or the path.
//   * An unexpected failure tells the client nothing but a request id. The log gets the
//     error's name and message, and never a body, a cookie, a token or an address.
//   * A handler receives plain values and returns a plain reply; only this module
//     touches the response object.

import { AppError, forbidden, isAppError, notFound, unauthorized } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { createContext, withActor } from '../domain/context.js';
import { cookieNames, parseCookieHeader } from '../auth/cookies.js';
import { verifyCsrf } from '../auth/csrf.js';
import { clientKey } from '../auth/rateLimit.js';
import { resolveSession } from '../auth/sessions.js';
import { readJsonObject } from './request.js';
import { hostMatches, originMatches, securityHeaders } from './security.js';

const JSON_TYPE = 'application/json; charset=utf-8';
// A path is logged only when it is made of characters an opaque id or a file name can
// contain. Anything else was typed by the caller and could be an address or a token.
const LOGGABLE_PATH = /^[A-Za-z0-9/_.~-]{1,200}$/;
const MAX_LOGGED_MESSAGE = 300;

/** The raw path of a request target, or null when it is not an origin-form path. */
function pathOf(target) {
  if (typeof target !== 'string' || !target.startsWith('/')) return null;
  const end = target.indexOf('?');
  return end === -1 ? target : target.slice(0, end);
}

function queryOf(target) {
  const start = target.indexOf('?');
  return new URLSearchParams(start === -1 ? '' : target.slice(start + 1));
}

/**
 * @param {{
 *   config: { appOrigin: string, expectedHost: string, secureOrigin: boolean, authMode: 'google'|'dev', trustProxyHops: number },
 *   db: import('../db/sqlite.js').Db, clock: { now(): Date },
 *   router: ReturnType<import('./router.js').createRouter>,
 *   staticFiles: ReturnType<import('./static.js').createStaticFiles>,
 *   logger: { info(entry: object): void, error(entry: object): void },
 *   beforeEach?: () => void }} deps
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createPipeline({ config, db, clock, router, staticFiles, logger, beforeEach = () => {} }) {
  const names = cookieNames(config.appOrigin);

  async function replyTo(req, seen) {
    if (!hostMatches(req, config.expectedHost)) throw new AppError(421, 'wrong_host', 'This server does not answer for that host name.');
    if (seen.pathname === null) throw notFound();

    const matched = router.match(seen.method, seen.pathname);
    if (!matched) {
      const file = seen.method === 'GET' || seen.method === 'HEAD' ? await staticFiles.read(seen.pathname) : null;
      if (!file) throw notFound();
      return { status: 200, contentType: file.contentType, content: file.content, headers: { 'Cache-Control': 'no-cache' } };
    }
    if (matched.allowed) {
      const error = new AppError(405, 'method_not_allowed', 'That method is not available here.');
      error.headers = { Allow: matched.allowed.join(', ') };
      throw error;
    }
    const { route, params } = matched;
    const changesState = seen.method !== 'GET' && seen.method !== 'HEAD';

    let body = {};
    if (changesState) {
      if (!originMatches(req, config.appOrigin)) throw forbidden('bad_origin', 'This request did not come from the app itself.');
      body = await readJsonObject(req);
    }

    const system = createContext({ db, clock, requestId: seen.requestId });
    const cookies = parseCookieHeader(req.headers.cookie);
    const sessionToken = cookies[names.session];
    const resolved = sessionToken === undefined ? null : resolveSession(system, sessionToken, { authMode: config.authMode });
    if (resolved) seen.userId = resolved.user.id;

    if (route.audience !== 'public') {
      if (!resolved) throw unauthorized();
      if (changesState && !verifyCsrf(sessionToken, req.headers['x-csrf-token'])) {
        throw forbidden('bad_csrf', 'This request is missing its security token. Reload the page and try again.');
      }
      if (route.audience === 'admin' && resolved.user.role !== 'admin') throw forbidden('admin_only', 'Only an admin can do that.');
      if (route.audience === 'member' && !resolved.user.member_id) throw forbidden('member_only', 'This is only for an account that belongs to a member.');
    }

    // The actor is rebuilt from the account row on every request: a role or member link
    // changed a moment ago already counts.
    const ctx = resolved ? withActor(system, { userId: resolved.user.id, role: resolved.user.role, memberId: resolved.user.member_id }) : null;
    return route.handler({
      ctx,
      system,
      user: resolved?.user ?? null,
      params,
      query: queryOf(req.url),
      body,
      cookies,
      sessionToken: resolved ? sessionToken : null,
      idempotencyKey: req.headers['idempotency-key'],
      client: clientKey({ remoteAddress: req.socket.remoteAddress, forwardedFor: req.headers['x-forwarded-for'], trustProxyHops: config.trustProxyHops }),
    });
  }

  function replyForError(error, seen) {
    if (isAppError(error)) {
      const retryAfter = error.status === 429 ? error.details?.retry_after_seconds : undefined;
      return {
        status: error.status,
        body: error.toJSON(),
        headers: { ...(error.headers ?? {}), ...(Number.isInteger(retryAfter) ? { 'Retry-After': String(retryAfter) } : {}) },
        closeConnection: error.closeConnection === true,
      };
    }
    logger.error({ event: 'error', request_id: seen.requestId, name: String(error?.name ?? 'Error'), message: String(error?.message ?? '').slice(0, MAX_LOGGED_MESSAGE) });
    return {
      status: 500,
      body: { error: { code: 'internal_error', message: 'Something went wrong on the server. Try again in a moment.', request_id: seen.requestId } },
    };
  }

  function send(req, res, reply, seen) {
    if (res.destroyed || res.writableEnded) return;
    const content = reply.content ?? Buffer.from(JSON.stringify(reply.body ?? {}));
    res.statusCode = reply.status ?? 200;
    for (const [name, value] of Object.entries(securityHeaders({ secureOrigin: config.secureOrigin, api: seen.api }))) res.setHeader(name, value);
    for (const [name, value] of Object.entries(reply.headers ?? {})) res.setHeader(name, value);
    res.setHeader('Content-Type', reply.contentType ?? JSON_TYPE);
    res.setHeader('Content-Length', content.length);
    if (reply.cookies?.length) res.setHeader('Set-Cookie', reply.cookies);
    if (reply.closeConnection) {
      // The rest of an oversized upload is not going to be read.
      res.setHeader('Connection', 'close');
      res.end(seen.method === 'HEAD' ? undefined : content, () => req.destroy());
      return;
    }
    res.end(seen.method === 'HEAD' ? undefined : content);
  }

  return async function handle(req, res) {
    const startedAt = clock.now().getTime();
    const pathname = pathOf(req.url);
    const seen = {
      requestId: newId('req'),
      method: req.method ?? 'GET',
      pathname,
      // Decided from the path alone, so an error on an API path is as uncacheable as a success.
      api: pathname !== null && pathname.startsWith('/api/'),
      userId: null,
    };
    let reply;
    try {
      beforeEach();
      reply = await replyTo(req, seen);
    } catch (error) {
      reply = replyForError(error, seen);
    }
    try {
      send(req, res, reply, seen);
    } catch (error) {
      logger.error({ event: 'error', request_id: seen.requestId, name: String(error?.name ?? 'Error'), message: String(error?.message ?? '').slice(0, MAX_LOGGED_MESSAGE) });
      res.destroy();
    }
    logger.info({
      event: 'request',
      method: seen.method,
      path: pathname !== null && LOGGABLE_PATH.test(pathname) ? pathname : '(not logged)',
      status: reply.status ?? 200,
      ms: clock.now().getTime() - startedAt,
      request_id: seen.requestId,
      user_id: seen.userId,
    });
  };
}
