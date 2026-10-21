/* Trading Deck: the desks as lanes of light on one time axis. Every number comes from deck.py
   (window.TRADING_DECK); the page only draws it, replays it, and keeps it fresh. */
(function () {
  'use strict';
  let D = window.TRADING_DECK;
  if (!D) return;

  const $ = (id) => document.getElementById(id);
  const REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const css = getComputedStyle(document.documentElement);
  const tok = (n, d) => css.getPropertyValue(n).trim() || d;
  const C = { ink: tok('--ink', '#e6ecf5'), ink2: tok('--ink-2', '#aab4c6'), dim: tok('--dim', '#6f7a8c'),
    rail: tok('--rail', '#1b2230'), rail2: tok('--rail-2', '#26304a'), loss: tok('--loss', '#ff5f6d'),
    win: tok('--win', '#5fe3a1'), gold: tok('--gold', '#f2bd4f'), flag: '#ff4f7b' };
  const DISPLAY = 'Michroma, "Eurostile", system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const DAY = 86400, REPLAY_MS = 12000;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const usd = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1).toFixed(3)})`; }
  const fmtDay = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: D.meta.tz });
  const fmtTime = (ts) => new Date(ts * 1000).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: D.meta.tz });

  // ---------------------------------------------------------------- the book, as lanes
  let lanes = [], t0 = 0, t1 = 1;
  function prepare() {
    const starts = D.desks.map((d) => d.start).filter(Boolean);
    const firsts = D.desks.map((d) => d.steps[0] && d.steps[0][0]).filter(Boolean);
    t0 = Math.min(...(starts.length ? starts : firsts.length ? firsts : [D.meta.now - DAY]));
    t1 = Math.max(D.meta.now, t0 + 3600);
    lanes = D.desks.map((d, i) => ({ d, i, y: 0, ty: 0, rank: i + 1 }));
    lanes.forEach((l) => { l.y = l.ty = -1; });
  }

  // cumulative paper profit of a desk at time t (closed trades only; open positions count at "now")
  function valueAt(d, t) {
    const s = d.steps;
    if (!s.length || t < s[0][0]) return 0;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m][0] <= t) lo = m; else hi = m - 1; }
    return s[lo][1];
  }
  const returnAt = (d, t) => (valueAt(d, t) + (t >= t1 ? d.open.value : 0)) / d.bank * 100;

  // ---------------------------------------------------------------- the camera in time
  let T = t1, playing = !REDUCE, playFrom = 0, playStart = 0, dirty = true, lastFrame = 0;
  const cv = $('lanes'), ctx = cv.getContext('2d');
  let VW = 0, VH = 0, dpr = 1, snap = true;
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    VW = Math.max(1, r.width); VH = Math.max(1, r.height);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    snap = true;                                   // a new size: lanes jump into place, no reorder animation
    dirty = true;
  }

  function startReplay() {
    T = t0; playing = true; playFrom = t0; playStart = performance.now();
    $('play').textContent = 'pause'; $('play').setAttribute('aria-pressed', 'true');
    dirty = true;
  }
  function pause() { playing = false; $('play').textContent = 'play'; $('play').setAttribute('aria-pressed', 'false'); }
  function resume() {
    if (T >= t1) T = t0;
    playing = true; playFrom = T; playStart = performance.now();
    $('play').textContent = 'pause'; $('play').setAttribute('aria-pressed', 'true');
  }
  function setT(t, fromUser) {
    T = clamp(t, t0, t1);
    if (fromUser) pause();
    $('scrub').value = String(Math.round(((T - t0) / (t1 - t0)) * 1000));
    dirty = true;
  }

  // ---------------------------------------------------------------- geometry
  const phone = () => VW < 600;
  function geometry() {
    const n = lanes.length;
    const axis = 26;
    const laneH = Math.max(40, (VH - axis) / Math.max(1, n));
    const L = phone() ? 14 : 232, R = phone() ? 120 : 168;
    return { n, axis, laneH, L, R, x: (t) => L + ((t - t0) / (t1 - t0)) * (VW - L - R) };
  }

  // ---------------------------------------------------------------- drawing
  let drawnAt = 0;
  function draw(now) {
    const dt = drawnAt ? Math.min(0.25, (now - drawnAt) / 1000) : 0.016;   // seconds since the last draw, capped
    drawnAt = now;
    const g = geometry();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    // shared scale: the biggest return any lane reaches at the end, never under ±10%
    let maxAbs = 10;
    lanes.forEach((l) => { maxAbs = Math.max(maxAbs, Math.abs(returnAt(l.d, t1)), ...l.d.steps.map((s) => Math.abs(s[1] / l.d.bank * 100))); });
    const half = g.laneH * 0.4;
    const yOf = (cy, v) => cy - (v / maxAbs) * half;
    yOf.key = `${maxAbs}|${half}`;

    // the order right now, animated into place
    const order = lanes.slice().sort((a, b) => returnAt(b.d, T) - returnAt(a.d, T) || a.i - b.i);
    order.forEach((l, k) => { l.rank = k + 1; l.ty = g.axis + k * g.laneH; if (l.y < 0 || REDUCE || snap) l.y = l.ty; });
    snap = false;
    let settling = false;
    const ease = 1 - Math.pow(0.001, dt);                                   // settles in about half a second of wall time, at any frame rate
    lanes.forEach((l) => { if (Math.abs(l.y - l.ty) > 0.3) { l.y += (l.ty - l.y) * ease; settling = true; } else l.y = l.ty; });

    // axis: day one, now, each day a hairline, and a label every week or so, never on top of each other
    ctx.font = `400 8.5px ${DISPLAY}`;
    ctx.fillStyle = C.dim; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const days = Math.ceil((t1 - t0) / DAY), pxDay = (VW - g.L - g.R) / Math.max(1, (t1 - t0) / DAY);
    const everyWeeks = Math.max(1, Math.ceil(84 / (7 * pxDay)));
    const dayOne = (phone() ? 'DAY ONE' : 'DAY ONE · ' + fmtDay(t0).toUpperCase());
    let clearFrom = g.x(t0) + ctx.measureText(dayOne).width + 18;
    const nowLabel = 'NOW · ' + fmtDay(t1).toUpperCase(), nowLeft = VW - 14 - ctx.measureText(nowLabel).width - 14;
    for (let i = 0; i <= days; i++) {
      const t = t0 + i * DAY, x = g.x(t);
      ctx.fillStyle = rgba(C.rail2, i % 7 ? 0.35 : 0.8);
      ctx.fillRect(x, g.axis - 6, 1, VH);
      const label = i === 0 ? dayOne : i % (7 * everyWeeks) === 0 ? 'DAY ' + (i + 1) : '';
      if (label && (i === 0 || x + 5 >= clearFrom) && x + 5 + ctx.measureText(label).width < nowLeft) {
        ctx.fillStyle = C.dim;
        ctx.fillText(label, x + 5, 11);
        clearFrom = x + 5 + ctx.measureText(label).width + 18;
      }
    }
    ctx.textAlign = 'right'; ctx.fillStyle = C.ink2;
    ctx.fillText(nowLabel, VW - 14, 11);

    // the lanes
    lanes.forEach((l) => drawLane(l, g, yOf, now));

    // BTC bought and held, across the coin lanes, as a thin gold thread
    if (D.btc_series) {
      ctx.save();
      ctx.strokeStyle = rgba(C.gold, 0.55); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      lanes.filter((l) => l.d.kind === 'coins').forEach((l) => {
        const cy = l.y + g.laneH / 2;
        ctx.beginPath();
        let started = false;
        for (const [t, p] of D.btc_series) {
          if (t > T) break;
          const x = g.x(t), y = yOf(cy, p);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.restore();
    }

    // the cursor
    const cx = g.x(T);
    ctx.fillStyle = rgba(C.ink, T < t1 ? 0.5 : 0.18);
    ctx.fillRect(cx, g.axis - 6, 1, VH);
    if (T < t1) {
      ctx.font = `500 10px ${MONO}`; ctx.fillStyle = C.ink; ctx.textAlign = cx > VW - 160 ? 'right' : 'left';
      ctx.fillText(fmtTime(T), cx + (cx > VW - 160 ? -6 : 6), g.axis + 9);
    }
    return settling;
  }

  function drawLane(l, g, yOf, now) {
    const d = l.d, top = l.y, cy = top + g.laneH / 2, x0 = g.x(Math.max(t0, d.start || t0));
    const col = d.color, ret = returnAt(d, T), val = valueAt(d, T) + (T >= t1 ? d.open.value : 0);
    const xEnd = g.x(T);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top, VW, g.laneH); ctx.clip();

    // lane floor and baseline
    ctx.fillStyle = rgba(col, l.rank === 1 ? 0.035 : 0.018);
    ctx.fillRect(0, top, VW, g.laneH);
    ctx.fillStyle = rgba(C.rail2, 0.9);
    ctx.fillRect(g.L, cy, VW - g.L - g.R, 1);
    ctx.fillStyle = C.rail;
    ctx.fillRect(0, top + g.laneH - 1, VW, 1);

    // the ribbon: cumulative paper profit as a step, filled to the baseline. Built once per moment in time
    // and kept, so a resting page only has to paint it. The sparks (every closed trade, up for a win, down
    // for a loss, pink when flagged) are gathered into a handful of paths instead of one stroke each.
    const key = `${T}|${VW}|${g.laneH}|${top}|${yOf.key}`;
    if (!l.cache || l.cache.key !== key) l.cache = buildLane(l, g, yOf, key, cy, x0, xEnd, val);
    const c = l.cache;
    if (c.path) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, VW, cy - top); ctx.clip();       // above the line: the desk's colour
      ctx.fillStyle = rgba(col, 0.3); ctx.fill(c.fill); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, cy, VW, top + g.laneH - cy); ctx.clip();   // below: the colour, drained
      ctx.fillStyle = rgba(C.loss, 0.16); ctx.fill(c.fill); ctx.restore();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(col, 0.22); ctx.lineWidth = 6; ctx.stroke(c.path);     // the glow, without shadowBlur
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke(c.path);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xEnd, c.tipY, 2.6, 0, Math.PI * 2); ctx.fill();   // the live tip
    }
    for (const [style, width, path] of c.sparks) { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(path); }

    // day 28: the end of this desk's own test
    if (d.start) {
      const tf = d.start + D.meta.month_days * DAY;
      ctx.font = `400 8px ${DISPLAY}`; ctx.textBaseline = 'middle';
      if (tf <= t1) {
        const xf = g.x(tf);
        ctx.fillStyle = rgba(C.ink, 0.7); ctx.fillRect(xf, top + 6, 1, g.laneH - 12);
        ctx.textAlign = 'left'; ctx.fillText('DAY 28', xf + 4, phone() ? top + g.laneH - 9 : top + 11);
      }
    }

    // left: rank, name, the idea, where it is in its month
    const nameY = phone() ? top + 12 : cy - 6;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `600 11px ${MONO}`; ctx.fillStyle = rgba(C.dim, 0.9);
    ctx.fillText(String(l.rank).padStart(2, '0'), phone() ? 8 : 14, nameY);
    ctx.font = `400 ${phone() ? 8.5 : 9.5}px ${DISPLAY}`; ctx.fillStyle = col;
    ctx.fillText(d.label.toUpperCase(), phone() ? 34 : 40, nameY);
    if (!phone()) {
      ctx.font = `400 10px ${MONO}`; ctx.fillStyle = C.dim;
      ctx.fillText(d.idea, 40, cy + 9);
      const stage = !d.start ? 'not started' : T < d.start ? 'not yet' : `day ${Math.min(D.meta.month_days, Math.floor((Math.min(T, t1) - d.start) / DAY) + 1)} of ${D.meta.month_days}`;
      ctx.fillText(stage + (T >= t1 ? ' · ' + d.verdict : ''), 40, cy + 22);
    }

    // right: the return, the paper dollars, open positions
    const rx = VW - 14;
    ctx.textAlign = 'right';
    ctx.font = `600 ${phone() ? 15 : 19}px ${MONO}`;
    ctx.fillStyle = T < (d.start || Infinity) ? C.dim : ret > 0 ? C.win : ret < 0 ? C.loss : C.ink2;
    ctx.fillText(d.start && T >= d.start ? pct(ret) : '—', rx, cy - (phone() ? 2 : 6));
    ctx.font = `400 10.5px ${MONO}`; ctx.fillStyle = C.dim;
    const sub = d.start && T >= d.start ? usd(val) + (T >= t1 && d.open.n ? ` · ${d.open.n} open` : '') : 'waiting for its first trade';
    ctx.fillText(sub, rx, cy + (phone() ? 13 : 10));
    if (T >= t1 && d.open.n && !phone()) {   // a pulse per open position
      const pulse = REDUCE ? 1 : 0.6 + 0.4 * Math.sin(now / 500 + l.i);
      for (let k = 0; k < Math.min(5, d.open.n); k++) {
        ctx.fillStyle = rgba(col, pulse); ctx.beginPath(); ctx.arc(g.x(t1) + 10 + k * 8, cy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function buildLane(l, g, yOf, key, cy, x0, xEnd, val) {
    const d = l.d, col = d.color, out = { key, path: null, fill: null, tipY: cy, sparks: [] };
    if (d.start && T >= d.start) {
      const path = new Path2D();
      let x = x0, y = cy;
      path.moveTo(x, y);
      for (const [t, v] of d.steps) {
        if (t > T) break;
        x = g.x(t); path.lineTo(x, y);
        y = yOf(cy, v / d.bank * 100); path.lineTo(x, y);
      }
      path.lineTo(xEnd, y);
      if (T >= t1 && d.open.value) { y = yOf(cy, val / d.bank * 100); path.lineTo(xEnd, y); }
      const fill = new Path2D(path); fill.lineTo(xEnd, cy); fill.lineTo(x0, cy); fill.closePath();
      out.path = path; out.fill = fill; out.tipY = y;
    }
    const groups = {};                                     // one path per look: colour × fresh/old × flagged
    let prev = 0;
    for (const [t, p, pnl, flag] of d.marks) {
      if (t > T) break;
      const sx = g.x(t), base = yOf(cy, prev / d.bank * 100);
      prev = valueAt(d, t);
      const fresh = (T - t) / Math.max(1, t1 - t0) < 0.02;
      const h = Math.min(g.laneH * 0.34, 4 + Math.min(14, Math.abs(p) / 4));
      const style = flag ? rgba(C.flag, 0.9) : rgba(pnl >= 0 ? col : C.loss, fresh ? 1 : 0.55);
      const gk = style + (flag ? 'f' : '');
      if (!groups[gk]) groups[gk] = [style, flag ? 1.6 : 1, new Path2D()];
      groups[gk][2].moveTo(sx, base); groups[gk][2].lineTo(sx, base + (pnl >= 0 ? -h : h));
    }
    out.sparks = Object.values(groups);
    return out;
  }

  // ---------------------------------------------------------------- header, tape
  function renderHeader() {
    const m = D.meta;
    $('badge').hidden = !m.demo;
    $('updated').textContent = 'updated ' + m.updated_local.replace(/^\w+ /, '');
    const net = m.net + m.open;
    const tn = $('t-net'); tn.textContent = usd(net); tn.className = net > 0 ? 'up' : net < 0 ? 'down' : '';
    $('t-bank').textContent = 'of $' + m.bank.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' paper';
    const tb = $('t-btc');
    if (m.btc) { tb.textContent = pct(m.btc.pct); tb.className = m.btc.pct > 0 ? 'up' : m.btc.pct < 0 ? 'down' : ''; }
    else tb.textContent = '—';
    $('t-n').textContent = m.trades.toLocaleString('en-US');
  }
  function renderClock() {
    const day = Math.floor((T - t0) / DAY) + 1;
    $('t-time').textContent = T >= t1 ? 'now · day ' + day : fmtTime(T) + ' · day ' + day;
  }
  function renderTape() {
    const track = $('tape');
    track.textContent = '';
    track.classList.remove('run');
    if (!D.tape.length) {
      const p = document.createElement('span'); p.className = 'empty';
      p.textContent = 'No closed paper trades yet. Each one rolls past here as soon as a desk closes it.';
      track.appendChild(p); return;
    }
    const byKey = {}; D.desks.forEach((d) => { byKey[d.key] = d; });
    const items = D.tape.map(([t, desk, sym, p, pnl, exit, ]) => {
      const s = document.createElement('span');
      const time = document.createElement('i'); time.textContent = fmtTime(t) + ' ';
      const dk = document.createElement('span'); dk.className = 'desk'; dk.textContent = (byKey[desk] || {}).label || desk;
      dk.style.setProperty('--c', (byKey[desk] || {}).color || '');
      const b = document.createElement('b'); b.textContent = ' ' + sym + ' ';
      const mv = document.createElement('span'); mv.className = pnl > 0 ? 'up' : 'down'; mv.textContent = pct(p) + ' ' + usd(pnl);
      const ex = document.createElement('i'); ex.textContent = ' · ' + exit; if (/rug/i.test(exit)) ex.className = 'flag';
      s.append(time, dk, b, mv, ex);
      return s;
    });
    items.forEach((s) => track.appendChild(s));
    items.forEach((s) => track.appendChild(s.cloneNode(true)));    // twice over, so the loop never shows a seam
    track.style.setProperty('--tape-s', Math.max(30, items.length * 4) + 's');
    if (!REDUCE) requestAnimationFrame(() => track.classList.add('run'));
  }

  // ---------------------------------------------------------------- loop
  let frames = 0;
  function loop(now) {
    frames++;
    if (playing) {
      const k = Math.min(1, (now - playStart) / REPLAY_MS);
      T = playFrom + (t1 - playFrom) * (k < 1 ? 1 - Math.pow(1 - k, 2) : 1);
      $('scrub').value = String(Math.round(((T - t0) / (t1 - t0)) * 1000));
      dirty = true;
      if (k >= 1) { T = t1; pause(); }
    }
    const pulsing = T >= t1 && !REDUCE && !phone() && D.desks.some((d) => d.open.n) && now - lastFrame > 90;
    if (dirty || pulsing || now - lastFrame > 1000) {
      const settling = draw(now);
      renderClock();
      dirty = settling;
      lastFrame = now;
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- controls
  $('play').addEventListener('click', () => (playing ? pause() : resume()));
  $('replay').addEventListener('click', startReplay);
  $('now').addEventListener('click', () => setT(t1, true));
  $('scrub').addEventListener('input', (e) => setT(t0 + (Number(e.target.value) / 1000) * (t1 - t0), true));
  let drag = false;
  const scrubAt = (clientX) => { const g = geometry(); const r = cv.getBoundingClientRect(); setT(t0 + ((clientX - r.left - g.L) / (VW - g.L - g.R)) * (t1 - t0), true); };
  cv.addEventListener('pointerdown', (e) => { drag = true; cv.classList.add('scrubbing'); cv.setPointerCapture(e.pointerId); scrubAt(e.clientX); });
  cv.addEventListener('pointermove', (e) => { if (drag) scrubAt(e.clientX); });
  const up = () => { drag = false; cv.classList.remove('scrubbing'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.key === ' ') { e.preventDefault(); playing ? pause() : resume(); }
    if (e.key === 'ArrowLeft') setT(T - (t1 - t0) / 100, true);
    if (e.key === 'ArrowRight') setT(T + (t1 - t0) / 100, true);
    if (e.key === 'Home') setT(t0, true);
    if (e.key === 'End') setT(t1, true);
  });

  // ---------------------------------------------------------------- fresh numbers
  async function refresh() {
    try {
      const r = await fetch('deck.json', { cache: 'no-store' });
      if (!r.ok) return;
      const next = await r.json();
      if (!next || next.meta.updated === D.meta.updated) return;
      const atEnd = T >= t1;
      D = next; prepare(); renderHeader(); renderTape();
      if (atEnd) T = t1;
      dirty = true;
      $('announce').textContent = 'New paper trades: the deck is up to date.';
    } catch (e) { /* not served next to deck.json: nothing to refresh */ }
  }
  if (/^https?:$/.test(location.protocol)) setInterval(refresh, 120000);

  // ---------------------------------------------------------------- go
  prepare(); renderHeader(); renderTape();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  if (REDUCE) { T = t1; pause(); } else startReplay();
  window.__deck = { time: () => [t0, T, t1], order: () => lanes.slice().sort((a, b) => a.rank - b.rank).map((l) => l.d.key),
    size: () => [VW, VH], frames: () => frames, lanes: () => lanes.map((l) => [l.d.key, Math.round(l.y), Math.round(l.ty)]) };
  requestAnimationFrame(loop);
})();
