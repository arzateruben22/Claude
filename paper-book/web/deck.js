/* Trading Deck: the desks as lanes of light on one time axis. Every number comes from deck.py
   (window.TRADING_DECK); the page only draws it, replays it, filters it by market, and keeps it fresh. */
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
    win: tok('--win', '#5fe3a1'), gold: tok('--gold', '#f2bd4f'), void: tok('--void', '#05070d'), flag: '#ff4f7b' };
  const DISPLAY = 'Michroma, "Eurostile", system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const DAY = 86400, REPLAY_MS = 12000, AXIS = 30, MARKET_KEY = 'deck.market';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const usd = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1).toFixed(3)})`; }
  const fmtDay = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: D.meta.tz });
  const fmtTime = (ts) => new Date(ts * 1000).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: D.meta.tz }).replace(',', '');

  // ---------------------------------------------------------------- the book, as lanes
  let lanes = [], t0 = 0, t1 = 1, tEnd = 1, market = 'all';
  try { market = localStorage.getItem(MARKET_KEY) || 'all'; } catch (e) { /* no storage: every desk */ }
  function prepare() {
    const starts = D.desks.map((d) => d.start).filter(Boolean);
    const firsts = D.desks.map((d) => d.steps[0] && d.steps[0][0]).filter(Boolean);
    t0 = Math.min(...(starts.length ? starts : firsts.length ? firsts : [D.meta.now - DAY]));
    t1 = Math.max(D.meta.now, t0 + 3600);
    const ahead = (D.meta.checkpoints || []).map((c) => c.at).filter((t) => t > t1);   // the dates still to come stay on the axis
    tEnd = ahead.length ? Math.max(...ahead) : t1;
    lanes = D.desks.map((d, i) => ({ d, i, y: -1, ty: -1, rank: i + 1 }));
    if (market !== 'all' && !(D.meta.markets || []).includes(market)) market = 'all';
  }
  const visible = () => lanes.filter((l) => market === 'all' || l.d.market === market);

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
  const stage = $('stage'), cv = $('lanes'), ctx = cv.getContext('2d'), ax = $('axis'), actx = ax.getContext('2d');
  let VW = 0, VH = 0, CH = 0, dpr = 1, snap = true;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    VW = Math.max(1, stage.clientWidth); VH = Math.max(1, stage.clientHeight - AXIS);
    ax.width = Math.round(VW * dpr); ax.height = Math.round(AXIS * dpr);
    CH = 0;                                        // the lanes canvas is sized on the next draw, from how many lanes show
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
    const n = visible().length;
    const laneH = Math.max(phone() ? 46 : 48, VH / Math.max(1, n));   // thirty lanes scroll; ten fill the screen
    const H = Math.max(VH, n * laneH);
    const L = phone() ? 14 : 256, R = phone() ? 120 : 168;
    return { n, laneH, H, L, R, compact: laneH < 64, x: (t) => L + ((t - t0) / (tEnd - t0)) * (VW - L - R) };
  }
  function fit(H) {
    if (H === CH) return;
    CH = H;
    cv.style.height = H + 'px';
    cv.width = Math.round(VW * dpr); cv.height = Math.round(H * dpr);
  }

  // ---------------------------------------------------------------- drawing
  let drawnAt = 0;
  function draw(now) {
    const dt = drawnAt ? Math.min(0.25, (now - drawnAt) / 1000) : 0.016;   // seconds since the last draw, capped
    drawnAt = now;
    const g = geometry();
    fit(g.H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, g.H);
    const vis = visible();

    // shared scale: the biggest return any showing lane reaches, never under ±10%
    let maxAbs = 10;
    vis.forEach((l) => { maxAbs = Math.max(maxAbs, Math.abs(returnAt(l.d, t1)), ...l.d.steps.map((s) => Math.abs(s[1] / l.d.bank * 100))); });
    const half = g.laneH * 0.4;
    const yOf = (cy, v) => cy - (v / maxAbs) * half;
    yOf.key = `${maxAbs}|${half}`;

    // the order right now, animated into place
    const order = vis.slice().sort((a, b) => returnAt(b.d, T) - returnAt(a.d, T) || a.i - b.i);
    order.forEach((l, k) => { l.rank = k + 1; l.ty = k * g.laneH; if (l.y < 0 || REDUCE || snap) l.y = l.ty; });
    snap = false;
    let settling = false;
    const ease = 1 - Math.pow(0.001, dt);                                   // settles in about half a second of wall time, at any frame rate
    vis.forEach((l) => { if (Math.abs(l.y - l.ty) > 0.3) { l.y += (l.ty - l.y) * ease; settling = true; } else l.y = l.ty; });

    // each day a hairline; the days still to come, dimmed
    const days = Math.ceil((tEnd - t0) / DAY);
    for (let i = 0; i <= days; i++) {
      ctx.fillStyle = rgba(C.rail2, i % 7 ? 0.35 : 0.8);
      ctx.fillRect(g.x(t0 + i * DAY), 0, 1, g.H);
    }
    if (tEnd > t1) { ctx.fillStyle = rgba(C.rail, 0.3); ctx.fillRect(g.x(t1), 0, g.x(tEnd) - g.x(t1), g.H); }
    for (const c of D.meta.checkpoints || []) {                             // the dates the book is read on
      if (c.at < t0 || c.at > tEnd) continue;
      ctx.fillStyle = rgba(C.gold, c.at <= T ? 0.3 : 0.55);
      ctx.fillRect(g.x(c.at), 0, 1, g.H);
    }

    // the lanes
    vis.forEach((l) => drawLane(l, g, yOf, now));

    // BTC bought and held, across the coin lanes, as a thin gold thread
    if (D.btc_series) {
      ctx.save();
      ctx.strokeStyle = rgba(C.gold, 0.55); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      vis.filter((l) => l.d.kind === 'coins').forEach((l) => {
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
    ctx.fillRect(cx, 0, 1, g.H);
    drawAxis(g, cx);
    return settling;
  }

  // the time axis, on its own strip that stays put while the lanes scroll
  function drawAxis(g, cx) {
    const a = actx;
    a.setTransform(dpr, 0, 0, dpr, 0, 0);
    a.clearRect(0, 0, VW, AXIS);
    a.font = `400 8.5px ${DISPLAY}`; a.textBaseline = 'middle'; a.textAlign = 'left';
    const days = Math.ceil((tEnd - t0) / DAY), pxDay = (VW - g.L - g.R) / Math.max(1, (tEnd - t0) / DAY);
    const everyWeeks = Math.max(1, Math.ceil(84 / (7 * pxDay)));
    for (let i = 0; i <= days; i++) {
      a.fillStyle = rgba(C.rail2, i % 7 ? 0.5 : 1);
      a.fillRect(g.x(t0 + i * DAY), AXIS - 6, 1, 6);
    }
    // two rows of labels: the days and now above, the dates the book is read on below; nothing on top of anything
    const taken = [[], []], ROW = [9, 21];
    const put = (text, x, align, color, row) => {
      const w = a.measureText(text).width, x0 = align === 'right' ? x - w : x;
      if (x0 < 2 || x0 + w > VW - 2 || taken[row].some(([s, e]) => x0 < e + 12 && x0 + w > s - 12)) return false;
      a.fillStyle = color; a.fillText(text, x0, ROW[row]); taken[row].push([x0, x0 + w]);
      return true;
    };
    const nowLabel = 'NOW · ' + fmtDay(t1).toUpperCase();
    if (tEnd > t1) put(nowLabel, g.x(t1) + 5, 'left', C.ink2, 0); else put(nowLabel, VW - 14, 'right', C.ink2, 0);
    put(phone() ? 'DAY ONE' : 'DAY ONE · ' + fmtDay(t0).toUpperCase(), g.x(t0) + 5, 'left', C.dim, 0);
    for (let i = 7 * everyWeeks; i <= days; i += 7 * everyWeeks) put('DAY ' + (i + 1), g.x(t0 + i * DAY) + 5, 'left', C.dim, 0);
    for (const c of D.meta.checkpoints || []) {
      if (c.at < t0 || c.at > tEnd) continue;
      const text = (phone() ? c.label : c.label + ' · ' + c.local).toUpperCase(), color = c.at <= T ? C.dim : C.gold;
      put(text, g.x(c.at) - 5, 'right', color, 1) || put(text, g.x(c.at) + 5, 'left', color, 1);
    }
    a.fillStyle = rgba(C.ink, T < t1 ? 0.6 : 0.25);
    a.fillRect(cx, 0, 1, AXIS);
    if (T < t1) {                                                          // the replay clock rides the cursor
      a.font = `500 10px ${MONO}`;
      const text = fmtTime(T), w = a.measureText(text).width, right = cx > VW - 160;
      const x0 = right ? cx - 6 - w : cx + 6;
      a.fillStyle = C.void; a.fillRect(x0 - 3, 13, w + 6, 16);
      a.fillStyle = C.ink; a.fillText(text, x0, 21);
    }
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
    const key = `${T}|${VW}|${g.laneH}|${top}|${yOf.key}|${tEnd}`;
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

    // day 28: the end of this desk's own test, ahead or behind
    if (d.start) {
      const tf = d.start + D.meta.month_days * DAY;
      ctx.font = `400 8px ${DISPLAY}`; ctx.textBaseline = 'middle';
      if (tf <= tEnd) {
        const xf = g.x(tf), past = tf <= T;
        ctx.fillStyle = rgba(C.ink, past ? 0.7 : 0.35); ctx.fillRect(xf, top + 6, 1, g.laneH - 12);
        ctx.fillStyle = rgba(C.ink, past ? 0.8 : 0.45);
        ctx.textAlign = 'left'; ctx.fillText('DAY 28', xf + 4, phone() ? top + g.laneH - 9 : top + 11);
      }
    }

    // left: rank, name, the idea, where it is in its month (two lines when the lanes are packed, three when roomy)
    const compact = g.compact, roomW = g.L - 48;
    const nameY = phone() ? top + 12 : compact ? cy - 7 : cy - 6;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `600 11px ${MONO}`; ctx.fillStyle = rgba(C.dim, 0.9);
    ctx.fillText(String(l.rank).padStart(2, '0'), phone() ? 8 : 14, nameY);
    ctx.font = `400 ${phone() ? 8.5 : 9.5}px ${DISPLAY}`; ctx.fillStyle = col;
    ctx.fillText(phone() ? d.label.toUpperCase() : fitText(d.label.toUpperCase(), roomW), phone() ? 34 : 40, nameY);
    if (!phone()) {
      ctx.font = `400 10px ${MONO}`; ctx.fillStyle = C.dim;
      const stage = !d.start ? 'not started' : T < d.start ? 'not yet' : `day ${Math.min(D.meta.month_days, Math.floor((Math.min(T, t1) - d.start) / DAY) + 1)} of ${D.meta.month_days}`;
      const line = stage + (T >= t1 ? ' · ' + d.verdict : '');
      if (compact) ctx.fillText(fitText(line, roomW), 40, cy + 7);
      else { ctx.fillText(fitText(d.idea, roomW), 40, cy + 9); ctx.fillText(fitText(line, roomW), 40, cy + 22); }
    }

    // right: the return, the paper dollars, open positions, a green week
    const rx = VW - 14, big = phone() ? 15 : compact ? 16 : 19;
    ctx.textAlign = 'right';
    ctx.font = `600 ${big}px ${MONO}`;
    ctx.fillStyle = T < (d.start || Infinity) ? C.dim : ret > 0 ? C.win : ret < 0 ? C.loss : C.ink2;
    ctx.fillText(d.start && T >= d.start ? pct(ret) : '—', rx, cy - (phone() ? 0 : compact ? 7 : 6));
    ctx.font = `400 10.5px ${MONO}`; ctx.fillStyle = C.dim;
    const sub = d.start && T >= d.start ? usd(val) + (T >= t1 && d.open.n ? ` · ${d.open.n} open` : '') : 'waiting for its first trade';
    const subY = cy + (phone() ? 14 : compact ? 8 : 10);
    ctx.fillText(sub, rx, subY);
    if (T >= t1 && d.week && d.week.green_week) {
      const subW = ctx.measureText(sub).width;
      ctx.font = `600 7.5px ${DISPLAY}`; ctx.fillStyle = C.win;
      if (phone()) ctx.fillText('GREEN WEEK', rx, top + 8);
      else if (compact) ctx.fillText('GREEN WEEK', rx - subW - 12, subY);
      else ctx.fillText('GREEN WEEK', rx, cy + 22);
    }
    if (T >= t1 && d.open.n && !phone()) {   // a pulse per open position
      const pulse = REDUCE ? 1 : 0.6 + 0.4 * Math.sin(now / 500 + l.i);
      for (let k = 0; k < Math.min(5, d.open.n); k++) {
        ctx.fillStyle = rgba(col, pulse); ctx.beginPath(); ctx.arc(g.x(t1) + 10 + k * 8, cy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function fitText(text, maxW) {                                          // cut with an ellipsis, in the current font
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.replace(/[\s·,]+$/, '') + '…';
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

  // ---------------------------------------------------------------- header, chips, tape
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
    const checks = $('checks');
    checks.textContent = '';
    for (const c of m.checkpoints || []) {
      const s = document.createElement('span');
      if (c.at <= m.now) s.className = 'past';
      const b = document.createElement('b'); b.textContent = c.label;
      s.append(b, ' ' + c.local);
      checks.appendChild(s);
    }
  }
  function renderChips() {
    const box = $('chips');
    box.textContent = '';
    const counts = {};
    D.desks.forEach((d) => { counts[d.market] = (counts[d.market] || 0) + 1; });
    for (const m of ['all', ...(D.meta.markets || [])]) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.market = m;
      b.setAttribute('aria-pressed', String(m === market));
      b.textContent = m === 'all' ? 'all desks' : m;
      const n = document.createElement('small'); n.textContent = String(m === 'all' ? D.desks.length : counts[m] || 0);
      b.appendChild(n);
      b.addEventListener('click', () => setMarket(m));
      box.appendChild(b);
    }
  }
  function setMarket(m) {
    market = m;
    try { localStorage.setItem(MARKET_KEY, m); } catch (e) { /* fine without */ }
    document.querySelectorAll('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.market === m)));
    stage.scrollTop = 0;
    snap = true; dirty = true;
    if (!$('standings').hidden) renderStandings();
    $('announce').textContent = (m === 'all' ? 'Every desk' : 'Only the ' + m + ' desks') + ' showing, ' + visible().length + ' lanes.';
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

  // ---------------------------------------------------------------- standings
  function renderStandings() {
    const m = D.meta, body = $('standings-body');
    const checks = (m.checkpoints || []).map((c) => `${c.label} ${c.local}`).join(', then ');
    const rule = $('standings-rule');
    rule.textContent = '';
    const b = document.createElement('b');
    b.textContent = checks ? `Read on: ${checks}.` : 'Read at the end of each desk’s month.';
    rule.append(b, ` After that the bar is a green week: traded on 3 or more of the last ${m.week_days || 7} days, net up over the ${m.week_days || 7}, and no single day's loss bigger than the week's gain. Paper money only; nothing here is a forecast.`);
    body.textContent = '';
    const rows = visible().slice().sort((a, b2) => returnAt(b2.d, t1) - returnAt(a.d, t1) || a.i - b2.i);
    if (!rows.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 8; td.className = 'empty'; td.textContent = 'No desks to show.'; tr.appendChild(td); body.appendChild(tr);
      return;
    }
    const cell = (tr, cls, ...parts) => {
      const td = document.createElement('td'); if (cls) td.className = cls;
      parts.forEach((p) => td.append(p)); tr.appendChild(td); return td;
    };
    const small = (text) => { const s = document.createElement('small'); s.textContent = text; return s; };
    rows.forEach((l, k) => {
      const d = l.d, ret = returnAt(d, t1), val = valueAt(d, t1) + d.open.value, w = d.week || {};
      const tr = document.createElement('tr');
      if (k === 0 && ret > 0) tr.className = 'lead';
      cell(tr, 'n', String(k + 1).padStart(2, '0'));
      const dot = document.createElement('i'); dot.className = 'dot'; dot.style.setProperty('--c', d.color);
      const name = document.createElement('span'); name.className = 'name'; name.style.setProperty('--c', d.color); name.textContent = d.label;
      cell(tr, '', dot, name, small(d.market));
      cell(tr, 'idea', d.idea);
      cell(tr, 'n day', d.start ? `${d.day} / ${m.month_days}` : '—');
      const since = cell(tr, 'n ' + (ret > 0 ? 'up' : ret < 0 ? 'down' : ''), d.start ? pct(ret) : '—');
      since.append(small(d.start ? usd(val) + (d.open.n ? ` · ${d.open.n} open` : '') : 'no trades yet'));
      const wk = cell(tr, 'n ' + (w.net > 0 ? 'up' : w.net < 0 ? 'down' : ''), w.traded ? usd(w.net) : '—');
      wk.append(small(w.traded ? `${w.green} green · ${w.red} red · ${w.traded} of ${m.week_days || 7} days` : 'no trades this week'));
      cell(tr, 'n', String(d.trades));
      const v = cell(tr, 'verdict', d.verdict);
      if (w.green_week) { const g = document.createElement('b'); g.className = 'gw'; g.textContent = 'green week'; v.appendChild(g); }
      body.appendChild(tr);
    });
  }
  let lastFocus = null;
  function openStandings() {
    renderStandings();
    lastFocus = document.activeElement;
    $('standings').hidden = false;
    $('standings-btn').setAttribute('aria-expanded', 'true');
    $('standings-close').focus();
  }
  function closeStandings() {
    $('standings').hidden = true;
    $('standings-btn').setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
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
  $('standings-btn').addEventListener('click', () => ($('standings').hidden ? openStandings() : closeStandings()));
  $('standings-close').addEventListener('click', closeStandings);
  $('scrub').addEventListener('input', (e) => setT(t0 + (Number(e.target.value) / 1000) * (t1 - t0), true));
  let drag = false;
  const scrubAt = (clientX) => { const g = geometry(); const r = cv.getBoundingClientRect(); setT(t0 + ((clientX - r.left - g.L) / (VW - g.L - g.R)) * (tEnd - t0), true); };
  cv.addEventListener('pointerdown', (e) => { drag = true; cv.classList.add('scrubbing'); cv.setPointerCapture(e.pointerId); scrubAt(e.clientX); });
  cv.addEventListener('pointermove', (e) => { if (drag) scrubAt(e.clientX); });
  const up = () => { drag = false; cv.classList.remove('scrubbing'); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('standings').hidden) { closeStandings(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || !$('standings').hidden) return;
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
      D = next; prepare(); renderHeader(); renderChips(); renderTape();
      if (!$('standings').hidden) renderStandings();
      if (atEnd) T = t1;
      dirty = true;
      $('announce').textContent = 'New paper trades: the deck is up to date.';
    } catch (e) { /* not served next to deck.json: nothing to refresh */ }
  }
  if (/^https?:$/.test(location.protocol)) setInterval(refresh, 120000);

  // ---------------------------------------------------------------- go
  prepare(); renderHeader(); renderChips(); renderTape();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  if (REDUCE) { T = t1; pause(); } else startReplay();
  window.__deck = { time: () => [t0, T, t1, tEnd], order: () => visible().slice().sort((a, b) => a.rank - b.rank).map((l) => l.d.key),
    size: () => [VW, VH, CH], frames: () => frames, lanes: () => visible().map((l) => [l.d.key, Math.round(l.y), Math.round(l.ty)]),
    market: () => market, setMarket, standings: () => $('standings-body').querySelectorAll('tr').length, open: openStandings };
  requestAnimationFrame(loop);
})();
