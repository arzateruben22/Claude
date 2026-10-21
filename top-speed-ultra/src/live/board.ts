// The online board's client: GET /api/board from the live server, with a timeout and a plain answer when the server
// can't be reached. The board is built by the server from the poses it accepted (live/board.mjs): the game sends
// nothing for it, and nothing scored on this device leaves it.

export type BoardKind = 'distance' | 'speed' | 'drive';
export type BoardPeriod = 'today' | 'week';
export interface BoardRow { rank: number; name: string; value: number }
export interface BoardYou { rank: number; value: number }
export interface BoardSnapshot {
  day: string;                                   // the Pacific day the board is for, YYYY-MM-DD
  since: string;                                 // the first day covered (the same as `day` for today)
  period: BoardPeriod;
  tz: string;                                    // 'America/Los_Angeles'
  at: number;                                    // server time, ms
  units: { distance: string; speed: string; drive: string };   // 'm', 'm/s', 's'
  distance: BoardRow[];                          // metres driven
  speed: BoardRow[];                             // m/s held for 3 s
  drive: BoardRow[];                             // seconds, the longest unbroken drive
  you?: Partial<Record<BoardKind, BoardYou | null>>;   // with a token: where you stand, even off the list
}
export type BoardResult = { ok: true; board: BoardSnapshot } | { ok: false; error: string };

export const BOARD_KINDS: BoardKind[] = ['distance', 'speed', 'drive'];
export const BOARD_PERIODS: BoardPeriod[] = ['today', 'week'];
export const KIND_LABEL: Record<BoardKind, string> = { distance: 'Distance', speed: 'Top speed', drive: 'Longest drive' };
const TIMEOUT_MS = 6000;
const MPH = 2.236936, MILE_M = 1609.344;

export async function fetchBoard(base: string, { period = 'today', limit = 10, token = '', timeoutMs = TIMEOUT_MS, signal }: { period?: BoardPeriod; limit?: number; token?: string; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<BoardResult> {
  if (!base) return { ok: false, error: 'No server address. Set one under Account.' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onOuter = () => ac.abort();
  signal?.addEventListener('abort', onOuter);
  try {
    const r = await fetch(`${base}/api/board?period=${period}&limit=${Math.max(1, Math.min(100, Math.round(limit)))}`, { signal: ac.signal, headers: token ? { authorization: 'Bearer ' + token } : {} });
    if (!r.ok) return { ok: false, error: r.status === 404 ? 'This server has no board yet.' : `The server answered ${r.status}.` };
    const board = parseBoard(await r.json());
    return board ? { ok: true, board } : { ok: false, error: 'The server\'s answer didn\'t look like a board.' };
  } catch {
    return { ok: false, error: ac.signal.aborted && !signal?.aborted ? 'The server took too long to answer.' : 'Can\'t reach the server. Check the address, or try again in a moment.' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onOuter); }
}

// a clean copy of what the server sent, or null when it isn't a board; names are kept to the server's own rule
// (16 characters) and values to finite, non-negative numbers, so a bad answer can't break the panel
export function parseBoard(j: unknown): BoardSnapshot | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const rows = (v: unknown): BoardRow[] | null => {
    if (!Array.isArray(v)) return null;
    const out: BoardRow[] = [];
    for (const r of v) {
      if (!r || typeof r !== 'object') return null;
      const { rank, name, value } = r as Record<string, unknown>;
      if (typeof name !== 'string' || !Number.isFinite(value) || !Number.isFinite(rank)) return null;
      out.push({ rank: Number(rank), name: name.slice(0, 16), value: Math.max(0, Number(value)) });
    }
    return out;
  };
  const distance = rows(o.distance), speed = rows(o.speed), drive = rows(o.drive);
  if (!distance || !speed || !drive || typeof o.day !== 'string') return null;
  const period: BoardPeriod = o.period === 'week' ? 'week' : 'today';
  const u = (o.units && typeof o.units === 'object' ? o.units : {}) as Record<string, unknown>;
  const board: BoardSnapshot = {
    day: o.day, since: typeof o.since === 'string' ? o.since : o.day, period, tz: typeof o.tz === 'string' ? o.tz : 'America/Los_Angeles',
    at: Number.isFinite(o.at) ? Number(o.at) : Date.now(),
    units: { distance: String(u.distance || 'm'), speed: String(u.speed || 'm/s'), drive: String(u.drive || 's') },
    distance, speed, drive,
  };
  if (o.you && typeof o.you === 'object') {
    const you: BoardSnapshot['you'] = {};
    for (const k of BOARD_KINDS) {
      const y = (o.you as Record<string, unknown>)[k];
      you[k] = y && typeof y === 'object' && Number.isFinite((y as BoardYou).rank) && Number.isFinite((y as BoardYou).value) ? { rank: Number((y as BoardYou).rank), value: Math.max(0, Number((y as BoardYou).value)) } : null;
    }
    board.you = you;
  }
  return board;
}

// a value in the game's units: miles, mph, and minutes or hours
export function fmtValue(kind: BoardKind, v: number): string {
  if (kind === 'distance') { const mi = v / MILE_M; return (mi >= 100 ? mi.toFixed(0) : mi.toFixed(1)) + ' mi'; }
  if (kind === 'speed') return Math.round(v * MPH) + ' mph';
  if (v < 60) return Math.round(v) + ' s';
  const m = Math.round(v / 60);
  return m < 60 ? m + ' min' : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
