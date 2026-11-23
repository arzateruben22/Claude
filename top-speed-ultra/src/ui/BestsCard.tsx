// The score boards, on this device only: the end-of-run card that slides in (rank, the gap, your best, Share) and the
// Bests screen's list. Fastest Minute for each difficulty (Easy, Medium, Extreme), two boards each, Open and Hypercar
// Unleashed; and Free Drive's Best drift, a personal best with the same two lists (bests.ts). Honest by label: "Your bests
// on this device"; the global boards need the hosted backend, which isn't built yet.

import { useState } from 'react';
import type { RunBests } from '../game/Game';
import { DIFFICULTY, DIFFICULTY_IDS } from '../game/settings';
import type { Difficulty } from '../game/settings';
import { BOARDS, BOARD_LABEL, bestsFor, driftBests, shareLine } from '../game/bests';
import type { Board, BestEntry, Kind } from '../game/bests';
import { carById } from '../game/cars';
import { Seg } from './controls';

export const KIND_LABEL: Record<Kind, string> = { minute: 'Fastest Minute', drift: 'Best drift' };
export const fmtScore = (kind: Kind, v: number) => (kind === 'minute' ? `${v.toFixed(1)} mph` : v.toLocaleString('en-US'));
const when = (t: number) => new Date(t).toLocaleDateString();

function List({ list, kind, board, mine }: { list: BestEntry[]; kind: Kind; board: Board; mine?: number }) {
  if (!list.length) return <p className="muted bests-empty">{board === 'unleashed' ? 'No Unleashed runs here yet. Only the OC Hypercar in Free Drive counts on this board.' : 'Nothing here yet.'}</p>;
  return (
    <ol className="bests-list">
      {list.slice(0, 5).map((e, i) => (
        <li key={e.when + ':' + i} className={mine === e.when ? 'me' : ''}>
          <i>{i + 1}</i><b>{fmtScore(kind, e.v)}</b><span>{carById(e.car).name}{e.road ? ` · ${e.road}` : ''}</span><time>{when(e.when)}</time>
        </li>
      ))}
    </ol>
  );
}

// the Bests screen: Fastest Minute by difficulty and board, then Free Drive's Best drift
export function BestsBoards() {
  const [d, setD] = useState<Difficulty>('easy');
  const [b, setB] = useState<Board>('open');
  return (
    <section className="bests-boards" aria-label="Your bests on this device">
      <p className="eyebrow">Your bests on this device</p>
      <Seg label="Difficulty" value={d} options={DIFFICULTY_IDS} labels={(v) => DIFFICULTY[v].label} onChange={setD} />
      <Seg label="Board" value={b} options={BOARDS} labels={(v) => BOARD_LABEL[v]} onChange={setB} />
      <p className="help">Fastest Minute: the best average speed over any continuous 60 s of a run. A crash or a reset breaks it.</p>
      <List list={bestsFor(b, d)} kind="minute" board={b} />
      <p className="help">{b === 'open' ? 'Open: every car you can earn; the OC Hypercar only in its race tune (the timed runs).' : 'Hypercar Unleashed: only the OC Hypercar in its Unleashed tune (Free Drive). Paid speed never ranks against the open board.'} Global boards need the hosted backend, which isn't built yet.</p>
      <p className="eyebrow">Free Drive · Best drift</p>
      <List list={driftBests(b)} kind="drift" board={b} />
      <p className="help">Your best single drift chain in Free Drive: slip angle times speed, summed over the slide. A crash loses the chain, and 1.5 s out of the slide ends it. A personal best, not a board.</p>
    </section>
  );
}

// the end-of-run card: it slides in over the results
export function BestsCard({ rb, car, onShare }: { rb: RunBests; car: string; onShare: (line: string) => void }) {
  const [tab, setTab] = useState<Board>(rb.board);
  const p = rb.placed, label = rb.diff ? DIFFICULTY[rb.diff].label : 'Free Drive', carName = carById(car).name;
  const tune = car === 'oc-hyper' ? (rb.board === 'unleashed' ? ' Unleashed' : ' race tune') : '';
  const unit = rb.kind === 'minute' ? ' mph' : ' pts';
  let line: string;
  if (!rb.counted) line = rb.why;
  else if (rb.value <= 0) line = rb.kind === 'minute' ? 'No full 60 s this run. Drive 60 s in a row with no crash or reset.' : 'No drift chain this drive. Hold a slide of 10° or more above 20 mph.';
  else if (!p || !p.rank) line = `Not in your top ten on this device. Best ${fmtScore(rb.kind, p?.best ?? 0)}.`;
  else if (p.newBest) line = `New best · #1 on this device${p.prev > 0 ? ` · ${fmtScore(rb.kind, rb.value - p.prev)} over your last best` : ''}`;
  else line = `#${p.rank} on this device · ${fmtScore(rb.kind, p.gapUp ?? 0)} behind #${p.rank - 1} · Best ${fmtScore(rb.kind, p.best)}`;
  const list = rb.diff ? bestsFor(tab, rb.diff) : driftBests(tab);
  return (
    <section className="bests-card" aria-label={`${KIND_LABEL[rb.kind]} result`} data-kind={rb.kind} data-counted={rb.counted}>
      <header><p className="eyebrow">{KIND_LABEL[rb.kind]}</p><span className="chip">{label}</span><span className="chip ice">{BOARD_LABEL[rb.board]}</span>
        {rb.value > 0 && rb.counted && <button type="button" className="btn share" onClick={() => onShare(shareLine(rb.kind, rb.value, label, `${carName}${tune}`, location.href.split('#')[0]))}>Share</button>}
      </header>
      <div className="bests-big"><b>{rb.value > 0 ? (rb.kind === 'minute' ? rb.value.toFixed(1) : rb.value.toLocaleString('en-US')) : '—'}</b>{rb.value > 0 && <small>{unit.trim()}</small>}</div>
      <p className={'bests-line' + (p?.newBest ? ' good' : '')} role="status">{line}</p>
      <Seg label="Board" value={tab} options={BOARDS} labels={(v) => BOARD_LABEL[v]} onChange={setTab} />
      <List list={list} kind={rb.kind} board={tab} mine={tab === rb.board ? p?.list.find((e) => e.v === rb.value)?.when : undefined} />
      <div className="bests-foot">
        <p className="help">Your bests on this device. Global boards need the hosted backend, which isn't built yet.</p>
      </div>
    </section>
  );
}
