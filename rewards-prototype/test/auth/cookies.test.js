import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken } from '../../src/lib/ids.js';
import { clearNonceCookie, clearSessionCookie, cookieNames, nonceCookie, parseCookieHeader, sessionCookie } from '../../src/auth/cookies.js';

const HTTPS = 'https://rewards.example.test';
const LOCAL = 'http://localhost:8787';
const TOKEN = 'c2Vzc2lvbi10b2tlbi1mb3ItY29va2llLXRlc3RzLTAwMQ';
const NONCE = 'bm9uY2UtZm9yLWNvb2tpZS10ZXN0cy0wMDAwMDAwMDAwMQ';

test('an https origin gets the __Host- cookies, exactly as the API contract spells them', () => {
  assert.deepEqual(cookieNames(HTTPS), { session: '__Host-sid', nonce: '__Host-nonce' });
  assert.equal(sessionCookie(HTTPS, { token: TOKEN, maxAgeSeconds: 604800 }), `__Host-sid=${TOKEN}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  assert.equal(nonceCookie(HTTPS, { nonce: NONCE, maxAgeSeconds: 600 }), `__Host-nonce=${NONCE}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`);
  assert.equal(clearSessionCookie(HTTPS), '__Host-sid=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  assert.equal(clearNonceCookie(HTTPS), '__Host-nonce=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  for (const origin of ['https://rewards.example.test:8443', 'https://localhost:8787', 'https://127.0.0.1']) {
    assert.deepEqual(cookieNames(origin), { session: '__Host-sid', nonce: '__Host-nonce' }, origin);
  }
});

test('an http localhost origin gets the plain names, without Secure', () => {
  assert.deepEqual(cookieNames(LOCAL), { session: 'rewards_sid', nonce: 'rewards_nonce' });
  assert.equal(sessionCookie(LOCAL, { token: TOKEN, maxAgeSeconds: 604800 }), `rewards_sid=${TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  assert.equal(nonceCookie(LOCAL, { nonce: NONCE, maxAgeSeconds: 600 }), `rewards_nonce=${NONCE}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`);
  assert.equal(clearSessionCookie(LOCAL), 'rewards_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  assert.equal(clearNonceCookie(LOCAL), 'rewards_nonce=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  for (const origin of ['http://localhost', 'http://127.0.0.1:8787', 'http://[::1]:8787']) {
    assert.deepEqual(cookieNames(origin), { session: 'rewards_sid', nonce: 'rewards_nonce' }, origin);
    assert.ok(!sessionCookie(origin, { token: TOKEN, maxAgeSeconds: 60 }).includes('Secure'), origin);
  }
});

test('the attributes every cookie must carry, and the ones it must never carry', () => {
  for (const origin of [HTTPS, LOCAL]) {
    const all = [
      sessionCookie(origin, { token: TOKEN, maxAgeSeconds: 3600 }),
      nonceCookie(origin, { nonce: NONCE, maxAgeSeconds: 600 }),
      clearSessionCookie(origin),
      clearNonceCookie(origin),
    ];
    for (const cookie of all) {
      const attributes = cookie.split('; ').slice(1);
      assert.ok(attributes.includes('HttpOnly'), cookie);
      assert.ok(attributes.includes('Path=/'), cookie);
      assert.equal(attributes.filter((attribute) => attribute.startsWith('Max-Age=')).length, 1, cookie);
      assert.equal(attributes.filter((attribute) => attribute.startsWith('SameSite=')).length, 1, cookie);
      assert.equal(attributes.includes('Secure'), origin === HTTPS, cookie);
      // A __Host- cookie with a Domain attribute is rejected by browsers; and nothing here may ever be SameSite=None.
      assert.ok(!/Domain=/i.test(cookie) && !/SameSite=None/i.test(cookie) && !/Expires=/i.test(cookie), cookie);
      assert.ok(!/[\r\n]/.test(cookie));
    }
    assert.ok(all[0].includes('SameSite=Lax') && all[2].includes('SameSite=Lax'), 'session cookie is Lax');
    assert.ok(all[1].includes('SameSite=Strict') && all[3].includes('SameSite=Strict'), 'nonce cookie is Strict');
  }
});

test('http anywhere but this machine is refused outright, as is anything that is not an origin', () => {
  const refused = [
    'http://rewards.example.test',
    'http://rewards.example.test:8787',
    'http://localhost.example.test',
    'http://sub.localhost:8787',
    'http://127.0.0.2:8787',
    'http://0.0.0.0:8787',
    'http://[::2]:8787',
    'http://192.168.1.10:8787',
    'ftp://localhost',
    'file:///tmp/app',
    'javascript:alert(1)',
    'localhost:8787',
    'rewards.example.test',
    '',
    undefined,
    null,
    42,
  ];
  for (const origin of refused) {
    assert.throws(() => cookieNames(origin), TypeError, String(origin));
    assert.throws(() => sessionCookie(origin, { token: TOKEN, maxAgeSeconds: 60 }), TypeError, String(origin));
    assert.throws(() => nonceCookie(origin, { nonce: NONCE, maxAgeSeconds: 60 }), TypeError, String(origin));
    assert.throws(() => clearSessionCookie(origin), TypeError, String(origin));
    assert.throws(() => clearNonceCookie(origin), TypeError, String(origin));
  }
});

test('only a base64url token and a positive whole Max-Age can be put in a cookie', () => {
  const injected = [`${TOKEN}; Domain=evil.example.test`, `${TOKEN}\r\nSet-Cookie: x=y`, `${TOKEN} `, 'a b', 'short', '', 'x'.repeat(257), 'tok,en-with-comma-000000', '"quoted-token-000000000"', undefined, null, 42, [TOKEN]];
  for (const value of injected) {
    assert.throws(() => sessionCookie(HTTPS, { token: value, maxAgeSeconds: 60 }), /must be a base64url token/);
    assert.throws(() => nonceCookie(HTTPS, { nonce: value, maxAgeSeconds: 60 }), /must be a base64url token/);
  }
  for (const maxAgeSeconds of [0, -1, 1.5, '3600', undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => sessionCookie(HTTPS, { token: TOKEN, maxAgeSeconds }), /maxAgeSeconds must be a positive whole number/);
    assert.throws(() => nonceCookie(HTTPS, { nonce: NONCE, maxAgeSeconds }), /maxAgeSeconds must be a positive whole number/);
  }
  // Real tokens always fit.
  for (let i = 0; i < 50; i += 1) assert.ok(sessionCookie(LOCAL, { token: randomToken(32), maxAgeSeconds: 1 }));
});

test('parseCookieHeader reads what the builders write', () => {
  for (const origin of [HTTPS, LOCAL]) {
    const names = cookieNames(origin);
    const header = [sessionCookie(origin, { token: TOKEN, maxAgeSeconds: 60 }), nonceCookie(origin, { nonce: NONCE, maxAgeSeconds: 60 })].map((cookie) => cookie.split(';')[0]).join('; ');
    const parsed = parseCookieHeader(header);
    assert.equal(parsed[names.session], TOKEN);
    assert.equal(parsed[names.nonce], NONCE);
    assert.deepEqual(Object.keys(parsed), [names.session, names.nonce]);
  }
  // A cleared cookie, if a browser ever sent it back, is an empty value, not a token.
  assert.equal(parseCookieHeader('rewards_sid=')['rewards_sid'], '');
});

test('parseCookieHeader: ordinary headers, spacing and quoting', () => {
  assert.deepEqual({ ...parseCookieHeader('a=1; b=2; c=3') }, { a: '1', b: '2', c: '3' });
  assert.deepEqual({ ...parseCookieHeader('a=1;b=2;   c=3  ;') }, { a: '1', b: '2', c: '3' });
  assert.deepEqual({ ...parseCookieHeader('  a = 1 ;b= 2') }, { a: '1', b: '2' });
  assert.deepEqual({ ...parseCookieHeader('a="quoted"; b=""; c=x=y=z; d=') }, { a: 'quoted', b: '', c: 'x=y=z', d: '' });
  assert.deepEqual({ ...parseCookieHeader('theme=dark; rewards_sid=abc-_DEF; other=%20kept%20as%20sent') }, { theme: 'dark', rewards_sid: 'abc-_DEF', other: '%20kept%20as%20sent' });
  // Names are case-sensitive: these are three different cookies.
  assert.deepEqual({ ...parseCookieHeader('sid=1; SID=2; Sid=3') }, { sid: '1', SID: '2', Sid: '3' });
});

test('parseCookieHeader: nothing useful in, empty map out', () => {
  for (const header of [undefined, null, '', '   ', ';', ';;;', 42, true, {}, ['a=1'], { cookie: 'a=1' }]) {
    const parsed = parseCookieHeader(header);
    assert.equal(Object.getPrototypeOf(parsed), null);
    assert.deepEqual(Object.keys(parsed), [], JSON.stringify(header));
  }
});

test('parseCookieHeader: malformed pairs are skipped, and the good ones around them are kept', () => {
  const header = [
    'good=1',
    'novalue',
    '=noname',
    ' =blank',
    'bad name=2',
    'bad;semi',
    'ctl\u0001=3',
    'paren(=4',
    'spaced=has space',
    'comma=a,b',
    'backslash=a\\b',
    'quote=a"b',
    'unbalanced="abc',
    'nul=a\u0000b',
    'unicode=café',
    'über=5',
    'also_good=6',
  ].join('; ');
  assert.deepEqual({ ...parseCookieHeader(header) }, { good: '1', also_good: '6' });
});

test('parseCookieHeader: when a name repeats, the first value wins', () => {
  assert.deepEqual({ ...parseCookieHeader('rewards_sid=first; rewards_sid=second; rewards_sid=third') }, { rewards_sid: 'first' });
  assert.deepEqual({ ...parseCookieHeader('a=1; b=2; a=3; b=4; a=') }, { a: '1', b: '2' });
  // An empty first value still wins: a later copy must not be able to fill it in.
  assert.deepEqual({ ...parseCookieHeader('__Host-sid=; __Host-sid=attacker') }, { '__Host-sid': '' });
  // A malformed first copy is not a value at all, so the first WELL-FORMED one counts.
  assert.deepEqual({ ...parseCookieHeader('a=has space; a=clean') }, { a: 'clean' });
});

test('parseCookieHeader: a cookie called __proto__ is just a cookie', () => {
  const parsed = parseCookieHeader('__proto__=polluted; constructor=c; toString=t; hasOwnProperty=h; valueOf=v; rewards_sid=real');
  assert.equal(Object.getPrototypeOf(parsed), null, 'the map has no prototype to pollute or inherit from');
  assert.deepEqual(Object.keys(parsed), ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'rewards_sid']);
  assert.equal(parsed['__proto__'], 'polluted');
  assert.equal(parsed.constructor, 'c');
  assert.equal(parsed.rewards_sid, 'real');

  // Nothing leaked onto ordinary objects.
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(typeof {}.toString, 'function');
  assert.equal(Object.getPrototypeOf({}), Object.prototype);

  // And a header WITHOUT those cookies does not appear to have them.
  const plain = parseCookieHeader('rewards_sid=real');
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
    assert.equal(plain[name], undefined, name);
    assert.equal(name in plain, false, name);
  }
  // First value wins for __proto__ too.
  assert.equal(parseCookieHeader('__proto__=one; __proto__=two')['__proto__'], 'one');
});
