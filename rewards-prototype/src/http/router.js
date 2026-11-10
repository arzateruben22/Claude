// The route table: which method and path exist, and who may call each one.
//
// Rules protected here:
//   * Every route declares its audience. Authorization is decided from that declaration
//     before any handler code runs; the domain functions then check again on their own,
//     so one missing check on either side cannot grant anything.
//   * Everything under /api/admin/ is admin-only, and nothing admin-only lives anywhere
//     else. A route table that breaks this fails at start-up, not in production.
//   * Only the sign-in routes may change state without a session. They say so explicitly.
//   * A path parameter is a short opaque id. Anything else (a dot, a slash, a percent
//     escape, an address) simply does not match a route.
//
//   audience   public      no session needed
//              signed_in   any signed-in account
//              member      an account attached to a member
//              admin       an admin account

import { ID_PATTERN } from './request.js';

export const AUDIENCES = Object.freeze(['public', 'signed_in', 'member', 'admin']);
const METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ADMIN_PREFIX = '/api/admin/';

/**
 * @typedef {{ method: string, path: string, audience: 'public'|'signed_in'|'member'|'admin',
 *             signIn?: boolean, handler: (request: object) => object|Promise<object> }} Route
 */

function compile(route) {
  if (!METHODS.includes(route.method)) throw new TypeError(`route ${route.path}: unknown method ${route.method}`);
  if (typeof route.path !== 'string' || !route.path.startsWith('/')) throw new TypeError('route path must start with "/"');
  if (!AUDIENCES.includes(route.audience)) throw new TypeError(`route ${route.method} ${route.path}: unknown audience`);
  if (typeof route.handler !== 'function') throw new TypeError(`route ${route.method} ${route.path}: handler must be a function`);
  if (route.path.startsWith(ADMIN_PREFIX) !== (route.audience === 'admin')) {
    throw new TypeError(`route ${route.method} ${route.path}: admin routes live under ${ADMIN_PREFIX}, and only there`);
  }
  const changesState = route.method !== 'GET';
  if (changesState && (route.audience === 'public') !== (route.signIn === true)) {
    throw new TypeError(`route ${route.method} ${route.path}: only a sign-in route may change state without a session`);
  }
  const segments = route.path.split('/').slice(1).map((segment) => (segment.startsWith(':') ? { param: segment.slice(1) } : { literal: segment }));
  return { ...route, segments, params: segments.filter((segment) => segment.param).length };
}

/**
 * @param {Route[]} routes
 */
export function createRouter(routes) {
  // Literal paths are tried before patterns, so a fixed word is never taken for an id.
  const compiled = routes.map(compile).sort((a, b) => a.params - b.params);
  const seen = new Set();
  for (const route of compiled) {
    const key = `${route.method} ${route.segments.map((segment) => (segment.param ? ':' : segment.literal)).join('/')}`;
    if (seen.has(key)) throw new TypeError(`route ${route.method} ${route.path} is declared twice`);
    seen.add(key);
  }

  function paramsFor(route, parts) {
    if (parts.length !== route.segments.length) return null;
    const params = {};
    for (let index = 0; index < parts.length; index += 1) {
      const segment = route.segments[index];
      if (segment.param) {
        if (!ID_PATTERN.test(parts[index])) return null;
        params[segment.param] = parts[index];
      } else if (segment.literal !== parts[index]) return null;
    }
    return params;
  }

  return Object.freeze({
    /**
     * @param {string} method    the request method; HEAD is answered by the GET route
     * @param {string} pathname  the raw path, without the query string
     * @returns {{ route: Route, params: Record<string, string> } | { allowed: string[] } | null}
     *          `allowed` when the path exists but not for this method; null when it does not exist
     */
    match(method, pathname) {
      const wanted = method === 'HEAD' ? 'GET' : method;
      const parts = pathname.split('/').slice(1);
      const allowed = [];
      for (const route of compiled) {
        const params = paramsFor(route, parts);
        if (!params) continue;
        if (route.method === wanted) return { route, params };
        allowed.push(route.method);
      }
      return allowed.length > 0 ? { allowed: [...new Set(allowed)].sort() } : null;
    },

    /** Method, path and audience of every route, for start-up logs and for tests. */
    list() {
      return compiled.map(({ method, path, audience }) => ({ method, path, audience }));
    },
  });
}
