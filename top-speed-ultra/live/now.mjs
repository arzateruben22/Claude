// "Now" for the realistic mode: the current weather, how the freeways are flowing, and what people are talking
// about. Each has a real provider and a mock, and the game treats a missing feed as "simulated" and says so.
//
//   weather:  NWS, the National Weather Service (api.weather.gov), free and open data, no key; the latest
//             observation at John Wayne Airport (KSNA). Needs a User-Agent that says who we are.
//   traffic:  TomTom Traffic Flow Segment Data (free tier: 2,500 requests a day, commercial use allowed, no card);
//             one point per carriageway from traffic-points.json, polled every 15 minutes: 20 × 96 = 1,920 a day.
//   trends:   trends.json, written by hand. No news feed is scraped: that is the only way to keep politics out
//             for sure. A small blocklist catches a slip.
//
// Nothing here is Google's. Google's "popular times" and live busyness have no public API and their terms forbid
// scraping, so a venue's busyness stays simulated in the game (by time and day, labelled), nudged by these feeds.

import { readFileSync, statSync } from 'node:fs';

const WEATHER_MS = 10 * 60 * 1000, TRAFFIC_MS = 15 * 60 * 1000, TRENDS_MS = 60 * 1000;
const UA = 'OC-Ultra-live/0.1 (a driving game; contact via the repository)';
const BLOCK = /\b(elect|vote|voter|ballot|senat|congress|president|governor|mayor|democrat|republican|gop|liberal|conservative|trump|biden|harris|newsom|immigra|border|abortion|gun|protest|riot|war|israel|gaza|ukraine|russia|china|tariff|impeach|supreme court|police|shooting|murder|crime)\w*/i;

export const WEATHER_KINDS = ['clear', 'cloudy', 'rain', 'fog', 'mist'];
// an NWS text description to the game's five skies
export function weatherKind(text) {
  const t = String(text || '').toLowerCase();
  if (/rain|shower|drizzle|thunder|storm|snow|sleet/.test(t)) return 'rain';
  if (/fog/.test(t)) return 'fog';
  if (/mist|haze|smoke|dust/.test(t)) return 'mist';
  if (/cloud|overcast/.test(t)) return 'cloudy';
  return 'clear';
}
const cToF = (c) => Math.round((c * 9) / 5 + 32);
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// the mocks: what a typical day looks like, from the clock (Pacific) and the road's name
export function mockWeather(date = new Date()) {
  const h = pacificHour(date), m = date.getUTCMonth();
  const marine = h >= 5 && h < (m >= 4 && m <= 7 ? 11 : 9);     // May gray and June gloom last longer
  const kind = marine ? (h < 7 ? 'mist' : 'cloudy') : 'clear';
  const tempF = Math.round(58 + 16 * Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)) + (m >= 5 && m <= 9 ? 6 : 0));
  return { kind, text: kind === 'clear' ? 'Clear' : kind === 'cloudy' ? 'Cloudy' : 'Mist', tempF };
}
export function mockTrafficRatio(label, date = new Date()) {
  const h = pacificHour(date), d = pacificDay(date), weekend = d === 0 || d === 6;
  const j = (hash(label) - 0.5) * 0.1;
  let r = 1;
  if (!weekend) { if (h >= 6 && h < 10) r = 0.55; else if (h >= 15 && h < 19) r = 0.45; else if (h >= 10 && h < 15) r = 0.85; else if (h >= 19 && h < 21) r = 0.8; }
  else { if (h >= 11 && h < 18) r = 0.8; else if (h >= 18 && h < 21) r = 0.9; }
  return Math.max(0.2, Math.min(1, r + j));
}
export function pacificHour(date) { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(date)) % 24; }
export function pacificDay(date) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).format(date)); }

export function createNow({ weather = 'off', traffic = 'off', tomtomKey = '', pointsPath = new URL('./traffic-points.json', import.meta.url).pathname, trendsPath = new URL('./trends.json', import.meta.url).pathname, fetchFn = globalThis.fetch, log = () => {} } = {}) {
  const points = JSON.parse(readFileSync(pointsPath, 'utf8')).points;
  const state = {
    weather: { source: 'none', updated: 0, kind: 'clear', text: '', tempF: null, station: 'KSNA' },
    traffic: { source: 'none', updated: 0, roads: {} },
    trends: { source: 'none', updated: 0, list: [] },
  };
  let trendsMtime = 0;

  async function refreshWeather() {
    if (weather === 'off') return;
    if (weather === 'mock') { state.weather = { ...state.weather, source: 'mock', updated: Date.now(), ...mockWeather() }; return; }
    try {
      const r = await fetchFn('https://api.weather.gov/stations/KSNA/observations/latest', { headers: { 'user-agent': UA, accept: 'application/geo+json' } });
      if (!r.ok) throw new Error('NWS ' + r.status);
      const j = await r.json(), p = j.properties || {};
      const kind = weatherKind(p.textDescription), tempC = p.temperature && p.temperature.value;
      state.weather = { source: 'NWS', updated: Date.now(), kind, text: String(p.textDescription || ''), tempF: typeof tempC === 'number' ? cToF(tempC) : null, station: 'KSNA', observed: p.timestamp };
    } catch (e) { log('weather-error', { error: e.message }); }
  }
  async function refreshTraffic() {
    if (traffic === 'off') return;
    const now = Date.now(), roads = {};
    if (traffic === 'mock') {
      for (const pt of points) { const ratio = mockTrafficRatio(pt.label), free = 65; roads[pt.label] = { ratio: round2(ratio), mph: Math.round(free * ratio), freeMph: free, conf: 1 }; }
      state.traffic = { source: 'mock', updated: now, roads }; return;
    }
    if (!tomtomKey) { log('traffic-error', { error: 'no TOMTOM_KEY' }); return; }
    let ok = 0;
    for (const pt of points) {
      try {
        const r = await fetchFn(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${pt.lat},${pt.lon}&unit=MPH&key=${tomtomKey}`, { headers: { 'user-agent': UA } });
        if (!r.ok) throw new Error('TomTom ' + r.status);
        const f = (await r.json()).flowSegmentData;
        const free = Math.max(1, Number(f.freeFlowSpeed)), cur = Number(f.currentSpeed);
        roads[pt.label] = { ratio: round2(Math.max(0, Math.min(1, cur / free))), mph: Math.round(cur), freeMph: Math.round(free), conf: Number(f.confidence) || 0 };
        ok++;
      } catch (e) { log('traffic-error', { road: pt.label, error: e.message }); }
      await new Promise((res) => setTimeout(res, 150));
    }
    if (ok) state.traffic = { source: 'TomTom', updated: now, roads: { ...state.traffic.roads, ...roads } };
  }
  function refreshTrends() {
    try {
      const { mtimeMs } = statSafe(trendsPath);
      if (mtimeMs === trendsMtime && state.trends.updated) return;
      trendsMtime = mtimeMs;
      const j = JSON.parse(readFileSync(trendsPath, 'utf8'));
      const list = [];
      for (const t of j.trends || []) {
        const s = String(t).trim().slice(0, 80);
        if (!s) continue;
        if (BLOCK.test(s)) { log('trend-dropped', { trend: s }); continue; }
        list.push(s);
      }
      state.trends = { source: 'file', updated: Date.now(), list: list.slice(0, 24), asOf: j.updated || '' };
    } catch (e) { log('trends-error', { error: e.message }); }
  }
  const round2 = (v) => Math.round(v * 100) / 100;
  function statSafe(p) { try { return { mtimeMs: statSync(p).mtimeMs }; } catch { return { mtimeMs: 0 }; } }

  const timers = [];
  function start() {
    void refreshWeather(); void refreshTraffic(); refreshTrends();
    timers.push(setInterval(() => void refreshWeather(), WEATHER_MS), setInterval(() => void refreshTraffic(), TRAFFIC_MS), setInterval(refreshTrends, TRENDS_MS));
    for (const t of timers) t.unref();
  }
  function stop() { for (const t of timers) clearInterval(t); }
  const snapshot = () => ({ at: Date.now(), weather: state.weather, traffic: state.traffic, trends: state.trends });
  return { start, stop, snapshot, refreshWeather, refreshTraffic, refreshTrends, state };
}
