// The online board: today's and this week's drivers by distance, by the speed held for three seconds and by the
// longest drive, as the live server observed them (live/board.mjs). Names only; your own row is highlighted. Honest
// about what it is: Live · alpha, built from the server's view of the drive, and what stays on the device.
//
// Rendered by App.tsx inside a .panel like the other panels: { cls: 'narrow', body: <OnlineBoard .../> }, with
// base = liveBase(settings.liveUrl), me = liveName, token = liveToken (optional: it adds "You: #n" when you are off
// the list).

import { useEffect, useState } from 'react';
import { fetchBoard, fmtValue, BOARD_KINDS, BOARD_PERIODS, KIND_LABEL } from '../live/board';
import type { BoardKind, BoardPeriod, BoardSnapshot } from '../live/board';

const PERIOD_LABEL: Record<BoardPeriod, string> = { today: 'Today', week: 'This week' };

export function OnlineBoard({ base, me, token = '', onClose }: { base: string; me: string; token?: string; onClose: () => void }) {
  const [period, setPeriod] = useState<BoardPeriod>('today');
  const [kind, setKind] = useState<BoardKind>('distance');
  const [tick, setTick] = useState(0);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!base) return;
    const ac = new AbortController();
    setLoading(true); setError('');
    void fetchBoard(base, { period, token, signal: ac.signal }).then((r) => {
      if (ac.signal.aborted) return;
      setLoading(false);
      if (r.ok) setBoard(r.board); else setError(r.error);
    });
    return () => ac.abort();
  }, [base, period, token, tick]);

  const rows = board && board.period === period ? board[kind] : [];
  const you = board && board.period === period ? board.you?.[kind] ?? null : null;
  const mine = me.toLowerCase();
  const isMe = (name: string) => !!mine && name.toLowerCase() === mine;
  const when = !board ? '' : period === 'today' ? board.day : `${board.since} to ${board.day}`;

  return <>
    <h2>Online board</h2>
    <p className="fine">Live · alpha. The server builds this from what it saw while you drove live: how far you went, the fastest speed you held for three seconds, and your longest drive without stopping. Names only. Nothing scored on this device is sent, and the day turns over at midnight in Orange County.</p>
    {!base ? <p className="fine">Set the server address under Account to see the board.</p> : <>
      <div className="seg" role="group" aria-label="Period" data-n={2} style={{ '--n': 2 } as Record<string, number>}>
        {BOARD_PERIODS.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Kind" data-n={3} style={{ '--n': 3 } as Record<string, number>}>
        {BOARD_KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      <div className="board">
        <p className="eyebrow">{KIND_LABEL[kind]} · {PERIOD_LABEL[period].toLowerCase()}{when ? ` · ${when}` : ''}</p>
        {error ? <p className="fine bad" role="alert">{error}</p>
          : !board || board.period !== period ? <div className="loadbar" role="status" aria-label="Loading the board"><i /></div>
          : rows.length === 0 ? <p className="muted">Nobody on the board {period === 'today' ? 'today' : 'this week'} yet. Drive live and you're on it.</p>
          : <ol>{rows.map((r) => <li key={r.name} className={isMe(r.name) ? 'me' : ''}><b>{fmtValue(kind, r.value)}</b><span>{r.name}</span></li>)}</ol>}
        {you && !rows.some((r) => isMe(r.name)) && <p className="fine">You: #{you.rank} · {fmtValue(kind, you.value)}</p>}
      </div>
      <p className="fine">Speed Survival streaks and near misses stay on this device: the computer traffic they depend on only exists on your phone.</p>
    </>}
    <div className="row">
      <button className="btn primary" onClick={onClose}>Done</button>
      {base && <button className="btn" onClick={() => setTick((n) => n + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>}
    </div>
  </>;
}
