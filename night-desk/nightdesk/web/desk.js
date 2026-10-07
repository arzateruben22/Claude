/* Night Desk dashboard. Polls /api/state (or plays a recorded replay) and
   draws the crew, the crawler's web, the balance and the books. */
(function () {
  "use strict";

  var AGENTS = ["chief", "crawler", "vet", "scan", "social", "judge", "size", "fills", "risk"];
  var GLYPHS = {
    chief: '<path d="M2 12h12M3 12 2 5l3.5 3L8 3l2.5 5L14 5l-1 7"/>',
    crawler: '<circle cx="8" cy="8" r="2.4"/><path d="M6 6.5 2.5 3M10 6.5 13.5 3M6 9.5 2.5 13M10 9.5l3.5 3.5M5.6 8H1.5M10.4 8h4.1"/>',
    vet: '<circle cx="8" cy="8" r="6"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/>',
    scan: '<path d="M1 9h3l2-5 3 9 2-6 1 2h3"/>',
    social: '<path d="M2 3h12v8H7l-3 3v-3H2z"/>',
    judge: '<path d="M8 2v12M4 14h8M3 5h10M3 5l-2 5h4zM13 5l-2 5h4z"/>',
    size: '<path d="M3 13V9M7 13V6M11 13V3M1 13.5h14"/>',
    fills: '<path d="M2 5h10l-3-3M14 11H4l3 3"/>',
    risk: '<path d="M8 1.5 2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4z"/><path d="M8 5v4M8 11v.5"/>'
  };
  var NAMES = { chief: "CHIEF", crawler: "CRAWLER", vet: "VET", scan: "SCAN", social: "SOCIAL",
                judge: "JUDGE", size: "SIZE", fills: "FILLS", risk: "RISK" };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };

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
  function axisMoney(x) {
    return x >= 1e4 ? "$" + (x / 1e3).toFixed(1) + "K" : "$" + Math.round(x).toLocaleString("en-US");
  }
  function pct(x) { return x == null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(1) + "%"; }
  function cls(x) { return x == null ? "" : x > 0 ? "up" : x < 0 ? "down" : ""; }
  function pt(iso, withDay) {
    var d = new Date(iso);
    var opts = { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" };
    if (withDay) { opts.weekday = "short"; }
    return d.toLocaleString("en-US", opts);
  }
  function ago(iso, nowIso) {
    var m = Math.max(0, Math.round((new Date(nowIso) - new Date(iso)) / 60000));
    return m < 1 ? "just now" : m < 60 ? m + "m ago" : Math.round(m / 60) + "h ago";
  }

  /* ---------- crew ---------- */
  var lastAt = {};
  function buildCrew() {
    $("crew").innerHTML = AGENTS.map(function (k) {
      return '<article class="agent" data-agent="' + k + '"><header><svg viewBox="0 0 16 16" aria-hidden="true">' +
        '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
        GLYPHS[k] + '</g></svg><h3>' + NAMES[k] + '</h3><span class="count"></span></header>' +
        '<p class="role"></p><p class="status">standing by</p><div class="meter"><span></span></div></article>';
    }).join("");
  }
  function renderCrew(agents) {
    AGENTS.forEach(function (k) {
      var a = agents[k], el = document.querySelector('.agent[data-agent="' + k + '"]');
      if (!a || !el) return;
      el.querySelector(".role").textContent = a.role;
      el.querySelector(".status").textContent = a.status;
      el.querySelector(".count").textContent = a.count ? a.count.toLocaleString("en-US") : "";
      el.querySelector(".meter span").style.setProperty("--v", a.meter || 0);
      if (a.at && a.at !== lastAt[k]) {
        lastAt[k] = a.at;
        el.classList.add("live");
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.classList.remove("live"); }, 1400);
      }
    });
  }

  /* ---------- header + books ---------- */
  function renderHeader(s) {
    $("mode").textContent = s.replay ? "Replay · demo night" : s.mode === "demo" ? "Demo market" : "Live data";
    $("clock").textContent = pt(s.now, true);
    $("clock-sub").textContent = "Pacific · desk running since " + pt(s.started);
    $("equity").textContent = money(s.bank.equity);
    $("pnl").textContent = pct(s.bank.pnl / s.bank.start * 100);
    $("pnl").className = cls(s.bank.pnl);
    $("day").textContent = s.bank.halted ? "halted" : pct(s.bank.day_pnl_pct);
    $("day").className = s.bank.halted ? "warn" : cls(s.bank.day_pnl_pct);
    $("open").textContent = s.bank.open;
    $("notes").textContent = (s.notes || []).slice(-2).join(" · ");
    $("judge-by").textContent = s.judge || "";
  }

  function renderStats(s) {
    var st = s.stats, c = s.counts;
    var items = [
      ["trades", st.trades],
      ["won", st.win_rate == null ? "—" : Math.round(st.win_rate * 100) + "%"],
      ["profit factor", st.profit_factor == null ? "—" : st.profit_factor],
      ["best", pct(st.best)], ["worst", pct(st.worst)],
      ["coins seen", c.seen.toLocaleString("en-US")], ["stomped", c.killed.toLocaleString("en-US")]
    ];
    $("stats").innerHTML = items.map(function (i) { return "<li><b>" + i[0] + "</b>" + esc(i[1]) + "</li>"; }).join("");
  }

  function renderChart(s) {
    var svg = $("chart"), body = $("chart-body");
    var w = Math.max(300, Math.round(svg.clientWidth || 1000)), h = 180;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    var pts = s.equity || [];
    if (pts.length < 2) { body.innerHTML = '<text x="12" y="96">The balance line starts after the first few minutes.</text>'; return; }
    var t0 = new Date(pts[0][0]).getTime(), t1 = new Date(pts[pts.length - 1][0]).getTime();
    var vals = pts.map(function (p) { return p[1]; }).concat([s.bank.start]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = Math.max((hi - lo) * 0.15, hi * 0.01);
    lo -= pad; hi += pad;
    var L = 70, R = 76, T = 12, B = 24;
    var x = function (t) { return L + (t - t0) / Math.max(1, t1 - t0) * (w - L - R); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (h - T - B); };
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(new Date(p[0]).getTime()).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("");
    var last = pts[pts.length - 1];
    var ticks = [lo + pad, (lo + hi) / 2, hi - pad];
    body.innerHTML =
      ticks.map(function (v) { return '<line class="grid" x1="' + L + '" x2="' + (w - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + axisMoney(v) + "</text>"; }).join("") +
      '<line class="base" x1="' + L + '" x2="' + (w - R) + '" y1="' + y(s.bank.start) + '" y2="' + y(s.bank.start) + '"/>' +
      '<path class="area" d="' + line + "L" + x(t1) + " " + (h - B) + "L" + L + " " + (h - B) + 'Z"/>' +
      '<path class="line" d="' + line + '"/>' +
      '<circle class="end" r="4" cx="' + x(t1) + '" cy="' + y(last[1]) + '"/>' +
      '<text x="' + (x(t1) + 8) + '" y="' + (y(last[1]) + 4) + '">' + money(last[1]) + "</text>" +
      '<text x="' + L + '" y="' + (h - 6) + '">' + pt(pts[0][0], true) + "</text>" +
      '<text x="' + (w - R) + '" y="' + (h - 6) + '" text-anchor="end">' + pt(last[0]) + "</text>";
  }

  function renderSheet(s) {
    var f = s.focus;
    if (!f) return;
    var rows = f.checks.map(function (c) {
      return "<tr><td class='k'>" + c.kind + "</td><td>" + esc(c.rule) + "</td><td class='v'>" + esc(c.value) +
        "</td><td class='l'>" + esc(c.limit) + "</td><td class='" + (c.ok ? "ok'>✓" : "no'>✗") + "</td></tr>";
    }).join("");
    var v = f.verdict;
    var verdict = v ? "<p class='sheet-note'><span class='" + (v.buy ? "yes" : "nay") + "'>" + (v.buy ? "JUDGE: YES" : "JUDGE: NO") +
      "</span> · " + v.confidence.toFixed(2) + " · " + esc(v.reason) + "</p>" : "";
    $("sheet").innerHTML =
      "<div class='sheet-head'><b>$" + esc(f.symbol) + "</b><span>" + esc(f.name) + " · cap " + money(f.mcap) +
      " · pool " + money(f.liquidity) + " · " + esc(f.status) + "</span></div>" +
      "<p class='sheet-note'>" + esc(f.note) + "</p>" + verdict +
      "<div class='table-wrap'><table class='rules'><tbody>" + rows + "</tbody></table></div>";
  }

  function list(id, items, row, empty) {
    $(id).innerHTML = items.length ? items.map(row).join("") : "<li class='empty'>" + empty + "</li>";
  }

  function renderBooks(s) {
    $("hold-count").textContent = s.positions.length ? s.positions.length + " open" : "";
    list("positions", s.positions, function (p) {
      return "<li><span class='sym'>$" + esc(p.symbol) + "</span><span class='why'>held " + p.held_min + "m · peak " +
        pct(p.peak_pct) + " · in " + money(p.cost) + "</span><span class='num " + cls(p.pnl_pct) + "'>" + pct(p.pnl_pct) +
        "</span><span class='sub'>" + esc(p.why) + "</span></li>";
    }, "Nothing open. The desk only buys what clears every rule.");
    list("trades", s.trades.slice(0, 12), function (t) {
      return "<li><span class='sym'>$" + esc(t.symbol) + "</span><span class='why'>" + esc(t.exit) + " · " + t.held_min +
        "m</span><span class='num " + cls(t.pnl) + "'>" + pct(t.pnl_pct) + " · " + money(t.pnl) + "</span></li>";
    }, "No closed trades yet.");
    list("kills", s.kills.slice(0, 10), function (k) {
      return "<li><span class='sym down'>$" + esc(k.symbol) + "</span><span class='why'>" + esc(k.reason) +
        "</span><span class='num'>" + ago(k.t, s.now) + "</span></li>";
    }, "Nothing stomped yet.");
    list("verdicts", s.verdicts.slice(0, 8), function (v) {
      return "<li><span class='" + (v.buy ? "yes" : "nay") + "'>" + (v.buy ? "YES" : "no") + "</span><span class='why'>$" +
        esc(v.symbol) + " · " + esc(v.reason) + "</span><span class='num'>" + v.confidence.toFixed(2) + "</span></li>";
    }, "The judge hasn't been asked yet.");
    var feed = (s.feed || []).slice(0, 3);
    $("ticker").innerHTML = feed.map(function (f) {
      return "<li><b>" + NAMES[f.agent] + "</b> " + esc(f.text) + "</li>";
    }).join("");
  }

  /* ---------- the web ---------- */
  var canvas = $("web"), ctx = canvas.getContext("2d");
  var nodes = {}, bursts = [], colors = {};
  var RING = { watching: 0.8, "new": 0.8, bought: 0.36, sold: 0.56, killed: 0.93, declined: 0.9, skipped: 0.97, expired: 0.97 };

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["thread", "up", "down", "gold", "ink", "ink-soft", "ink-dim", "line", "panel", "warn"].forEach(function (k) {
      colors[k] = cs.getPropertyValue("--" + k).trim() || "#888";
    });
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function statusColor(n) {
    return n.status === "killed" ? colors.down : n.status === "bought" ? colors.up : n.status === "sold" ? colors.gold :
      n.status === "watching" || n.status === "new" ? colors.thread : colors["ink-dim"];
  }

  function syncWeb(web) {
    var seen = {};
    web.forEach(function (w) {
      seen[w.id] = true;
      var n = nodes[w.id];
      if (!n) {
        n = nodes[w.id] = { id: w.id, a: hash(w.id) * Math.PI * 2, r: RING[w.status] || 0.8, grow: reduceMotion ? 1 : 0, gone: 0 };
      } else if (n.status !== w.status) {
        var kind = w.status === "killed" ? "down" : w.status === "bought" ? "up" : w.status === "sold" ? "gold" : null;
        if (kind) bursts.push({ id: w.id, kind: kind, t: 0 });
      }
      n.status = w.status; n.symbol = w.symbol; n.pnl = w.pnl; n.mcap = w.mcap;
      n.tr = RING[w.status] || 0.8; n.gone = 0;
    });
    Object.keys(nodes).forEach(function (id) { if (!seen[id]) nodes[id].gone = nodes[id].gone || 0.001; });
  }

  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSpider(cx, cy, t) {
    var wig = reduceMotion ? 0 : Math.sin(t / 260) * 0.12;
    ctx.strokeStyle = colors.thread; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (var i = 0; i < 8; i++) {
      var side = i < 4 ? -1 : 1, k = i % 4;
      var base = (side < 0 ? Math.PI : 0) + (k - 1.5) * 0.45 * side + (k % 2 ? wig : -wig);
      var kx = cx + Math.cos(base) * 13, ky = cy + Math.sin(base) * 13 - 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kx, ky);
      ctx.lineTo(kx + Math.cos(base) * 9, ky + 9); ctx.stroke();
    }
    ctx.fillStyle = colors.thread;
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2); ctx.fill();
  }

  function draw(t) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 34;
    // radar rings
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
    [0.36, 0.56, 0.8, 0.95].forEach(function (k) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); });
    ctx.globalAlpha = 0.5;
    for (var s = 0; s < 6; s++) { var a = s * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
    ctx.globalAlpha = 1;

    var list = Object.keys(nodes).map(function (k) { return nodes[k]; });
    list.forEach(function (n) {
      if (!reduceMotion) { n.r += (n.tr - n.r) * 0.06; n.grow = Math.min(1, n.grow + 0.03); } else { n.r = n.tr; n.grow = 1; }
      if (n.gone) n.gone = Math.min(1, n.gone + 0.02);
    });
    list = list.filter(function (n) { if (n.gone >= 1) { delete nodes[n.id]; return false; } return true; });

    // threads
    list.forEach(function (n) {
      var x = cx + Math.cos(n.a) * R * n.r, y = cy + Math.sin(n.a) * R * n.r;
      var dim = n.status === "declined" || n.status === "skipped" || n.status === "expired";
      ctx.globalAlpha = (dim ? 0.18 : 0.42) * (1 - n.gone);
      ctx.strokeStyle = statusColor(n); ctx.lineWidth = n.status === "bought" ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (x - cx) * n.grow, cy + (y - cy) * n.grow); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // nodes + labels
    ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = "middle";
    var labelled = list.filter(function (n) { return n.status !== "declined" && n.status !== "skipped" && n.status !== "expired"; })
      .sort(function (a, b) { return (b.status === "bought") - (a.status === "bought") || (b.mcap || 0) - (a.mcap || 0); }).slice(0, 14);
    // Greedy label placement: skip a label that would sit on one already drawn.
    var label = {}, placed = [];
    labelled.forEach(function (n) {
      var x = cx + Math.cos(n.a) * R * n.tr, y = cy + Math.sin(n.a) * R * n.tr;
      var right = Math.cos(n.a) >= 0, x0 = right ? x + 8 : x - 78;
      var clash = placed.some(function (p) { return Math.abs(p.y - y) < 13 && x0 < p.x + 78 && p.x < x0 + 78; });
      if (!clash) { placed.push({ x: x0, y: y }); label[n.id] = true; }
    });
    list.forEach(function (n) {
      if (n.grow < 0.98) return;
      var x = cx + Math.cos(n.a) * R * n.r, y = cy + Math.sin(n.a) * R * n.r;
      var size = 2.5 + Math.min(6, Math.max(0, Math.log10(Math.max(1, n.mcap || 1)) - 3.5) * 2.2);
      ctx.globalAlpha = 1 - n.gone;
      ctx.fillStyle = statusColor(n);
      if (n.status === "killed") {
        ctx.strokeStyle = colors.down; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      }
      if (n.status === "bought" && !reduceMotion) {
        ctx.strokeStyle = colors.up; ctx.lineWidth = 1;
        ctx.globalAlpha = (1 - n.gone) * (0.5 + 0.5 * Math.sin(t / 300));
        ctx.beginPath(); ctx.arc(x, y, size + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1 - n.gone;
      }
      if (label[n.id]) {
        var right = Math.cos(n.a) >= 0;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillStyle = n.status === "killed" ? colors.down : n.status === "bought" ? colors.up : colors["ink-soft"];
        var text = "$" + n.symbol + (n.status === "bought" && n.pnl != null ? " " + (n.pnl >= 0 ? "+" : "") + n.pnl.toFixed(1) + "%" : "");
        ctx.fillText(text, x + (right ? size + 6 : -size - 6), y);
      }
    });
    ctx.globalAlpha = 1;

    // bursts: stomp (red), buy (green), sell (gold)
    bursts = bursts.filter(function (b) {
      var n = nodes[b.id]; if (!n) return false;
      b.t += reduceMotion ? 1 : 0.025;
      if (b.t >= 1) return false;
      var x = cx + Math.cos(n.a) * R * n.r, y = cy + Math.sin(n.a) * R * n.r;
      ctx.globalAlpha = 1 - b.t; ctx.strokeStyle = colors[b.kind]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6 + b.t * 30, 0, Math.PI * 2); ctx.stroke();
      if (b.kind === "down") {
        ctx.fillStyle = colors.down; ctx.textAlign = "center"; ctx.font = "600 11px " + getComputedStyle(document.body).fontFamily;
        ctx.fillText("STOMPED", x, y - 18 - b.t * 12);
        ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
      }
      return true;
    });
    ctx.globalAlpha = 1;
    drawSpider(cx, cy, t);
    requestAnimationFrame(draw);
  }

  /* ---------- data loop ---------- */
  var replay = window.NIGHT_DESK_REPLAY, frame = 0;
  var jump = /^#f(\d+)$/.exec(location.hash);   // e.g. #f120 starts the replay at frame 120
  if (replay && jump) frame = Math.min(replay.frames.length - 1, parseInt(jump[1], 10));
  function render(s) {
    if (replay) s.replay = true;
    renderHeader(s); renderCrew(s.agents); renderStats(s); renderChart(s); renderSheet(s); renderBooks(s); syncWeb(s.web);
  }
  function tick() {
    if (replay) {
      render(replay.frames[frame]);
      frame = (frame + 1) % replay.frames.length;
      return;
    }
    fetch("api/state", { cache: "no-store" }).then(function (r) { return r.json(); }).then(render).catch(function () {
      $("mode").textContent = "Desk offline";
      $("notes").textContent = "Can't reach the desk. Is `python -m nightdesk run` still going?";
    });
  }

  buildCrew(); readColors(); resize();
  window.addEventListener("resize", function () { resize(); });
  tick();
  setInterval(tick, replay ? replay.interval || 1500 : 1500);
  requestAnimationFrame(draw);
})();
