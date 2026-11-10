// The sign-in layer is pure: everything it needs is passed in. These checks read the
// source of src/auth so that a later change cannot quietly reach for the environment,
// the wall clock, the console or the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'auth');
const EXPECTED = ['cookies.js', 'csrf.js', 'devLogin.js', 'googleIdToken.js', 'nonces.js', 'rateLimit.js', 'sessions.js'];
const sources = new Map(readdirSync(AUTH_DIR).filter((name) => EXPECTED.includes(name)).map((name) => [name, readFileSync(join(AUTH_DIR, name), 'utf8')]));

/** Source with comments removed, so that a rule explained in a comment is not mistaken for a breach of it. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

test('every sign-in module exists', () => {
  assert.deepEqual([...sources.keys()].sort(), EXPECTED);
});

test('no sign-in module reads the environment, the wall clock or global randomness, or writes to the console', () => {
  const forbidden = [
    [/process\.(env|argv|exit|stdout|stderr)/, 'process.*'],
    [/\bDate\.now\s*\(/, 'Date.now()'],
    [/new Date\(\s*\)/, 'new Date() without an argument'],
    [/\bconsole\./, 'console.*'],
    [/Math\.random/, 'Math.random'],
    [/\bset(Timeout|Interval|Immediate)\s*\(/, 'timers'],
    [/\bfetch\s*\(/, 'fetch'],
    [/\bTODO\b|\bFIXME\b/, 'a to-do marker'],
  ];
  for (const [name, source] of sources) {
    for (const [pattern, label] of forbidden) assert.ok(!pattern.test(code(source)), `src/auth/${name} must not use ${label}`);
  }
  // To-do markers are not wanted in comments either.
  for (const [name, source] of sources) assert.ok(!/\bTODO\b|\bFIXME\b/.test(source), `src/auth/${name} has a to-do marker`);
});

test('sign-in modules depend only on node, jose, lib and domain: never on the HTTP layer or the database adapter', () => {
  const allowed = /^(node:(crypto|net)|jose|\.\.\/lib\/(errors|ids)\.js|\.\.\/domain\/(context|users)\.js)$/;
  for (const [name, source] of sources) {
    const imports = [...code(source).matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1]);
    for (const specifier of imports) assert.match(specifier, allowed, `src/auth/${name} imports ${specifier}`);
    assert.ok(!/\bimport\s*\(/.test(code(source)), `src/auth/${name} must not import dynamically`);
    assert.ok(!/\brequire\s*\(/.test(code(source)), `src/auth/${name} must not use require`);
  }
  // jose is used in exactly one place, so the algorithm and claim rules cannot be bypassed elsewhere.
  assert.deepEqual([...sources].filter(([, source]) => /from 'jose'/.test(source)).map(([name]) => name), ['googleIdToken.js']);
});

test('no module keeps state outside what a factory returns', () => {
  for (const [name, source] of sources) {
    const topLevelLets = code(source).split('\n').filter((line) => /^(let|var)\s/.test(line));
    assert.deepEqual(topLevelLets, [], `src/auth/${name} has module-level mutable state`);
    const topLevelCollections = code(source).split('\n').filter((line) => /^const\s+\w+\s*=\s*new (Map|WeakMap|Array)\b/.test(line) || /^const\s+\w+\s*=\s*(\[\]|\{\})\s*;/.test(line));
    assert.deepEqual(topLevelCollections, [], `src/auth/${name} has a module-level mutable collection`);
  }
});
