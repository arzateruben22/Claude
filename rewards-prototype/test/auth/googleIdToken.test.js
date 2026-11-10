import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { CompactSign, SignJWT, UnsecuredJWT, createLocalJWKSet, exportJWK, exportSPKI, generateKeyPair } from 'jose';
import { T0, makeWorld } from '../helpers.js';
import { fixedClock } from '../../src/lib/clock.js';
import { recordAudit } from '../../src/domain/audit.js';
import {
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URL,
  ID_TOKEN_REASONS,
  IdTokenError,
  MAX_TOKEN_AGE_SECONDS,
  createGoogleVerifier,
  googleKeySet,
} from '../../src/auth/googleIdToken.js';

// Keys are generated here, tokens are minted here, and verification runs against a local
// key set: nothing in this file touches the network.
const CLIENT_ID = 'rewards-test-client.apps.googleusercontent.com';
const NONCE = 'bm9uY2UtZm9yLXRoaXMtYnJvd3Nlci1vbmx5LTAwMDE';
const EMAIL = 'ada@example.test';
const KID = 'google-key-1';
const NOW = Math.floor(Date.parse(T0) / 1000);

const google = await generateKeyPair('RS256', { extractable: true });
const stranger = await generateKeyPair('RS256', { extractable: true });
const keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }] });

/** Claims of an ordinary Google ID token issued five seconds ago. `undefined` removes a claim. */
const claims = (overrides = {}) => ({
  iss: 'https://accounts.google.com',
  azp: CLIENT_ID,
  aud: CLIENT_ID,
  sub: '109876543210987654321',
  hd: 'example.test',
  email: EMAIL,
  email_verified: true,
  nonce: NONCE,
  iat: NOW - 5,
  exp: NOW + 3595,
  ...overrides,
});

const mint = (overrides, { key = google.privateKey, header = {} } = {}) =>
  new SignJWT(claims(overrides)).setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT', ...header }).sign(key);

const segment = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const verifierAt = (at = T0, options = {}) => createGoogleVerifier({ clientId: CLIENT_ID, keySet, clock: fixedClock(at), ...options });
const verify = (token, options = { expectedNonce: NONCE }) => verifierAt().verify(token, options);

/** Asserts a refusal with the given reason, and that it looks the same to a client as every other refusal. */
async function refused(promise, reason) {
  let caught;
  await assert.rejects(promise, (error) => {
    caught = error;
    return true;
  });
  assert.ok(caught instanceof IdTokenError, `expected IdTokenError, got ${caught?.name}: ${caught?.message}`);
  assert.equal(caught.reason, reason);
  assert.equal(caught.status, 401);
  assert.equal(caught.code, 'sign_in_denied');
  return caught;
}

test('a valid token yields exactly the identity resolveSignIn expects', async () => {
  const identity = await verify(await mint());
  assert.deepEqual(identity, { sub: '109876543210987654321', email: EMAIL, emailVerified: true, hostedDomain: 'example.test' });

  // The verifier can be held as an object or as a function; both are the same thing.
  const verifier = verifierAt();
  assert.equal(verifier.verify, verifier);
  assert.deepEqual(await verifier(await mint(), { expectedNonce: NONCE }), identity);
});

test('optional identity claims are passed through honestly, never guessed', async () => {
  const bare = await verify(await mint({ email: undefined, email_verified: undefined, hd: undefined }));
  assert.deepEqual(bare, { sub: '109876543210987654321', email: undefined, emailVerified: false, hostedDomain: undefined });
  // Only the boolean true counts as verified; a look-alike string does not.
  assert.equal((await verify(await mint({ email_verified: 'true' }))).emailVerified, false);
  assert.equal((await verify(await mint({ email_verified: 1 }))).emailVerified, false);
  assert.equal((await verify(await mint({ email: { address: EMAIL }, hd: 42 }))).email, undefined);
  assert.equal((await verify(await mint({ email: { address: EMAIL }, hd: 42 }))).hostedDomain, undefined);
});

test('issuer: both Google spellings are accepted, nothing else', async () => {
  assert.deepEqual(GOOGLE_ISSUERS, ['accounts.google.com', 'https://accounts.google.com']);
  for (const iss of GOOGLE_ISSUERS) assert.equal((await verify(await mint({ iss }))).sub, '109876543210987654321');
  for (const iss of ['https://accounts.google.com/', 'http://accounts.google.com', 'https://accounts.google.com.evil.example.test', 'accounts.google.com.evil.example.test', ['accounts.google.com'], undefined]) {
    await refused(verify(await mint({ iss })), 'wrong_issuer');
  }
});

test('audience: only a token issued for exactly this client id', async () => {
  await refused(verify(await mint({ aud: 'another-app.apps.googleusercontent.com' })), 'wrong_audience');
  await refused(verify(await mint({ aud: undefined })), 'wrong_audience');
  await refused(verify(await mint({ aud: `${CLIENT_ID}.evil.example.test` })), 'wrong_audience');
  // A list that merely CONTAINS our client id is also addressed to somebody else.
  await refused(verify(await mint({ aud: [CLIENT_ID, 'another-app.apps.googleusercontent.com'] })), 'wrong_audience');
  await refused(verify(await mint({ aud: [CLIENT_ID] })), 'wrong_audience');
});

test('expiry: valid until the second before `exp`, refused from `exp` on', async () => {
  assert.ok(await verify(await mint({ exp: NOW + 1 })));
  await refused(verify(await mint({ exp: NOW })), 'expired');
  await refused(verify(await mint({ exp: NOW - 1 })), 'expired');
  // A token with no expiry at all is not "never expires": it is not a Google ID token.
  await refused(verify(await mint({ exp: undefined })), 'malformed');
  await refused(verify(await mint({ exp: 'tomorrow' })), 'malformed');
});

test('age: accepted for ten minutes after issue, whatever `exp` says', async () => {
  assert.equal(MAX_TOKEN_AGE_SECONDS, 600);
  assert.ok(await verify(await mint({ iat: NOW - 600 })));
  await refused(verify(await mint({ iat: NOW - 601 })), 'too_old');
  await refused(verify(await mint({ iat: NOW - 3000 })), 'too_old');
  await refused(verify(await mint({ iat: undefined })), 'malformed');
  await refused(verify(await mint({ iat: String(NOW) })), 'malformed');
});

test('a token dated in the future is refused', async () => {
  assert.ok(await verify(await mint({ iat: NOW })));
  await refused(verify(await mint({ iat: NOW + 1 })), 'not_yet_valid');
  await refused(verify(await mint({ iat: NOW + 3600, exp: NOW + 7200 })), 'not_yet_valid');
  await refused(verify(await mint({ nbf: NOW + 30 })), 'not_yet_valid');
  assert.ok(await verify(await mint({ nbf: NOW - 300 })));
});

test('the injected clock decides, not the wall clock', async () => {
  const token = await mint();
  const clock = fixedClock(T0);
  const verifier = createGoogleVerifier({ clientId: CLIENT_ID, keySet, clock });
  assert.ok(await verifier.verify(token, { expectedNonce: NONCE }));
  clock.advance(9 * 60_000);
  assert.ok(await verifier.verify(token, { expectedNonce: NONCE }));
  clock.advance(60_000);
  await refused(verifier.verify(token, { expectedNonce: NONCE }), 'too_old');
  clock.set('2026-11-09T21:00:00.000Z');
  await refused(verifier.verify(token, { expectedNonce: NONCE }), 'expired');
  clock.set('2026-11-09T19:00:00.000Z');
  await refused(verifier.verify(token, { expectedNonce: NONCE }), 'not_yet_valid');
});

test('signature: a token signed by any other key, or altered after signing, is refused', async () => {
  // Signed by someone else's key while claiming Google's key id.
  await refused(verify(await mint({}, { key: stranger.privateKey })), 'bad_signature');

  // A genuine token whose payload was swapped for a different account.
  const [header, , signature] = (await mint()).split('.');
  await refused(verify(`${header}.${segment(claims({ sub: 'someone-else' }))}.${signature}`), 'bad_signature');
  await refused(verify(`${header}.${segment(claims())}.${signature.slice(0, -4)}AAAA`), 'bad_signature');
  await refused(verify(`${header}.${segment(claims())}.`), 'bad_signature');
});

test('algorithm: `none`, HS256 keyed with the public key, and every other algorithm are refused before any key is looked up', async () => {
  let lookups = 0;
  const countingKeySet = async (protectedHeader, token) => {
    lookups += 1;
    return keySet(protectedHeader, token);
  };
  const verifier = createGoogleVerifier({ clientId: CLIENT_ID, keySet: countingKeySet, clock: fixedClock(T0) });
  const attempt = (token) => verifier.verify(token, { expectedNonce: NONCE });

  // Unsigned.
  await refused(attempt(new UnsecuredJWT(claims()).encode()), 'wrong_algorithm');
  // Unsigned header in front of a genuine token's signature.
  const genuine = (await mint()).split('.');
  await refused(attempt(`${segment({ alg: 'none', kid: KID, typ: 'JWT' })}.${genuine[1]}.${genuine[2]}`), 'wrong_algorithm');
  for (const alg of ['None', 'NONE', 'nOnE']) await refused(attempt(`${segment({ alg, kid: KID })}.${genuine[1]}.`), 'wrong_algorithm');

  // Algorithm confusion: an HMAC whose secret is Google's PUBLIC key, which anyone can download.
  const publicKeyPem = await exportSPKI(google.publicKey);
  const publicJwk = await exportJWK(google.publicKey);
  for (const secret of [publicKeyPem, publicKeyPem.trim(), JSON.stringify(publicJwk), publicJwk.n]) {
    for (const alg of ['HS256', 'HS384', 'HS512']) {
      const forged = await new SignJWT(claims()).setProtectedHeader({ alg, kid: KID, typ: 'JWT' }).sign(new TextEncoder().encode(secret));
      await refused(attempt(forged), 'wrong_algorithm');
    }
  }

  // Properly signed, but not with the one algorithm Google's ID tokens use.
  const pss = await generateKeyPair('PS256');
  await refused(attempt(await new SignJWT(claims()).setProtectedHeader({ alg: 'PS256', kid: KID }).sign(pss.privateKey)), 'wrong_algorithm');
  const ec = await generateKeyPair('ES256');
  await refused(attempt(await new SignJWT(claims()).setProtectedHeader({ alg: 'ES256', kid: KID }).sign(ec.privateKey)), 'wrong_algorithm');

  assert.equal(lookups, 0, 'no key may be fetched for a token that is not RS256');
  assert.ok(await attempt(await mint()));
  assert.equal(lookups, 1);
});

test('keys: an unknown key id is refused; a key set that cannot be loaded is reported as such', async () => {
  await refused(verify(await mint({}, { header: { kid: 'not-a-google-key' } })), 'unknown_key');
  await refused(verify(await mint({}, { key: stranger.privateKey, header: { kid: 'stranger-key-1' } })), 'unknown_key');

  const offline = async () => {
    throw new TypeError('fetch failed');
  };
  await refused(createGoogleVerifier({ clientId: CLIENT_ID, keySet: offline, clock: fixedClock(T0) }).verify(await mint(), { expectedNonce: NONCE }), 'keys_unavailable');

  // A key set that hands back something that is not a key at all must not sign anyone in.
  const broken = async () => ({ not: 'a key' });
  await refused(createGoogleVerifier({ clientId: CLIENT_ID, keySet: broken, clock: fixedClock(T0) }).verify(await mint(), { expectedNonce: NONCE }), 'verifier_error');
});

test('nonce: the token must carry exactly the nonce this browser was given', async () => {
  const token = await mint();
  await refused(verify(await mint({ nonce: undefined })), 'bad_nonce');
  await refused(verify(await mint({ nonce: 'bm9uY2UtZm9yLWFub3RoZXItYnJvd3Nlci0wMDAwMDI' })), 'bad_nonce');
  await refused(verify(await mint({ nonce: `${NONCE}x` })), 'bad_nonce');
  await refused(verify(await mint({ nonce: NONCE.slice(0, -1) })), 'bad_nonce');
  await refused(verify(await mint({ nonce: NONCE.toLowerCase() })), 'bad_nonce');
  await refused(verify(await mint({ nonce: '' })), 'bad_nonce');
  await refused(verify(await mint({ nonce: [NONCE] })), 'bad_nonce');
  await refused(verify(await mint({ nonce: 12345 })), 'bad_nonce');

  // With nothing to compare against, even a perfect token is refused.
  await refused(verifierAt().verify(token), 'bad_nonce');
  await refused(verify(token, {}), 'bad_nonce');
  for (const expectedNonce of [undefined, null, '', 0, true, [NONCE], { nonce: NONCE }]) {
    await refused(verify(token, { expectedNonce }), 'bad_nonce');
  }
  // A token without a nonce does not match a missing expectation either.
  await refused(verify(await mint({ nonce: undefined }), { expectedNonce: undefined }), 'bad_nonce');
});

test('subject: `sub` must be text of 1 to 255 characters', async () => {
  assert.equal((await verify(await mint({ sub: 's'.repeat(255) }))).sub.length, 255);
  await refused(verify(await mint({ sub: 's'.repeat(256) })), 'bad_subject');
  await refused(verify(await mint({ sub: undefined })), 'bad_subject');
  await refused(verify(await mint({ sub: '' })), 'bad_subject');
  await refused(verify(await mint({ sub: 109876543210 })), 'bad_subject');
  await refused(verify(await mint({ sub: ['109876543210987654321'] })), 'bad_subject');
  await refused(verify(await mint({ sub: null })), 'bad_subject');
});

test('anything that is not a JWT is refused as malformed, without throwing anything else', async () => {
  const genuine = await mint();
  const notTokens = [
    '',
    'hello',
    'a.b',
    'a.b.c',
    'a.b.c.d',
    '..',
    `${genuine}.extra`,
    genuine.split('.').slice(0, 2).join('.'),
    `${segment({ kid: KID })}.${genuine.split('.')[1]}.${genuine.split('.')[2]}`,
    `${segment(['RS256'])}.${genuine.split('.')[1]}.${genuine.split('.')[2]}`,
    'x'.repeat(8193),
    `${genuine}${'A'.repeat(8192)}`,
    undefined,
    null,
    42,
    true,
    {},
    [genuine],
    new TextEncoder().encode(genuine),
    Buffer.from(genuine),
  ];
  for (const value of notTokens) await refused(verify(value), 'malformed');

  // Signed by Google's key, but the payload is not a claims object.
  const signRaw = (payload) => new CompactSign(new TextEncoder().encode(payload)).setProtectedHeader({ alg: 'RS256', kid: KID }).sign(google.privateKey);
  for (const payload of ['"just a string"', '[1,2,3]', 'null', 'not json at all', '']) await refused(verify(await signRaw(payload)), 'malformed');
});

test('no refusal carries the token, its claims or the library error, and every refusal looks the same to a client', async () => {
  const cases = [
    ['wrong_audience', await mint({ aud: 'another-app.apps.googleusercontent.com' })],
    ['wrong_issuer', await mint({ iss: 'https://evil.example.test' })],
    ['expired', await mint({ exp: NOW - 1 })],
    ['too_old', await mint({ iat: NOW - 601 })],
    ['not_yet_valid', await mint({ iat: NOW + 60 })],
    ['bad_signature', await mint({}, { key: stranger.privateKey })],
    ['wrong_algorithm', new UnsecuredJWT(claims()).encode()],
    ['unknown_key', await mint({}, { header: { kid: 'not-a-google-key' } })],
    ['bad_nonce', await mint({ nonce: 'bm9uY2UtZm9yLWFub3RoZXItYnJvd3Nlci0wMDAwMDI' })],
    ['bad_subject', await mint({ sub: undefined })],
    ['malformed', await mint({ exp: undefined })],
    ['malformed', `${await mint()}.extra`],
  ];
  const bodies = new Set();
  for (const [reason, token] of cases) {
    const error = await refused(verify(token), reason);
    const everything = [error.message, error.stack, JSON.stringify(error), inspect(error, { depth: 10, showHidden: true }), String(error)].join('\n');
    for (const secret of [token, ...token.split('.').filter((part) => part.length > 8), EMAIL, NONCE, '109876543210987654321', CLIENT_ID]) {
      assert.ok(!everything.includes(secret), `${reason}: the error must not contain "${secret.slice(0, 12)}…"`);
    }
    assert.equal(error.cause, undefined, `${reason}: the library error (which holds the claims) must not be attached`);
    assert.equal(error.details, undefined);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'details', 'name', 'reason', 'status']);
    bodies.add(JSON.stringify(error.toJSON()));
  }
  // What a client receives does not depend on which check failed, and holds no reason code.
  assert.equal(bodies.size, 1);
  const [body] = bodies;
  assert.deepEqual(Object.keys(JSON.parse(body).error), ['code', 'message']);
  for (const reason of ID_TOKEN_REASONS) assert.ok(!body.includes(reason), `the response must not mention ${reason}`);

  // An expectedNonce refusal happens before the token is even looked at.
  const early = await refused(verifierAt().verify(cases[0][1]), 'bad_nonce');
  assert.ok(!inspect(early, { depth: 10 }).includes(cases[0][1]));
});

test('IdTokenError is an AppError the HTTP layer can pass straight through', () => {
  const error = new IdTokenError('expired');
  assert.equal(error.name, 'AppError');
  assert.deepEqual(error.toJSON(), { error: { code: 'sign_in_denied', message: error.message } });
  assert.throws(() => new IdTokenError('because'), /unknown ID token reason/);
  assert.ok(Object.isFrozen(ID_TOKEN_REASONS));
  assert.equal(new Set(ID_TOKEN_REASONS).size, ID_TOKEN_REASONS.length);
  for (const reason of ID_TOKEN_REASONS) assert.match(reason, /^[a-z]+(_[a-z]+)*$/);
});

test('reason codes can be audit-logged as values (a count and codes only)', () => {
  const world = makeWorld();
  const id = recordAudit(world.system, { action: 'auth.denied', entityType: 'auth', detail: { count: ID_TOKEN_REASONS.length, reasons: [...ID_TOKEN_REASONS] } });
  assert.ok(id > 0);
  const stored = world.db.get('SELECT detail FROM audit_log WHERE id = ?', [id]).detail;
  assert.deepEqual(JSON.parse(stored).reasons, [...ID_TOKEN_REASONS]);
});

test('a verifier cannot be built without a client id, a key set and a clock', () => {
  const clock = fixedClock(T0);
  // Without a client id jose would skip the audience check and accept tokens issued to any app.
  for (const clientId of [undefined, null, '', 42, [CLIENT_ID]]) {
    assert.throws(() => createGoogleVerifier({ clientId, keySet, clock }), /clientId is required/);
  }
  assert.throws(() => createGoogleVerifier({ clientId: CLIENT_ID, keySet: { keys: [] }, clock }), /keySet must be/);
  assert.throws(() => createGoogleVerifier({ clientId: CLIENT_ID, keySet }), /clock is required/);
  assert.throws(() => createGoogleVerifier({ clientId: CLIENT_ID, keySet, clock: {} }), /clock is required/);
});

test("googleKeySet points at Google's published keys and fetches nothing until a token is verified", () => {
  assert.equal(GOOGLE_JWKS_URL, 'https://www.googleapis.com/oauth2/v3/certs');
  const remote = googleKeySet();
  assert.equal(typeof remote, 'function');
  assert.equal(remote.reloading, false);
  assert.equal(remote.fresh, false);
  assert.equal(remote.jwks(), undefined);
  assert.ok(createGoogleVerifier({ clientId: CLIENT_ID, keySet: remote, clock: fixedClock(T0) }));
});
