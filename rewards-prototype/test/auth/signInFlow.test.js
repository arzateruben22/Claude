// The sign-in modules used together, in the order the HTTP layer uses them
// (docs/API.md §3). There is no HTTP here: each step is the pure call a route makes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { makeWorld, insertMember, insertUser, count } from '../helpers.js';
import { resolveSignIn, updateUser } from '../../src/domain/users.js';
import { listAudit } from '../../src/domain/audit.js';
import { clearNonceCookie, clearSessionCookie, cookieNames, nonceCookie, parseCookieHeader, sessionCookie } from '../../src/auth/cookies.js';
import { csrfTokenFor, verifyCsrf } from '../../src/auth/csrf.js';
import { createDevLogin, generateDevLoginCode } from '../../src/auth/devLogin.js';
import { IdTokenError, createGoogleVerifier } from '../../src/auth/googleIdToken.js';
import { createNonceStore } from '../../src/auth/nonces.js';
import { createSession, destroySession, purgeExpiredSessions, purgeSessionsByMethod, resolveSession } from '../../src/auth/sessions.js';

const APP_ORIGIN = 'https://rewards.example.test';
const CLIENT_ID = 'rewards-test-client.apps.googleusercontent.com';
const KID = 'google-key-1';
const TTL_HOURS = 168;

const google = await generateKeyPair('RS256', { extractable: true });
const keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }] });

/** What Google would return to the page for this person, for the nonce the page was given. */
function googleCredential(world, { sub, email, nonce }) {
  const now = Math.floor(world.clock.now().getTime() / 1000);
  return new SignJWT({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub, email, email_verified: true, hd: 'example.test', nonce, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .sign(google.privateKey);
}

/** The browser: keeps the cookies it is given and sends them back as one Cookie header. */
function browser() {
  const jar = new Map();
  return {
    receive(setCookie) {
      const [pair, ...attributes] = setCookie.split('; ');
      const name = pair.slice(0, pair.indexOf('='));
      if (attributes.includes('Max-Age=0')) jar.delete(name);
      else jar.set(name, pair.slice(pair.indexOf('=') + 1));
    },
    header: () => [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
  };
}

/** The app wiring a server would build once at start-up in google mode. */
function googleApp(world) {
  const names = cookieNames(APP_ORIGIN);
  const nonces = createNonceStore({ clock: world.clock });
  const verifier = createGoogleVerifier({ clientId: CLIENT_ID, keySet, clock: world.clock });
  return {
    names,
    /** GET /api/auth/config */
    config(client) {
      const nonce = nonces.issue();
      client.receive(nonceCookie(APP_ORIGIN, { nonce, maxAgeSeconds: 600 }));
      return { auth_mode: 'google', google_client_id: CLIENT_ID, nonce };
    },
    /** POST /api/auth/google { credential } */
    async signIn(client, credential) {
      const cookies = parseCookieHeader(client.header());
      const cookieNonce = cookies[names.nonce];
      // The nonce is spent on first presentation, pass or fail, and its cookie goes with it.
      client.receive(clearNonceCookie(APP_ORIGIN));
      if (!nonces.consume(cookieNonce)) throw new IdTokenError('bad_nonce');
      const identity = await verifier.verify(credential, { expectedNonce: cookieNonce });
      const resolved = resolveSignIn(world.system, identity);
      if (!resolved) return null;
      destroySession(world.system, cookies[names.session]);
      const session = createSession(world.system, { userId: resolved.user.id, authMethod: 'google', ttlHours: TTL_HOURS });
      client.receive(sessionCookie(APP_ORIGIN, session));
      return resolved.user;
    },
    /** What every later request does first. */
    whoAmI(client) {
      const token = parseCookieHeader(client.header())[names.session];
      const resolved = resolveSession(world.system, token, { authMode: 'google' });
      return resolved ? { user: resolved.user, csrf_token: csrfTokenFor(token), sessionToken: token } : null;
    },
    /** POST /api/auth/logout */
    signOut(client) {
      destroySession(world.system, parseCookieHeader(client.header())[names.session]);
      client.receive(clearSessionCookie(APP_ORIGIN));
    },
  };
}

function allowlist(world, name) {
  const memberId = insertMember(world.db, { name });
  const userId = insertUser(world.db, { email: `${name.toLowerCase()}@example.test`, role: 'member', memberId });
  return { memberId, userId };
}

test('Google sign-in end to end: nonce, verified token, allowlist, session cookie, CSRF token, sign-out', async () => {
  const world = makeWorld();
  const ada = allowlist(world, 'Ada');
  const app = googleApp(world);
  const client = browser();
  assert.equal(app.whoAmI(client), null, 'nobody is signed in yet');

  const { nonce } = app.config(client);
  assert.equal(parseCookieHeader(client.header())['__Host-nonce'], nonce);
  const user = await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce }));
  assert.equal(user.id, ada.userId);
  assert.equal(user.member_id, ada.memberId);
  assert.deepEqual(Object.keys(parseCookieHeader(client.header())), ['__Host-sid'], 'the nonce cookie is gone, the session cookie is set');

  const me = app.whoAmI(client);
  assert.equal(me.user.id, ada.userId);
  assert.equal(me.user.signed_in_before, true);
  assert.equal(verifyCsrf(me.sessionToken, me.csrf_token), true);
  assert.equal(count(world.db, 'sessions'), 1);
  assert.deepEqual(listAudit(world.admin, { action: 'user.first_sign_in' }).items.map((row) => row.entity_id), [ada.userId]);

  // Nothing secret reached the database or the audit trail.
  const stored = JSON.stringify([world.db.all('SELECT * FROM sessions'), world.db.all('SELECT * FROM audit_log')]);
  for (const secret of [me.sessionToken, me.csrf_token, nonce, 'ada@example.test', 'google-sub-ada']) assert.ok(!stored.includes(secret));

  app.signOut(client);
  assert.equal(client.header(), '');
  assert.equal(app.whoAmI(client), null);
  assert.equal(resolveSession(world.system, me.sessionToken, { authMode: 'google' }), null, 'the old token is dead on the server, not just forgotten by the browser');
  assert.equal(count(world.db, 'sessions'), 0);
});

test('a captured token cannot be replayed, and cannot be used from another browser', async () => {
  const world = makeWorld();
  allowlist(world, 'Ada');
  const app = googleApp(world);
  const victim = browser();
  const { nonce } = app.config(victim);
  const credential = await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce });

  // An attacker's browser holds a different nonce cookie: the stolen token does not match it.
  const attacker = browser();
  app.config(attacker);
  await assert.rejects(app.signIn(attacker, credential), (error) => error instanceof IdTokenError && error.reason === 'bad_nonce');
  // A browser with no nonce cookie at all gets nowhere either.
  await assert.rejects(app.signIn(browser(), credential), (error) => error instanceof IdTokenError && error.reason === 'bad_nonce');

  // The rightful browser signs in once…
  assert.ok(await app.signIn(victim, credential));
  // …and the very same request replayed, nonce cookie included, is refused: the nonce is spent.
  const replay = browser();
  replay.receive(nonceCookie(APP_ORIGIN, { nonce, maxAgeSeconds: 600 }));
  await assert.rejects(app.signIn(replay, credential), (error) => error instanceof IdTokenError && error.reason === 'bad_nonce');
  assert.equal(count(world.db, 'sessions'), 1);
});

test('a failed attempt spends the nonce: the next try needs a fresh one', async () => {
  const world = makeWorld();
  allowlist(world, 'Ada');
  const app = googleApp(world);
  const client = browser();
  const { nonce } = app.config(client);
  const good = await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce });

  // First presentation fails for an unrelated reason (the token is for another nonce)…
  const other = await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce: 'bm9uY2UtZm9yLWFub3RoZXItYnJvd3Nlci0wMDAwMDI' });
  await assert.rejects(app.signIn(client, other), (error) => error.reason === 'bad_nonce');
  // …so even the good token for that nonce is now useless, cookie or no cookie.
  client.receive(nonceCookie(APP_ORIGIN, { nonce, maxAgeSeconds: 600 }));
  await assert.rejects(app.signIn(client, good), (error) => error.reason === 'bad_nonce');

  const fresh = app.config(client);
  assert.ok(await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce: fresh.nonce })));
});

test('a genuine Google account that is not on the allowlist gets no session', async () => {
  const world = makeWorld();
  allowlist(world, 'Ada');
  const app = googleApp(world);
  const client = browser();
  const { nonce } = app.config(client);
  const user = await app.signIn(client, await googleCredential(world, { sub: 'google-sub-stranger', email: 'stranger@example.test', nonce }));
  assert.equal(user, null, 'the token is genuine; resolveSignIn is what says no');
  assert.equal(count(world.db, 'sessions'), 0);
  assert.equal(app.whoAmI(client), null);
});

test('signing in again discards the previous session and issues a new token and CSRF token', async () => {
  const world = makeWorld();
  const ada = allowlist(world, 'Ada');
  const app = googleApp(world);
  const client = browser();

  let config = app.config(client);
  await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce: config.nonce }));
  const first = app.whoAmI(client);

  world.clock.advance(60_000);
  config = app.config(client);
  await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce: config.nonce }));
  const second = app.whoAmI(client);

  assert.equal(second.user.id, ada.userId);
  assert.notEqual(second.sessionToken, first.sessionToken);
  assert.notEqual(second.csrf_token, first.csrf_token);
  assert.equal(resolveSession(world.system, first.sessionToken, { authMode: 'google' }), null, 'the session named by the incoming cookie was ended');
  assert.equal(verifyCsrf(second.sessionToken, first.csrf_token), false, "the old session's CSRF token does not work with the new one");
  assert.equal(count(world.db, 'sessions'), 1);
});

test('a privilege change mid-session signs the person out on their very next request', async () => {
  const world = makeWorld();
  const ada = allowlist(world, 'Ada');
  const app = googleApp(world);
  const client = browser();
  const { nonce } = app.config(client);
  await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce }));
  assert.ok(app.whoAmI(client));

  updateUser(world.admin, ada.userId, { status: 'disabled' });
  assert.equal(app.whoAmI(client), null);
  // And the disabled account cannot sign back in.
  const again = app.config(client);
  assert.equal(await app.signIn(client, await googleCredential(world, { sub: 'google-sub-ada', email: 'ada@example.test', nonce: again.nonce })), null);
});

test('dev sign-in end to end, and why its sessions never survive into Google mode', () => {
  const world = makeWorld();
  const ada = allowlist(world, 'Ada');
  const origin = 'http://localhost:8787';
  const names = cookieNames(origin);
  const code = generateDevLoginCode();
  const devLogin = createDevLogin({ code });
  const client = browser();

  // POST /api/auth/dev-login { email, code }
  const user = devLogin.attempt(world.system, { email: 'ada@example.test', code });
  const session = createSession(world.system, { userId: user.id, authMethod: 'dev', ttlHours: TTL_HOURS });
  client.receive(sessionCookie(origin, session));

  const token = parseCookieHeader(client.header())[names.session];
  assert.equal(names.session, 'rewards_sid');
  assert.equal(resolveSession(world.system, token, { authMode: 'dev' }).user.id, ada.userId);
  assert.equal(verifyCsrf(token, csrfTokenFor(token)), true);

  // The same database served with Google sign-in: the dev session is not honoured, and
  // start-up housekeeping removes it.
  assert.equal(resolveSession(world.system, token, { authMode: 'google' }), null);
  assert.equal(purgeExpiredSessions(world.system), 0);
  assert.equal(purgeSessionsByMethod(world.system, 'dev'), 1);
  assert.equal(count(world.db, 'sessions'), 0);
});
