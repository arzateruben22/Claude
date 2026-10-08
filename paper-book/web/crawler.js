/* Trade Crawler: the spider, the web of paper trades and the six readout panels.
   Every number comes from crawler.py (window.TRADE_CRAWLER); only the shape of the dust is random. */
(function () {
  'use strict';
  let D = window.TRADE_CRAWLER;
  if (!D) return;

  const $ = (id) => document.getElementById(id);
  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const C = {
    bg: token('--bg', '#08090b'), ink: token('--ink', '#e9edf1'), dim: token('--dim', '#7c838b'),
    teal: token('--teal', '#41d9c3'), pink: token('--pink', '#ff4f7b'), wave: token('--wave', '#d9a65a'),
    gold: token('--gold', '#f2bd4f'),
  };
  const FONT = token('--mono', 'ui-monospace, monospace');

  const LEGS = 16, TENTACLES = 22, HOLD = 14;
  // Where each cluster sits in the web, in crawl order: three desks, the open positions, the patterns.
  const CENTERS = [[0, 0], [-430, -560], [-1150, -190], [-990, 640], [-140, 880], [780, 650], [930, -250]];
  const SHIP = { key: 'ship', name: 'ship', color: C.pink, sub: 'flags to check before any real money' };
  const AXES = ['WIN', 'PF', 'R:R', 'DD', 'GREEN', 'N'];
  const GREY = [205, 212, 220], WHITE = [240, 244, 248], CREAM = [246, 231, 166];
  const CYAN = [80, 226, 214], SKY = [79, 205, 240], PINK = rgbOf(C.pink), GOLD = rgbOf(C.gold);
  const ALPHA = [0.16, 0.3, 0.52];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const usd = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usd0 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
  function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`; }
  function mix(c, d, t) { return [lerp(c[0], d[0], t) | 0, lerp(c[1], d[1], t) | 0, lerp(c[2], d[2], t) | 0]; }
  function qb(a, c, b, t) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  // ---------------------------------------------------------------- the book, as words to read

  const DESK = {};
  function sections(d) {
    (d.desks || []).forEach((k) => { DESK[k.key] = k; });
    return d.sections.map((s) => {
      let words;
      if (s.kind === 'trades') {
        words = s.words.map(([sym, pnl, p, exit, held, ts, day, flag]) =>
          ({ sym, pnl, pct: p, exit, held, ts, day, flag: !!flag, tone: flag ? 'flag' : pnl > 0 ? 'hi' : 'lo' }));
      } else if (s.kind === 'open') {
        words = s.words.map(([sym, desk, cost, value, ts]) => {
          const p = value == null || !cost ? null : (value / cost - 1) * 100;
          return { sym, desk, cost, value, ts, pct: p, flag: p != null && p < -20, tone: p != null && p < -20 ? 'flag' : 'hi' };
        });
      } else {
        words = s.words.map(([title, desk, unlocked, detail]) =>
          ({ title, desk, unlocked: !!unlocked, detail, flag: false, tone: unlocked ? 'hi' : 'lo' }));
      }
      return Object.assign({}, s, { words });
    });
  }

  // ---------------------------------------------------------------- the web

  let secs = [], world = [], asks = [];
  const S = { frame: 0, paused: false, speed: 1, base: 0.1 };
  const sp = { x: 0, y: 0, vx: 0, vy: 0, tilt: 0, phase: 0, pulse: 0, k: 1 };
  const cam = { x: 0, y: 0, z: 0.8 };
  let tents = [], trails = [];

  function buildWorld() {
    const small = window.innerWidth < 700;
    return secs.map((s, i) => {
      const [cx, cy] = CENTERS[i];
      const r = rng(4049 + i * 7919);
      const blobs = [];
      const nb = 6 + Math.floor(r() * 4);
      for (let k = 0; k < nb; k++) {
        blobs.push({ x: cx + gauss(r) * 150, y: cy + gauss(r) * 130, sx: 40 + r() * 100, sy: 35 + r() * 95,
          rot: r() * Math.PI, w: 0.4 + r() });
      }
      const rgb = rgbOf(s.color);
      const lay = layoutWords(cx, cy, s.words, rng(77 + i * 131));
      return {
        i, s, cx, cy, rgb, light: mix(rgb, WHITE, 0.3), nodes: lay.nodes, R: lay.R,
        dust: makeDust(cx, cy, blobs, r, small ? 900 : 1800),
        haze: makeHaze(blobs, cx, cy, GREY), hazeTint: makeHaze(blobs, cx, cy, rgb),
      };
    });
  }

  function makeDust(cx, cy, blobs, r, n) {
    const pts = [];
    const wsum = blobs.reduce((a, b) => a + b.w, 0);
    const strands = Math.floor(n * 0.28);
    for (let k = 0; k < n - strands; k++) {
      let t = r() * wsum, b = blobs[blobs.length - 1];
      for (const bb of blobs) { t -= bb.w; if (t <= 0) { b = bb; break; } }
      const gx = gauss(r) * b.sx, gy = gauss(r) * b.sy, co = Math.cos(b.rot), si = Math.sin(b.rot);
      pts.push(b.x + gx * co - gy * si, b.y + gx * si + gy * co);
    }
    let left = strands;
    while (left > 0) {                       // thin wandering strands between the clumps
      let x = cx + gauss(r) * 170, y = cy + gauss(r) * 150, a = r() * Math.PI * 2;
      const len = 18 + Math.floor(r() * 40);
      for (let k = 0; k < len && left > 0; k++, left--) {
        a += (r() - 0.5) * 0.7;
        x += Math.cos(a) * 11; y += Math.sin(a) * 11;
        pts.push(x + gauss(r) * 3, y + gauss(r) * 3);
      }
    }
    // Thread each point to its nearest neighbours.
    const cell = 36, grid = new Map(), m = pts.length / 2;
    const key = (gx, gy) => gx * 100003 + gy;
    for (let i = 0; i < m; i++) {
      const k = key(Math.floor(pts[2 * i] / cell), Math.floor(pts[2 * i + 1] / cell));
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(i);
    }
    const links = [];
    for (let i = 0; i < m; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1], gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let b1 = -1, d1 = cell * cell, b2 = -1, d2 = cell * cell;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const a = grid.get(key(gx + dx, gy + dy));
          if (!a) continue;
          for (const j of a) {
            if (j <= i) continue;
            const d = (pts[2 * j] - x) ** 2 + (pts[2 * j + 1] - y) ** 2;
            if (d < d1) { b2 = b1; d2 = d1; b1 = j; d1 = d; } else if (d < d2) { b2 = j; d2 = d; }
          }
        }
      }
      if (b1 >= 0) links.push(x, y, pts[2 * b1], pts[2 * b1 + 1]);
      if (b2 >= 0 && r() < 0.5) links.push(x, y, pts[2 * b2], pts[2 * b2 + 1]);
    }
    const buckets = [[], [], []], stars = [];
    for (let i = 0; i < m; i++) {
      const v = r();
      if (v < 0.025) stars.push(pts[2 * i], pts[2 * i + 1]);
      else buckets[v < 0.55 ? 0 : v < 0.85 ? 1 : 2].push(pts[2 * i], pts[2 * i + 1]);
    }
    return { b: buckets.map((a) => new Float32Array(a)), stars: new Float32Array(stars), links: new Float32Array(links) };
  }

  function makeHaze(blobs, cx, cy, col) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d'), s = 256 / 1400;
    for (const b of blobs) {
      const x = (b.x - cx + 700) * s, y = (b.y - cy + 700) * s, rad = (b.sx + b.sy) * 1.25 * s;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(col, col === GREY ? 0.05 : Math.min(...col) > 200 ? 0.03 : 0.07));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return cv;
  }

  // Trades sit along a wandering path, so the spider walks each desk in the order its trades closed.
  function layoutWords(cx, cy, words, r) {
    const n = words.length;
    const R = 150 + Math.min(170, Math.sqrt(n) * 18);
    const nodes = [];
    let x = cx + (r() - 0.5) * 120, y = cy + (r() - 0.5) * 100, a = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      let nx, ny, tries = 0;
      do {
        a += (r() - 0.5) * 1.6;
        const step = 24 + r() * 22;
        nx = x + Math.cos(a) * step; ny = y + Math.sin(a) * step;
        if (Math.hypot(nx - cx, ny - cy) > R) {
          a = Math.atan2(cy - y, cx - x) + (r() - 0.5) * 1.2;
          nx = x + Math.cos(a) * step; ny = y + Math.sin(a) * step;
        }
      } while (++tries < 8 && nodes.some((p) => Math.hypot(p.x - nx, p.y - ny) < 16));
      x = nx; y = ny;
      const w = words[k];
      const size = w.pct == null ? 1 : 0.85 + Math.min(1, Math.abs(w.pct) / 40) * 0.5;
      nodes.push({ x, y, read: false, at: -9, flag: w.flag, tone: w.tone, size });
    }
    return { nodes, R };
  }

  // ---------------------------------------------------------------- the crawl

  function load(d) {
    D = d;
    secs = sections(d);
    asks = d.flags || [];
    world = buildWorld();
    const total = secs.reduce((a, s) => a + s.words.length, 0);
    S.base = clamp(26 / Math.max(1, total), 0.02, 0.11);
    setCode();
    buildPanels();
    const badge = $('book-name');
    badge.textContent = d.meta.demo ? 'demo prices' : 'paper money';
    badge.classList.toggle('demo', !!d.meta.demo);
    badge.title = 'Updated ' + d.meta.updated_local;
    $('st-total').textContent = d.meta.trades.toLocaleString('en-US');
    $('p-total').textContent = d.meta.trades.toLocaleString('en-US');
    reset();
  }

  function reset() {
    Object.assign(S, {
      phase: 'read', sec: 0, cursor: 0, wait: 0.8, t: 0, read: 0, wins: 0, losses: 0, flags: 0, open: 0, unlocked: 0,
      pnl: 0, gain: 0, loss: 0, cum: 0, peak: 0, dd: 0, days: new Map(), curve: [0], took: secs.map(() => false),
      readIn: world.map(() => 0), done: new Set(),
      log: [], logDirty: true, stamps: [], chars: 0, shown: -1, lps: 0,
      walk: null, secStart: 0, shipAt: 0, shipShown: false, shipOpen: false, emptyDone: false,
    });
    for (const c of world) for (const n of c.nodes) { n.read = false; n.at = -9; }
    tents = [];
    trails = [];
    $('ship').hidden = true;
    const c0 = world[0], p0 = c0.nodes[0] || { x: c0.cx, y: c0.cy };
    sp.x = p0.x - 70; sp.y = p0.y + 40; sp.vx = sp.vy = 0;
    log('walk', '→ ' + c0.s.name);
    arrive(0, true);
    S.wait = 0.8;
    snapCam();
  }

  function arrive(i, quiet) {
    Object.assign(S, { phase: 'read', sec: i, cursor: 0, wait: 0.3, secStart: S.t, walk: null, emptyDone: false });
    takeEarlier(i);
    setSection(i);
    if (!quiet) announce(`Reading ${world[i].s.name}: ${world[i].s.sub}.`);
  }

  // A desk with more trades than the crawler walks: the older ones are counted in one go.
  function takeEarlier(si) {
    const e = world[si].s.earlier;
    if (!e || !e.n || S.took[si]) return;
    S.took[si] = true;
    S.read += e.n; S.wins += e.wins; S.losses += e.losses; S.flags += e.flags;
    S.gain += e.gain; S.loss += e.loss; S.pnl += e.pnl;
    for (const [day, v] of Object.entries(e.days)) S.days.set(+day, (S.days.get(+day) || 0) + v);
    step(e.pnl);
    log('past', `${e.n.toLocaleString('en-US')} earlier trades · ${usd(e.pnl)}`);
  }

  function step(pnl) {
    S.cum += pnl;
    S.peak = Math.max(S.peak, S.cum);
    const base = D.meta.bank + S.peak;
    if (base > 0) S.dd = Math.max(S.dd, ((S.peak - S.cum) / base) * 100);
    S.curve.push(S.cum);
  }

  function tick(dt) {
    if (S.phase === 'read') {
      const c = world[S.sec];
      S.wait -= dt;
      if (!c.s.words.length) {
        if (!S.emptyDone) {
          S.emptyDone = true;
          log('none', c.s.kind === 'trades' ? `${c.s.name}: no trades yet` : `no ${c.s.name} yet`);
          S.wait = 1.1;
        }
        if (S.wait <= 0) finishSection();
        return;
      }
      while (S.wait <= 0 && S.phase === 'read') {
        if (S.cursor >= c.s.words.length) { finishSection(); break; }
        const w = c.s.words[S.cursor];
        readWord(S.sec, S.cursor, false);
        S.cursor++;
        S.wait += delayFor(c.s, w);
      }
    } else if (S.phase === 'walk') {
      S.walk.t = Math.min(1, S.walk.t + dt / S.walk.dur);
      if (S.walk.t >= 1) { S.walk.endAt = S.t; arrive(S.walk.to); }
    } else if (S.phase === 'ship' && !S.shipShown && S.t >= S.shipAt) {
      showShip();
    }
  }

  function delayFor(s, w) {
    if (s.kind !== 'trades') return Math.max(0.3, S.base * 4) * (0.8 + Math.random() * 0.4) + (w.flag ? 0.4 : 0);
    let d = S.base * (0.75 + Math.random() * 0.5);
    if (w.flag) d += 0.5;
    else if (w.pnl > 0) d += 0.04;
    return d;
  }

  function readWord(si, wi, quiet) {
    const c = world[si], w = c.s.words[wi], n = c.nodes[wi];
    n.read = true;
    n.at = S.t;
    S.readIn[si]++;
    let verb, text;
    if (c.s.kind === 'trades') {
      S.read++;
      S.pnl += w.pnl;
      if (w.pnl > 0) { S.wins++; S.gain += w.pnl; } else if (w.pnl < 0) { S.losses++; S.loss -= w.pnl; }
      S.days.set(w.day, (S.days.get(w.day) || 0) + w.pnl);
      step(w.pnl);
      verb = w.flag ? 'flag' : w.pnl > 0 ? 'won' : 'lost';
      text = w.flag ? `${w.sym} ${pct(w.pct)} · ${w.exit}` : `${w.sym} ${usd(w.pnl)} · ${w.exit}`;
    } else if (c.s.kind === 'open') {
      S.open++;
      verb = w.flag ? 'flag' : 'held';
      text = w.value == null ? `${w.sym} · waiting for the open` : `${w.sym} ${usd(w.value - w.cost)} open · ${pct(w.pct)}`;
    } else {
      if (w.unlocked) S.unlocked++;
      verb = w.unlocked ? 'link' : 'lock';
      text = `${w.desk} · ${w.title}`;
    }
    if (w.flag) {
      S.flags++;
      if (!quiet) sp.pulse = 1;
    }
    log(verb, text);
    if (quiet) return;
    S.stamps.push(S.t);
    tents.push({ si, wi, born: S.t, dead: null });
    const live = tents.filter((t) => t.dead === null);
    if (live.length > HOLD) live[0].dead = S.t;
  }

  function finishSection() {
    S.done.add(world[S.sec].s.key);
    if (S.sec + 1 < world.length) startWalk(S.sec + 1);
    else startShip(false);
  }

  function startWalk(next) {
    const c = world[next];
    const p = c.nodes[0] || { x: c.cx, y: c.cy };
    const a = { x: sp.x, y: sp.y }, b = { x: p.x - 46, y: p.y + 30 };
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const bend = (next % 2 ? 1 : -1) * 0.3 * dist;
    const ctrl = { x: (a.x + b.x) / 2 - (dy / dist) * bend, y: (a.y + b.y) / 2 + (dx / dist) * bend };
    S.walk = { a, b, c: ctrl, t: 0, dur: RM ? 0.01 : 1.1 + dist / 1100, to: next, endAt: 0 };
    trails.push(S.walk);
    for (const t of tents) if (t.dead === null) t.dead = S.t;
    log('walk', '→ ' + c.s.name);
    S.phase = 'walk';
    S.sec = next;
    setSection(next);
  }

  function startShip(quiet) {
    S.phase = 'ship';
    S.sec = world.length;
    S.shipAt = S.t + (quiet || RM ? 0 : 1.4);
    for (const t of tents) if (t.dead === null) t.dead = S.t;
    setSection(world.length);
    log('ship', countFlags(true) + ' flags to check');
  }

  // Jump straight to a cluster: everything before it is read at once.
  function seek(target) {
    reset();
    for (let i = 0; i < Math.min(target, world.length); i++) {
      takeEarlier(i);
      world[i].s.words.forEach((w, wi) => readWord(i, wi, true));
      S.done.add(world[i].s.key);
    }
    S.log = S.log.slice(-20);
    if (target >= world.length) {
      const c = world[world.length - 1], p = c.nodes[c.nodes.length - 1] || { x: c.cx, y: c.cy };
      sp.x = p.x - 46; sp.y = p.y + 30;
      startShip(true);
    } else {
      arrive(target);
      const c = world[target], p = c.nodes[0] || { x: c.cx, y: c.cy };
      sp.x = p.x - 46; sp.y = p.y + 30;
    }
    sp.vx = sp.vy = 0;
    S.chars = Math.floor(progress() * CODE.length);
    snapCam();
  }

  const LOG_CLASS = { won: 'link', link: 'link', lost: 'read', flag: 'flag', held: 'held', lock: 'lock', none: 'lock',
    past: 'walk', walk: 'walk', ship: 'ship' };
  function log(verb, text) {
    const d = new Date();
    S.log.push({ tm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), verb, text });
    if (S.log.length > 40) S.log.shift();
    S.logDirty = true;
  }

  function announce(msg) { $('announce').textContent = msg; }

  // Flags on the results list count once their desk has been crawled.
  function countFlags(all) {
    return asks.filter((q) => q.level === 'flag' && (all || S.phase === 'ship' || S.done.has(q.desk))).length;
  }

  // ---------------------------------------------------------------- the score

  function score() {
    const n = S.read;
    if (!n) return { per: AXES.map(() => 0), total: 0 };
    const pf = S.loss > 0 ? S.gain / S.loss : S.gain > 0 ? 2 : 0;
    const avgW = S.wins ? S.gain / S.wins : 0, avgL = S.losses ? S.loss / S.losses : 0;
    const rr = avgL > 0 ? avgW / avgL : avgW > 0 ? 2 : 0;
    let green = 0;
    for (const v of S.days.values()) if (v > 0) green++;
    const per = [S.wins / n, Math.min(1, pf / 2), Math.min(1, rr / 2), 1 - Math.min(1, S.dd / 50),
      S.days.size ? green / S.days.size : 0, Math.min(1, n / 200)];
    return { per, total: Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 100) };
  }

  // ---------------------------------------------------------------- motion

  function spiderTarget() {
    if (S.phase === 'ship') return { x: sp.x, y: sp.y };
    const c = world[S.sec], n = c.nodes.length;
    if (!n) return { x: c.cx - 40, y: c.cy + 20 };
    const i = clamp(S.cursor - 1, 0, n - 1);
    let x = 0, y = 0, k = 0;
    for (let j = i; j < Math.min(n, i + 4); j++, k++) { x += c.nodes[j].x; y += c.nodes[j].y; }
    return { x: x / k - 46, y: y / k + 30 };
  }

  function updateSpider(rdt) {
    sp.pulse = Math.max(0, sp.pulse - rdt * 1.8);
    const px = sp.x, py = sp.y;
    if (S.phase === 'walk' && S.walk) {
      const p = qb(S.walk.a, S.walk.c, S.walk.b, ease(S.walk.t));
      sp.x = p.x; sp.y = p.y;
      if (rdt > 0) { sp.vx = (sp.x - px) / rdt; sp.vy = (sp.y - py) / rdt; }
    } else {
      const t = spiderTarget();
      if (RM) { sp.x = t.x; sp.y = t.y; sp.vx = sp.vy = 0; }
      else {
        sp.vx += ((t.x - sp.x) * 6 - sp.vx * 4.9) * rdt;
        sp.vy += ((t.y - sp.y) * 6 - sp.vy * 4.9) * rdt;
        sp.x += sp.vx * rdt;
        sp.y += sp.vy * rdt;
      }
    }
    if (!RM) sp.phase += rdt * (0.8 + Math.hypot(sp.vx, sp.vy) * 0.03);
    sp.tilt += (clamp(sp.vx * 0.0011, -0.35, 0.35) - sp.tilt) * Math.min(1, rdt * 4);
  }

  function baseZoom() { return clamp(Math.min(VW * 0.95, VH * 1.2) / (VW < 700 ? 760 : 900), 0.3, 1.3); }

  function camTarget() {
    const z = baseZoom();
    if (S.phase === 'ship') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of world) {
        x0 = Math.min(x0, c.cx - 380); x1 = Math.max(x1, c.cx + 380);
        y0 = Math.min(y0, c.cy - 400); y1 = Math.max(y1, c.cy + 380);
      }
      // Fit every cluster, leaving room on the right for labels and for the results panel.
      const side = S.shipOpen && VW > 900 ? 460 : 0, left = 12, avail = VW - side - (VW < 700 ? 50 : 120);
      const zz = Math.min(avail / (x1 - x0), (VH - 30) / (y1 - y0));
      return { x: (x0 + x1) / 2 + (VW / 2 - (left + avail / 2)) / zz, y: (y0 + y1) / 2, z: zz };
    }
    if (S.phase === 'walk') return { x: sp.x, y: sp.y, z: z * 0.8 };
    const c = world[S.sec];
    return { x: lerp(c.cx, sp.x, 0.5), y: lerp(c.cy, sp.y, 0.5), z };
  }

  function snapCam() { const t = camTarget(); cam.x = t.x; cam.y = t.y; cam.z = t.z; }

  function updateCam(rdt) {
    const t = camTarget();
    const k = RM ? 1 : 1 - Math.exp(-rdt * (S.phase === 'walk' ? 3.2 : 1.8));
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
    cam.z += (t.z - cam.z) * k;
  }

  // ---------------------------------------------------------------- drawing

  const canvas = $('web'), ctx = canvas.getContext('2d');
  let VW = 0, VH = 0, DPR = 1, vignette = null;

  function resize() {
    const r = $('stage').getBoundingClientRect();
    VW = r.width; VH = r.height;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(VW * DPR));
    canvas.height = Math.max(1, Math.round(VH * DPR));
    vignette = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.55)');
  }

  function modeOf(c) {                     // 0 queued, 1 being read, 2 done
    if (S.phase === 'ship') return 2;
    if (c.i === S.sec) return 1;
    return c.i < S.sec ? 2 : 0;
  }

  function draw(now) {
    if (!VW || !VH) return;
    const z = cam.z, ox = VW / 2 - cam.x * z, oy = VH / 2 - cam.y * z;
    const sx = (x) => x * z + ox, sy = (y) => y * z + oy;
    const onScreen = (c) => {
      const x = sx(c.cx), y = sy(c.cy), r = 720 * z;
      return x + r > 0 && x - r < VW && y + r > 0 && y - r < VH;
    };
    sp.k = clamp(z * 1.6, 0.6, 1.5);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, VW, VH);
    const act = S.sec < world.length ? world[S.sec] : null;
    if (act) {
      const gx = sx(act.cx), gy = sy(act.cy), gr = 620 * z;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, rgba(act.rgb, 0.07));
      g.addColorStop(1, rgba(act.rgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }

    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
    for (const c of world) if (onScreen(c)) drawDust(c, modeOf(c), z, now);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VW, VH);

    drawTrails(sx, sy);
    for (const c of world) if (onScreen(c)) drawNodes(c, modeOf(c), sx, sy);
    const bx = sx(sp.x), by = sy(sp.y);
    drawTentacles(bx, by, sx, sy, now);
    if (act && S.phase !== 'ship') drawTags(act, sx, sy, bx, by);
    drawSpider(bx, by, sp.k, now);
    drawLabels(sx, sy, bx, by);
  }

  function drawDust(c, mode, z, now) {
    const tint = mode === 1 ? c.rgb : GREY;
    const boost = mode === 1 ? 1.2 : mode === 2 ? 0.85 : 0.6;
    const inv = 1 / z;
    ctx.globalAlpha = mode === 1 ? 1 : 0.6;
    ctx.drawImage(mode === 1 ? c.hazeTint : c.haze, c.cx - 700, c.cy - 700, 1400, 1400);
    ctx.globalAlpha = 1;
    const L = c.dust.links;
    ctx.lineWidth = 0.7 * inv;
    ctx.strokeStyle = rgba(tint, (mode === 1 ? 0.16 : 0.08) * boost);
    ctx.beginPath();
    for (let i = 0; i < L.length; i += 4) { ctx.moveTo(L[i], L[i + 1]); ctx.lineTo(L[i + 2], L[i + 3]); }
    ctx.stroke();
    const s = 1.2 * inv, h = s / 2;
    for (let b = 0; b < 3; b++) {
      const P = c.dust.b[b];
      ctx.fillStyle = rgba(b === 2 && mode !== 1 ? WHITE : tint, ALPHA[b] * boost);
      ctx.beginPath();
      for (let i = 0; i < P.length; i += 2) ctx.rect(P[i] - h, P[i + 1] - h, s, s);
      ctx.fill();
    }
    const st = c.dust.stars, s2 = 2.4 * inv;
    for (let i = 0; i < st.length; i += 2) {
      const tw = RM ? 0.8 : 0.55 + 0.45 * Math.sin(now * 0.0017 + i * 1.3);
      ctx.fillStyle = rgba(mode === 1 ? c.light : WHITE, tw * (mode === 0 ? 0.55 : 0.95));
      ctx.fillRect(st[i] - s2 / 2, st[i + 1] - s2 / 2, s2, s2);
    }
  }

  function drawTrails(sx, sy) {
    trails = trails.filter((w) => w.t < 1 || S.t - w.endAt < 4);
    for (const w of trails) {
      const upto = ease(w.t);
      const fade = w.t < 1 ? 1 : 1 - (S.t - w.endAt) / 4;
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      for (const [off, width, alpha] of [[0, 2, 0.75], [0.14, 1, 0.4]]) {
        const ctrl = { x: w.c.x + (w.c.x - mid.x) * off, y: w.c.y + (w.c.y - mid.y) * off };
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const p = qb(w.a, ctrl, w.b, (upto * k) / 48);
          if (k) ctx.lineTo(sx(p.x), sy(p.y)); else ctx.moveTo(sx(p.x), sy(p.y));
        }
        ctx.strokeStyle = rgba(SKY, alpha * fade);
        ctx.lineWidth = width;
        ctx.shadowColor = rgba(SKY, 0.8 * fade);
        ctx.shadowBlur = 8;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  }

  // Wins glow in the desk's colour, losses stay grey, flags are pink.
  function drawNodes(c, mode, sx, sy) {
    for (const n of c.nodes) {
      const x = sx(n.x), y = sy(n.y);
      if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) continue;
      if (n.read) {
        const age = S.t - n.at;
        const col = n.tone === 'flag' ? PINK : n.tone === 'lo' ? GREY : mode === 1 ? c.light : mix(c.light, WHITE, 0.4);
        if (mode === 1 && age < 1.2 && !RM) {
          ctx.strokeStyle = rgba(col, (1 - age / 1.2) * 0.6);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 3 + age * 10, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(col, n.tone === 'lo' ? 0.6 : 0.95);
        ctx.beginPath(); ctx.arc(x, y, (mode === 1 ? 2.3 : 1.9) * n.size, 0, Math.PI * 2); ctx.fill();
      } else if (mode === 1) {
        ctx.fillStyle = rgba(c.rgb, 0.5);
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (mode === 0) {
        ctx.fillStyle = rgba(GREY, 0.3);
        ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      }
    }
  }

  function drawTentacles(bx, by, sx, sy, now) {
    tents = tents.filter((t) => t.dead === null || S.t - t.dead < 0.45);
    for (const t of tents.slice(-TENTACLES)) {
      const n = world[t.si].nodes[t.wi];
      const grow = RM ? 1 : clamp((S.t - t.born) / 0.18, 0, 1);
      const shrink = t.dead === null ? 1 : 1 - clamp((S.t - t.dead) / 0.45, 0, 1);
      drawTentacle(bx, by, sx(n.x), sy(n.y), Math.min(grow, shrink), t.wi, 0.9 * shrink, S.t - t.born < 1.2);
    }
    if (S.phase === 'read') {                // two reach ahead for the next trades
      const c = world[S.sec];
      for (let j = 0; j < 2; j++) {
        const n = c.nodes[S.cursor + j];
        if (!n) break;
        const f = RM ? 0.5 : 0.35 + 0.25 * Math.sin(now * 0.004 + j * 2);
        drawTentacle(bx, by, sx(n.x), sy(n.y), f, S.cursor + j, 0.35, false);
      }
    }
  }

  function drawTentacle(ax, ay, bx, by, frac, seed, alpha, ring) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < 6 || frac <= 0) return;
    const ux = dx / len, uy = dy / len;
    const a = { x: ax + ux * 30 * sp.k * 0.85, y: ay + uy * 21 * sp.k * 0.85 }, b = { x: bx, y: by };
    const bend = len * 0.16 * (seed % 2 ? 1 : -1);
    const c = { x: (a.x + bx) / 2 - uy * bend, y: (a.y + by) / 2 + ux * bend };
    const n = Math.max(2, Math.floor(len / 6.5)), upto = Math.floor(n * frac);
    const g = ctx.createLinearGradient(a.x, a.y, bx, by);
    g.addColorStop(0, rgba(CREAM, alpha));
    g.addColorStop(1, rgba(WHITE, alpha));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 1; k <= upto; k++) {
      const p = qb(a, c, b, k / n);
      ctx.moveTo(p.x + 1.3, p.y);
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    }
    ctx.fill();
    if (ring && frac >= 1) {
      ctx.strokeStyle = rgba(WHITE, alpha);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawSpider(x, y, k, now) {
    const rx = 30 * k, ry = 21 * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sp.tilt);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgba(CYAN, 0.85);
    ctx.fillStyle = 'rgba(170,250,240,.95)';
    for (let i = 0; i < LEGS; i++) {
      const a = (i / LEGS) * Math.PI * 2;
      const wig = RM ? 0 : Math.sin(sp.phase * 3 + i * 1.7) * 0.22;
      const L = (i % 2 ? 36 : 46) * k * (RM ? 1 : 1 + 0.07 * Math.sin(sp.phase * 2 + i));
      const bx = Math.cos(a) * rx * 0.9, by = Math.sin(a) * ry * 0.9;
      const kx = bx + Math.cos(a + wig) * L * 0.5, ky = by + Math.sin(a + wig) * L * 0.5;
      const tx = kx + Math.cos(a - wig * 0.7) * L * 0.55, ty = ky + Math.sin(a - wig * 0.7) * L * 0.55;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillRect(kx - 0.9, ky - 0.9, 1.8, 1.8);
      ctx.beginPath(); ctx.arc(tx, ty, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // the shell: a meshed globe with a glowing rim
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(0, -ry * 0.3, 1, 0, 0, rx);
    g.addColorStop(0, 'rgba(26,96,104,.96)');
    g.addColorStop(1, 'rgba(8,40,48,.96)');
    ctx.shadowColor = rgba(CYAN, 0.9);
    ctx.shadowBlur = 18 * k;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(110,240,228,.42)';
    ctx.lineWidth = 0.8;
    for (let j = -3; j <= 3; j++) {
      const yy = (j / 3.6) * ry;
      ctx.beginPath(); ctx.moveTo(-rx, yy); ctx.lineTo(rx, yy); ctx.stroke();
    }
    const spin = RM ? 0 : now * 0.0006;
    for (let j = 0; j < 7; j++) {
      const e = Math.abs(Math.cos((j / 7) * Math.PI + spin) * rx) + 0.01;
      ctx.beginPath(); ctx.ellipse(0, 0, e, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#5ff0e2';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // the core flares pink on every flag
    const cs = (6.5 + 4 * sp.pulse) * k;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = (12 + 14 * sp.pulse) * k;
    ctx.fillStyle = C.pink;
    ctx.beginPath(); ctx.moveTo(0, -cs); ctx.lineTo(cs, 0); ctx.lineTo(0, cs); ctx.lineTo(-cs, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const overlaps = (p, r) => p.x < r.x + r.w + 2 && r.x < p.x + p.w + 2 && p.y < r.y + r.h + 2 && r.y < p.y + p.h + 2;

  function tagOf(s, w) {
    if (s.kind === 'trades') return { text: `${w.sym} · ${pct(w.pct)}`, after: w.exit };
    if (s.kind === 'open') {
      return { text: w.value == null ? `${w.sym} · waiting` : `${w.sym} · open ${usd(w.value - w.cost)}`, after: 'open' };
    }
    return { text: `${w.desk} · ${w.unlocked ? w.title : 'locked'}`, after: '' };
  }

  // Tags for the cluster being read: every flag and win, plus the latest reads.
  function drawTags(c, sx, sy, bx, by) {
    const small = VW < 700, cap = small ? 7 : 24, k = sp.k;
    const read = [];
    for (let i = 0; i < c.nodes.length; i++) if (c.nodes[i].read) read.push(i);
    const recent = read.slice(-(small ? 4 : 18));
    const flags = read.filter((i) => c.nodes[i].tone === 'flag').reverse();
    const links = read.filter((i) => c.nodes[i].tone === 'hi').reverse();
    const order = [...new Set([...flags, ...links.slice(0, cap), ...recent.reverse()])];
    // keep clear of the crawler's shell, its name tag and the cluster's name
    const placed = [{ x: bx - 34 * k, y: by - 25 * k, w: 68 * k, h: 50 * k },
      { x: bx + 30 * k + 4, y: by + 21 * k, w: 150, h: 16 },
      { x: sx(c.cx + 20), y: sy(c.cy - c.R - 50) - 20, w: 210, h: 40 }];
    const fixed = placed.length;
    ctx.font = `600 10.5px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    for (const i of order) {
      if (placed.length - fixed >= cap) break;
      const w = c.s.words[i], n = c.nodes[i], x = sx(n.x), y = sy(n.y);
      if (x < -60 || x > VW + 60 || y < -30 || y > VH + 30) continue;
      const flag = n.tone === 'flag', lo = n.tone === 'lo';
      const { text: label, after } = tagOf(c.s, w);
      const text = flag ? label + ' · ' : label;
      const tw = ctx.measureText(text).width + (flag ? 8 + ctx.measureText(' ' + after).width : 0);
      const bw = tw + 12, bh = 17;
      const spots = [[x + 7, y - bh - 3], [x - bw - 7, y - bh - 3], [x + 7, y + 4], [x - bw - 7, y + 4]];
      if (flag) spots.push([x - bw / 2, y - 2 * bh - 8], [x - bw / 2, y + bh + 8], [x + 7, y - 2 * bh - 8], [x - bw - 7, y + bh + 8]);
      let at = null;
      for (const [px, py] of spots) {
        const r = { x: clamp(px, 4, Math.max(4, VW - bw - 4)), y: py, w: bw, h: bh };
        if (!placed.some((p) => overlaps(p, r))) { at = r; break; }
      }
      if (!at) {
        if (!flag) continue;
        at = { x: clamp(spots[0][0], 4, Math.max(4, VW - bw - 4)), y: spots[0][1], w: bw, h: bh };
      }
      placed.push(at);
      ctx.globalAlpha = RM ? 1 : clamp((S.t - n.at) / 0.2, 0, 1);
      if (flag) {
        ctx.fillStyle = rgba(PINK, 0.92);
        ctx.fillRect(at.x, at.y, at.w, at.h);
        ctx.fillStyle = '#2a0611';
        ctx.fillText(text, at.x + 6, at.y + 12.5);
        const fx = at.x + 6 + ctx.measureText(text).width + 1;
        ctx.fillRect(fx, at.y + 4, 1.2, 10);
        ctx.beginPath(); ctx.moveTo(fx + 1.2, at.y + 4); ctx.lineTo(fx + 7, at.y + 6.5); ctx.lineTo(fx + 1.2, at.y + 9); ctx.closePath(); ctx.fill();
        ctx.fillText(' ' + after, fx + 7, at.y + 12.5);
      } else {
        const col = lo ? GREY : c.light;
        ctx.fillStyle = 'rgba(8,9,11,.82)';
        ctx.fillRect(at.x, at.y, at.w, at.h);
        ctx.strokeStyle = rgba(col, lo ? 0.45 : 0.85);
        ctx.lineWidth = 1;
        ctx.strokeRect(at.x + 0.5, at.y + 0.5, at.w - 1, at.h - 1);
        ctx.fillStyle = rgba(col, lo ? 0.75 : 1);
        ctx.fillText(text, at.x + 6, at.y + 12.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  const UNIT = { trades: ['trade', 'trades'], open: ['position', 'positions'], patterns: ['pattern', 'patterns'] };
  function drawLabels(sx, sy, bx, by) {
    ctx.textBaseline = 'alphabetic';
    for (const c of world) {
      const mode = modeOf(c), active = mode === 1;
      const lx = sx(c.cx + 20), ly = sy(c.cy - c.R - 50);
      if (lx < -220 || lx > VW + 40 || ly < -40 || ly > VH + 40) continue;
      if (active && S.phase === 'read' && !RM) {     // a thread to the cluster label as reading starts
        const age = S.t - S.secStart;
        const a = clamp(age / 0.3, 0, 1) * clamp(1 - (age - 2.4) / 0.8, 0, 1);
        if (a > 0) {
          ctx.strokeStyle = rgba(WHITE, 0.55 * a);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(lx + 8, ly + 6); ctx.stroke();
        }
      }
      ctx.font = `${active ? 700 : 600} ${active ? 20 : 15}px ${FONT}`;
      ctx.fillStyle = active ? rgba(c.light, 1) : mode === 2 ? C.ink : '#9aa1a9';
      ctx.fillText(c.s.name, lx, ly);
      ctx.font = `400 10.5px ${FONT}`;
      ctx.fillStyle = C.dim;
      const n = c.s.words.length, unit = UNIT[c.s.kind][n === 1 ? 0 : 1];
      const status = !n ? 'none yet' : active ? 'reading' : mode === 2 ? 'done' : 'queued';
      ctx.fillText(`${S.readIn[c.i]}/${n} ${unit} · ${status}`, lx, ly + 15);
    }
    const key = S.sec < world.length ? world[S.sec].s.name : 'ship';
    ctx.font = `400 10px ${FONT}`;
    ctx.fillStyle = C.teal;
    ctx.fillText(`crawler · ${key}`, bx + 30 * sp.k + 8, by + 21 * sp.k + 12);
  }

  // ---------------------------------------------------------------- panels

  let CODE = '', CODE_SEGS = [], heatCells = [];

  function setCode() {
    CODE = [
      '# crawler.py · reads the paper book, flags what to check',
      'book = load("paper.book")',
      `spider = Crawler(legs=${LEGS}, tentacles=${TENTACLES})`,
      'for desk in book.desks:',
      '    spider.walk(desk)',
      '    for trade in desk.trades:',
      `        if trade.rugged or trade.pct <= ${D.meta.big_loss}:`,
      '            flags.append(check(trade))',
      '        elif trade.pnl > 0:',
      '            web.link(trade, "won")',
      'spider.walk(book.open)',
      'spider.walk(book.patterns)',
      'score = paper_score(web, flags)',
      'ship(flags, score)  # paper money only',
    ].join('\n');
    CODE_SEGS = [];
    CODE.split('\n').forEach((line, li) => {
      if (li) CODE_SEGS.push({ t: '\n', c: '' });
      const re = /(#.*$)|("[^"]*")|\b(for|in|if|elif|or)\b/g;
      let last = 0, m;
      while ((m = re.exec(line))) {
        if (m.index > last) CODE_SEGS.push({ t: line.slice(last, m.index), c: '' });
        CODE_SEGS.push({ t: m[0], c: m[1] ? 'c' : m[2] ? 's' : 'k' });
        last = m.index + m[0].length;
      }
      if (last < line.length) CODE_SEGS.push({ t: line.slice(last), c: '' });
    });
  }

  function progress() {
    if (S.phase === 'ship') return 1;
    const total = secs.reduce((a, s) => a + s.words.length, 0);
    const read = S.readIn.reduce((a, b) => a + b, 0);
    return 0.06 + 0.86 * (read / Math.max(1, total));
  }

  function typeCode(dt, rdt) {
    const target = Math.floor(progress() * CODE.length);
    const before = Math.floor(S.chars);
    if (target - S.chars > 200) S.chars = target - 20;
    if (S.chars < target) S.chars = Math.min(target, S.chars + (RM ? 1e4 : 30) * dt);
    const typed = Math.floor(S.chars) - before;
    if (rdt > 0) S.lps += ((typed / rdt) - S.lps) * (1 - Math.exp(-rdt * 3));
  }

  function renderCode() {
    let left = Math.floor(S.chars), html = '';
    for (const seg of CODE_SEGS) {
      if (left <= 0) break;
      const t = seg.t.slice(0, left);
      left -= t.length;
      html += seg.c ? `<span class="${seg.c}">${esc(t)}</span>` : esc(t);
    }
    const pre = $('code');
    pre.innerHTML = html + '<span class="cur"></span>';
    pre.scrollTop = pre.scrollHeight;
  }

  function buildPanels() {
    const tabs = secs.concat([SHIP]);
    $('tabs').innerHTML = tabs.map((s, i) => {
      const miss = s.words && !s.words.length ? ' class="miss"' : '';
      return `<button type="button" data-i="${i}" style="--c:${s.color}"${miss}>${esc(s.name)}</button>`;
    }).join('');
    $('secs').innerHTML = secs.map((s) =>
      `<li style="--c:${s.color}"><span>${esc(s.name)}</span><span class="ct">0/${s.words.length}</span><b><i></i></b></li>`).join('');
    $('heat').innerHTML = secs.map((s) =>
      `<div style="--c:${s.color}"><span>${s.abbr}</span>${'<i></i>'.repeat(12)}</div>`).join('');
    heatCells = Array.from($('heat').children).map((row) => Array.from(row.querySelectorAll('i')));
  }

  function setSection(i) {
    const s = i < world.length ? world[i].s : SHIP;
    const h = $('heading');
    h.style.setProperty('--c', s.color);
    h.style.setProperty('--c-sub', s.color);
    $('h-num').textContent = String(i + 1).padStart(2, '0');
    $('h-name').textContent = s.name;
    $('h-sub').textContent = s.sub;
    Array.from($('tabs').children).forEach((b, k) => {
      b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  // One heat cell = a twelfth of a cluster: the desk's colour if it made money, pink if a flag sank it.
  function cellClass(s, a, b) {
    let flag = false, sum = 0, any = false;
    for (let j = a; j < b; j++) {
      const w = s.words[j];
      if (w.flag) flag = true;
      if (s.kind === 'trades') sum += w.pnl;
      else if (s.kind === 'open') { if (w.value != null) { sum += w.value - w.cost; any = true; } }
      else sum += w.unlocked ? 1 : -1;
    }
    if (flag && sum <= 0) return 'flag';
    if (s.kind === 'open' && !any) return 'on';
    return sum > 0 ? 'on' : 'neg';
  }

  function ui() {
    const sc = score();
    $('st-read').textContent = S.read.toLocaleString('en-US');
    $('st-links').textContent = S.wins.toLocaleString('en-US');
    $('st-flags').textContent = S.flags;
    const stp = $('st-pnl');
    stp.textContent = usd0(S.pnl);
    stp.className = S.pnl > 0 ? 'up' : S.pnl < 0 ? 'down' : '';
    $('st-frame').textContent = String(S.frame % 10000).padStart(4, '0');
    S.stamps = S.stamps.filter((t) => S.t - t < 1);
    $('p-wps').textContent = S.stamps.length;
    const big = $('p-wpm');
    big.textContent = usd(S.pnl);
    big.className = 'big' + (S.pnl > 0 ? ' up' : S.pnl < 0 ? ' down' : '');
    $('p-lps').textContent = Math.round(S.lps);
    $('p-desks').textContent = `${Math.min(S.done.size, secs.length)}/${secs.length}`;

    const lis = $('secs').children;
    secs.forEach((s, i) => {
      const li = lis[i], n = s.words.length, r = S.readIn[i];
      li.classList.toggle('on', i === S.sec);
      li.children[1].textContent = `${r}/${n}`;
      li.children[2].firstChild.style.width = (n ? (r / n) * 100 : 0) + '%';
      const cells = heatCells[i], per = n / 12;
      for (let k = 0; k < 12; k++) {
        const a = Math.floor(k * per), b = Math.floor((k + 1) * per);
        let cls = '';
        if (b <= a) cls = 'none';
        else if (r >= b) cls = cellClass(s, a, b);
        if (cells[k].className !== cls) cells[k].className = cls;
      }
    });

    const counts = { claim: S.wins, owner: S.losses, approval: S.open };
    const most = Math.max(1, counts.claim, counts.owner, counts.approval);
    for (const kind of ['claim', 'owner', 'approval']) {
      $('n-' + kind).textContent = counts[kind].toLocaleString('en-US');
      $('k-' + kind).style.width = Math.round((counts[kind] / most) * 60) + 'px';
    }
    $('c-read').textContent = S.read.toLocaleString('en-US');
    $('c-linked').textContent = S.wins.toLocaleString('en-US');
    $('c-flagged').textContent = S.flags;
    $('c-guessed').textContent = S.open;
    $('p-score').textContent = sc.total;
    $('p-ask').textContent = 'flags to check · ' + countFlags(false);
    drawRadar(sc.per);
    drawGauge(sc.total);

    if (S.logDirty) {
      const keep = VW < 700 ? 10 : 15;
      $('log').innerHTML = S.log.slice(-keep).map((e) =>
        `<li><span class="tm">${e.tm}</span><span class="v-${LOG_CLASS[e.verb] || 'read'}">${e.verb}</span><span>${esc(e.text)}</span></li>`).join('');
      S.logDirty = false;
    }
    if (Math.floor(S.chars) !== S.shown) { S.shown = Math.floor(S.chars); renderCode(); }
  }

  function fit(cv) {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    const W = Math.round(w * DPR), H = Math.round(h * DPR);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  function drawRadar(per) {
    const f = fit($('radar'));
    if (!f) return;
    const { g, w, h } = f, n = per.length, cx = w / 2, cy = h / 2 + 2, R = Math.min(w * 0.33, h * 0.38);
    const pt = (i, r) => [cx + Math.sin((i / n) * Math.PI * 2) * r, cy - Math.cos((i / n) * Math.PI * 2) * r];
    g.lineWidth = 1;
    g.strokeStyle = '#262b31';
    for (let ring = 1; ring <= 3; ring++) {
      g.beginPath();
      for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, (R * ring) / 3); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    g.beginPath();
    for (let i = 0; i < n; i++) { g.moveTo(cx, cy); const [x, y] = pt(i, R); g.lineTo(x, y); }
    g.stroke();
    g.font = `400 9px ${FONT}`;
    g.fillStyle = C.dim;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    AXES.forEach((label, i) => { const [x, y] = pt(i, R + 13); g.fillText(label, x, y); });
    g.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, R * Math.max(0.02, per[i % n])); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.fillStyle = 'rgba(65,217,195,.24)';
    g.fill();
    g.strokeStyle = C.teal;
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawGauge(sc) {
    const f = fit($('gauge'));
    if (!f) return;
    const { g, w, h } = f, r = Math.min(w, h) * 0.4, a0 = Math.PI * 0.75;
    g.lineWidth = 9;
    g.strokeStyle = '#1b1f24';
    g.beginPath(); g.arc(w / 2, h / 2, r, a0, a0 + Math.PI * 1.5); g.stroke();
    if (sc > 0) {
      g.strokeStyle = C.pink;
      g.beginPath(); g.arc(w / 2, h / 2, r, a0, a0 + Math.PI * 1.5 * (sc / 100)); g.stroke();
    }
  }

  // The paper P&L of every trade read so far, with the zero line dashed.
  function drawWave(now) {
    const f = fit($('wave'));
    if (!f) return;
    const { g, w, h } = f, pts = S.curve, N = pts.length;
    const stride = Math.max(1, Math.ceil(N / 160)), sample = [];
    for (let i = 0; i < N; i += stride) sample.push(pts[i]);
    if (sample[sample.length - 1] !== pts[N - 1]) sample.push(pts[N - 1]);
    let lo = 0, hi = 0;
    for (const v of sample) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const span = hi - lo || 1, M = sample.length;
    const X = (k) => (M < 2 ? w : (k / (M - 1)) * (w - 8));
    const Y = (v) => h - 5 - ((v - lo) / span) * (h - 10);
    g.setLineDash([3, 4]);
    g.strokeStyle = '#2d3239';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    g.setLineDash([]);
    g.beginPath();
    sample.forEach((v, k) => { if (k) g.lineTo(X(k), Y(v)); else g.moveTo(X(k), Y(v)); });
    g.strokeStyle = C.wave;
    g.lineWidth = 1.6;
    g.stroke();
    const end = sample[M - 1], ex = X(M - 1), ey = Y(end);
    const glow = RM ? 1 : 0.6 + 0.4 * Math.sin(now * 0.006);
    g.shadowColor = end < 0 ? C.pink : C.gold;
    g.shadowBlur = 8 * glow;
    g.fillStyle = end < 0 ? C.pink : C.gold;
    g.beginPath(); g.arc(ex, ey, 2.6, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }

  // ---------------------------------------------------------------- results

  const NAME = { memecoins: 'memecoins', majors: 'big coins', stocks: 'stocks' };
  function colorOf(key) { const s = secs.find((x) => x.key === key); return s ? s.color : C.pink; }

  function showShip() {
    S.shipShown = true;
    S.shipOpen = true;
    const sc = score().total, nf = countFlags(true);
    $('ship-sum').innerHTML = `Paper score <b>${sc}</b> of 100 · <b>${D.meta.trades.toLocaleString('en-US')}</b> trades · ` +
      `<b>${esc(usd(S.pnl))}</b> paper P&amp;L · <b>${nf}</b> flag${nf === 1 ? '' : 's'}` +
      (D.meta.demo ? ' · <b>demo prices</b>' : '') + ` · updated ${esc(D.meta.updated_local)}`;
    $('asks').innerHTML = asks.length ? asks.map((q) => {
      const chip = q.level === 'up' ? 'chip up' : q.level === 'note' ? 'chip note' : 'chip';
      const where = `<span class="where" style="--c:${colorOf(q.desk)}">${esc(NAME[q.desk] || q.desk)}</span>`;
      return `<li><div class="tag"><span class="${chip}">${esc(q.chip)}</span>${where}</div><p>${esc(q.text)}</p></li>`;
    }).join('') : '<li><p>Nothing to flag yet. Every desk is inside its limits.</p></li>';
    $('ship').hidden = false;
    announce(`Done. Paper score ${sc}. ${nf} flags to check.`);
    if (pending) later();
  }

  function asksText() {
    const lines = [`Flags to check · paper book · paper score ${score().total} · ${D.meta.updated_local}` +
      (D.meta.demo ? ' · demo prices' : '')];
    asks.forEach((q, i) => {
      lines.push(`${String(i + 1).padStart(2, '0')} [${NAME[q.desk] || q.desk}] ${q.chip}: ${q.text}`);
    });
    lines.push('Paper money only.');
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- controls

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) seek(Number(b.dataset.i));
  });
  $('pause').addEventListener('click', () => {
    S.paused = !S.paused;
    $('pause').textContent = S.paused ? 'play' : 'pause';
    $('pause').setAttribute('aria-pressed', String(S.paused));
  });
  $('speed').addEventListener('click', () => {
    S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1;
    $('speed').textContent = S.speed + 'x';
    $('speed').setAttribute('aria-label', `Crawl speed ${S.speed}x`);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && (e.target === document.body || e.target === document.documentElement)) {
      e.preventDefault();
      $('pause').click();
    }
  });
  $('ship-close').addEventListener('click', () => { $('ship').hidden = true; S.shipOpen = false; });
  $('again').addEventListener('click', () => { if (pending) applyPending(); else seek(0); });
  $('copy-asks').addEventListener('click', () => {
    const btn = $('copy-asks'), text = asksText();
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy flags'; }, 1600); };
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents($('asks'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Selected: press copy';
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
  });

  // Served by paperbook.py: look for new trades every two minutes.
  let pending = null, served = false;
  async function refresh() {
    try {
      const r = await fetch('crawler.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (!served) {
        served = true;
        for (const [href, label] of [['galaxy', 'Galaxy'], ['book', 'Paper book']]) {
          const a = document.createElement('a');
          a.className = 'btn';
          a.href = href;
          a.textContent = label;
          $('again').after(a);
        }
      }
      if (d.meta && d.meta.updated !== D.meta.updated) {
        pending = d;
        $('again').textContent = 'Crawl new trades';
        if (S.shipShown) later();
      }
    } catch (err) {
      if (!served) clearInterval(timer);       // not served next to crawler.json: nothing to refresh
    }
  }
  // New numbers wait for the results to be read: a minute after the crawl ships, or "Crawl new trades".
  let wait = null;
  function later() { if (!wait) wait = setTimeout(applyPending, 60000); }
  function applyPending() {
    clearTimeout(wait);
    wait = null;
    if (!pending) return;
    const d = pending;
    pending = null;
    $('again').textContent = 'Crawl again';
    load(d);
    announce('New trades came in. Crawling again.');
  }

  // ---------------------------------------------------------------- run

  let last = 0, lastUi = 0;
  function loop(now) {
    const rdt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const dt = S.paused ? 0 : rdt * S.speed;
    S.t += dt;
    tick(dt);
    updateSpider(rdt);
    updateCam(rdt);
    typeCode(dt, rdt);
    draw(now);
    drawWave(now);
    if (now - lastUi > 80) { ui(); lastUi = now; }
    S.frame++;
    requestAnimationFrame(loop);
  }

  if (window.ResizeObserver) new ResizeObserver(resize).observe($('stage'));
  else window.addEventListener('resize', resize);
  resize();
  load(D);
  const timer = /^https?:$/.test(location.protocol) ? setInterval(refresh, 120000) : null;
  if (timer) refresh();
  requestAnimationFrame(loop);
})();
