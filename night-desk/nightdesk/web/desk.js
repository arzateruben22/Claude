/* Night Desk dashboard. Polls /api/state (or plays a recorded replay) and draws it the way the
   prompt crawler does: the crew as tabs, the crawler's web as glowing clusters of coins with a
   camera that follows the spider, and six readouts underneath. */
(function () {
  "use strict";

  var AGENTS = ["crawler", "vet", "scan", "social", "judge", "size", "fills", "risk"];   // CHIEF runs the status line
  var AGENT_COLOR = { crawler: "cyan", vet: "down", scan: "blue", social: "pink", judge: "violet", size: "gold",
                      fills: "ink", risk: "up", chief: "ink-soft" };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var FONT = "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(x) {
    if (x == null) return "—";
    var a = Math.abs(x), s = x < 0 ? "-" : "";
    if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return s + "$" + (a / 1e3).toFixed(1) + "K";
    return s + "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function shortMoney(x) {
    return x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? Math.round(x / 1e3) + "K" : Math.round(x) + "";
  }
  function pct(x) { return x == null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(1) + "%"; }
  function cls(x) { return x == null ? "" : x > 0 ? "up" : x < 0 ? "down" : ""; }
  function hhmm(iso) {
    return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit" });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  var colors = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["cyan", "pink", "violet", "blue", "up", "down", "gold", "ink", "ink-soft", "ink-dim", "line", "panel", "night", "warn"]
      .forEach(function (k) { colors[k] = cs.getPropertyValue("--" + k).trim() || "#888"; });
  }
  function rgba(hex, a) {
    var n = parseInt(hex.replace("#", ""), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + clamp(a, 0, 1).toFixed(3) + ")";
  }

  /* ---------- the crew: tabs + the heading in the scene's corner ---------- */
  var pinned = null, lastAt = {}, busyUntil = {};
  function buildTabs() {
    $("tabs").innerHTML = AGENTS.map(function (k) {
      return '<button type="button" data-agent="' + k + '" aria-pressed="false" style="--c: var(--' + AGENT_COLOR[k] + ')">' +
        k + '<span class="n"></span></button>';
    }).join("");
    $("tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      pinned = pinned === b.dataset.agent ? null : b.dataset.agent;
      Array.prototype.forEach.call($("tabs").children, function (x) { x.setAttribute("aria-pressed", String(x.dataset.agent === pinned)); });
      if (last) renderCrew(last);
    });
  }
  function renderCrew(s) {
    var now = Date.now();
    var latest = (s.feed || []).filter(function (f) { return f.agent !== "chief"; })[0];
    var active = pinned || (latest ? latest.agent : "crawler");
    Array.prototype.forEach.call($("tabs").children, function (b) {
      var k = b.dataset.agent, a = s.agents[k] || {};
      if (a.at && a.at !== lastAt[k]) { lastAt[k] = a.at; busyUntil[k] = now + 1600; }
      b.classList.toggle("busy", (busyUntil[k] || 0) > now);
      b.querySelector(".n").textContent = a.count ? a.count.toLocaleString("en-US") : "";
      if (k === active) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
    var a = s.agents[active] || {};
    $("heading").style.setProperty("--c", "var(--" + AGENT_COLOR[active] + ")");
    $("h-num").textContent = String(AGENTS.indexOf(active) + 1).padStart(2, "0");
    $("h-name").textContent = active;
    $("h-role").textContent = a.role || "";
    $("h-status").textContent = a.status || "standing by";
  }

  /* ---------- status line ---------- */
  function renderStatus(s) {
    var c = s.counts, b = s.bank, now = new Date(s.now);
    $("st-mode").textContent = s.replay ? "replay" : s.mode;
    $("st-seen").textContent = c.seen.toLocaleString("en-US");
    $("st-killed").textContent = c.killed.toLocaleString("en-US");
    $("st-judged").textContent = c.judged.toLocaleString("en-US");
    $("st-open").textContent = b.open;
    $("st-bank").textContent = money(b.equity);
    $("st-day").textContent = b.halted ? "halted" : pct(b.day_pnl_pct);
    $("st-day").className = b.halted ? "warn" : cls(b.day_pnl_pct);
    $("st-night").textContent = Math.floor((now - new Date(s.started)) / 864e5) + 1;
    $("clock").textContent = now.toISOString().slice(11, 16) + " UTC";
    $("notes").textContent = (s.notes || []).slice(-2).join(" · ");
  }

  /* ---------- readouts ---------- */
  function renderLog(s) {
    var feed = s.feed || [], now = new Date(s.now).getTime();
    $("p-epm").textContent = feed.filter(function (f) { return now - new Date(f.t).getTime() <= 60000; }).length;
    var rows = feed.slice(0, 16).reverse();
    $("log").innerHTML = rows.map(function (f) {
      return "<li><span class='tm'>" + hhmm(f.t) + "</span><span class='ag' style='--c: var(--" + (AGENT_COLOR[f.agent] || "ink") +
        ")'>" + esc(f.agent) + "</span><span>" + esc(f.text) + "</span></li>";
    }).join("");
  }

  function renderBook(s) {
    var st = s.stats;
    $("p-open").textContent = s.positions.length + " open";
    $("positions").innerHTML = s.positions.length ? s.positions.map(function (p) {
      return "<li><span class='sym'>$" + esc(p.symbol) + "</span><span class='why'>" + p.held_min + "m · peak " + pct(p.peak_pct) +
        "</span><span class='num " + cls(p.pnl_pct) + "'>" + pct(p.pnl_pct) + "</span></li>";
    }).join("") : "<li class='empty'>Nothing open. It only buys what clears every rule.</li>";
    $("p-closed").textContent = st.trades ? "· " + st.trades + " · won " + Math.round(st.win_rate * 100) + "%" : "";
    $("trades").innerHTML = s.trades.length ? s.trades.slice(0, 9).map(function (t) {
      return "<li><span class='sym'>$" + esc(t.symbol) + "</span><span class='why'>" + esc(t.exit) + " · " + t.held_min +
        "m</span><span class='num " + cls(t.pnl) + "'>" + pct(t.pnl_pct) + "</span></li>";
    }).join("") : "<li class='empty'>No closed trades yet.</li>";
  }

  function fit(cv) {
    var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!w || !h) return null;
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g: g, w: w, h: h };
  }

  var AXES = [["buy_pressure", "BUY 1H"], ["buy_pressure_now", "BUY 5M"], ["momentum_spent", "ROOM"],
              ["heat", "HEAT"], ["liquidity_fit", "POOL"], ["social", "SOCIAL"]];
  function renderRadar(s) {
    var f = s.focus, f2 = fit($("radar"));
    $("p-focus").textContent = f ? "$" + f.symbol : "—";
    var kinds = { kill: [0, 0], ready: [0, 0], scan: [0, 0] };
    (f ? f.checks : []).forEach(function (c) { if (kinds[c.kind]) { kinds[c.kind][1]++; if (c.ok) kinds[c.kind][0]++; } });
    $("kinds").innerHTML = ["kill", "ready", "scan"].map(function (k) {
      var v = kinds[k], ok = v[1] && v[0] === v[1];
      return "<div><dt>" + k + " rules</dt><dd class='" + (v[1] ? (ok ? "up" : "down") : "dim") + "'>" +
        (v[1] ? v[0] + "/" + v[1] + (ok ? " ✓" : " ✗") : "—") + "</dd></div>";
    }).join("");
    if (!f2) return;
    var g = f2.g, w = f2.w, h = f2.h, cx = w / 2, cy = h / 2 + 4, R = Math.min(w * 0.32, h * 0.38), n = AXES.length;
    var pt = function (i, r) { var a = i / n * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    g.lineWidth = 1; g.strokeStyle = rgba(colors.violet, 0.22);
    [0.25, 0.5, 0.75, 1].forEach(function (k) {
      g.beginPath();
      for (var i = 0; i <= n; i++) { var p = pt(i % n, R * k); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
      g.stroke();
    });
    g.beginPath();
    for (var i = 0; i < n; i++) { var p = pt(i, R); g.moveTo(cx, cy); g.lineTo(p[0], p[1]); }
    g.stroke();
    g.font = "9px " + FONT; g.fillStyle = colors["ink-dim"]; g.textAlign = "center"; g.textBaseline = "middle";
    AXES.forEach(function (a, i) { var p = pt(i, R + 13); g.fillText(a[1], p[0], p[1]); });
    if (!f || !f.scores || !Object.keys(f.scores).length) {
      g.fillStyle = colors["ink-dim"]; g.fillText(f ? "stomped before scoring" : "no coin on the desk", cx, cy);
      return;
    }
    var val = function (k, src) { var v = src[k] == null ? 0 : src[k]; return k === "momentum_spent" ? 1 - v : v; };
    function poly(src, stroke, fill, dash) {
      g.beginPath();
      AXES.forEach(function (a, i) { var p = pt(i, R * clamp(val(a[0], src), 0.02, 1)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
      g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = dash ? 1 : 1.6; g.stroke(); g.setLineDash([]);
    }
    poly(f.scores, colors.cyan, rgba(colors.cyan, 0.22));
    if (f.limits) poly(f.limits, colors.violet, null, [3, 3]);
    AXES.forEach(function (a, i) {
      var ok = !f.limits || val(a[0], f.scores) >= val(a[0], f.limits);
      var p = pt(i, R * clamp(val(a[0], f.scores), 0.02, 1));
      g.fillStyle = ok ? colors.cyan : colors.down;
      g.beginPath(); g.arc(p[0], p[1], ok ? 2.2 : 3, 0, Math.PI * 2); g.fill();
    });
  }

  var KILL_ABBR = { "not already rugged": "RUGGED", "mint authority revoked": "MINT", "freeze authority revoked": "FREEZE",
                    "top wallet": "WHALE", "top 10 wallets": "TOP 10", "dev still holding": "DEV", "pool locked or burned": "POOL",
                    "no danger flags": "FLAGS" };
  function renderHeat(s) {
    var rows = (s.kill_rules || []).slice(0, 7), max = rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 1);
    $("heat").innerHTML = rows.length ? rows.map(function (r) {
      var lit = Math.max(1, Math.round(r[1] / max * 12)), cells = "";
      for (var i = 0; i < 12; i++) cells += i < lit ? "<i class='on'></i>" : "<i></i>";
      return "<div title='" + esc(r[0]) + ": " + r[1] + "'><span>" + esc(KILL_ABBR[r[0]] || r[0].slice(0, 6).toUpperCase()) + "</span>" + cells + "</div>";
    }).join("") : "<div><span>—</span></div>";
    var c = s.counts, hours = Math.max(1 / 60, (new Date(s.now) - new Date(s.started)) / 36e5);
    $("p-killed").textContent = c.killed.toLocaleString("en-US");
    $("p-kph").textContent = Math.round(c.killed / hours) + "/h";
    $("c-seen").textContent = c.seen.toLocaleString("en-US");
    $("c-judged").textContent = c.judged;
    $("c-bought").textContent = c.bought;
    $("c-sold").textContent = c.sold;
  }

  function renderBalance(s) {
    var b = s.bank, st = s.stats, since = b.pnl / b.start * 100;
    $("p-since").textContent = pct(since) + " since start";
    $("p-since").className = cls(since) || "cyan";
    $("p-bank").textContent = money(b.equity);
    $("p-day").textContent = "today " + pct(b.day_pnl_pct);
    var limit = b.daily_limit_pct || 15;
    $("p-limit").textContent = b.halted ? "daily loss limit hit: no buys today" :
      "daily loss limit −" + limit + "% · " + Math.round(clamp(-b.day_pnl_pct / limit, 0, 1) * 100) + "% used";
    $("p-pf").textContent = "won " + (st.win_rate == null ? "—" : Math.round(st.win_rate * 100) + "%") +
      " · profit factor " + (st.profit_factor == null ? "—" : st.profit_factor);
    var g1 = fit($("wave"));
    if (g1) {
      var pts = (s.equity || []).slice(-120), g = g1.g, w = g1.w, h = g1.h;
      if (pts.length > 1) {
        var vals = pts.map(function (p) { return p[1]; }).concat([b.start]);
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = Math.max((hi - lo) * 0.12, hi * 0.002);
        lo -= pad; hi += pad;
        var y = function (v) { return 4 + (hi - v) / (hi - lo) * (h - 8); };
        g.setLineDash([3, 4]); g.strokeStyle = rgba(colors.pink, 0.5); g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, y(b.start)); g.lineTo(w, y(b.start)); g.stroke(); g.setLineDash([]);
        var grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, colors.pink); grad.addColorStop(1, colors.violet);
        g.beginPath();
        pts.forEach(function (p, i) { var x = i / (pts.length - 1) * w; if (i) g.lineTo(x, y(p[1])); else g.moveTo(x, y(p[1])); });
        g.strokeStyle = grad; g.lineWidth = 1.6; g.stroke();
      }
    }
    var g2 = fit($("gauge"));
    if (g2) {
      var gg = g2.g, r = Math.min(g2.w, g2.h) * 0.42, a0 = Math.PI * 0.75, cx = g2.w / 2, cy = g2.h / 2;
      gg.lineWidth = 8; gg.strokeStyle = rgba(colors.violet, 0.18);
      gg.beginPath(); gg.arc(cx, cy, r, a0, a0 + Math.PI * 1.5); gg.stroke();
      var share = clamp(Math.abs(b.day_pnl_pct) / limit, 0, 1);
      if (share > 0) {
        gg.strokeStyle = b.day_pnl_pct < 0 ? colors.down : colors.up;
        gg.beginPath(); gg.arc(cx, cy, r, a0, a0 + Math.PI * 1.5 * share); gg.stroke();
      }
    }
  }

  function renderCode(s) {
    var f = s.focus;
    if (!f) return;
    var v = f.verdict, statusCol = { watching: "cyan", killed: "down", bought: "up", sold: "gold", declined: "violet" }[f.status] || "ink-dim";
    $("p-verdict").textContent = v ? (v.buy ? "YES " : "no ") + v.confidence.toFixed(2) : f.status;
    $("p-verdict").style.color = "var(--" + (v ? (v.buy ? "up" : "violet") : statusCol) + ")";
    var out = ["<span class='c'># $" + esc(f.symbol) + " · " + esc(f.name) + "</span>",
               "<span class='c'># cap " + money(f.mcap) + " · pool " + money(f.liquidity) + " · " + esc(f.status) + "</span>",
               "<span class='c'># " + esc(f.note) + "</span>"];
    var section = null;
    f.checks.forEach(function (c) {
      if (c.kind !== section) { section = c.kind; out.push("<span class='k'>[" + section + "]</span>"); }
      out.push("<span class='" + (c.ok ? "ok-line" : "no-line") + "'><span class='" + (c.ok ? "ok'>✓" : "no'>✗") +
        "</span> <span class='r'>" + esc(c.rule.replace(/[ ,]+/g, "_")) + "</span> = <span class='v'>" + esc(c.value) +
        "</span>  <span class='c'># " + esc(c.limit) + "</span></span>");
    });
    if (v) {
      out.push("<span class='k'>[judge]</span>");
      out.push("<span class='" + (v.buy ? "ok'>✓" : "no'>✗") + "</span> <span class='r'>verdict</span> = <span class='v'>" +
        (v.buy ? "YES" : "no") + " " + v.confidence.toFixed(2) + "</span>  <span class='c'># " + esc(v.reason) + "</span>");
    }
    $("code").innerHTML = out.join("\n");
  }

  /* ---------- the web: clusters of coins, a camera, the spider ---------- */
  var canvas = $("web"), ctx = canvas.getContext("2d");
  var VW = 0, VH = 0, DPR = 1, vignette = null;
  // Where each kind of coin lives in the world. The watchlist is the big one in the middle.
  var CLUSTERS = [
    { key: "watching", label: "watching", color: "cyan", x: 0, y: 0, r: 330 },
    { key: "bought", label: "holding", color: "up", x: 860, y: -360, r: 170 },
    { key: "sold", label: "sold", color: "gold", x: 1000, y: 330, r: 190 },
    { key: "killed", label: "stomped", color: "down", x: -930, y: 280, r: 260 },
    { key: "declined", label: "judge said no", color: "violet", x: -470, y: -640, r: 170 },
    { key: "gone", label: "let go", color: "ink-dim", x: 140, y: 760, r: 210 }
  ];
  var BY_KEY = {};
  CLUSTERS.forEach(function (c) { BY_KEY[c.key] = c; });
  function clusterOf(status) {
    return BY_KEY[status === "new" || status === "approved" ? "watching" : status === "skipped" || status === "expired" ? "gone" : status] || BY_KEY.watching;
  }
  function home(id, status) {
    var c = clusterOf(status), a = hash(id) * Math.PI * 2, rr = Math.sqrt(hash(id + "r")) * c.r * 0.8;
    return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.82 };
  }

  function buildDust() {
    var small = window.innerWidth < 700;
    CLUSTERS.forEach(function (c, ci) {
      var r = rng(911 + ci * 7919), n = Math.round(c.r * (small ? 1.3 : 2.5)), pts = [], blobs = [];
      for (var b = 0; b < 6; b++) blobs.push({ x: c.x + gauss(r) * c.r * 0.35, y: c.y + gauss(r) * c.r * 0.3,
                                               sx: c.r * (0.15 + r() * 0.3), sy: c.r * (0.12 + r() * 0.26), rot: r() * Math.PI });
      var strands = Math.floor(n * 0.3);
      for (var k = 0; k < n - strands; k++) {
        var bl = blobs[Math.floor(r() * blobs.length)], gx = gauss(r) * bl.sx, gy = gauss(r) * bl.sy;
        pts.push(bl.x + gx * Math.cos(bl.rot) - gy * Math.sin(bl.rot), bl.y + gx * Math.sin(bl.rot) + gy * Math.cos(bl.rot));
      }
      var left = strands;
      while (left > 0) {
        var x = c.x + gauss(r) * c.r * 0.45, y = c.y + gauss(r) * c.r * 0.4, a = r() * Math.PI * 2, len = 14 + Math.floor(r() * 30);
        for (var s2 = 0; s2 < len && left > 0; s2++, left--) {
          a += (r() - 0.5) * 0.7; x += Math.cos(a) * 9; y += Math.sin(a) * 9;
          pts.push(x + gauss(r) * 2.5, y + gauss(r) * 2.5);
        }
      }
      var cell = 30, grid = {}, m = pts.length / 2, links = [];
      for (var i = 0; i < m; i++) { var key = Math.floor(pts[2 * i] / cell) + "," + Math.floor(pts[2 * i + 1] / cell); (grid[key] = grid[key] || []).push(i); }
      for (i = 0; i < m; i++) {
        var px = pts[2 * i], py = pts[2 * i + 1], gx2 = Math.floor(px / cell), gy2 = Math.floor(py / cell), best = -1, bd = cell * cell;
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          (grid[(gx2 + dx) + "," + (gy2 + dy)] || []).forEach(function (j) {
            if (j <= i) return;
            var d = (pts[2 * j] - px) * (pts[2 * j] - px) + (pts[2 * j + 1] - py) * (pts[2 * j + 1] - py);
            if (d < bd) { bd = d; best = j; }
          });
        }
        if (best >= 0) links.push(px, py, pts[2 * best], pts[2 * best + 1]);
      }
      var buckets = [[], [], []], stars = [];
      for (i = 0; i < m; i++) {
        var v = r();
        if (v < 0.03) stars.push(pts[2 * i], pts[2 * i + 1]);
        else buckets[v < 0.55 ? 0 : v < 0.85 ? 1 : 2].push(pts[2 * i], pts[2 * i + 1]);
      }
      c.dust = { b: buckets, stars: stars, links: links };
      var hz = document.createElement("canvas"); hz.width = hz.height = 160;     // soft glow under the dust
      var hg = hz.getContext("2d"), scale = 160 / (c.r * 3.2);
      blobs.forEach(function (bl) {
        var x = (bl.x - c.x) * scale + 80, y = (bl.y - c.y) * scale + 80, rad = (bl.sx + bl.sy) * 1.4 * scale;
        var gr = hg.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, rgba(colors[c.color], 0.16)); gr.addColorStop(1, rgba(colors[c.color], 0));
        hg.fillStyle = gr; hg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
      c.haze = hz;
    });
  }

  var nodes = {}, bursts = [], last = null;
  function syncWeb(s) {
    var seen = {};
    s.web.forEach(function (w) {
      seen[w.id] = true;
      var n = nodes[w.id];
      if (!n) {
        var h = home(w.id, w.status);
        n = nodes[w.id] = { id: w.id, x: h.x, y: h.y, grow: reduceMotion ? 1 : 0, gone: 0, changed: -1e9, status: w.status };
      } else if (n.status !== w.status) {
        var kind = w.status === "killed" ? "down" : w.status === "bought" ? "up" : w.status === "sold" ? "gold" :
                   w.status === "declined" ? "violet" : null;
        if (kind) queueEvent(w, s);
        var to = home(w.id, w.status);
        if (reduceMotion) { n.x = to.x; n.y = to.y; }
        else n.fly = { fx: n.x, fy: n.y, tx: to.x, ty: to.y, t: 0, color: kind || "cyan" };
        n.changed = performance.now();
        if (kind) bursts.push({ x: n.x, y: n.y, kind: kind, t: 0 });
      }
      n.status = w.status; n.symbol = w.symbol; n.pnl = w.pnl; n.mcap = w.mcap; n.gone = 0;
    });
    Object.keys(nodes).forEach(function (id) { if (!seen[id]) nodes[id].gone = nodes[id].gone || 0.001; });
  }

  /* The crawler: eight two-joint legs. Planted feet stay put until the body gets too far ahead,
     then step in alternating groups. A foot that lands near a coin grabs it. Short trips are a
     crawl, long ones a jump (between clusters, usually). It goes to whatever the desk just did
     (buy, sell, stomp, a judge's no) and tags it; between events it patrols what it's holding. */
  var spider = null, events = [], lastT = 0, lastStomp = -1e9;
  var LEG_ANGLES = [0.5, 1.1, 1.9, 2.55];

  function queueEvent(w, s) {
    if (reduceMotion) return;
    var ev = { id: w.id, kind: w.status }, now = performance.now();
    if (w.status === "bought") {
      ev.text = "BUY $" + w.symbol + " · cap " + shortMoney(w.mcap || 0); ev.color = "pink"; ev.ms = 3200; ev.rank = 0;
    } else if (w.status === "sold") {
      var t = (s.trades || []).filter(function (x) { return x.symbol === w.symbol; })[0], p = t ? t.pnl_pct : null;
      ev.text = "SELL $" + w.symbol + (p == null ? "" : " " + pct(p)); ev.color = p != null && p < 0 ? "down" : "gold"; ev.ms = 3000; ev.rank = 0;
    } else if (w.status === "killed") {
      if (now - lastStomp < 12000 || events.length >= 2) return;   // stomps are common; don't let them crowd out trades
      lastStomp = now;
      var k = (s.kills || []).filter(function (x) { return x.mint === w.id; })[0];
      ev.text = "STOMPED $" + w.symbol + (k ? " · " + k.reason.split(" (")[0] : ""); ev.color = "down"; ev.ms = 1800; ev.rank = 1;
    } else if (w.status === "declined") {
      if (events.length >= 2) return;
      ev.text = "JUDGE: NO $" + w.symbol; ev.color = "violet"; ev.ms = 1800; ev.rank = 1;
    } else return;
    events.push(ev);
    events.sort(function (a, b) { return a.rank - b.rank; });
    if (events.length > 5) events.length = 5;
  }

  function makeSpider(x, y, L) {
    var legs = [];
    for (var i = 0; i < 8; i++) {
      var side = i < 4 ? 1 : -1, k = i % 4;
      legs.push({ ang: side * LEG_ANGLES[k], group: (k + (side > 0 ? 0 : 1)) % 2, foot: { x: x, y: y }, from: null, to: null, t: 1, node: null });
    }
    return { x: x, y: y, vx: 0, vy: 0, heading: -Math.PI / 2, L: L, z: 0, mode: "rest", legs: legs,
             target: null, until: 0, jump: null, label: null, tint: "pink", squash: 0, patrol: 0, gait: 0, gaitClock: 0 };
  }
  function homeOf(sp, leg) { var a = sp.heading + leg.ang; return { x: sp.x + Math.cos(a) * sp.L * 1.7, y: sp.y + Math.sin(a) * sp.L * 1.7 }; }
  function nearestNode(p, within) {
    var best = null, bestD = within;
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id]; if (n.gone || n.grow < 0.98 || n.fly) return;
      var d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }
  function nextTarget(sp) {
    var ev = events.shift();
    if (ev && nodes[ev.id]) return ev;
    var all = Object.keys(nodes).map(function (k) { return nodes[k]; });
    var held = all.filter(function (n) { return n.status === "bought" && !n.gone; });
    if (held.length && Math.random() < 0.6) return { id: held[sp.patrol++ % held.length].id, kind: "hold", ms: 2600 };
    var watch = all.filter(function (n) { return n.status === "watching" && !n.gone && n.grow >= 0.98; });
    if (watch.length) {
      var w = watch[Math.floor(Math.random() * watch.length)];
      return { id: w.id, kind: "inspect", text: "reading $" + w.symbol + "…", color: "cyan", ms: 1700 };
    }
    return { id: null, kind: "home", ms: 1400 };
  }

  function updateSpider(sp, dt, now) {
    if (!sp.target || (sp.mode === "rest" && now > sp.until)) { sp.target = nextTarget(sp); sp.mode = "travel"; }
    var tn = sp.target.id ? nodes[sp.target.id] : null;
    if (sp.target.id && (!tn || tn.gone)) { sp.target = null; return; }
    var tp = tn ? { x: tn.x, y: tn.y } : BY_KEY.watching;
    var dx = tp.x - sp.x, dy = tp.y - sp.y, d = Math.hypot(dx, dy);
    if (sp.mode === "travel" && !sp.jump && d > sp.L * 6) sp.jump = { fx: sp.x, fy: sp.y, t: 0, dur: 0.6 + d / 1400 };
    if (sp.jump) {
      var j = sp.jump;
      j.t = Math.min(1, j.t + dt / j.dur);
      var e = j.t < 0.5 ? 2 * j.t * j.t : 1 - Math.pow(-2 * j.t + 2, 2) / 2;
      sp.x = j.fx + (tp.x - j.fx) * e; sp.y = j.fy + (tp.y - j.fy) * e;
      sp.z = Math.sin(Math.PI * j.t) * Math.min(90, 20 + d * 0.1);
      var face = Math.atan2(dy, dx);
      sp.heading += Math.atan2(Math.sin(face - sp.heading), Math.cos(face - sp.heading)) * Math.min(1, dt * 8);
      if (j.t >= 1) {
        sp.jump = null; sp.z = 0; sp.squash = 1;
        sp.legs.forEach(function (leg) {
          var h = homeOf(sp, leg), n = nearestNode(h, sp.L * 0.9);
          leg.node = n ? n.id : null; leg.foot = n ? { x: n.x, y: n.y } : h; leg.t = 1;
        });
        bursts.push({ x: sp.x, y: sp.y, kind: "cyan", t: 0 });
        d = 0;
      }
    } else if (sp.mode === "travel") {
      var speed = Math.min(sp.L * 5, d * 4);
      if (d > 0.5) {
        sp.vx = dx / d * speed; sp.vy = dy / d * speed;
        sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        var want = Math.atan2(dy, dx), diff = Math.atan2(Math.sin(want - sp.heading), Math.cos(want - sp.heading));
        sp.heading += diff * Math.min(1, dt * 6);
      }
    }
    if (sp.mode === "travel" && !sp.jump && d < 3) {
      sp.mode = "rest"; sp.vx = sp.vy = 0;
      var tg = sp.target, text = tg.text, color = tg.color;
      if (tg.kind === "hold" && tn) { text = "$" + tn.symbol + " " + pct(tn.pnl == null ? 0 : tn.pnl); color = tn.pnl != null && tn.pnl < 0 ? "down" : "up"; }
      sp.until = now + tg.ms;
      if (text) sp.label = { text: text, color: color, born: now, until: sp.until };
      if (color) sp.tint = color === "cyan" || color === "up" ? "pink" : color;
      if (tg.kind === "killed") { sp.squash = 1.4; bursts.push({ x: sp.x, y: sp.y, kind: "down", t: 0, word: "STOMPED" }); }
    }
    sp.squash = Math.max(0, sp.squash - dt * 3);
    if (sp.mode === "rest" && now > sp.until - 300 && sp.tint !== "pink") sp.tint = "pink";

    sp.gaitClock += dt;
    if (sp.gaitClock > 0.12) { sp.gaitClock = 0; sp.gait ^= 1; }
    var moving = sp.mode === "travel";
    sp.legs.forEach(function (leg) {
      if (sp.jump) return;
      var stuck = leg.node && nodes[leg.node];
      if (stuck && leg.t >= 1) leg.foot = { x: stuck.x, y: stuck.y };
      var h = homeOf(sp, leg);
      if (leg.t < 1) {
        leg.t = Math.min(1, leg.t + dt / (moving ? 0.11 : 0.2));
        var f = leg.t * leg.t * (3 - 2 * leg.t);
        leg.foot = { x: leg.from.x + (leg.to.x - leg.from.x) * f, y: leg.from.y + (leg.to.y - leg.from.y) * f };
        leg.lift = Math.sin(Math.PI * leg.t);
        return;
      }
      leg.lift = 0;
      var off = Math.hypot(leg.foot.x - h.x, leg.foot.y - h.y);
      var need = moving ? (leg.group === sp.gait && off > sp.L * 0.55) : off > sp.L * 0.9 || (Math.random() < dt * 0.08);
      if (need) {
        var aim = { x: h.x + sp.vx * 0.12, y: h.y + sp.vy * 0.12 };
        var n = moving ? null : nearestNode(aim, sp.L * 0.9);
        leg.node = n ? n.id : null;
        leg.from = leg.foot; leg.to = n ? { x: n.x, y: n.y } : aim; leg.t = 0;
      }
    });
    if (sp.label && now > sp.label.until + 450) sp.label = null;
  }

  // Drawn in world units: the camera's zoom scales it with the web; `px` keeps lines one pixel-ish thin.
  function drawSpider(sp, px) {
    var L = sp.L, bx = sp.x, by = sp.y - sp.z, grow = 1 + sp.z / 220, col = colors[sp.tint] || colors.pink;
    var c = nearestCluster(sp);
    ctx.save();
    ctx.globalAlpha = 0.25; ctx.strokeStyle = colors.cyan; ctx.lineWidth = px;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(bx, by); ctx.stroke();       // silk back to its cluster's heart
    if (sp.z > 1) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 4, L * 0.9, L * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.8 * px; ctx.lineCap = "round"; ctx.lineJoin = "round";
    sp.legs.forEach(function (leg) {
      var a = sp.heading + leg.ang;
      var hip = { x: bx + Math.cos(a) * L * 0.28 * grow, y: by + Math.sin(a) * L * 0.28 * grow };
      var foot = sp.jump ? { x: bx + Math.cos(a) * L * 1.1, y: by + Math.sin(a) * L * 1.1 + L * 0.3 }
                         : { x: leg.foot.x, y: leg.foot.y - (leg.lift || 0) * L * 0.35 };
      var dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy) || 1, maxD = L * 1.95;
      if (d > maxD) { foot = { x: hip.x + dx / d * maxD, y: hip.y + dy / d * maxD }; d = maxD; }
      var h = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
      var mx = (hip.x + foot.x) / 2, my = (hip.y + foot.y) / 2, ppx = -dy / d, ppy = dx / d;
      if (ppx * (mx - bx) + ppy * (my - by) < 0) { ppx = -ppx; ppy = -ppy; }
      var knee = { x: mx + ppx * h, y: my + ppy * h - L * 0.25 };
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(knee.x, knee.y, 2 * px, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(foot.x, foot.y, (leg.node ? 3.2 : 2.4) * px, 0, Math.PI * 2); ctx.fill();
    });
    ctx.translate(bx, by); ctx.rotate(sp.heading);
    var sq = 1 + sp.squash * 0.25;
    ctx.scale(grow * sq, grow / sq);
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.rect(-L * 0.95, -L * 0.3, L * 0.85, L * 0.6); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.4 * px; ctx.strokeStyle = colors.ink;
    ctx.beginPath(); ctx.rect(-L * 0.95, -L * 0.3, L * 0.85, L * 0.6); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(L * 0.12, 0, L * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.beginPath(); ctx.arc(L * 0.22, -L * 0.08, 1.6 * px, 0, Math.PI * 2); ctx.arc(L * 0.22, L * 0.08, 1.6 * px, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function tag(text, col, x, y, alpha) {
    var w = ctx.measureText(text).width + 12, h = 18;
    x = clamp(x, 4, VW - w - 4); y = clamp(y, h / 2 + 2, VH - h / 2 - 2);
    ctx.globalAlpha = alpha * 0.9; ctx.fillStyle = colors.night;
    ctx.fillRect(x, y - h / 2, w, h);
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    ctx.fillStyle = col; ctx.textAlign = "left";
    ctx.fillText(text, x + 6, y + 0.5);
    ctx.globalAlpha = 1;
    return { x: x, y: y - h / 2, w: w, h: h };
  }

  /* ---------- camera ---------- */
  var cam = { x: 0, y: 0, z: 0.6 };
  function nearestCluster(p) {
    var best = CLUSTERS[0], bd = Infinity;
    CLUSTERS.forEach(function (c) { var d = Math.hypot(p.x - c.x, p.y - c.y) - c.r; if (d < bd) { bd = d; best = c; } });
    return best;
  }
  function baseZoom() { return clamp(Math.min(VW * 0.92, VH * 1.25) / (VW < 700 ? 760 : 860), 0.25, 1.3); }
  function fitAll() {
    var x0 = -1200, x1 = 1250, y0 = -870, y1 = 1020;
    var z = Math.min(VW / (x1 - x0), VH / (y1 - y0));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: z };
  }
  function camTarget() {
    if (reduceMotion || !spider) return reduceMotion ? fitAll() : { x: 0, y: 0, z: baseZoom() };
    var c = nearestCluster(spider), z = baseZoom() * (spider.jump ? 0.78 : 1);
    return { x: lerp(c.x, spider.x, 0.55), y: lerp(c.y, spider.y, 0.55), z: z };
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    VW = r.width; VH = r.height; DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(VW * DPR)); canvas.height = Math.max(1, Math.round(VH * DPR));
    vignette = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(5,2,12,.6)");
  }

  /* Vice City dusk, fixed to the screen behind the moving web: a striped sun and a grid floor. */
  function drawBackdrop(t) {
    var horizon = VH * 0.78, sunR = Math.min(VW * 0.13, VH * 0.26), sx = VW / 2;
    var sky = ctx.createRadialGradient(sx, horizon, sunR * 0.3, sx, horizon, sunR * 3);
    sky.addColorStop(0, rgba(colors.violet, 0.2)); sky.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, horizon);
    ctx.save();
    var g = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
    g.addColorStop(0, colors.pink); g.addColorStop(1, "#ff9a3d");
    ctx.globalAlpha = 0.16; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, horizon, sunR, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    for (var i = 0; i < 6; i++) ctx.fillRect(sx - sunR, horizon - sunR * 0.5 + i * sunR * 0.09, sunR * 2, 2 + i * 1.2);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = colors.cyan; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(VW, horizon); ctx.stroke();
    ctx.globalAlpha = 0.1; ctx.strokeStyle = colors.pink;
    for (var v = -14; v <= 14; v++) { ctx.beginPath(); ctx.moveTo(sx + v * 16, horizon); ctx.lineTo(sx + v * VW * 0.14, VH); ctx.stroke(); }
    var roll = reduceMotion ? 0 : (t / 2400) % 1;
    ctx.strokeStyle = colors.violet; ctx.globalAlpha = 0.16;
    for (var k = 0; k < 6; k++) { var f = (k + roll) / 6, y = horizon + (VH - horizon) * f * f; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
    ctx.restore();
  }

  function drawDust(c, bright, z, t) {
    var inv = 1 / z, col = colors[c.color], boost = bright ? 1.15 : 0.6;
    ctx.globalAlpha = bright ? 0.95 : 0.55;
    ctx.drawImage(c.haze, c.x - c.r * 1.6, c.y - c.r * 1.6, c.r * 3.2, c.r * 3.2);
    ctx.globalAlpha = 1;
    var L = c.dust.links;
    ctx.lineWidth = 0.7 * inv; ctx.strokeStyle = rgba(col, 0.14 * boost);
    ctx.beginPath();
    for (var i = 0; i < L.length; i += 4) { ctx.moveTo(L[i], L[i + 1]); ctx.lineTo(L[i + 2], L[i + 3]); }
    ctx.stroke();
    var s = 1.3 * inv, h = s / 2, alpha = [0.18, 0.32, 0.55];
    for (var b = 0; b < 3; b++) {
      var P = c.dust.b[b];
      ctx.fillStyle = rgba(b === 2 ? colors.ink : col, alpha[b] * boost);
      ctx.beginPath();
      for (i = 0; i < P.length; i += 2) ctx.rect(P[i] - h, P[i + 1] - h, s, s);
      ctx.fill();
    }
    var st = c.dust.stars, s2 = 2.3 * inv;
    for (i = 0; i < st.length; i += 2) {
      var tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.0017 + i * 1.3);
      ctx.fillStyle = rgba(colors.ink, tw * (bright ? 0.9 : 0.5));
      ctx.fillRect(st[i] - s2 / 2, st[i + 1] - s2 / 2, s2, s2);
    }
  }

  function statusColor(n) {
    return colors[clusterOf(n.status).color];
  }

  function draw(t) {
    if (!VW || !VH) { requestAnimationFrame(draw); return; }
    var dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
    var L = 44;                                   // leg segment in world units: a big, leggy crawler
    if (!spider) spider = makeSpider(0, 0, L);
    if (!reduceMotion) updateSpider(spider, dt, t);
    else if (!spider.posed) { spider.legs.forEach(function (leg) { leg.foot = homeOf(spider, leg); }); spider.posed = true; }
    var tc = camTarget(), k = reduceMotion ? 1 : 1 - Math.exp(-dt * (spider.jump ? 3 : 1.8));
    cam.x += (tc.x - cam.x) * k; cam.y += (tc.y - cam.y) * k; cam.z += (tc.z - cam.z) * k;
    var z = cam.z, ox = VW / 2 - cam.x * z, oy = VH / 2 - cam.y * z;
    var sx = function (x) { return x * z + ox; }, sy = function (y) { return y * z + oy; };
    var here = nearestCluster(spider);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    drawBackdrop(t);
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
    CLUSTERS.forEach(function (c) {
      var x = sx(c.x), y = sy(c.y), r = c.r * 1.7 * z;
      if (x + r > 0 && x - r < VW && y + r > 0 && y - r < VH) drawDust(c, c === here, z, t);
    });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);

    // coins: grow in, fly between clusters when the desk decides, fade when they leave the web
    var list = Object.keys(nodes).map(function (id) { return nodes[id]; });
    list.forEach(function (n) {
      n.grow = reduceMotion ? 1 : Math.min(1, n.grow + dt * 1.8);
      if (n.gone) n.gone = Math.min(1, n.gone + dt * 1.2);
      if (n.fly) {
        var f = n.fly; f.t = Math.min(1, f.t + dt / 1.3);
        var e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
        var mx = (f.fx + f.tx) / 2, my = (f.fy + f.ty) / 2 - Math.hypot(f.tx - f.fx, f.ty - f.fy) * 0.18;
        var u = 1 - e;
        n.x = u * u * f.fx + 2 * u * e * mx + e * e * f.tx; n.y = u * u * f.fy + 2 * u * e * my + e * e * f.ty;
        ctx.strokeStyle = rgba(colors[f.color] || colors.cyan, 0.55 * (1 - f.t * 0.6)); ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (var q = 0; q <= 24; q++) {
          var w = e * q / 24, uw = 1 - w;
          var px = uw * uw * f.fx + 2 * uw * w * mx + w * w * f.tx, py = uw * uw * f.fy + 2 * uw * w * my + w * w * f.ty;
          if (q) ctx.lineTo(sx(px), sy(py)); else ctx.moveTo(sx(px), sy(py));
        }
        ctx.stroke();
        if (f.t >= 1) n.fly = null;
      }
    });
    list = list.filter(function (n) { if (n.gone >= 1) { delete nodes[n.id]; return false; } return true; });

    var ns = clamp(z * 1.5, 0.7, 1.4);
    list.forEach(function (n) {
      var x = sx(n.x), y = sy(n.y);
      if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) return;
      var size = (2.2 + Math.min(5, Math.max(0, Math.log10(Math.max(1, n.mcap || 1)) - 3.5) * 1.8)) * ns * n.grow;
      ctx.globalAlpha = 1 - n.gone;
      var col = statusColor(n);
      if (n.status === "killed") {
        ctx.strokeStyle = col; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
      } else {
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (n.status === "bought" && !reduceMotion) {
        ctx.strokeStyle = colors.up; ctx.lineWidth = 1; ctx.globalAlpha = (1 - n.gone) * (0.5 + 0.5 * Math.sin(t / 300));
        ctx.beginPath(); ctx.arc(x, y, size + 6, 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    // cluster names, like the prompt crawler's section labels
    var counts = last ? last.counts : null;
    CLUSTERS.forEach(function (c) {
      var x = sx(c.x - c.r * 0.55), y = sy(c.y - c.r * 0.95) - 10;
      if (x < -200 || x > VW + 20 || y < -30 || y > VH + 20) return;
      var inCluster = list.filter(function (n) { return clusterOf(n.status) === c; }).length;
      var sub = c.key === "killed" && counts ? counts.killed + " stomped tonight" :
                c.key === "sold" && counts ? counts.sold + " sold" :
                c.key === "bought" ? inCluster + " open" : inCluster + " on the web";
      var active = c === here;
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.font = (active ? "600 19px " : "600 15px ") + FONT;
      ctx.fillStyle = active ? colors[c.color] : rgba(colors[c.color], 0.75);
      ctx.fillText(c.label, x, y);
      ctx.font = "10.5px " + FONT; ctx.fillStyle = colors["ink-dim"];
      ctx.fillText(sub + (active ? " · the spider is here" : ""), x, y + 14);
    });

    // tags on the coins that matter right now
    ctx.font = "600 10.5px " + FONT; ctx.textBaseline = "middle";
    var small = VW < 700, cap = small ? 6 : 14, nowMs = performance.now();
    var spx = sx(spider.x), spy = sy(spider.y - spider.z), keep = L * z * 2.4;
    var placed = [{ x: spx - keep, y: spy - keep, w: keep * 2, h: keep * 2 }];   // leave the spider room
    var ranked = list.filter(function (n) { return !n.gone && n.grow > 0.9; }).map(function (n) {
      var recent = nowMs - n.changed < 25000;
      var r = n.status === "bought" ? 0 : recent && n.status === "killed" ? 1 : recent && n.status === "declined" ? 1 :
              recent && n.status === "sold" ? 1 : n.status === "watching" ? 2 + 1 / Math.max(1, n.mcap || 1) : 9;
      return { n: n, r: r };
    }).filter(function (o) { return o.r < 9; }).sort(function (a, b) { return a.r - b.r; });
    ranked.forEach(function (o) {
      if (placed.length > cap) return;
      var n = o.n, x = sx(n.x), y = sy(n.y);
      if (x < 0 || x > VW || y < 0 || y > VH) return;
      var text = "$" + n.symbol, col = colors.cyan;
      if (n.status === "bought") { text += " " + pct(n.pnl == null ? 0 : n.pnl); col = n.pnl != null && n.pnl < 0 ? colors.down : colors.up; }
      else if (n.status === "killed") { text += " · stomped"; col = colors.down; }
      else if (n.status === "declined") { text += " · judge: no"; col = colors.violet; }
      else if (n.status === "sold") { text += " · sold"; col = colors.gold; }
      var w = ctx.measureText(text).width + 12;
      var spots = [[x + 8, y - 12], [x - w - 8, y - 12], [x + 8, y + 12], [x - w - 8, y + 12]], at = null;
      for (var i = 0; i < spots.length && !at; i++) {
        var r = { x: spots[i][0], y: spots[i][1] - 9, w: w, h: 18 };
        if (!placed.some(function (p) { return p.x < r.x + r.w + 2 && r.x < p.x + p.w + 2 && p.y < r.y + r.h + 2 && r.y < p.y + p.h + 2; })) at = spots[i];
      }
      if (!at) return;
      placed.push(tag(text, col, at[0], at[1], o.r < 2 ? 1 : 0.85));
    });

    // bursts: stomp, buy, sell, a judge's no, a landing
    bursts = bursts.filter(function (b) {
      b.t += reduceMotion ? 1 : dt * 1.4;
      if (b.t >= 1) return false;
      var x = sx(b.x), y = sy(b.y);
      ctx.globalAlpha = 1 - b.t; ctx.strokeStyle = colors[b.kind] || colors.cyan; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6 + b.t * 34, 0, Math.PI * 2); ctx.stroke();
      if (b.word) { ctx.fillStyle = colors.down; ctx.textAlign = "center"; ctx.font = "600 11px " + FONT; ctx.fillText(b.word, x, y - 20 - b.t * 14); }
      return true;
    });
    ctx.globalAlpha = 1;

    // the spider, in world units so it zooms with the web
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);
    drawSpider(spider, 1 / Math.max(0.35, z));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var bx = sx(spider.x), by = sy(spider.y - spider.z), Ls = L * z;
    ctx.font = "600 11px " + FONT; ctx.textBaseline = "middle";
    if (spider.jump) tag("jump", colors.cyan, bx + Ls * 1.3, by - Ls * 1.1, 1);
    if (spider.label) {
      var age = t - spider.label.born, a2 = Math.min(1, age / 180) * Math.min(1, Math.max(0, (spider.label.until + 450 - t) / 450));
      tag(spider.label.text, colors[spider.label.color] || colors.pink, bx + Ls * 1.4, by - Ls * 1.6, a2);
    }
    requestAnimationFrame(draw);
  }

  /* ---------- data loop ---------- */
  var replay = window.NIGHT_DESK_REPLAY, frame = 0;
  var jumpTo = /^#f(\d+)$/.exec(location.hash);   // e.g. #f120 starts the replay at frame 120
  if (replay && jumpTo) frame = Math.min(replay.frames.length - 1, parseInt(jumpTo[1], 10));
  function render(s) {
    if (replay) s.replay = true;
    last = s;
    renderStatus(s); renderCrew(s); renderLog(s); renderBook(s); renderRadar(s); renderHeat(s); renderBalance(s); renderCode(s);
    syncWeb(s);
  }
  function tick() {
    if (replay) {
      render(replay.frames[frame]);
      frame = (frame + 1) % replay.frames.length;
      return;
    }
    fetch("api/state", { cache: "no-store" }).then(function (r) { return r.json(); }).then(render).catch(function () {
      $("st-mode").textContent = "offline";
      $("notes").textContent = "Can't reach the desk. Is `python -m nightdesk run` still going?";
    });
  }

  readColors(); buildTabs(); resize(); buildDust();
  window.addEventListener("resize", function () { resize(); if (last) render(last); });
  tick();
  setInterval(tick, replay ? replay.interval || 1500 : 1500);
  requestAnimationFrame(draw);
})();
