// The live client: the account calls, the socket to the live server, and the other drivers' poses, smoothed for the
// renderer. The game stays honest about what this is: an alpha, on one small server, with a cap on how many can
// drive at once; everyone past the cap waits in line and is told their place.
//
// Nothing scored leaves the device. The server only relays where each car is.

export type LiveStatus = 'off' | 'connecting' | 'queued' | 'online' | 'error';
export interface LiveInfo { status: LiveStatus; online: number; cap: number; position: number; error: string }
export interface Pose { x: number; y: number; z: number; h: number; v: number; b: boolean }
interface Sample { t: number; x: number; y: number; z: number; h: number; v: number; b: number }
export interface Peer { id: number; name: string; car: string; paint: number; a: Sample | null; b: Sample | null; seen: number; far: { x: number; z: number; t: number } | null }
export interface Player { id: number; name: string }

export const TOKEN_KEY = 'tsu.live.token';
export const NAME_KEY = 'tsu.live.name';
const SEND_MS = 100;                 // poses go out at 10 Hz
const LAG_MS = 150;                  // peers are drawn this far in the past, so there is always a pose to blend toward
const EXTRAPOLATE_S = 0.3;           // and at most this far ahead of the last pose when a packet is late
const FORGET_MS = 3000;              // a peer not heard of for this long leaves the renderer (out of range, or gone)

export const loadToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const loadName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
export function saveLogin(token: string, name: string) { try { if (token) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(NAME_KEY, name); } else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); } } catch { /* a convenience */ } }

// where the server is: the address in Settings, or, when this page is served by the live server itself, this origin.
// Opened from disk or from a host that isn't ours (an artifact page), it must be typed in.
export function liveBase(setting: string): string {
  const s = setting.trim().replace(/\/+$/, '');
  if (s) return /^https?:\/\//.test(s) ? s : 'https://' + s;
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && !/claude\.ai$/.test(location.hostname) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return location.origin;
  return '';
}

async function call(base: string, path: string, body?: unknown, token?: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Can\'t reach the server. Check the address, or try again in a moment.' } };
  }
}
export const liveApi = {
  signup: (base: string, name: string, password: string, email: string, over13: boolean) => call(base, '/api/signup', { name, password, email: email || undefined, over13 }),
  login: (base: string, name: string, password: string) => call(base, '/api/login', { name, password }),
  logout: (base: string, token: string) => call(base, '/api/logout', {}, token),
  me: (base: string, token: string) => call(base, '/api/me', undefined, token),
  password: (base: string, token: string, current: string, next: string) => call(base, '/api/password', { current, next }, token),
  remove: (base: string, token: string, password: string) => call(base, '/api/delete', { password }, token),
  resetRequest: (base: string, name: string) => call(base, '/api/reset/request', { name }),
  resetConfirm: (base: string, name: string, code: string, next: string) => call(base, '/api/reset/confirm', { name, code, next }),
  email: (base: string, token: string, email: string, password: string) => call(base, '/api/email', { email, password }, token),
  health: (base: string) => call(base, '/health'),
};

export class LiveClient {
  readonly peers = new Map<number, Peer>();
  info: LiveInfo = { status: 'off', online: 0, cap: 0, position: 0, error: '' };
  me: Player | null = null;
  onInfo: ((i: LiveInfo) => void) | null = null;
  onHonk: ((p: Peer) => void) | null = null;          // a nearby driver honked
  private honkAt = 0;
  private ws: WebSocket | null = null;
  private base = ''; private token = ''; private car = ''; private paint = 0;
  private lastSend = 0; private stopped = true; private retry = 0; private timer = 0;
  messages = 0;                                 // snapshots received (for tests)

  connect(base: string, token: string, car: string, paint: number) {
    this.base = base; this.token = token; this.car = car; this.paint = paint; this.stopped = false; this.retry = 0;
    this.open();
  }
  private set(patch: Partial<LiveInfo>) { this.info = { ...this.info, ...patch }; this.onInfo?.(this.info); }
  private open() {
    if (this.stopped) return;
    const url = this.base.replace(/^http/, 'ws') + '/ws';
    this.set({ status: 'connecting', error: '' });
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { this.set({ status: 'error', error: 'Bad server address.' }); return; }
    this.ws = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', token: this.token, car: this.car, paint: this.paint, v: 1 })); };
    ws.onmessage = (e) => this.onMessage(String(e.data));
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null; this.peers.clear();
      if (this.stopped) { this.set({ status: 'off', position: 0 }); return; }
      if (e.code === 4000) { this.stopped = true; this.set({ status: 'error', error: e.reason || 'Disconnected' }); return; }   // the server's own reasons: no retry
      if (e.code === 4001) this.retry = 1;          // the server is restarting: back in about 2 s, not after a long backoff
      if (e.code === 4002) this.retry = 3;          // the spot went to someone waiting while we sat still: back of the line in about 8 s
      this.retry = Math.min(5, this.retry + 1);
      this.set({ status: 'connecting', error: 'Reconnecting' });
      this.timer = window.setTimeout(() => this.open(), 1000 * 2 ** (this.retry - 1));
    };
    ws.onerror = () => { /* onclose follows */ };
  }
  private onMessage(raw: string) {
    let m: Record<string, unknown>;
    try { m = JSON.parse(raw); } catch { return; }
    const now = performance.now();
    switch (m.t) {
      case 'welcome': {
        this.me = { id: m.id as number, name: m.name as string };
        this.retry = 0;
        for (const p of m.peers as { id: number; name: string; car: string; paint: number }[]) this.peer(p.id, p);
        this.set({ status: 'online', online: m.online as number, cap: m.cap as number, position: 0, error: '' });
        break;
      }
      case 'queued': this.set({ status: 'queued', position: m.position as number, cap: m.cap as number, online: m.online as number }); break;
      case 'join': this.peer(m.id as number, m as unknown as { name: string; car: string; paint: number }); this.set({ online: m.online as number }); break;
      case 'leave': this.peers.delete(m.id as number); this.set({ online: m.online as number }); break;
      case 'bye': if (!m.retry) this.set({ error: String(m.why || '') }); break;     // a restart's bye: the game reconnects on its own
      case 'e': { const p = this.peers.get(m.id as number); if (p && m.k === 'honk') this.onHonk?.(p); break; }
      case 'r': {                                 // the roster: where everyone is, every 2 s
        for (const [id, x, z] of m.n as number[][]) { const p = this.peers.get(id); if (p) p.far = { x, z, t: now }; }
        break;
      }
      case 'p': {
        this.messages++;
        for (const row of m.n as number[][]) {
          const [id, x, y, z, h, v, b] = row;
          const p = this.peer(id);
          const s: Sample = { t: now, x, y, z, h, v, b };
          // a pose that moved: the previous latest becomes the blend's start (a repeat keeps the pair as it was)
          if (!p.b || p.b.x !== x || p.b.z !== z || p.b.h !== h) { p.a = p.b; p.b = s; }
          p.seen = now;
        }
        if (typeof m.online === 'number' && (m.online !== this.info.online || m.cap !== this.info.cap)) this.set({ online: m.online, cap: m.cap as number });
        break;
      }
    }
  }
  private peer(id: number, who?: { name: string; car: string; paint: number }) {
    let p = this.peers.get(id);
    if (!p) { p = { id, name: '', car: 'rossini-gt', paint: 0x8d9196, a: null, b: null, seen: 0, far: null }; this.peers.set(id, p); }
    if (who) { p.name = who.name; p.car = who.car; p.paint = who.paint; }
    return p;
  }
  // called every frame by the game; sends at most ten times a second
  send(pose: Pose, now: number) {
    if (!this.ws || this.ws.readyState !== 1 || this.info.status !== 'online' || now - this.lastSend < SEND_MS) return;
    this.lastSend = now;
    this.ws.send(JSON.stringify({ t: 's', x: r1(pose.x), y: r1(pose.y), z: r1(pose.z), h: r3(pose.h), v: r1(pose.v), b: pose.b ? 1 : 0 }));
  }
  // where a peer is right now for the renderer, blended between its last two poses LAG_MS in the past; null when
  // nothing recent is known
  poseOf(p: Peer, now: number, out: Pose): Pose | null {
    const b = p.b;
    if (!b || now - p.seen > FORGET_MS) return null;
    const t = now - LAG_MS, a = p.a;
    if (a && t <= b.t && b.t > a.t) {
      const k = Math.max(0, (t - a.t) / (b.t - a.t));
      let dh = b.h - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      out.x = a.x + (b.x - a.x) * k; out.y = a.y + (b.y - a.y) * k; out.z = a.z + (b.z - a.z) * k; out.h = a.h + dh * k;
    } else {
      const ahead = Math.min(EXTRAPOLATE_S, Math.max(0, (t - b.t) / 1000));
      out.x = b.x + Math.sin(b.h) * b.v * ahead; out.y = b.y; out.z = b.z + Math.cos(b.h) * b.v * ahead; out.h = b.h;
    }
    out.v = b.v; out.b = b.b === 1;
    return out;
  }
  honk(now: number) {
    if (!this.ws || this.ws.readyState !== 1 || this.info.status !== 'online' || now - this.honkAt < 1500) return false;
    this.honkAt = now; this.ws.send(JSON.stringify({ t: 'e', k: 'honk' })); return true;
  }
  // where a peer is on the map now: the live pose when near, otherwise the roster's (null when unknown)
  whereIs(p: Peer, now: number): { x: number; z: number; v: number; h: number } | null {
    if (p.b && now - p.seen < FORGET_MS) return { x: p.b.x, z: p.b.z, v: p.b.v, h: p.b.h };
    if (p.far && now - p.far.t < 10000) return { x: p.far.x, z: p.far.z, v: 0, h: 0 };
    return null;
  }
  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    const ws = this.ws; this.ws = null;
    if (ws && ws.readyState <= 1) { try { ws.send(JSON.stringify({ t: 'leave' })); } catch { /* closing */ } ws.close(); }
    this.peers.clear();
    this.set({ status: 'off', position: 0, error: '' });
  }
}
const r1 = (v: number) => Math.round(v * 10) / 10, r3 = (v: number) => Math.round(v * 1000) / 1000;
