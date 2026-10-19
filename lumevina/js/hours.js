/* Lumevina — Evelyn's hours
 *
 * One place that says when the studio is open. The booking calendar on
 * the website reads it, and the owner dashboard (Your calendar) edits it:
 *
 *   week    the usual hours for each weekday, or closed
 *   off     single dates she's away (a holiday, a trip, a sick day)
 *   extra   single dates she opens that are normally closed
 *   blocks  times blocked out inside an open day (an errand, a class)
 *
 * Times are minutes after midnight: 8:00 AM is 480, 6:00 PM is 1080.
 *
 * DEMO: saved in this browser (lumevina_hours), so the dashboard and the
 * website share it when both are opened on the same device. A change in
 * one tab reaches the other straight away.
 * LIVE: one availability row in Supabase (server/schema.sql), read by
 * the calendar and checked again when a deposit is taken.
 */
(function () {
  "use strict";

  var KEY = "lumevina_hours";

  /* the studio's usual week: Tuesday to Saturday, 8 to 6, lunch at noon */
  var STANDARD = { open: 480, close: 1080, lunch: 720, lunchEnd: 750 };
  var DEFAULT_WEEK = [null, null, STANDARD, STANDARD, STANDARD, STANDARD, STANDARD];
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  var copy = function (h) { return h ? { open: h.open, close: h.close, lunch: h.lunch, lunchEnd: h.lunchEnd } : null; };

  var valid = function (h) {
    return !!h && h.open >= 0 && h.close <= 1440 && h.close > h.open &&
      (h.lunch == null || (h.lunchEnd > h.lunch && h.lunch >= h.open && h.lunchEnd <= h.close));
  };

  var read = function () {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode */ }
    s = s && typeof s === "object" ? s : {};
    var week = Array.isArray(s.week) && s.week.length === 7
      ? s.week.map(function (h) { return valid(h) ? copy(h) : null; })
      : DEFAULT_WEEK.map(copy);
    return {
      week: week,
      off: s.off && typeof s.off === "object" ? s.off : {},
      extra: s.extra && typeof s.extra === "object" ? s.extra : {},
      blocks: s.blocks && typeof s.blocks === "object" ? s.blocks : {},
      at: s.at || null
    };
  };

  var listeners = [];
  var write = function (s) {
    s.at = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
    listeners.forEach(function (fn) { fn(); });
  };
  /* the dashboard in one tab, the website in another */
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) listeners.forEach(function (fn) { fn(); });
  });

  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var keyOf = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var dateOf = function (key) { var p = String(key).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var asDate = function (d) { return typeof d === "string" ? dateOf(d) : d; };

  /* the hours for one date, or null when closed */
  var hoursFor = function (d) {
    d = asDate(d);
    var s = read(), key = keyOf(d);
    if (s.off[key]) return null;
    if (valid(s.extra[key])) return copy(s.extra[key]);
    return copy(s.week[d.getDay()]);
  };

  /* is this date open because Evelyn opened it specially? */
  var isExtra = function (d) {
    d = asDate(d);
    var s = read(), key = keyOf(d);
    return !s.off[key] && valid(s.extra[key]) && !s.week[d.getDay()];
  };
  var isOff = function (d) { return !!read().off[keyOf(asDate(d))]; };

  /* blocked stretches inside an open day, as [start, end] pairs */
  var blocksFor = function (d) {
    var b = read().blocks[keyOf(asDate(d))];
    return Array.isArray(b) ? b.filter(function (x) { return x && x[1] > x[0]; }) : [];
  };

  var fmt = function (mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ":" + pad(m) + " " + (h >= 12 ? "PM" : "AM");
  };
  var fmtShort = function (mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h % 12 === 0 ? 12 : h % 12) + (m ? ":" + pad(m) : "") + (h >= 12 ? "pm" : "am");
  };
  var sameHours = function (a, b) {
    return !!a && !!b && a.open === b.open && a.close === b.close && a.lunch === b.lunch && a.lunchEnd === b.lunchEnd;
  };

  /* "Tue–Sat, 8:00 AM–6:00 PM · lunch 12:00–12:30", built from the week */
  var SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var runs = function (week) {
    /* group consecutive weekdays (Mon→Sun order) that share the same hours */
    var order = [1, 2, 3, 4, 5, 6, 0], out = [];
    order.forEach(function (i) {
      var h = week[i], last = out[out.length - 1];
      if (h && last && sameHours(last.h, h) && last.end === order[order.indexOf(i) - 1]) { last.end = i; return; }
      if (h) out.push({ start: i, end: i, h: h });
    });
    return out;
  };
  var summary = function () {
    var r = runs(read().week);
    if (!r.length) return "Closed for now";
    return r.map(function (x) {
      var days = x.start === x.end ? SHORT[x.start] : SHORT[x.start] + "–" + SHORT[x.end];
      var t = days + ", " + fmt(x.h.open) + "–" + fmt(x.h.close);
      if (x.h.lunch != null) t += " · lunch " + fmt(x.h.lunch).replace(/ [AP]M$/, "") + "–" + fmt(x.h.lunchEnd).replace(/ [AP]M$/, "");
      return t;
    }).join("; ");
  };
  /* "Tuesday to Saturday, 8:00 AM to 6:00 PM", for sentences */
  var prose = function () {
    var r = runs(read().week);
    if (!r.length) return "Closed for now";
    return r.map(function (x) {
      var days = x.start === x.end ? DAY_NAMES[x.start] : DAY_NAMES[x.start] + " to " + DAY_NAMES[x.end];
      return days + ", " + fmt(x.h.open) + " to " + fmt(x.h.close);
    }).join("; ");
  };
  /* "Closed Sundays and Mondays" */
  var closedLabel = function () {
    var w = read().week, shut = [];
    [1, 2, 3, 4, 5, 6, 0].forEach(function (i) { if (!w[i]) shut.push(DAY_NAMES[i] + "s"); });
    if (!shut.length) return "Open every day";
    return "Closed " + (shut.length === 1 ? shut[0] : shut.slice(0, -1).join(", ") + " and " + shut[shut.length - 1]);
  };

  /* ── edits, from the dashboard ── */
  var setWeekday = function (dow, h) {
    var s = read();
    s.week[dow] = h && valid(h) ? copy(h) : null;
    write(s);
  };
  var setOff = function (d, on) {
    var s = read(), key = keyOf(asDate(d));
    if (on) { s.off[key] = true; delete s.extra[key]; } else delete s.off[key];
    write(s);
  };
  var setExtra = function (d, h) {
    var s = read(), key = keyOf(asDate(d));
    delete s.off[key];
    if (h && valid(h)) s.extra[key] = copy(h); else delete s.extra[key];
    write(s);
  };
  var addBlock = function (d, start, end) {
    if (!(end > start)) return;
    var s = read(), key = keyOf(asDate(d));
    var list = Array.isArray(s.blocks[key]) ? s.blocks[key] : [];
    list.push([start, end]);
    list.sort(function (a, b) { return a[0] - b[0]; });
    s.blocks[key] = list;
    write(s);
  };
  var removeBlock = function (d, index) {
    var s = read(), key = keyOf(asDate(d));
    if (!Array.isArray(s.blocks[key])) return;
    s.blocks[key].splice(index, 1);
    if (!s.blocks[key].length) delete s.blocks[key];
    write(s);
  };
  var reset = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
    listeners.forEach(function (fn) { fn(); });
  };

  window.LumevinaHours = {
    STANDARD: copy(STANDARD), DAY_NAMES: DAY_NAMES,
    hoursFor: hoursFor, isExtra: isExtra, isOff: isOff, blocksFor: blocksFor,
    week: function () { return read().week; },
    summary: summary, prose: prose, closedLabel: closedLabel, fmt: fmt, fmtShort: fmtShort,
    setWeekday: setWeekday, setOff: setOff, setExtra: setExtra,
    addBlock: addBlock, removeBlock: removeBlock, reset: reset,
    keyOf: keyOf, dateOf: dateOf,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
