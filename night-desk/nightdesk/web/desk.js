/* Night Desk dashboard. Polls /api/state (or plays a recorded replay) and
   draws the crew, the crawler's web, the balance and the books. */
(function () {
  "use strict";

  var AGENTS = ["crawler", "vet", "scan", "social", "judge", "size", "fills", "risk"];   // CHIEF runs the header
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
    var now = new Date(s.now);
    $("clock").textContent = now.toISOString().slice(11, 16) + " UTC";
    $("clock-sub").textContent = pt(s.now) + " Pacific";
    $("night").textContent = "Night " + (Math.floor((now - new Date(s.started)) / 864e5) + 1);
    $("date").textContent = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
    $("scene-count").textContent = s.counts.seen.toLocaleString("en-US") + " found · " + s.counts.killed.toLocaleString("en-US") + " stomped";
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
      return "<tr><td class='n'></td><td class='k'>" + c.kind + "</td><td class='r'>" + esc(c.rule.replace(/[ ,]+/g, "_")).replace(/_/g, "_<wbr>") + "</td><td class='v'>" + esc(c.value) +
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
    ["cyan", "pink", "violet", "up", "down", "gold", "ink", "ink-soft", "ink-dim", "line", "panel", "warn"].forEach(function (k) {
      colors[k] = cs.getPropertyValue("--" + k).trim() || "#888";
    });
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function statusColor(n) {
    return n.status === "killed" ? colors.down : n.status === "bought" ? colors.up : n.status === "sold" ? colors.gold :
      n.status === "watching" || n.status === "new" ? colors.cyan : n.status === "declined" ? colors.violet : colors["ink-dim"];
  }

  function syncWeb(s) {
    var seen = {};
    s.web.forEach(function (w) {
      seen[w.id] = true;
      var n = nodes[w.id];
      if (!n) {
        n = nodes[w.id] = { id: w.id, a: hash(w.id) * Math.PI * 2, r: RING[w.status] || 0.8, grow: reduceMotion ? 1 : 0, gone: 0 };
      } else if (n.status !== w.status) {
        var kind = w.status === "killed" ? "down" : w.status === "bought" ? "up" : w.status === "sold" ? "gold" : null;
        var queued = kind && queueEvent(w, s);
        if (kind && !(queued && kind === "down")) bursts.push({ id: w.id, kind: kind, t: 0 });   // the spider stomps its own
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

  /* ---------- the crawler: a spider that walks the web ----------
     Eight two-joint legs. Planted feet stay put until the body gets too far
     ahead, then step (alternating groups, like a real gait). A foot that lands
     near a coin grabs it. Short trips are a crawl, long ones a jump. It stops
     on whatever the desk just did (buy, sell, stomp) and tags it; between
     events it patrols the coins it's holding. */
  var spider = null, events = [], lastT = 0;
  var LEG_ANGLES = [0.5, 1.1, 1.9, 2.55];      // from the heading, each side

  function shortMoney(x) {
    return x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : x >= 1e3 ? Math.round(x / 1e3) + "K" : Math.round(x) + "";
  }

  function queueEvent(w, s) {
    if (reduceMotion) return false;
    var ev = { id: w.id, kind: w.status };
    if (w.status === "bought") {
      ev.text = "BUY $" + w.symbol + " · cap " + shortMoney(w.mcap || 0); ev.color = "pink"; ev.ms = 3200; ev.rank = 0;
    } else if (w.status === "sold") {
      var t = (s.trades || []).filter(function (x) { return x.symbol === w.symbol; })[0];
      var p = t ? t.pnl_pct : null;
      ev.text = "SELL $" + w.symbol + (p == null ? "" : " " + pct(p)); ev.color = p != null && p < 0 ? "down" : "gold"; ev.ms = 3000; ev.rank = 0;
    } else if (w.status === "killed") {
      var k = (s.kills || []).filter(function (x) { return x.mint === w.id; })[0];
      ev.text = "STOMPED $" + w.symbol + (k ? " · " + k.reason.split(" (")[0] : ""); ev.color = "down"; ev.ms = 1800; ev.rank = 1;
      if (events.length >= 2) return false;   // stomps are common; don't let them crowd out trades
    } else return false;
    events.push(ev);
    events.sort(function (a, b) { return a.rank - b.rank; });
    if (events.length > 5) events.length = 5;
    return true;
  }

  function makeSpider(x, y, L) {
    var legs = [];
    for (var i = 0; i < 8; i++) {
      var side = i < 4 ? 1 : -1, k = i % 4;
      legs.push({ ang: side * LEG_ANGLES[k], group: (k + (side > 0 ? 0 : 1)) % 2, foot: { x: x, y: y },
                  from: null, to: null, t: 1, node: null });
    }
    return { x: x, y: y, vx: 0, vy: 0, heading: -Math.PI / 2, L: L, z: 0, mode: "rest", legs: legs,
             target: null, until: 0, jump: null, label: null, tint: "pink", squash: 0, patrol: 0, gait: 0, gaitClock: 0 };
  }

  function homeOf(sp, leg) {
    var a = sp.heading + leg.ang;
    return { x: sp.x + Math.cos(a) * sp.L * 1.7, y: sp.y + Math.sin(a) * sp.L * 1.7 };
  }

  function nearestNode(p, within, geo) {
    var best = null, bestD = within;
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id]; if (n.gone || n.grow < 0.98) return;
      var q = geo(n), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  function nextTarget(sp, now) {
    var ev = events.shift();
    if (ev && nodes[ev.id]) return ev;
    var held = Object.keys(nodes).map(function (k) { return nodes[k]; }).filter(function (n) { return n.status === "bought" && !n.gone; });
    if (held.length) {
      var n = held[sp.patrol++ % held.length];
      return { id: n.id, kind: "hold", ms: 2600 };
    }
    var watch = Object.keys(nodes).map(function (k) { return nodes[k]; }).filter(function (n) { return n.status === "watching" && !n.gone && n.grow >= 0.98; });
    if (watch.length && Math.random() < 0.75) {
      var w = watch[Math.floor(Math.random() * watch.length)];
      return { id: w.id, kind: "inspect", text: "reading $" + w.symbol + "…", color: "cyan", ms: 1600 };
    }
    return { id: null, kind: "home", ms: 1400 };
  }

  function updateSpider(sp, dt, now, geo, hub) {
    // pick the next stop
    if (!sp.target || (sp.mode === "rest" && now > sp.until)) {
      sp.target = nextTarget(sp, now); sp.mode = "travel";
    }
    var tn = sp.target.id ? nodes[sp.target.id] : null;
    if (sp.target.id && (!tn || tn.gone)) { sp.target = null; return; }
    var tp = tn ? geo(tn) : hub;
    var dx = tp.x - sp.x, dy = tp.y - sp.y, d = Math.hypot(dx, dy);

    if (sp.mode === "travel" && !sp.jump && d > sp.L * 6) {
      sp.jump = { fx: sp.x, fy: sp.y, t: 0, dur: 0.5 + d / 1600 };
    }
    if (sp.jump) {
      var j = sp.jump;
      j.t = Math.min(1, j.t + dt / j.dur);
      var e = j.t < 0.5 ? 2 * j.t * j.t : 1 - Math.pow(-2 * j.t + 2, 2) / 2;
      sp.x = j.fx + (tp.x - j.fx) * e; sp.y = j.fy + (tp.y - j.fy) * e;
      sp.z = Math.sin(Math.PI * j.t) * Math.min(60, 18 + d * 0.12);
      var face = Math.atan2(dy, dx);
      sp.heading += Math.atan2(Math.sin(face - sp.heading), Math.cos(face - sp.heading)) * Math.min(1, dt * 8);
      if (j.t >= 1) {                                  // land: legs splay, feet grab what's near
        sp.jump = null; sp.z = 0; sp.squash = 1;
        sp.legs.forEach(function (leg) {
          var h = homeOf(sp, leg), n = nearestNode(h, sp.L * 0.9, geo);
          leg.node = n ? n.id : null; leg.foot = n ? geo(n) : h; leg.t = 1;
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
    if (sp.mode === "travel" && !sp.jump && d < 3) {   // arrived
      sp.mode = "rest"; sp.vx = sp.vy = 0;
      var tg = sp.target, text = tg.text, color = tg.color;
      if (tg.kind === "hold" && tn) {
        text = "$" + tn.symbol + " " + pct(tn.pnl == null ? 0 : tn.pnl);
        color = tn.pnl != null && tn.pnl < 0 ? "down" : "up";
      }
      sp.until = now + tg.ms;
      if (text) sp.label = { text: text, color: color, born: now, until: sp.until };
      if (color) sp.tint = color === "cyan" || color === "up" ? "pink" : color;
      if (tg.kind === "killed") { sp.squash = 1.4; bursts.push({ id: tg.id, kind: "down", t: 0 }); }
    }
    sp.squash = Math.max(0, sp.squash - dt * 3);
    if (sp.mode === "rest" && now > sp.until - 300 && sp.tint !== "pink") sp.tint = "pink";

    // legs: step when the body has moved on, alternating groups
    sp.gaitClock += dt;
    if (sp.gaitClock > 0.12) { sp.gaitClock = 0; sp.gait ^= 1; }
    var moving = sp.mode === "travel";
    sp.legs.forEach(function (leg) {
      if (sp.jump) return;
      if (leg.node && nodes[leg.node] && leg.t >= 1) leg.foot = geo(nodes[leg.node]);   // stuck to a moving coin
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
      var need = moving ? (leg.group === sp.gait && off > sp.L * 0.55) : off > sp.L * 0.9 || (Math.random() < dt * 0.08);   // now and then a resting leg re-grips
      if (need) {
        var aim = { x: h.x + sp.vx * 0.12, y: h.y + sp.vy * 0.12 };
        var n = moving ? null : nearestNode(aim, sp.L * 0.9, geo);
        leg.node = n ? n.id : null;
        leg.from = leg.foot; leg.to = n ? geo(n) : aim; leg.t = 0;
      }
    });

    if (sp.label && now > sp.label.until + 450) sp.label = null;
  }

  function drawSpider(sp, now, hub) {
    var L = sp.L, bx = sp.x, by = sp.y - sp.z, grow = 1 + sp.z / 160;
    var col = colors[sp.tint] || colors.pink;
    // silk back to the hub
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = colors.cyan; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(bx, by); ctx.stroke();
    if (sp.z > 1) {                                   // shadow while airborne
      ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 4, L * 0.9, L * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    sp.legs.forEach(function (leg) {
      var a = sp.heading + leg.ang;
      var hip = { x: bx + Math.cos(a) * L * 0.28 * grow, y: by + Math.sin(a) * L * 0.28 * grow };
      var foot = sp.jump ? { x: bx + Math.cos(a) * L * 1.1, y: by + Math.sin(a) * L * 1.1 + L * 0.3 }
                         : { x: leg.foot.x, y: leg.foot.y - (leg.lift || 0) * L * 0.35 };
      var dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy) || 1, maxD = L * 1.95;
      if (d > maxD) { foot = { x: hip.x + dx / d * maxD, y: hip.y + dy / d * maxD }; d = maxD; }
      var h = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
      var mx = (hip.x + foot.x) / 2, my = (hip.y + foot.y) / 2, px = -dy / d, py = dx / d;
      if (px * (mx - bx) + py * (my - by) < 0) { px = -px; py = -py; }   // knees bend away from the body
      var knee = { x: mx + px * h, y: my + py * h - L * 0.25 };
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(knee.x, knee.y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(foot.x, foot.y, leg.node ? 3.2 : 2.4, 0, Math.PI * 2); ctx.fill();
    });
    // body: abdomen box behind, head in front
    ctx.translate(bx, by); ctx.rotate(sp.heading);
    var sq = 1 + sp.squash * 0.25;
    ctx.scale(grow * sq, grow / sq);
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.rect(-L * 0.95, -L * 0.3, L * 0.85, L * 0.6); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.4; ctx.strokeStyle = colors.ink;
    ctx.beginPath(); ctx.rect(-L * 0.95, -L * 0.3, L * 0.85, L * 0.6); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(L * 0.12, 0, L * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.beginPath(); ctx.arc(L * 0.22, -L * 0.08, 1.6, 0, Math.PI * 2); ctx.arc(L * 0.22, L * 0.08, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // tags: "jump" in the air, the action when it lands
    ctx.save();
    ctx.font = "600 11px " + getComputedStyle(document.body).fontFamily; ctx.textBaseline = "middle";
    if (sp.jump) tag("jump", colors.cyan, bx + L * 1.3, by - L * 1.1, 1);
    if (sp.label) {
      var age = now - sp.label.born, a2 = Math.min(1, age / 180) * Math.min(1, Math.max(0, (sp.label.until + 450 - now) / 450));
      tag(sp.label.text, colors[sp.label.color] || colors.pink, bx + L * 1.4, by - L * 1.5, a2);
    }
    ctx.restore();
  }

  function tag(text, col, x, y, alpha) {
    var w = ctx.measureText(text).width + 14, h = 20;
    x = Math.min(x, canvas.clientWidth - w - 6);
    ctx.globalAlpha = alpha * 0.92; ctx.fillStyle = colors.panel;
    ctx.fillRect(x, y - h / 2, w, h);
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    ctx.fillStyle = col; ctx.textAlign = "left";
    ctx.fillText(text, x + 7, y + 0.5);
  }

  /* Vice City sunset behind the web: striped sun on the horizon, a grid floor
     rolling toward you. Kept faint so the web stays readable. */
  function drawBackdrop(w, h, t) {
    var horizon = h * 0.64, sunR = Math.min(w * 0.16, h * 0.34), sx = w / 2;
    var sky = ctx.createRadialGradient(sx, horizon, sunR * 0.4, sx, horizon, sunR * 2.8);   // violet dusk around the sun
    sky.addColorStop(0, colors.violet); sky.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon); ctx.restore();
    var g = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
    g.addColorStop(0, colors.pink); g.addColorStop(1, "#ff9a3d");
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.arc(sx, horizon, sunR, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    for (var i = 0; i < 6; i++) {        // the stripes cut through the lower half of the sun
      var y = horizon - sunR * 0.5 + i * sunR * 0.09;
      ctx.fillRect(sx - sunR, y, sunR * 2, 2 + i * 1.2);
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = colors.cyan; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
    ctx.globalAlpha = 0.16; ctx.strokeStyle = colors.pink; ctx.lineWidth = 1;
    for (var v = -12; v <= 12; v++) {    // lines running to the vanishing point
      ctx.beginPath(); ctx.moveTo(sx + v * 18, horizon); ctx.lineTo(sx + v * w * 0.16, h); ctx.stroke();
    }
    var roll = reduceMotion ? 0 : (t / 2400) % 1;
    ctx.strokeStyle = colors.violet; ctx.globalAlpha = 0.24;
    for (var k = 0; k < 8; k++) {        // horizontal lines, bunching toward the horizon
      var f = (k + roll) / 8, y2 = horizon + (h - horizon) * f * f;
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(w, y2); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(t) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    drawBackdrop(w, h, t);
    var cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 34;
    var geo = function (n) { return { x: cx + Math.cos(n.a) * R * n.r, y: cy + Math.sin(n.a) * R * n.r }; };
    var hub = { x: cx, y: cy };
    var dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
    // radar rings
    ctx.strokeStyle = colors.cyan; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    [0.36, 0.56, 0.8, 0.95].forEach(function (k) { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); });
    ctx.globalAlpha = 0.1;
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
      var n = b.id ? nodes[b.id] : null; if (b.id && !n) return false;
      b.t += reduceMotion ? 1 : 0.025;
      if (b.t >= 1) return false;
      var x = n ? geo(n).x : b.x, y = n ? geo(n).y : b.y;
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
    // the hub the threads hang from
    ctx.fillStyle = colors.cyan; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    var L = Math.max(18, Math.min(46, R * 0.2));     // leg segment: a big, leggy crawler like the original
    if (!spider) spider = makeSpider(cx, cy, L);
    spider.L = L;
    if (!reduceMotion) updateSpider(spider, dt, t, geo, hub);
    else if (!spider.posed) {                         // reduced motion: a still spider on the hub
      spider.legs.forEach(function (leg) { leg.foot = homeOf(spider, leg); });
      spider.posed = true;
    }
    drawSpider(spider, t, hub);
    requestAnimationFrame(draw);
  }

  /* ---------- data loop ---------- */
  var replay = window.NIGHT_DESK_REPLAY, frame = 0;
  var jump = /^#f(\d+)$/.exec(location.hash);   // e.g. #f120 starts the replay at frame 120
  if (replay && jump) frame = Math.min(replay.frames.length - 1, parseInt(jump[1], 10));
  function render(s) {
    if (replay) s.replay = true;
    renderHeader(s); renderCrew(s.agents); renderStats(s); renderChart(s); renderSheet(s); renderBooks(s); syncWeb(s);
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
  window.addEventListener("resize", function () { resize(); if (spider) { spider.posed = false; spider.x = canvas.clientWidth / 2; spider.y = canvas.clientHeight / 2 + 6; } });
  tick();
  setInterval(tick, replay ? replay.interval || 1500 : 1500);
  requestAnimationFrame(draw);
})();
