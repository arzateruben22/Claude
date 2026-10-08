/* Post Desk dashboard. Polls /api/state (or plays a recorded replay) and draws it. */
(() => {
  "use strict";
  const REPLAY = window.POST_DESK_REPLAY || null;
  const $ = (id) => document.getElementById(id);
  const meta = document.querySelector('meta[name="desk-token"]');
  const TOKEN = meta ? meta.content : "";
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = getComputedStyle(document.documentElement);
  const css = (v, d) => root.getPropertyValue(v).trim() || d;
  const PALETTE = ["--amber", "--mint", "--sky", "--coral", "--lilac", "--citron"].map((v) => css(v, "#8b8f99"));
  const COLOR = { quote: css("--paper", "#f2efe6"), repost: css("--grey", "#8b8f99") };
  let FORMATS = [];
  function setFormats(list) {            // your formats from desk.toml, each with its own color
    if (FORMATS.length) return;
    FORMATS = list.slice();
    FORMATS.forEach((f, i) => { COLOR[f] = PALETTE[i % PALETTE.length]; });
    legend();
  }
  const RED = css("--red", "#ff3b30");
  const fname = (f) => (f === "how_to" ? "how-to" : String(f || "").replace(/_/g, " "));
  const fcolor = (f) => COLOR[f] || COLOR.repost;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
  const short = (n) => {
    if (n == null) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(n);
  };
  const usd = (v) => "$" + Number(v || 0).toFixed(2);
  const ago = (m) => (m < 60 ? m + "m ago" : Math.floor(m / 60) + "h " + (m % 60) + "m ago");
  const xlen = (t) => t.replace(/https?:\/\/\S+|www\.\S+/gi, "x".repeat(23)).length;

  let S = null;
  const editing = new Set();

  // -- talking to the desk -------------------------------------------------------------------
  let toastTimer = 0;
  function toast(msg, bad) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast"; }, 3200);
  }
  function banner(text) {
    const b = $("banner");
    b.hidden = !text;
    b.textContent = text || "";
  }

  async function act(action, id, text, format) {
    if (REPLAY) { toast("This is a recording: the buttons are switched off."); return false; }
    try {
      const r = await fetch("api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Desk-Token": TOKEN },
        body: JSON.stringify({ action, id: id || "", text: text || "", format: format || "" }),
      });
      const data = await r.json().catch(() => ({ ok: false, message: "No answer from the desk." }));
      toast(data.message || (data.ok ? "Done." : "Didn't work."), !data.ok);
      pollOnce();
      return !!data.ok;
    } catch (e) {
      toast("Can't reach the desk. Is it still running?", true);
      return false;
    }
  }

  async function pollOnce() {
    try {
      const r = await fetch("api/state", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      render(await r.json());
      return true;
    } catch (e) {
      banner("Lost contact with the desk. Is it still running? (python -m postdesk run)");
      return false;
    }
  }
  async function poll() {
    await pollOnce();
    setTimeout(poll, 1000);
  }

  // -- status bar --------------------------------------------------------------------------------
  function status(s) {
    const pill = $("pill");
    pill.textContent = s.pill;
    pill.dataset.state = s.pill;
    const auto = s.approval === "auto_originals";
    const mode = $("mode");
    mode.textContent = auto ? "AUTO: CLEAN ORIGINALS" : "REVIEW: YOU APPROVE";
    mode.className = "mode" + (auto ? " auto" : "");
    const st = s.stats;
    $("s-handle").textContent = "@" + s.handle;
    $("s-fol").textContent = num(st.followers);
    const f7 = $("s-fol7");
    f7.textContent = (st.followers_7d >= 0 ? "+" : "") + num(st.followers_7d) + " 7d";
    f7.className = st.followers_7d < 0 ? "down" : "";
    $("s-views").textContent = short(st.views_7d);
    $("s-today").textContent = st.posts_today + " / " + st.slots_today;
    $("s-wait").textContent = st.waiting + (st.ready ? " · " + st.ready + " ready" : "");
    $("s-x").textContent = usd(st.x_today) + " / " + usd(st.x_cap);
    $("s-ai").textContent = usd(st.ai_today) + " / " + usd(st.ai_cap);
    $("clock").textContent = s.clock;
    $("date").textContent = s.date + " · " + s.tz + (s.mode === "demo" ? " · DEMO" : "");
    const pause = $("b-pause");
    pause.textContent = s.paused ? "Resume posting" : "Pause posting";
    pause.className = "btn" + (s.paused ? " air" : "");
    const w = $("writer");
    w.textContent = "Writer: " + s.writer + (s.writer_error ? " · " + s.writer_error : "");
    w.className = "writer" + (s.writer_error ? " err" : "");
    if (REPLAY) {
      banner("A recording of the demo: a made-up account, a made-up audience and sample posts. Nothing here was posted. " +
             "The buttons are switched off; run python -m postdesk run --demo to press them.");
    } else if (s.mode === "demo") {
      banner("Demo: a make-believe X account with an invented audience. Nothing is posted anywhere. A stand-in " +
             "reviewer decides on drafts you leave alone for two simulated hours.");
    } else {
      banner("");
    }
  }

  // -- the rundown strip ----------------------------------------------------------------------------
  function rundown(s) {
    const pct = (m) => (m / 1440 * 100).toFixed(3) + "%";
    const [a, b] = s.window;
    let html = `<div class="win" style="left:${pct(a)};width:${pct(b - a)}"></div>`;
    for (let h = 0; h <= 24; h += 3) {
      html += `<span class="tick" style="left:${pct(h * 60)}">${String(h % 24).padStart(2, "0")}</span>`;
    }
    s.rundown.forEach((r, i) => {
      const label = r.state === "done" ? fname(r.format || "") + (r.views ? " · " + short(r.views) : "")
        : r.state === "missed" ? "missed" : r.state === "open" ? "open now" : r.state === "next" ? "next" : "";
      const desc = `${r.at}, ${r.state}${r.text ? ": " + r.text : ""}`;
      html += `<div class="slot ${r.state}${i % 2 ? " alt" : ""}" role="listitem" style="left:${pct(r.min)};--fc:${fcolor(r.format)}"
        title="${esc(desc)}" aria-label="${esc(desc)}"><i></i><span>${esc(r.at)}</span><em>${esc(label)}</em></div>`;
    });
    html += `<div class="now" style="left:${pct(s.minute)}" aria-hidden="true"></div>`;
    $("strip").innerHTML = html;
    const done = s.rundown.filter((r) => r.state === "done").length;
    const missed = s.rundown.filter((r) => r.state === "missed").length;
    $("rundown-note").textContent = `${s.rundown.length} slots · ${done} posted` + (missed ? ` · ${missed} missed` : "") +
      ` · window ${String(Math.floor(a / 60)).padStart(2, "0")}:00–${String(Math.floor(b / 60)).padStart(2, "0")}:00`;
  }

  function nextUp(s) {
    const t = $("next-t"), sub = $("next-s");
    if (!s.next) {
      t.textContent = s.paused ? "PAUSED" : "DONE";
      sub.textContent = s.paused ? "Posting is paused." : "No more slots today.";
      sub.className = "next-s";
      return;
    }
    t.textContent = s.next.at;
    const when = s.next.in_min <= 0 ? "open now" : s.next.in_min < 60 ? `in ${s.next.in_min} min`
      : `in ${Math.floor(s.next.in_min / 60)}h ${s.next.in_min % 60}m`;
    if (s.paused) {
      sub.textContent = when + " · paused";
      sub.className = "next-s warn";
    } else if (s.next.ready) {
      sub.textContent = when + " · " + s.stats.ready + " approved, ready";
      sub.className = "next-s";
    } else {
      sub.textContent = when + " · nothing approved yet";
      sub.className = "next-s warn";
    }
  }

  // -- the airtime wheel --------------------------------------------------------------------------
  const cv = $("wheel");
  const ctx = cv.getContext("2d");
  let hand = null;
  function drawWheel(t) {
    const s = S;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = cv.getBoundingClientRect();
    const W = Math.max(200, Math.round(box.width)), H = W;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!s) return;
    const cx = W / 2, cy = H / 2, R = W / 2 - 22, r0 = R * 0.44;
    const ang = (m) => -Math.PI / 2 + (m / 1440) * Math.PI * 2;

    // active window band
    const [a, b] = s.window;
    ctx.lineWidth = R - r0;
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.arc(cx, cy, (R + r0) / 2, ang(a), ang(b));
    ctx.stroke();

    // rings and hour ticks
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#2a2e37";
    [r0, R].forEach((rr) => { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = "#7d7a72";
    ctx.font = `500 ${Math.max(10, W / 48)}px "DM Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let h = 0; h < 24; h++) {
      const g = ang(h * 60), major = h % 6 === 0;
      ctx.strokeStyle = major ? "#5a5f6b" : "#2f333c";
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(g) * (R + 2), cy + Math.sin(g) * (R + 2));
      ctx.lineTo(cx + Math.cos(g) * (R + (major ? 9 : 5)), cy + Math.sin(g) * (R + (major ? 9 : 5)));
      ctx.stroke();
      if (major) ctx.fillText(String(h).padStart(2, "0"), cx + Math.cos(g) * (R + 17), cy + Math.sin(g) * (R + 17));
    }

    // posts from the last 7 days: angle = time of day, length = views
    const maxV = Math.max(1, ...s.wheel.map((p) => p.v));
    const span = R - r0 - 8;
    s.wheel.slice().sort((p, q) => q.age - p.age).forEach((p) => {
      const g = ang(p.m), len = 4 + Math.sqrt(p.v / maxV) * span;
      ctx.globalAlpha = Math.max(0.22, 1 - p.age / 7.5);
      ctx.strokeStyle = fcolor(p.f);
      ctx.lineWidth = Math.max(2, W / 150);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(g) * (r0 + 4), cy + Math.sin(g) * (r0 + 4));
      ctx.lineTo(cx + Math.cos(g) * (r0 + 4 + len), cy + Math.sin(g) * (r0 + 4 + len));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";

    // today's slots on the rim
    const pulse = REDUCE ? 0.5 : (Math.sin(t / 260) + 1) / 2;
    s.rundown.forEach((r) => {
      const g = ang(r.min), x = cx + Math.cos(g) * R, y = cy + Math.sin(g) * R;
      ctx.beginPath();
      ctx.arc(x, y, r.state === "next" || r.state === "open" ? 6 : 4.5, 0, Math.PI * 2);
      if (r.state === "done") { ctx.fillStyle = fcolor(r.format); ctx.fill(); }
      else if (r.state === "next" || r.state === "open") {
        ctx.fillStyle = RED; ctx.fill();
        ctx.strokeStyle = `rgba(255,59,48,${0.5 - pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 9 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      } else if (r.state === "missed") { ctx.strokeStyle = "#7d7a72"; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = "#0c0d10"; ctx.fill(); ctx.strokeStyle = "#aaa59a"; ctx.lineWidth = 1.5; ctx.stroke(); }
    });

    // the clock hand, eased so demo time doesn't jump
    let target = s.minute;
    if (hand == null || Math.abs(target - hand) > 240 && Math.abs(target - hand) < 1200) hand = target;
    let d = target - hand;
    if (d > 720) d -= 1440;
    if (d < -720) d += 1440;
    hand = (hand + d * (REDUCE ? 1 : 0.12) + 1440) % 1440;
    const g = ang(hand);
    ctx.shadowColor = RED;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(g) * (r0 - 2), cy + Math.sin(g) * (r0 - 2));
    ctx.lineTo(cx + Math.cos(g) * (R + 8), cy + Math.sin(g) * (R + 8));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(cx + Math.cos(g) * (R + 8), cy + Math.sin(g) * (R + 8), 3, 0, Math.PI * 2); ctx.fill();
  }
  function loop(t) {
    drawWheel(t);
    requestAnimationFrame(loop);
  }

  function legend() {
    $("legend").innerHTML = FORMATS.concat(["quote"])
      .map((f) => `<li style="--c:${fcolor(f)}">${esc(fname(f))}</li>`).join("");
  }

  // -- the approval queue -----------------------------------------------------------------------------
  const STATUS = { queued: "WAITING", approved: "APPROVED", blocked: "STOPPED" };
  function byline(d) {
    const who = { claude: "Claude", sample: "sample post", you: "you", scout: "scout" }[d.by] ||
      (d.by.endsWith("+you") ? ({ claude: "Claude", sample: "sample" }[d.by.split("+")[0]] || d.by.split("+")[0]) + ", edited by you" : d.by);
    const dec = d.status === "approved" && d.decided_by
      ? (d.decided_by === "auto" ? " · cleared by the rules" : d.decided_by === "you" ? "" : " · " + d.decided_by) : "";
    return "by " + who + dec;
  }
  function cardKey(d) {
    return JSON.stringify([d.status, d.text, d.checks, d.decided_by, Math.floor(d.age_min / 10)]);
  }
  function cardHTML(d) {
    const fc = fcolor(d.kind === "original" ? d.format : d.kind);
    const label = d.kind === "original" ? fname(d.format) : d.kind;
    const isEdit = editing.has(d.id);
    let target = "";
    if (d.kind !== "original") {
      target = `<div class="target"><b>${d.kind === "quote" ? "Quoting" : "Reposting"} @${esc(d.target_author || "someone")}</b>
        <br>${esc(d.target_text)}</div>`;
    }
    const body = d.kind === "repost" ? "" : isEdit
      ? `<label class="sr" for="e-${esc(d.id)}">Edit the draft</label><textarea id="e-${esc(d.id)}" rows="4" data-edit="${esc(d.id)}">${esc(d.text)}</textarea>`
      : `<p class="text">${esc(d.text)}</p>`;
    const checks = d.checks.length
      ? `<ul class="checks">${d.checks.map((c) => `<li class="${esc(c.level)}">${esc(c.rule)}${c.note ? ": " + esc(c.note) : ""}</li>`).join("")}</ul>` : "";
    const why = d.why ? `<p class="why">${esc(d.why)}</p>` : "";
    const src = d.source_url ? ` · <a href="${esc(d.source_url)}" target="_blank" rel="noopener noreferrer">source</a>` : "";
    let buttons = "";
    if (isEdit) {
      buttons = `<button type="button" class="btn go" data-act="save-approve">Save &amp; approve</button>
        <button type="button" class="btn ghost" data-act="save">Save</button>
        <button type="button" class="btn ghost" data-act="cancel">Cancel</button>`;
    } else if (d.status === "queued") {
      buttons = `<button type="button" class="btn go" data-act="approve">Approve</button>` +
        (d.kind !== "repost" ? `<button type="button" class="btn ghost" data-act="edit">Edit</button>` : "") +
        `<button type="button" class="btn ghost" data-act="post_now">Post now</button>
        <button type="button" class="btn red" data-act="reject">Reject</button>`;
    } else if (d.status === "approved") {
      buttons = `<button type="button" class="btn ghost" data-act="post_now">Post now</button>` +
        (d.kind !== "repost" ? `<button type="button" class="btn ghost" data-act="edit">Edit</button>` : "") +
        `<button type="button" class="btn red" data-act="reject">Pull it</button>`;
    } else {
      buttons = (d.kind !== "repost" ? `<button type="button" class="btn ghost" data-act="edit">Fix it</button>` : "") +
        `<button type="button" class="btn red" data-act="reject">Dismiss</button>`;
    }
    const chars = d.kind === "repost" ? "" : `<span>${d.chars} chars</span>`;
    return `<div class="meta"><span class="chip">${esc(label)}</span><span>${esc(byline(d))}</span>
      <span>${ago(d.age_min)}</span>${chars}<span class="status ${esc(d.status)}">${STATUS[d.status] || esc(d.status)}</span></div>
      ${target}${body}${why}${checks}<div class="actions">${buttons}</div>
      ${src ? `<p class="why" style="font-style:normal">idea from a headline${src}</p>` : ""}`;
  }
  const cardEls = new Map();
  function queue(s) {
    const list = $("cards");
    const seen = new Set();
    let prev = null;
    s.queue.forEach((d) => {
      seen.add(d.id);
      let li = cardEls.get(d.id);
      const key = cardKey(d) + (editing.has(d.id) ? "e" : "");
      if (!li) {
        li = document.createElement("li");
        li.dataset.id = d.id;
        cardEls.set(d.id, li);
      }
      if (li.dataset.key !== key && !(editing.has(d.id) && li.querySelector("textarea"))) {
        li.innerHTML = cardHTML(d);
        li.dataset.key = key;
      }
      li.className = "card " + d.status;
      li.style.setProperty("--fc", fcolor(d.kind === "original" ? d.format : d.kind));
      li.dataset.kind = d.kind;
      const want = prev ? prev.nextSibling : list.firstChild;
      if (want !== li && !li.contains(document.activeElement)) list.insertBefore(li, want);
      prev = li;
    });
    cardEls.forEach((li, id) => {
      if (!seen.has(id)) { li.remove(); cardEls.delete(id); editing.delete(id); }
    });
    let empty = list.querySelector(".empty");
    if (!s.queue.length && !empty) {
      empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Nothing waiting. The writer tops the queue up on its own, or press Write more drafts.";
      list.appendChild(empty);
    } else if (s.queue.length && empty) {
      empty.remove();
    }
    const st = s.stats;
    $("queue-note").textContent = `${st.waiting} waiting · ${st.ready} approved` +
      (s.approval === "auto_originals" ? " · clean originals clear themselves; quotes always wait for you" : " · nothing posts without you");
  }

  $("cards").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const li = btn.closest("li.card");
    const id = li.dataset.id;
    const what = btn.dataset.act;
    if (what === "edit") { editing.add(id); li.dataset.key = ""; if (S) queue(S); const ta = li.querySelector("textarea"); if (ta) ta.focus(); return; }
    if (what === "cancel") { editing.delete(id); li.dataset.key = ""; if (S) queue(S); return; }
    const ta = li.querySelector("textarea");
    const text = ta ? ta.value : "";
    if (what === "post_now" && S && S.mode === "live" && !window.confirm("Post this to X right now?")) return;
    btn.disabled = true;
    const action = what === "save" ? "edit" : what === "save-approve" ? "approve" : what;
    const ok = await act(action, id, text);
    btn.disabled = false;
    if (ok && (what === "save" || what === "save-approve")) { editing.delete(id); li.dataset.key = ""; }
  });

  // -- compose -------------------------------------------------------------------------------------------
  function counter() {
    const n = xlen($("c-text").value);
    const c = $("c-count");
    c.textContent = n + " / 280";
    c.className = "count" + (n > 280 ? " over" : "");
  }
  $("c-text").addEventListener("input", counter);
  $("compose").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("c-text").value.trim();
    if (!text) { toast("Write something first.", true); return; }
    if (await act("add", "", text, $("c-fmt").value)) { $("c-text").value = ""; counter(); }
  });
  let fmtsDone = false;
  function formatsSelect(s) {
    if (fmtsDone) return;
    $("c-fmt").innerHTML = s.formats_allowed.map((f) => `<option value="${esc(f)}">${esc(fname(f))}</option>`).join("");
    fmtsDone = true;
  }
  $("b-pause").addEventListener("click", () => act(S && S.paused ? "resume" : "pause"));
  $("b-write").addEventListener("click", () => act("write"));
  $("b-scout").addEventListener("click", () => act("scout"));

  // -- panels ----------------------------------------------------------------------------------------------
  function log(s) {
    $("log").innerHTML = s.log.map((e) => `<li class="k-${esc(e.kind)}"><time>${esc(e.at)}</time><span>${esc(e.text)}</span></li>`).join("")
      || `<li><time></time><span>Starting up…</span></li>`;
  }
  function scout(s) {
    $("scout").innerHTML = s.scout.map((x) => {
      const src = x.source === "x" ? `<b>X</b> ${x.author ? "@" + esc(x.author) : "author not looked up (saves money)"}` : `<b>RSS</b> headline`;
      const heat = x.source === "x" ? `<span class="heat">♥ ${short(x.likes)}</span>` : "";
      const link = x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">open</a>` : "";
      return `<li><div class="src">${src}${heat}</div>${esc(x.text)}${link}</li>`;
    }).join("") || `<li class="empty">Nothing yet. The scout runs every few hours.</li>`;
  }
  function formats(s) {
    const rows = s.formats;
    if (!rows.length) {
      $("formats").innerHTML = `<p class="note">Not enough posts a day old yet. Each format needs three before it's compared.</p>`;
      return;
    }
    const top = Math.max(2, ...rows.map((r) => r.factor));
    $("formats").innerHTML = `<div class="bars">${rows.map((r) => `
      <div class="row" style="--fc:${fcolor(r.format)}"><span>${esc(fname(r.format))}</span>
        <span class="track" role="img" aria-label="${esc(fname(r.format))}: ${r.factor} times typical reach, ${r.n} posts">
          <span class="fill" style="width:${(r.factor / top * 100).toFixed(1)}%"></span>
          <span class="one" style="left:${(1 / top * 100).toFixed(1)}%"></span></span>
        <span class="val">${r.factor.toFixed(1)}× <small>n${r.n}</small></span></div>`).join("")}</div>
      <p class="note">Dashed line = your typical post. Reach is views per follower, so growth doesn't flatter later posts. ` +
      `Formats with fewer than 3 posts are guesses.</p>`;
  }
  function hours(s) {
    const scored = s.hours.filter((h) => h.n >= 3).sort((p, q) => q.factor - p.factor);
    const best = new Set(scored.slice(0, 3).map((h) => h.hour));
    const top = Math.max(1.5, ...s.hours.map((h) => h.factor || 0));
    $("hours").innerHTML = `<div class="hours">${s.hours.map((h) => {
      const ht = h.factor == null ? 3 : Math.max(4, h.factor / top * 100);
      const cls = h.factor == null ? "" : best.has(h.hour) ? "best" : h.factor >= 1 ? "good" : "ok";
      const lbl = h.hour % 2 === 0 ? String(h.hour).padStart(2, "0") : "";
      const tip = h.factor == null ? `${h.hour}:00, no posts yet` : `${h.hour}:00, ${h.factor}× typical reach, ${h.n} posts`;
      return `<div class="h-col" title="${tip}"><div class="h-bar ${cls}" style="height:${ht.toFixed(0)}%" role="img" aria-label="${tip}"></div><span class="h-lbl">${lbl}</span></div>`;
    }).join("")}</div>
      <p class="note">${scored.length >= 4 ? "Red = your three best hours (3+ posts each). Most slots go there; the rest keep testing."
        : "Still learning: slots are spread out until four hours have 3+ posts each."}</p>`;
  }
  function growth(s) {
    const F = s.growth.followers, V = s.growth.views_by_day;
    const W = 320, H1 = 92, H2 = 70;
    let svg = "";
    if (F.length >= 2) {
      const t0 = F[0][0], t1 = F[F.length - 1][0] || t0 + 1;
      const lo = Math.min(...F.map((p) => p[1])), hi = Math.max(...F.map((p) => p[1]));
      const span = Math.max(1, hi - lo);
      const pts = F.map((p) => [((p[0] - t0) / Math.max(1, t1 - t0)) * (W - 8) + 4, H1 - 14 - ((p[1] - lo) / span) * (H1 - 30)]);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      svg += `<svg viewBox="0 0 ${W} ${H1}" width="100%" role="img" aria-label="Followers went from ${lo} to ${F[F.length - 1][1]}">
        <path d="${d} L ${pts[pts.length - 1][0]} ${H1 - 12} L 4 ${H1 - 12} Z" fill="rgba(70,211,154,.10)"/>
        <path d="${d}" fill="none" stroke="#46d39a" stroke-width="2"/>
        <text x="4" y="11" fill="#aaa59a" font-size="10">followers ${num(F[0][1])} → ${num(F[F.length - 1][1])}</text>
        <text x="${W - 4}" y="${H1 - 1}" fill="#7d7a72" font-size="9" text-anchor="end">last 30 days</text></svg>`;
    } else {
      svg += `<p class="note">Follower counts arrive every few hours.</p>`;
    }
    if (V.length) {
      const top = Math.max(1, ...V.map((v) => v[1]));
      const bw = (W - 8) / V.length;
      svg += `<svg viewBox="0 0 ${W} ${H2}" width="100%" role="img" aria-label="Views per day, last ${V.length} days">` +
        V.map((v, i) => {
          const h = (v[1] / top) * (H2 - 24);
          return `<rect x="${(4 + i * bw + 1).toFixed(1)}" y="${(H2 - 12 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="1.5" fill="${i === V.length - 1 ? "#ff3b30" : "#4cc2ff"}" opacity="${i === V.length - 1 ? 1 : 0.75}"><title>${v[0]}: ${num(v[1])} views</title></rect>`;
        }).join("") +
        `<text x="4" y="10" fill="#aaa59a" font-size="10">views of each day's posts · best ${short(top)}</text>
         <text x="${W - 4}" y="${H2 - 1}" fill="#7d7a72" font-size="9" text-anchor="end">today in red</text></svg>`;
    }
    const k = s.kit;
    svg += `<p class="note">Media kit, 30 days: ${num(k.posts_30d)} posts · ${short(k.views_30d)} views · ~${short(k.median_views)} per post · ` +
      `${(k.eng_rate * 100).toFixed(1)}% engagement${k.best_format ? " · best: " + esc(fname(k.best_format)) : ""}</p>`;
    $("growth").innerHTML = svg;
  }
  function meter(label, val, cap, fmt, cls) {
    const p = Math.max(0, Math.min(100, (val / Math.max(cap, 1e-9)) * 100));
    return `<div class="meter"><div class="meter-h"><span>${label}</span><b>${fmt(val)} / ${fmt(cap)}</b></div>
      <div class="track" role="img" aria-label="${label}: ${p.toFixed(0)} percent"><div class="fill ${cls || ""}" style="width:${p.toFixed(1)}%"></div></div></div>`;
  }
  function moneyPanel(s) {
    const m = s.money, st = s.stats;
    const heat = (v, c) => (v / c > 0.9 ? "red" : v / c > 0.6 ? "amber" : "");
    const net = m.net_30d;
    $("money").innerHTML = `<div class="money">
      ${meter("Verified followers", m.verified_followers, m.need_verified, num)}
      ${meter("Views, last 90 days", m.views_90d, m.need_views, short)}
      <p class="note" style="margin:-4px 0 10px">${m.premium ? "Premium: on." : "Premium: OFF (needed for payouts)."}
        ${m.pace_90d ? " At this week's pace, ~" + short(m.pace_90d) + " views per 90 days (arithmetic, not a forecast)." : ""}
        ${m.eligible ? " <b style='color:#46d39a'>Meets the thresholds you set.</b>" : ""}</p>
      ${meter("X spend today", st.x_today, st.x_cap, usd, heat(st.x_today, st.x_cap))}
      ${meter("Reading budget today", st.reads_today, st.reads_cap, usd, heat(st.reads_today, st.reads_cap))}
      ${meter("Claude today", st.ai_today, st.ai_cap, usd, heat(st.ai_today, st.ai_cap))}
      ${meter("X spend this month", st.x_month, st.x_month_cap, usd, heat(st.x_month, st.x_month_cap))}
      <div class="grid"><div><span>Earned 30d</span><b>${usd(m.earned_30d)}</b></div>
        <div><span>Spent 30d</span><b>${usd(m.spent_30d)}</b></div>
        <div><span>Net</span><b class="${net < 0 ? "neg" : "pos"}">${net < 0 ? "−" : "+"}${usd(Math.abs(net))}</b></div></div>
      <p class="note">Log income with <code>python -m postdesk earned 25 --source sponsor</code>. Payout rules change: check Creator Studio.</p></div>`;
  }
  function reviewPanel(s) {
    const r = s.lessons;
    if (!r) {
      $("rv-by").textContent = "";
      $("rv-lessons").innerHTML = `<li>The first review runs after tonight's last slot.</li>`;
      $("rv-prop").innerHTML = `<b class="k">PROPOSAL</b>At most one suggested change a day. It's never applied for you.`;
      return;
    }
    $("rv-by").textContent = "by " + r.by + (r.note ? " · " + r.note : "");
    $("rv-lessons").innerHTML = r.lessons.map((l) => `<li>${esc(l)}</li>`).join("") +
      (r.writer_notes && r.writer_notes.length ? r.writer_notes.map((l) => `<li><i>For the writer:</i> ${esc(l)}</li>`).join("") : "");
    const p = r.proposal;
    const show = (v) => esc(Array.isArray(v) ? v.join(", ") : v);
    $("rv-prop").innerHTML = p
      ? `<b class="k">PROPOSAL · NOT APPLIED</b><code>${esc(p.setting)}</code><br>${show(p.from)} → <b>${show(p.to)}</b>
         <p style="margin:8px 0 0">${esc(p.why)}</p><p class="note">Edit desk.toml if you agree, then restart the desk.</p>`
      : `<b class="k">PROPOSAL</b>None today. The desk only suggests a change when the numbers clearly back it.`;
  }
  function posted(s) {
    $("posted").innerHTML = s.posted.map((p) => {
      const f = p.kind === "original" ? p.format : p.kind;
      const label = p.kind === "repost" ? "repost of @" + p.target_author : p.kind === "quote" ? "quote of @" + p.target_author : fname(p.format);
      const views = p.kind === "repost" ? "a repost: the views are theirs"
        : p.views == null ? "numbers in a few hours" : `${num(p.views)} views · ${num(p.eng)} engagements`;
      const link = p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">open</a>` : "";
      return `<li style="--fc:${fcolor(f)}"><div class="pm"><span>${esc(label)}</span><span>${esc(p.at)}</span></div>
        <p class="pt">${esc(p.text)}</p><div class="pv">${views}${link}</div></li>`;
    }).join("") || `<li class="empty">Nothing posted yet.</li>`;
  }

  // -- everything -----------------------------------------------------------------------------------------
  function render(s) {
    S = s;
    setFormats(s.formats_allowed);
    status(s);
    rundown(s);
    nextUp(s);
    formatsSelect(s);
    queue(s);
    log(s);
    scout(s);
    formats(s);
    hours(s);
    growth(s);
    moneyPanel(s);
    reviewPanel(s);
    posted(s);
    if (REDUCE) drawWheel(0);
  }

  counter();
  if (REDUCE) window.addEventListener("resize", () => drawWheel(0));
  else requestAnimationFrame(loop);

  if (REPLAY) {
    const frames = REPLAY.frames;
    for (let i = 1; i < frames.length; i++) {
      for (const k of REPLAY.carry || []) if (!(k in frames[i])) frames[i][k] = frames[i - 1][k];
    }
    let i = 0;
    document.querySelectorAll("button, textarea, select").forEach((el) => { el.disabled = true; });
    const tick = () => { render(frames[i]); i = (i + 1) % frames.length; };
    tick();
    setInterval(tick, REPLAY.interval || 700);
  } else {
    poll();
  }
})();
