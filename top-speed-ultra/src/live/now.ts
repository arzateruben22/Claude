// The "now" feed for the realistic mode: the weather, how the freeways are flowing and what people are talking
// about, from the live server (/api/now, which asks the National Weather Service and TomTom) or, with no server
// in reach, from a simulated typical day that follows this device's clock. The game always says which one it has.

export type SkyKind = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist';
export interface NowSnapshot {
  at: number;
  weather: { source: string; updated: number; kind: SkyKind; text: string; tempF: number | null };
  traffic: { source: string; updated: number; roads: Record<string, { ratio: number; mph?: number; freeMph?: number }> };
  trends: { source: string; updated: number; list: string[] };
}
const POLL_MS = 5 * 60 * 1000;
const DEFAULT_TRENDS = ['the marine layer', 'the Coastal League', 'the stadium traffic on game nights', 'sunset at 6:15 now', 'a taco truck on every corner'];

// the simulated day: the same curves as the server's mocks (live/now.mjs), so the two agree, on Orange County's clock
// (Pacific time) wherever the player is: rush hour is OC's rush hour
function pacific(date: Date) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', month: 'numeric', hour12: false }).formatToParts(date).map((x) => [x.type, x.value]));
    return { h: Number(p.hour) % 24, d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), m: Number(p.month) - 1 };
  } catch { return { h: date.getHours(), d: date.getDay(), m: date.getMonth() }; }
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
export function simulatedWeather(date = new Date()): NowSnapshot['weather'] {
  const { h, m } = pacific(date);
  const marine = h >= 5 && h < (m >= 4 && m <= 7 ? 11 : 9);
  const kind: SkyKind = marine ? (h < 7 ? 'mist' : 'cloudy') : 'clear';
  const tempF = Math.round(58 + 16 * Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)) + (m >= 5 && m <= 9 ? 6 : 0));
  return { source: 'simulated', updated: date.getTime(), kind, text: kind === 'clear' ? 'Clear' : kind === 'cloudy' ? 'Cloudy' : 'Mist', tempF };
}
export function simulatedRatio(label: string, date = new Date()): number {
  const { h, d } = pacific(date), weekend = d === 0 || d === 6;
  const j = (hash(label) - 0.5) * 0.1;
  let r = 1;
  if (!weekend) { if (h >= 6 && h < 10) r = 0.55; else if (h >= 15 && h < 19) r = 0.45; else if (h >= 10 && h < 15) r = 0.85; else if (h >= 19 && h < 21) r = 0.8; }
  else { if (h >= 11 && h < 18) r = 0.8; else if (h >= 18 && h < 21) r = 0.9; }
  return Math.max(0.2, Math.min(1, r + j));
}
export function simulatedNow(labels: string[], date = new Date()): NowSnapshot {
  const roads: NowSnapshot['traffic']['roads'] = {};
  for (const l of labels) roads[l] = { ratio: Math.round(simulatedRatio(l, date) * 100) / 100 };
  return { at: date.getTime(), weather: simulatedWeather(date), traffic: { source: 'simulated', updated: date.getTime(), roads }, trends: { source: 'simulated', updated: date.getTime(), list: DEFAULT_TRENDS } };
}

export class NowFeed {
  snapshot: NowSnapshot;
  source: 'server' | 'simulated' = 'simulated';
  onChange: (() => void) | null = null;
  private base = ''; private timer = 0; private running = false; private labels: string[] = [];
  constructor(labels: string[] = []) { this.labels = labels; this.snapshot = simulatedNow(labels); }
  setLabels(labels: string[]) { this.labels = labels; if (this.source === 'simulated') this.snapshot = simulatedNow(labels); }
  // keep the feed current while wanted; base '' means simulated only
  want(on: boolean, base: string) {
    if (!on) { this.stop(); return; }
    if (this.running && base === this.base) return;
    this.stop(); this.base = base; this.running = true;
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), POLL_MS);
  }
  stop() { this.running = false; clearInterval(this.timer); this.timer = 0; }
  async refresh() {
    if (!this.base) { this.snapshot = simulatedNow(this.labels); this.source = 'simulated'; this.onChange?.(); return; }
    try {
      const r = await fetch(this.base + '/api/now');
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as NowSnapshot;
      const sim = simulatedNow(this.labels);
      // each part falls back on its own: a feed that is off on the server reads as simulated here
      this.snapshot = {
        at: Date.now(),
        weather: j.weather && j.weather.source !== 'none' ? j.weather : sim.weather,
        traffic: j.traffic && j.traffic.source !== 'none' && Object.keys(j.traffic.roads || {}).length ? j.traffic : sim.traffic,
        trends: j.trends && j.trends.list && j.trends.list.length ? j.trends : sim.trends,
      };
      this.source = 'server';
    } catch {
      this.snapshot = simulatedNow(this.labels); this.source = 'simulated';
    }
    this.onChange?.();
  }
  ratioFor(label: string): number { const r = this.snapshot.traffic.roads[label]; return r ? r.ratio : simulatedRatio(label); }
  // "TomTom · 7 min ago", "NWS · 2 min ago", or "simulated · typical day"
  note(part: 'traffic' | 'weather'): string {
    const p = this.snapshot[part];
    if (!p || p.source === 'simulated' || p.source === 'mock' || p.source === 'none') return 'simulated · typical day';
    const min = Math.max(0, Math.round((Date.now() - p.updated) / 60000));
    return `${p.source} · ${min < 1 ? 'just now' : min + ' min ago'}`;
  }
}
// a live traffic ratio (current speed over free-flow) to the traffic settings' density
export function densityForRatio(ratio: number): { perKmLane: number; bold: number } {
  const r = Math.max(0, Math.min(1, ratio));
  const perKmLane = r >= 0.95 ? 2.2 : r >= 0.8 ? 2.2 + ((0.95 - r) / 0.15) * 2.8 : r >= 0.6 ? 5 + ((0.8 - r) / 0.2) * 4 : r >= 0.45 ? 9 + ((0.6 - r) / 0.15) * 0.5 : 9.5;
  return { perKmLane: Math.round(perKmLane * 10) / 10, bold: r < 0.5 ? 0.08 : r < 0.8 ? 0.04 : 0 };
}
