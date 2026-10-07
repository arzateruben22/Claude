/* Prompt Crawler: the spider, the web of words and the six readout panels.
   What gets read, linked and flagged comes from analyze.js; only the shape of the dust is random. */
(function () {
  'use strict';
  const PA = window.PromptAnalyzer;
  if (!PA) return;

  const $ = (id) => document.getElementById(id);
  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const C = {
    bg: token('--bg', '#08090b'), ink: token('--ink', '#e9edf1'), dim: token('--dim', '#7c838b'),
    teal: token('--teal', '#41d9c3'), pink: token('--pink', '#ff4f7b'), wave: token('--wave', '#d9a65a'),
  };
  const FONT = token('--mono', 'ui-monospace, monospace');

  const LEGS = 16, TENTACLES = 22, HOLD = 14;
  // Where each section's cluster sits in the web, in crawl order.
  const CENTERS = [[0, 0], [-430, -560], [-1150, -190], [-990, 640], [-140, 880], [780, 650], [930, -250]];
  const SHIP = { key: 'ship', color: C.pink, sub: 'flags to ask before anyone builds' };
  const GREY = [205, 212, 220], WHITE = [240, 244, 248], CREAM = [246, 231, 166];
  const CYAN = [80, 226, 214], SKY = [79, 205, 240], PINK = rgbOf(C.pink);
  const ALPHA = [0.16, 0.3, 0.52];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
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

  // ---------------------------------------------------------------- the web

  let doc = null, world = [], asks = [], promptName = 'studio.prompt', promptText = '';
  const S = { frame: 0, paused: false, speed: 1, base: 0.1 };
  const sp = { x: 0, y: 0, vx: 0, vy: 0, tilt: 0, phase: 0, pulse: 0, k: 1 };
  const cam = { x: 0, y: 0, z: 0.8 };
  let tents = [], trails = [];

  function buildWorld(d) {
    const small = window.innerWidth < 700;
    return d.sections.map((s, i) => {
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

  // Words sit along a wandering path, so the spider walks the prompt in reading order.
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
      nodes.push({ x, y, read: false, at: -9, flag: words[k].kind === 'vague' });
    }
    return { nodes, R };
  }

  // ---------------------------------------------------------------- the crawl

  function load(text, name) {
    doc = PA.analyze(text);
    asks = PA.questions(doc);
    promptText = text;
    promptName = name;
    world = buildWorld(doc);
    S.base = clamp(26 / Math.max(1, doc.total), 0.02, 0.11);
    setCode();
    buildPanels();
    $('open-load').textContent = name;
    $('st-total').textContent = doc.total;
    $('p-total').textContent = doc.total;
    reset();
  }

  function reset() {
    Object.assign(S, {
      phase: 'read', sec: 0, cursor: 0, wait: 0.8, t: 0, read: 0, links: 0, flags: 0, guessed: 0,
      kinds: { claim: 0, owner: 0, approval: 0, spec: 0 }, readIn: world.map(() => 0), askSet: new Set(),
      log: [], logDirty: true, stamps: [], rate: 0, wave: [], waveAt: 0, chars: 0, shown: -1, lps: 0,
      walk: null, secStart: 0, shipAt: 0, shipShown: false, shipOpen: false, missingDone: false,
    });
    for (const c of world) for (const n of c.nodes) { n.read = false; n.at = -9; }
    tents = [];
    trails = [];
    $('ship').hidden = true;
    const c0 = world[0], p0 = c0.nodes[0] || { x: c0.cx, y: c0.cy };
    sp.x = p0.x - 70; sp.y = p0.y + 40; sp.vx = sp.vy = 0;
    log('walk', '→ ' + c0.s.key);
    arrive(0, true);
    S.wait = 0.8;
    snapCam();
  }

  function arrive(i, quiet) {
    Object.assign(S, { phase: 'read', sec: i, cursor: 0, wait: 0.3, secStart: S.t, walk: null, missingDone: false });
    setSection(i);
    if (!quiet) announce(`Reading ${world[i].s.key}, ${world[i].s.words.length} words.`);
  }

  function tick(dt) {
    if (S.phase === 'read') {
      const c = world[S.sec];
      S.wait -= dt;
      if (!c.s.words.length) {
        if (!S.missingDone) { S.missingDone = true; flagMissing(S.sec); S.wait = 1.1; sp.pulse = 1; }
        if (S.wait <= 0) finishSection();
        return;
      }
      while (S.wait <= 0 && S.phase === 'read') {
        if (S.cursor >= c.s.words.length) { finishSection(); break; }
        const w = c.s.words[S.cursor];
        readWord(S.sec, S.cursor, false);
        S.cursor++;
        S.wait += delayFor(w);
      }
    } else if (S.phase === 'walk') {
      S.walk.t = Math.min(1, S.walk.t + dt / S.walk.dur);
      if (S.walk.t >= 1) { S.walk.endAt = S.t; arrive(S.walk.to); }
    } else if (S.phase === 'ship' && !S.shipShown && S.t >= S.shipAt) {
      showShip();
    }
  }

  function delayFor(w) {
    let d = S.base * (0.75 + Math.random() * 0.5);
    if (w.kind === 'vague') d += 0.55;
    else if (w.kind) d += 0.16;
    if (w.end) d += 0.12;
    return d;
  }

  function readWord(si, wi, quiet) {
    const c = world[si], w = c.s.words[wi], n = c.nodes[wi];
    n.read = true;
    n.at = S.t;
    S.read++;
    S.readIn[si]++;
    if (w.guessed) S.guessed++;
    let verb = 'read';
    if (w.kind === 'vague') {
      verb = 'flag'; S.flags++; S.askSet.add(w.lower);
      if (!quiet) sp.pulse = 1;
    } else if (w.kind) {
      verb = 'link'; S.links++; S.kinds[w.kind]++;
    }
    log(verb, w.text);
    if (quiet) return;
    S.stamps.push(S.t);
    tents.push({ si, wi, born: S.t, dead: null });
    const live = tents.filter((t) => t.dead === null);
    if (live.length > HOLD) live[0].dead = S.t;
  }

  function flagMissing(si) {
    S.flags++;
    S.askSet.add('#' + world[si].s.key);
    log('skip', world[si].s.key + ' missing');
  }

  function finishSection() {
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
    log('walk', '→ ' + c.s.key);
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
    log('ship', asks.length + ' flags to ask');
  }

  // Jump straight to a section: everything before it is read at once.
  function seek(target) {
    reset();
    for (let i = 0; i < Math.min(target, world.length); i++) {
      const c = world[i];
      if (!c.s.words.length) flagMissing(i);
      c.s.words.forEach((w, wi) => readWord(i, wi, true));
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

  function log(verb, text) {
    const d = new Date();
    S.log.push({ tm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), verb, text });
    if (S.log.length > 40) S.log.shift();
    S.logDirty = true;
  }

  function announce(msg) { $('announce').textContent = msg; }

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
      g.addColorStop(0, rgba(act.rgb, act.i === 0 ? 0.025 : 0.08));
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
    if (act && S.phase !== 'ship') drawTags(act, sx, sy);
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

  function drawNodes(c, mode, sx, sy) {
    for (const n of c.nodes) {
      const x = sx(n.x), y = sy(n.y);
      if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) continue;
      if (n.read) {
        const age = S.t - n.at;
        if (mode === 1 && age < 1.2 && !RM) {
          ctx.strokeStyle = rgba(n.flag ? PINK : c.light, (1 - age / 1.2) * 0.6);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 3 + age * 10, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(n.flag ? PINK : mode === 1 ? c.light : WHITE, 0.95);
        ctx.beginPath(); ctx.arc(x, y, mode === 1 ? 2.3 : 1.9, 0, Math.PI * 2); ctx.fill();
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
    if (S.phase === 'read') {                // two reach ahead for the next words
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

  // Word tags for the section being read: every flag and link, plus the latest reads.
  function drawTags(c, sx, sy) {
    const small = VW < 700, cap = small ? 7 : 24;
    const read = [];
    for (let i = 0; i < c.nodes.length; i++) if (c.nodes[i].read) read.push(i);
    const recent = read.slice(-(small ? 4 : 18));
    const flags = read.filter((i) => c.s.words[i].kind === 'vague').reverse();
    const links = read.filter((i) => c.s.words[i].kind && c.s.words[i].kind !== 'vague').reverse();
    const order = [...new Set([...flags, ...links, ...recent.reverse()])];
    const placed = [];
    ctx.font = `600 10.5px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    for (const i of order) {
      if (placed.length >= cap) break;
      const w = c.s.words[i], n = c.nodes[i], x = sx(n.x), y = sy(n.y);
      if (x < -60 || x > VW + 60 || y < -30 || y > VH + 30) continue;
      const vague = w.kind === 'vague';
      const text = vague ? w.text + ' · ' : w.kind ? `${w.text} · ${w.kind}` : w.text;
      const tw = ctx.measureText(text).width + (vague ? 8 + ctx.measureText(' vague').width : 0);
      const bw = tw + 12, bh = 17;
      const spots = [[x + 7, y - bh - 3], [x - bw - 7, y - bh - 3], [x + 7, y + 4], [x - bw - 7, y + 4]];
      let at = null;
      for (const [px, py] of spots) {
        const r = { x: px, y: py, w: bw, h: bh };
        if (!placed.some((p) => overlaps(p, r))) { at = r; break; }
      }
      if (!at) {
        if (!vague) continue;
        at = { x: spots[0][0], y: spots[0][1], w: bw, h: bh };
      }
      placed.push(at);
      ctx.globalAlpha = RM ? 1 : clamp((S.t - n.at) / 0.2, 0, 1);
      if (vague) {
        ctx.fillStyle = rgba(PINK, 0.92);
        ctx.fillRect(at.x, at.y, at.w, at.h);
        ctx.fillStyle = '#2a0611';
        ctx.fillText(text, at.x + 6, at.y + 12.5);
        const fx = at.x + 6 + ctx.measureText(text).width + 1;
        ctx.fillRect(fx, at.y + 4, 1.2, 10);
        ctx.beginPath(); ctx.moveTo(fx + 1.2, at.y + 4); ctx.lineTo(fx + 7, at.y + 6.5); ctx.lineTo(fx + 1.2, at.y + 9); ctx.closePath(); ctx.fill();
        ctx.fillText(' vague', fx + 7, at.y + 12.5);
      } else {
        ctx.fillStyle = 'rgba(8,9,11,.82)';
        ctx.fillRect(at.x, at.y, at.w, at.h);
        ctx.strokeStyle = rgba(c.light, 0.85);
        ctx.lineWidth = 1;
        ctx.strokeRect(at.x + 0.5, at.y + 0.5, at.w - 1, at.h - 1);
        ctx.fillStyle = rgba(c.light, 1);
        ctx.fillText(text, at.x + 6, at.y + 12.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawLabels(sx, sy, bx, by) {
    ctx.textBaseline = 'alphabetic';
    for (const c of world) {
      const mode = modeOf(c), active = mode === 1;
      const lx = sx(c.cx + 20), ly = sy(c.cy - c.R - 50);
      if (lx < -220 || lx > VW + 40 || ly < -40 || ly > VH + 40) continue;
      if (active && S.phase === 'read' && !RM) {     // a thread to the section label as reading starts
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
      ctx.fillText(c.s.key, lx, ly);
      ctx.font = `400 10.5px ${FONT}`;
      ctx.fillStyle = C.dim;
      const status = !c.s.words.length ? 'missing' : active ? 'reading' : mode === 2 ? 'done' : 'queued';
      ctx.fillText(`${S.readIn[c.i]}/${c.s.words.length} words · ${status}`, lx, ly + 15);
    }
    const key = S.sec < world.length ? world[S.sec].s.key : 'ship';
    ctx.font = `400 10px ${FONT}`;
    ctx.fillStyle = C.teal;
    ctx.fillText(`crawler · ${key}`, bx + 30 * sp.k + 8, by + 21 * sp.k + 12);
  }

  // ---------------------------------------------------------------- panels

  let CODE = '', CODE_SEGS = [], heatCells = [];

  function setCode() {
    CODE = [
      '# crawler.py · reads a prompt, flags what is vague',
      `graph = load("${promptName}")`,
      `spider = Crawler(legs=${LEGS}, tentacles=${TENTACLES})`,
      'for section in graph.sections:',
      '    spider.walk(section)',
      '    for word in section.words:',
      '        kind = spider.read(word)',
      '        if kind == "vague":',
      '            flags.append(ask(word))',
      '        elif kind:',
      '            graph.link(word, kind)',
      'score = spec_score(graph, flags)',
      "ship(flags, score)  # ask, don't guess",
    ].join('\n');
    CODE_SEGS = [];
    CODE.split('\n').forEach((line, li) => {
      if (li) CODE_SEGS.push({ t: '\n', c: '' });
      const re = /(#.*$)|("[^"]*")|\b(for|in|if|elif)\b/g;
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
    if (!doc) return 0;
    if (S.phase === 'ship') return 1;
    return 0.06 + 0.86 * (S.read / Math.max(1, doc.total));
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
    const tabs = doc.sections.concat([SHIP]);
    $('tabs').innerHTML = tabs.map((s, i) => {
      const miss = s.words && !s.words.length ? ' class="miss"' : '';
      return `<button type="button" data-i="${i}" style="--c:${s.color}"${miss}>${s.key}</button>`;
    }).join('');
    $('secs').innerHTML = doc.sections.map((s) =>
      `<li style="--c:${s.color}"><span>${s.key}</span><span class="ct">0/${s.words.length}</span><b><i></i></b></li>`).join('');
    $('heat').innerHTML = doc.sections.map((s) =>
      `<div style="--c:${s.color}"><span>${s.abbr}</span>${'<i></i>'.repeat(12)}</div>`).join('');
    heatCells = Array.from($('heat').children).map((row) => Array.from(row.querySelectorAll('i')));
  }

  function setSection(i) {
    const s = i < world.length ? world[i].s : SHIP;
    const h = $('heading');
    h.style.setProperty('--c', s.color);
    if (i === 0) h.style.removeProperty('--c-sub'); else h.style.setProperty('--c-sub', s.color);
    $('h-num').textContent = String(i + 1).padStart(2, '0');
    $('h-name').textContent = s.key;
    $('h-sub').textContent = s.sub;
    Array.from($('tabs').children).forEach((b, k) => {
      b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  function ui() {
    $('st-read').textContent = S.read;
    $('st-links').textContent = S.links;
    $('st-flags').textContent = S.flags;
    $('st-t').textContent = S.t.toFixed(2);
    $('st-frame').textContent = String(S.frame % 10000).padStart(4, '0');
    S.stamps = S.stamps.filter((t) => S.t - t < 1);
    $('p-wps').textContent = S.stamps.length;
    $('p-wpm').textContent = Math.round(S.rate * 60) + '/m';
    $('p-lps').textContent = Math.round(S.lps);

    const secs = $('secs').children;
    doc.sections.forEach((s, i) => {
      const li = secs[i], n = s.words.length, r = S.readIn[i];
      li.classList.toggle('on', i === S.sec);
      li.children[1].textContent = `${r}/${n}`;
      li.children[2].firstChild.style.width = (n ? (r / n) * 100 : 0) + '%';
      const cells = heatCells[i], per = n / 12;
      for (let k = 0; k < 12; k++) {
        const a = Math.floor(k * per), b = Math.floor((k + 1) * per);
        let cls = '';
        if (b <= a) cls = 'none';
        else if (r >= b) {
          cls = 'on';
          for (let j = a; j < b; j++) if (s.words[j].kind === 'vague') { cls = 'flag'; break; }
        }
        if (cells[k].className !== cls) cells[k].className = cls;
      }
    });

    for (const kind of ['claim', 'owner', 'approval']) {
      $('n-' + kind).textContent = S.kinds[kind];
      $('k-' + kind).style.width = Math.min(60, S.kinds[kind] * 7) + 'px';
    }
    $('c-read').textContent = S.read;
    $('c-linked').textContent = S.links;
    $('c-flagged').textContent = S.flags;
    $('c-guessed').textContent = S.guessed;
    const sc = PA.score(doc, S.readIn);
    $('p-score').textContent = sc.total;
    $('p-ask').textContent = 'flags to ask · ' + S.askSet.size;
    drawRadar(sc.per);
    drawGauge(sc.total);

    if (S.logDirty) {
      const keep = VW < 700 ? 10 : 15;
      $('log').innerHTML = S.log.slice(-keep).map((e) =>
        `<li><span class="tm">${e.tm}</span><span class="v-${e.verb}">${e.verb}</span><span>${esc(e.text)}</span></li>`).join('');
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
    doc.sections.forEach((s, i) => { const [x, y] = pt(i, R + 12); g.fillText(s.axis, x, y); });
    g.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, R * Math.max(0.02, per[i % n])); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.fillStyle = 'rgba(65,217,195,.24)';
    g.fill();
    g.strokeStyle = C.teal;
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawGauge(score) {
    const f = fit($('gauge'));
    if (!f) return;
    const { g, w, h } = f, r = Math.min(w, h) * 0.4, a0 = Math.PI * 0.75;
    g.lineWidth = 9;
    g.strokeStyle = '#1b1f24';
    g.beginPath(); g.arc(w / 2, h / 2, r, a0, a0 + Math.PI * 1.5); g.stroke();
    if (score > 0) {
      g.strokeStyle = C.pink;
      g.beginPath(); g.arc(w / 2, h / 2, r, a0, a0 + Math.PI * 1.5 * (score / 100)); g.stroke();
    }
  }

  function drawWave(now) {
    const f = fit($('wave'));
    if (!f) return;
    const { g, w, h } = f, N = 60, pts = S.wave;
    const max = Math.max(4, ...pts);
    g.beginPath();
    let px = 0, py = 0;
    for (let k = 0; k < N; k++) {
      const v = pts[pts.length - N + k] || 0;
      const x = (k / (N - 1)) * w;
      const y = h * 0.6 - (v / max) * h * 0.34 + (RM ? 0 : Math.sin(now * 0.002 + k * 0.32) * h * 0.13);
      if (!k) g.moveTo(x, y); else g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x; py = y;
    }
    g.lineTo(px, py);
    g.strokeStyle = C.wave;
    g.lineWidth = 1.6;
    g.stroke();
  }

  // ---------------------------------------------------------------- results

  function colorOf(key) { const s = doc.sections.find((x) => x.key === key); return s ? s.color : C.pink; }

  function showShip() {
    S.shipShown = true;
    S.shipOpen = true;
    const sc = PA.score(doc).total;
    const missing = doc.sections.filter((s) => !s.words.length).length;
    $('ship-sum').innerHTML = `Spec score <b>${sc}</b> of 100 · <b>${S.flags}</b> flags in <b>${doc.total}</b> words` +
      (missing ? ` · <b>${missing}</b> sections missing` : '') +
      (doc.guessed ? ` · <b>${doc.guessed}</b> sentences sorted by guess` : '') +
      (doc.truncated ? ` · read the first ${PA.MAX_WORDS} words` : '');
    $('asks').innerHTML = asks.length ? asks.map((q) => {
      const where = q.sections.map((k) => `<span class="where" style="--c:${colorOf(k)}">${k}</span>`).join(' ');
      const chip = q.missing ? 'missing' : esc(q.word) + (q.count > 1 ? ` ×${q.count}` : '');
      const ctx2 = q.missing ? '' :
        `<p class="ctx">${esc(q.context.before)} <mark>${esc(q.context.word)}</mark> ${esc(q.context.after)}</p>`;
      return `<li><div class="tag"><span class="chip">${chip}</span>${where}</div><p>${esc(q.ask)}</p>${ctx2}</li>`;
    }).join('') : '<li><p>Nothing vague found, and every section is there.</p></li>';
    $('ship').hidden = false;
    announce(`Done. Spec score ${sc}. ${asks.length} flags to ask.`);
  }

  function asksText() {
    const lines = [`Flags to ask · ${promptName} · spec score ${PA.score(doc).total}`];
    asks.forEach((q, i) => {
      lines.push(`${String(i + 1).padStart(2, '0')} [${q.sections.join(', ')}] ${q.ask}`);
      if (!q.missing) lines.push(`   ${q.context.before} ${q.context.word} ${q.context.after}`.trimEnd());
    });
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
  $('again').addEventListener('click', () => seek(0));
  $('copy-asks').addEventListener('click', () => {
    const btn = $('copy-asks'), text = asksText();
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy questions'; }, 1600); };
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

  const dialog = $('load'), input = $('prompt-input');
  let fileName = null;
  const DRAFT = 'prompt-crawler.draft';
  function openLoad() {
    let draft = null;
    try { draft = localStorage.getItem(DRAFT); } catch (err) { draft = null; }
    input.value = draft || promptText;
    $('load-err').textContent = '';
    $('file-name').textContent = '';
    fileName = null;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    input.focus();
  }
  function closeLoad() { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
  $('open-load').addEventListener('click', openLoad);
  $('load-2').addEventListener('click', openLoad);
  $('load-cancel').addEventListener('click', closeLoad);
  input.addEventListener('input', () => {
    fileName = null;
    $('file-name').textContent = '';
    try { localStorage.setItem(DRAFT, input.value); } catch (err) { /* drafts are a convenience */ }
  });
  $('prompt-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 400000) { $('load-err').textContent = 'That file is over 400 KB. Paste the prompt part instead.'; return; }
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result);
      fileName = file.name;
      $('file-name').textContent = file.name;
      $('load-err').textContent = '';
    };
    reader.onerror = () => { $('load-err').textContent = 'That file could not be read. Try pasting it instead.'; };
    reader.readAsText(file);
  });
  $('load-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    if (PA.tokenize(text).length < 6) {
      $('load-err').textContent = 'Paste at least a sentence or two for the crawler to read.';
      return;
    }
    closeLoad();
    load(text, fileName || 'your.prompt');
  });
  $('load-demo').addEventListener('click', () => {
    try { localStorage.removeItem(DRAFT); } catch (err) { /* nothing saved */ }
    closeLoad();
    load(defaultText, 'studio.prompt');
  });

  // ---------------------------------------------------------------- run

  let last = 0, lastUi = 0, lastWave = 0;
  function loop(now) {
    const rdt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const dt = S.paused ? 0 : rdt * S.speed;
    S.t += dt;
    tick(dt);
    const inst = S.stamps.filter((t) => S.t - t < 1).length;
    S.rate += (inst - S.rate) * (1 - Math.exp(-rdt * 1.5));
    if (now - lastWave > 200) { S.wave.push(S.rate); if (S.wave.length > 80) S.wave.shift(); lastWave = now; }
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
  const defaultText = $('studio-prompt').textContent;
  load(defaultText, 'studio.prompt');
  requestAnimationFrame(loop);
})();
