// The realistic mode's feeds: the weather mapping, the mock day, the trends blocklist, and the /api/now route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createNow, weatherKind, mockTrafficRatio, mockWeather } from '../now.mjs';

test('an NWS description maps to one of the game\'s five skies', () => {
  assert.equal(weatherKind('Light Rain'), 'rain'); assert.equal(weatherKind('Thunderstorms and Rain'), 'rain');
  assert.equal(weatherKind('Fog/Mist'), 'fog'); assert.equal(weatherKind('Haze'), 'mist'); assert.equal(weatherKind('Smoke'), 'mist');
  assert.equal(weatherKind('Mostly Cloudy'), 'cloudy'); assert.equal(weatherKind('Overcast'), 'cloudy');
  assert.equal(weatherKind('Clear'), 'clear'); assert.equal(weatherKind('Sunny'), 'clear'); assert.equal(weatherKind(''), 'clear');
});

test('the mock day: rush hour is slower than midnight, weekends are easier, and the weather is a plausible OC day', () => {
  const at = (h, weekday = 3) => new Date(Date.UTC(2026, 9, 11 + weekday, h + 7, 0));   // Oct 2026, PDT = UTC-7; the 11th is a Sunday
  const rush = mockTrafficRatio('I-405 North', at(17)), night = mockTrafficRatio('I-405 North', at(2)), sat = mockTrafficRatio('I-405 North', at(17, 6));
  assert.ok(rush < 0.6 && rush > 0.3, `rush ${rush}`); assert.ok(night > 0.9, `night ${night}`); assert.ok(sat > rush, `saturday ${sat} vs weekday ${rush}`);
  for (const h of [0, 6, 12, 18]) { const r = mockTrafficRatio('CA-57 South', at(h)); assert.ok(r >= 0.2 && r <= 1, `${h}h ${r}`); }
  const w = mockWeather(at(14));
  assert.ok(['clear', 'cloudy', 'rain', 'fog', 'mist'].includes(w.kind) && w.tempF > 50 && w.tempF < 95, JSON.stringify(w));
});

test('trends: the hand-written list is served, and a political entry is dropped', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oc-now-'));
  const file = join(dir, 'trends.json');
  writeFileSync(file, JSON.stringify({ updated: '2026-10-21', trends: ['the marine layer', 'the Coastal League playoffs', 'the election next month', 'a taco truck on every corner'] }));
  const dropped = [];
  const now = createNow({ weather: 'mock', traffic: 'mock', trendsPath: file, log: (ev, d) => { if (ev === 'trend-dropped') dropped.push(d.trend); } });
  now.refreshTrends(); await now.refreshWeather(); await now.refreshTraffic();
  const s = now.snapshot();
  assert.deepEqual(s.trends.list, ['the marine layer', 'the Coastal League playoffs', 'a taco truck on every corner']);
  assert.deepEqual(dropped, ['the election next month']);
  assert.equal(s.weather.source, 'mock'); assert.equal(s.traffic.source, 'mock');
  assert.equal(Object.keys(s.traffic.roads).length, 20, 'one entry per carriageway');
  assert.ok(s.traffic.roads['I-405 North'].ratio > 0 && s.traffic.roads['I-405 North'].freeMph === 65);
  rmSync(dir, { recursive: true, force: true });
});

test('the real providers are only called when switched on; a dead network is logged, not fatal', async () => {
  const calls = [], errors = [];
  const now = createNow({ weather: 'nws', traffic: 'tomtom', tomtomKey: 'k', fetchFn: async (url) => { calls.push(String(url)); throw new Error('ENOTFOUND'); }, log: (ev) => errors.push(ev) });
  await now.refreshWeather(); await now.refreshTraffic();
  assert.ok(calls[0].startsWith('https://api.weather.gov/stations/KSNA/'), calls[0]);
  assert.equal(calls.filter((c) => c.startsWith('https://api.tomtom.com/traffic/services/4/flowSegmentData/')).length, 20);
  assert.equal(now.snapshot().weather.source, 'none'); assert.equal(now.snapshot().traffic.source, 'none');
  assert.ok(errors.includes('weather-error') && errors.includes('traffic-error'));
  // and a good answer is kept
  const ok = createNow({ weather: 'nws', traffic: 'tomtom', tomtomKey: 'k', fetchFn: async (url) => ({ ok: true, json: async () => String(url).includes('weather.gov')
    ? { properties: { textDescription: 'Mostly Cloudy', temperature: { value: 18.3 }, timestamp: '2026-10-21T02:53:00+00:00' } }
    : { flowSegmentData: { currentSpeed: 31, freeFlowSpeed: 65, confidence: 0.9 } } }) });
  await ok.refreshWeather(); await ok.refreshTraffic();
  const s = ok.snapshot();
  assert.deepEqual([s.weather.source, s.weather.kind, s.weather.tempF], ['NWS', 'cloudy', 65]);
  assert.deepEqual(s.traffic.roads['CA-91 East'], { ratio: 0.48, mph: 31, freeMph: 65, conf: 0.9 });
});

test('/api/now and /api/traffic are served by the server', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oc-now-srv-')), port = 24000 + Math.floor(Math.random() * 5000);
  const proc = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, 'n.db'), NOW_WEATHER: 'mock', NOW_TRAFFIC: 'mock' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => proc.stdout.on('data', (d) => { if (String(d).includes('"ev":"listen"')) r(); }));
  try {
    const n = await (await fetch(`http://127.0.0.1:${port}/api/now`)).json();
    assert.equal(n.weather.source, 'mock'); assert.ok(n.trends.list.length >= 3); assert.ok(n.traffic.roads['I-5 South']);
    const t = await (await fetch(`http://127.0.0.1:${port}/api/traffic`)).json();
    assert.equal(Object.keys(t.roads).length, 20);
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.deepEqual(h.feeds, { weather: 'mock', traffic: 'mock', trends: n.trends.list.length });
  } finally { proc.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); }
});
