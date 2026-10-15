// SoCal Timesheet — UI, storage, export, print.
// Plain ES module. The rules engine (./rules.js) does all labor-code math;
// this file only gathers input, renders results and moves documents around.

// ---------------------------------------------------------------------------
// Rules engine (loaded first; a broken engine degrades to a visible error
// instead of a blank page).
// ---------------------------------------------------------------------------
const rules = await (async () => {
  try {
    return await import('./rules.js');
  } catch (e) {
    const msg = 'Rules engine failed to load: ' + (e && e.message ? e.message : e);
    const fail = () => { throw new Error(msg); };
    return { evaluateShift: fail, validateOdometer: () => ({ miles: null, flags: [] }), validateEA: () => [], FLAG_CODES: {} };
  }
})();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROSTER = [
  'Aleksey Souglobov', 'Fernando Carranza', 'Alberto Pineda-Gonzalez', 'Eriberto Aragon',
  'Rigoberto Arroyo', 'Carlos Viramontes', 'Steven Chang', 'Eduardo Gomez',
];
const PROJECTS = {
  '105-Express': { label: '105 Express', ea: '07-314524', taskOrder: false,
    groups: [['Field (23-0454.12)', 'Field (23-0454.12)'], ['Lab (23-0454.00)', 'Lab (23-0454.00)']] },
  'D8': { label: 'District 8', ea: '', taskOrder: true, groups: [['1', '1 Field'], ['2', '2 Plant']] },
  'CTC': { label: 'CTC', ea: '', taskOrder: false, groups: [['Field', 'Field'], ['Lab', 'Lab'], ['Plant', 'Plant']] },
};
const TIER_CODES = ['PW Regular', 'PW 1.5 OT', 'PW 2.0 DT', 'PWSS Regular', 'PWSS 1.5 OT', 'PWSS 2.0 DT'];
const RATE_CODES = TIER_CODES.concat(['Non-PW']);
const STATUS_LABEL = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', kicked_back: 'Kicked back' };
const SEV_LABEL = { error: 'Error', warn: 'Warning', info: 'Info', ruling: 'Pending QC ruling' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LS_KEY = 'socal-timesheet-v1';
const LS_RATES = 'socal-timesheet-rates-v1';
const LS_VEHICLE = 'socal-timesheet-vehicle-v1';
const SCREENS = ['entry', 'review', 'rules'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
function hm(min) { min = Math.max(0, Math.round(Number(min) || 0)); return Math.floor(min / 60) + ':' + pad2(min % 60); }
function hours2(min) { return (Math.round(Number(min) || 0) / 60).toFixed(2); }
function tierHours(t) { return typeof t.hours === 'number' && Number.isFinite(t.hours) ? t.hours.toFixed(2) : hours2(t.minutes); }
function sumT(tiers) { return (tiers || []).reduce((s, t) => s + (Number(t.minutes) || 0), 0); }
function toMin(hhmm) { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function clock12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); if (!m) return hhmm || '';
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap;
}
function parseHM(str) {
  // "2:30" | "2" | "2.5" | "2h 30m" | "150m" -> minutes. null when blank, NaN when unreadable.
  const s = String(str || '').trim(); if (!s) return null;
  let m = /^(\d{1,3}):([0-5]?\d)$/.exec(s); if (m) return (+m[1]) * 60 + (+m[2]);
  m = /^(\d{1,3})(?:\.(\d+))?$/.exec(s); if (m) return Math.round(parseFloat(s) * 60);
  m = /^(\d{1,3})\s*h(?:\s*(\d{1,2})\s*m?)?$/i.exec(s); if (m) return (+m[1]) * 60 + (+(m[2] || 0));
  m = /^(\d{1,4})\s*m(?:in)?$/i.exec(s); if (m) return +m[1];
  return NaN;
}
function ymdParts(ymd) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? [+m[1], +m[2], +m[3]] : null; }
function dowOf(ymd) { const p = ymdParts(ymd); return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : null; }
function shiftDate(ymd, days) { const p = ymdParts(ymd); if (!p) return null; return new Date(Date.UTC(p[0], p[1] - 1, p[2] + days)).toISOString().slice(0, 10); }
function fmtDate(ymd) { const d = dowOf(ymd); return d == null ? (ymd || '') : DOW[d] + ' ' + ymd; }
function shortDate(ymd) { const p = ymdParts(ymd); return p ? p[1] + '/' + p[2] : (ymd || ''); }
function todayYMD() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function normName(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function numOrNull(v) { const s = String(v == null ? '' : v).trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
function money(n) { try { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); } catch (e) { return '$' + n.toFixed(2); } }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function flagsOf(r) { return Array.isArray(r) ? r : (r && Array.isArray(r.flags)) ? r.flags : []; }
function projLabel(p) { return PROJECTS[p] ? PROJECTS[p].label : (p || ''); }
function localStamp(iso) { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return String(iso); try { return d.toLocaleString(); } catch (e) { return String(iso); } }
function randId() {
  try { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
  catch (e) { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }
}
function makeId(doc) { return 'ts_' + (doc.date || 'nodate') + '_' + (slug(doc.inspector) || 'unknown') + '_' + randId(); }
function statusChip(s) { return '<span class="chip chip-status-' + esc(s) + '">' + esc(STATUS_LABEL[s] || s || '') + '</span>'; }
function sevChipClass(sev) { return sev === 'ruling' ? 'chip-ruling' : sev === 'error' ? 'chip-err' : sev === 'warn' ? 'chip-warn' : 'chip-info'; }
function setMsg(id, text, cls) { const el = $(id); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' status-' + cls : ''); }
function setModeNote(text) { const el = $('mode-note'); if (el) el.textContent = text; }
function whereText(mode) {
  return mode === 'shared' ? 'Saved to the shared database.' : mode === 'local' ? 'Saved in this browser.' : 'Kept in memory for this visit only.';
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  mode: 'memory',            // 'shared' | 'local' | 'memory'
  db: null, user: null, meId: null, readOnly: false,
  entries: {},               // id -> doc
  rates: {},                 // project -> {project, period, byInspector}
  storeAnswered: false,
  ready: null,
  editingId: null,
  eaAuto: true,
  priorManual: false,
  ledger: { minutes: 0, lines: [] },
  last: null,                // {doc, ev, blocked, reason}
  selectedId: null,
  detailMsg: null,
  ratesDraft: {},            // project -> {period, byInspector(strings)} while unsaved
  ratesExtraNames: [],
};

const RESULTS_EMPTY = $('results').innerHTML;
const REVIEW_EMPTY = $('review-list').innerHTML;

// ---------------------------------------------------------------------------
// Routing (hash deep-links)
// ---------------------------------------------------------------------------
function route(focus) {
  const raw = (location.hash || '').replace(/^#/, '');
  const parts = raw.split('/');
  const name = parts[0];
  const arg = parts.slice(1).join('/');
  const screen = SCREENS.includes(name) ? name : 'entry';
  for (const s of SCREENS) {
    $(s).classList.toggle('is-active', s === screen);
    const tab = $('tab-' + s);
    if (s === screen) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }
  if (name !== screen) { try { history.replaceState(null, '', '#' + screen); } catch (e) { /* ignore */ } }
  if (screen === 'review') {
    if (arg) { let id = arg; try { id = decodeURIComponent(arg); } catch (e) { /* keep raw */ } openDetail(id, focus); }
    else closeDetail();
  }
  if (screen === 'rules') renderRatesTable();
  if (focus && !(screen === 'review' && arg)) { try { $(screen).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}

// ---------------------------------------------------------------------------
// Entry form: project, inspector, blocks
// ---------------------------------------------------------------------------
function currentInspector() {
  const sel = $('f-inspector').value;
  return sel === '__other__' ? $('f-inspector-other').value.trim() : sel;
}
function toggleOther() {
  const other = $('f-inspector').value === '__other__';
  $('f-inspector-other-wrap').hidden = !other;
}
function applyProject() {
  const p = PROJECTS[$('f-project').value] || PROJECTS['105-Express'];
  $('f-task-order-wrap').hidden = !p.taskOrder;
  const g = $('f-group');
  const prev = g.value;
  g.innerHTML = p.groups.map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join('');
  if (Array.from(g.options).some((o) => o.value === prev)) g.value = prev;
  const ea = $('f-ea');
  if (state.eaAuto || !ea.value.trim()) { ea.value = p.ea; state.eaAuto = true; }
}
function ensureGroupOption(value) {
  const g = $('f-group');
  if (!value) return;
  if (!Array.from(g.options).some((o) => o.value === value)) {
    const o = document.createElement('option'); o.value = value; o.textContent = value; g.appendChild(o);
  }
  g.value = value;
}

function readBlockRow(row) {
  const b = {};
  for (const el of row.querySelectorAll('[data-k]')) b[el.dataset.k] = (el.value || '').trim();
  if (!b.category) b.category = 'work';
  return b;
}
function addBlock(data, focus) {
  const node = $('tpl-block').content.firstElementChild.cloneNode(true);
  if (data) {
    for (const el of node.querySelectorAll('[data-k]')) {
      const k = el.dataset.k;
      el.value = data[k] != null ? String(data[k]) : (k === 'category' ? 'work' : '');
    }
  }
  $('blocks').appendChild(node);
  reindexBlocks();
  if (focus) { const s = node.querySelector('[data-k="start"]'); if (s) s.focus(); }
  return node;
}
function reindexBlocks() {
  const rows = Array.from($('blocks').querySelectorAll('.block-row'));
  rows.forEach((row, i) => {
    row.querySelector('.block-n').textContent = String(i + 1);
    for (const el of row.querySelectorAll('[data-k]')) {
      const id = 'b-' + el.dataset.k.toLowerCase() + '-' + i;
      el.id = id;
      const field = el.closest('.field');
      const lab = field ? field.querySelector('label') : null;
      if (lab) lab.htmlFor = id;
    }
    row.querySelector('[data-act="dup"]').id = 'b-dup-' + i;
    row.querySelector('[data-act="rm"]').id = 'b-rm-' + i;
  });
  $('blocks-empty').hidden = rows.length > 0;
}

// ---------------------------------------------------------------------------
// Read the form into a document
// ---------------------------------------------------------------------------
function readForm() {
  const inspector = currentInspector();
  const rows = Array.from($('blocks').querySelectorAll('.block-row'));
  const blocks = [];
  let incomplete = 0;
  rows.forEach((row) => {
    const b = readBlockRow(row);
    const ok = toMin(b.start) != null && toMin(b.stop) != null;
    row.classList.toggle('is-incomplete', !ok && !!(b.start || b.stop || b.jobRef || b.note));
    if (ok) {
      const blk = { category: b.category, start: b.start.slice(0, 5), stop: b.stop.slice(0, 5) };
      if (b.jobRef) blk.jobRef = b.jobRef;
      if (b.note) blk.note = b.note;
      blocks.push(blk);
    } else {
      incomplete++;
    }
  });
  const priorRaw = $('f-prior').value;
  const priorParsed = parseHM(priorRaw);
  const project = PROJECTS[$('f-project').value] ? $('f-project').value : '105-Express';
  const doc = {
    inspector,
    enteredBy: $('f-entered-by').value.trim(),
    date: $('f-date').value,
    project,
    ea: $('f-ea').value.trim(),
    taskOrder: project === 'D8' ? $('f-task-order').value.trim() : '',
    group: $('f-group').value,
    priorMinutes: Number.isFinite(priorParsed) ? priorParsed : 0,
    priorMinutesManual: !!state.priorManual,
    priorNote: $('f-prior-note').value.trim(),
    holiday: $('f-holiday').checked,
    secondLunchWaived: $('f-lunch2-waived').checked,
    blocks,
    vehicle: {
      begin: numOrNull($('f-odo-begin').value),
      end: numOrNull($('f-odo-end').value),
      miles: numOrNull($('f-miles').value),
      itinerary: $('f-itinerary').value.split('\n').map((s) => s.trim()).filter(Boolean),
      make: $('f-make').value.trim(),
      model: $('f-model').value.trim(),
      plate: $('f-plate').value.trim(),
    },
  };
  return { doc, incomplete, totalRows: rows.length, priorInvalid: priorRaw.trim() !== '' && Number.isNaN(priorParsed) };
}

// ---------------------------------------------------------------------------
// Evaluation (engine + odometer + EA), invoice preview, lunch line
// ---------------------------------------------------------------------------
function evaluate(doc) {
  let res = null, engineError = null;
  try {
    res = rules.evaluateShift({
      date: doc.date || todayYMD(),
      blocks: clone(doc.blocks || []),
      priorMinutes: Number(doc.priorMinutes) || 0,
      options: { holiday: !!doc.holiday, secondLunchWaived: !!doc.secondLunchWaived },
    });
    if (!res || typeof res !== 'object') throw new Error('engine returned nothing');
  } catch (e) { engineError = e; res = null; }
  const extra = [];
  const v = doc.vehicle || {};
  if (v.begin != null && v.end != null) {
    try {
      const arg = { begin: v.begin, end: v.end };
      if (v.miles != null) arg.claimedMiles = v.miles;
      extra.push(...flagsOf(rules.validateOdometer(arg)));
    } catch (e) { extra.push({ severity: 'warn', code: 'ODO_CHECK', message: 'Odometer check failed: ' + e.message }); }
  }
  if (doc.ea) {
    try { extra.push(...flagsOf(rules.validateEA(doc.project, doc.ea))); }
    catch (e) { extra.push({ severity: 'warn', code: 'EA_CHECK', message: 'EA check failed: ' + e.message }); }
  }
  const flags = (res && Array.isArray(res.flags) ? res.flags : []).concat(extra)
    .map((f) => ({ severity: f && f.severity || 'info', code: f && f.code || '', message: f && f.message || '' }));
  return { res, engineError, flags, errors: flags.filter((f) => f.severity === 'error') };
}

function rateRowFor(project, inspector) {
  const doc = state.rates[project];
  if (!doc || !doc.byInspector || !inspector) return null;
  const by = doc.byInspector;
  if (by[inspector]) return by[inspector];
  const n = normName(inspector);
  for (const k of Object.keys(by)) if (normName(k) === n) return by[k];
  return null;
}
function invoiceFor(doc, res) {
  const rateDoc = state.rates[doc.project];
  const period = rateDoc && rateDoc.period ? String(rateDoc.period) : '';
  if (!res) return { amount: null, note: 'no rate on file', period, lines: [] };
  const row = rateRowFor(doc.project, doc.inspector);
  if (!row) return { amount: null, note: 'no rate on file', period, lines: [] };
  let total = 0; const missing = []; const lines = [];
  for (const t of (res.tiers || [])) {
    if (!(t.minutes > 0)) continue;
    const raw = row[t.code];
    const rate = Number(raw);
    if (raw == null || raw === '' || !Number.isFinite(rate)) { missing.push(t.code); continue; }
    const hrs = typeof t.hours === 'number' ? t.hours : (t.minutes / 60);
    const amount = hrs * rate;
    total += amount;
    lines.push({ code: t.code, hours: hrs, rate, amount });
  }
  if (missing.length) return { amount: null, note: 'no rate on file for ' + missing.join(', '), period, lines };
  return { amount: total, note: '', period, lines };
}

function lunchStatus(doc, flags) {
  const lf = flags.filter((f) => /^LUNCH/.test(f.code || ''));
  const errs = lf.filter((f) => f.severity === 'error');
  if (errs.length) return { cls: 'err', text: errs.map((f) => f.message).join(' ') };
  const blocks = doc.blocks || [];
  if (!blocks.length) return { cls: '', text: '' };
  const start = toMin(blocks[0].start);
  const lunches = blocks.filter((b) => b.category === 'lunch').map((b) => ((toMin(b.start) - start) + 1440) % 1440).sort((a, b) => a - b);
  const parts = [];
  if (!lunches.length) parts.push('No lunch block. Fine under 5 hours elapsed; an error past 4:59.');
  else {
    parts.push('1st lunch began ' + hm(lunches[0]) + ' into the shift (limit 4:59).');
    if (lunches[1] != null) parts.push('2nd lunch began ' + hm(lunches[1]) + ' (limit 9:59).');
  }
  if (lf.some((f) => f.code === 'LUNCH2_WAIVABLE')) parts.push(doc.secondLunchWaived ? 'Second lunch waived (recorded on the entry).' : 'Second lunch waivable under 12 hrs.');
  return { cls: 'ok', text: parts.join(' ') };
}

// ---------------------------------------------------------------------------
// Results card rendering (shared by Entry and Review detail)
// ---------------------------------------------------------------------------
function flagsHTML(flags) {
  if (!flags.length) return '<div class="line-row"><span class="chip chip-ok">Clear</span><span class="hint">No flags.</span></div>';
  return '<ul class="flags">' + flags.map((f) => {
    const sev = f.severity || 'info';
    return '<li class="flag flag-' + esc(sev) + '"><span class="chip ' + sevChipClass(sev) + '">' + esc(SEV_LABEL[sev] || sev) + '</span>'
      + '<span class="flag-code">' + esc(f.code) + '</span><span class="flag-msg">' + esc(f.message) + '</span></li>';
  }).join('') + '</ul>';
}
function splitRowHTML(d, two) {
  const tiers = (d && d.tiers || []).filter((t) => t.minutes > 0);
  return '<div class="split-row"><span class="split-date num">' + esc(fmtDate(d && d.date)) + '</span>'
    + (two ? '<span class="chip chip-accent">Shift Change</span>' : '')
    + '<span>' + (tiers.length ? tiers.map((t) => esc(t.code) + ' ' + tierHours(t)).join(' · ') : 'no paid minutes') + '</span></div>';
}
function resultsHTML(doc, ev) {
  const { res, engineError, flags } = ev;
  if (engineError || !res) {
    return '<div class="results-head"><h3>Results</h3></div>'
      + flagsHTML([{ severity: 'error', code: 'ENGINE', message: 'Rules engine error: ' + (engineError && engineError.message || 'no result') }].concat(flags));
  }
  const tiers = (res.tiers || []).filter((t) => t.minutes > 0);
  const total = sumT(tiers);
  const inv = invoiceFor(doc, res);
  const lunch = lunchStatus(doc, flags);
  let h = '<div class="results-head"><h3>Results</h3><span class="family-badge" title="Labor code family">' + esc(res.family || '—') + '</span></div>';
  h += '<p class="family-reason">' + esc(res.familyReason || '') + '</p>';
  h += '<div class="summary-row"><span>Worked <b class="num">' + hm(res.workedMinutes) + '</b></span>'
    + '<span>Lunch <b class="num">' + hm(res.lunchMinutes) + '</b></span>'
    + '<span>Elapsed <b class="num">' + hm(res.elapsedMinutes) + '</b></span>'
    + (doc.priorMinutes ? '<span>Prior today <b class="num">' + hm(doc.priorMinutes) + '</b>' + (doc.priorMinutesManual ? ' (manual)' : '') + '</span>' : '')
    + '</div>';
  h += '<div class="tiers">';
  if (tiers.length) {
    h += tiers.map((t) => '<div class="tier"><span class="tier-code">' + esc(t.code) + '</span><span class="tier-hours">' + tierHours(t) + '<small>hrs</small></span></div>').join('');
    h += '<div class="tier tier-total"><span class="tier-code">Total paid</span><span class="tier-hours">' + hours2(total) + '<small>hrs</small></span></div>';
  } else {
    h += '<p class="hint">No paid minutes.</p>';
  }
  h += '</div>';
  if (res.split) {
    h += '<div class="split"><div class="lbl">Midnight split: two checklist rows</div>' + splitRowHTML(res.split.dayOne, false) + splitRowHTML(res.split.dayTwo, true) + '</div>';
  } else {
    h += '<p class="hint">Single day: no midnight crossing.</p>';
  }
  h += '<div class="line-row"><span class="lbl">Lunch</span><span class="' + (lunch.cls === 'err' ? 'status-err' : '') + '">' + esc(lunch.text) + '</span></div>';
  h += '<div class="line-row"><span class="lbl">Invoice preview</span>';
  if (inv.amount != null) {
    h += '<span class="invoice-amt num">' + esc(money(inv.amount)) + '</span><span class="hint">'
      + inv.lines.map((l) => esc(l.code) + ' ' + l.hours.toFixed(2) + ' × ' + esc(money(l.rate))).join(' + ')
      + (inv.period ? ' · rates ' + esc(inv.period) : '') + '</span>';
  } else {
    h += '<span class="invoice-amt">—</span><span class="hint">' + esc(inv.note) + '</span>';
  }
  h += '</div>';
  h += flagsHTML(flags);
  return h;
}

// ---------------------------------------------------------------------------
// Live recompute
// ---------------------------------------------------------------------------
function updateWeekday(ymd) {
  const d = dowOf(ymd);
  const el = $('f-weekday');
  el.className = 'chip';
  if (d == null) { el.textContent = '—'; return; }
  if (d === 6) { el.textContent = 'Saturday · 1.5 OT all day'; el.classList.add('chip-accent'); }
  else if (d === 0) { el.textContent = 'Sunday · 2.0 DT all day'; el.classList.add('chip-accent'); }
  else el.textContent = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
}

function recompute() {
  const { doc, incomplete, totalRows, priorInvalid } = readForm();
  updateWeekday(doc.date);
  const resultsEl = $('results');
  if (!doc.blocks.length) {
    if (resultsEl.innerHTML !== RESULTS_EMPTY) resultsEl.innerHTML = RESULTS_EMPTY;
    state.last = { doc, ev: null, blocked: true, reason: totalRows ? 'Give the block a start and a stop time to submit.' : 'Add at least one complete time block to submit.' };
  } else {
    const ev = evaluate(doc);
    const appFlags = [];
    if (!doc.inspector) appFlags.push({ severity: 'error', code: 'NO_INSPECTOR', message: 'Choose an inspector.' });
    if (!doc.date) appFlags.push({ severity: 'error', code: 'NO_DATE', message: 'Pick the date the shift started.' });
    if (incomplete) appFlags.push({ severity: 'error', code: 'ROW_INCOMPLETE', message: incomplete + ' block row' + (incomplete > 1 ? 's are' : ' is') + ' missing a start or stop time. Fill it in or remove it.' });
    if (priorInvalid) appFlags.push({ severity: 'error', code: 'PRIOR_FORMAT', message: 'Hours already worked today must be h:mm (for example 2:30).' });
    ev.flags = appFlags.concat(ev.flags);
    ev.errors = ev.flags.filter((f) => f.severity === 'error');
    resultsEl.innerHTML = resultsHTML(doc, ev);
    const blocked = !!ev.engineError || ev.errors.length > 0;
    const reason = ev.engineError ? 'Rules engine error. Nothing can be submitted until it loads.'
      : blocked ? 'Blocked by ' + ev.errors.map((f) => f.code).join(', ') + '. Fix the errors in the results card.'
      : 'Ready to submit.';
    state.last = { doc, ev, blocked, reason };
  }
  $('btn-submit').disabled = state.last.blocked || state.readOnly;
  const reasonEl = $('submit-reason');
  const reasonText = state.readOnly ? 'View-only access: this account can read entries but not save them.' : state.last.reason;
  if (reasonEl.textContent !== reasonText) reasonEl.textContent = reasonText;
}

// ---------------------------------------------------------------------------
// Day ledger (cumulative OT across shifts)
// ---------------------------------------------------------------------------
function computeLedger(inspector, date, excludeId) {
  const out = { minutes: 0, lines: [] };
  if (!inspector || !date) return out;
  const n = normName(inspector);
  const prev = shiftDate(date, -1);
  for (const e of Object.values(state.entries)) {
    if (!e || e.id === excludeId) continue;
    if (normName(e.inspector) !== n) continue;
    if (e.date !== date && e.date !== prev) continue;
    let res = null;
    try {
      res = rules.evaluateShift({ date: e.date, blocks: clone(e.blocks || []), priorMinutes: 0, options: { holiday: !!e.holiday } });
    } catch (err) { continue; }
    if (!res) continue;
    let contrib = 0; let spill = false;
    if (e.date === date) contrib = res.split ? sumT(res.split.dayOne && res.split.dayOne.tiers) : sumT(res.tiers);
    else { if (!res.split) continue; contrib = sumT(res.split.dayTwo && res.split.dayTwo.tiers); spill = true; }
    if (contrib <= 0) continue;
    out.minutes += contrib;
    const blocks = e.blocks || [];
    const first = blocks[0], last = blocks[blocks.length - 1];
    const jobs = Array.from(new Set(blocks.map((b) => b.jobRef).filter(Boolean)));
    out.lines.push({ id: e.id, span: first ? clock12(first.start) + '–' + clock12(last.stop) : '', minutes: contrib, jobs, spill, fromDate: e.date, status: e.status, example: !!e.example });
  }
  return out;
}

function updateLedger() {
  const inspector = currentInspector();
  const date = $('f-date').value;
  state.ledger = computeLedger(inspector, date, state.editingId);
  const el = $('ledger');
  const L = state.ledger;
  if (!inspector || !date) {
    el.innerHTML = '<span class="hint">Pick an inspector and a date to see the day ledger.</span>';
  } else if (!L.lines.length) {
    el.innerHTML = '<span class="hint">No other hours on file for ' + esc(inspector) + ' on ' + esc(fmtDate(date)) + '. The ladder starts at 0:00'
      + (state.storeAnswered ? '' : ' (storage still loading)') + '.</span>';
  } else {
    el.innerHTML = '<ul class="ledger-lines">' + L.lines.map((l) =>
      '<li><span class="num">' + esc(l.span) + '</span><span class="num"><b>' + l.minutes + ' min</b></span>'
      + '<span>' + (l.jobs.length ? 'job ' + esc(l.jobs.join(', ')) : 'no job #') + '</span>'
      + (l.spill ? '<span class="chip chip-accent">after midnight, from ' + esc(shortDate(l.fromDate)) + '</span>' : '')
      + statusChip(l.status) + (l.example ? '<span class="chip chip-example">Example</span>' : '') + '</li>').join('')
      + '<li class="ledger-total"><span>Ledger total on ' + esc(shortDate(date)) + '</span><span class="num"><b>' + hm(L.minutes) + '</b> (' + L.minutes + ' min)</span></li></ul>';
  }
  const prior = $('f-prior');
  if (!state.priorManual) {
    const want = hm(L.minutes);
    if (prior.value !== want) prior.value = want;
    $('btn-prior-reset').hidden = true;
  } else {
    const entered = parseHM(prior.value);
    $('btn-prior-reset').hidden = false;
    $('btn-prior-reset').textContent = 'Use ledger value (' + hm(L.minutes) + ')';
    if (Number.isFinite(entered) && entered !== L.minutes) {
      el.insertAdjacentHTML('beforeend', '<p class="hint">Manual override: you entered ' + esc(hm(entered)) + '; the ledger computes ' + esc(hm(L.minutes)) + '. Add a note saying why.</p>');
    }
  }
}
function onPriorEdit() {
  const p = parseHM($('f-prior').value);
  const val = p === null ? 0 : p;
  state.priorManual = Number.isNaN(val) ? true : val !== state.ledger.minutes;
  $('btn-prior-reset').hidden = !state.priorManual;
  if (state.priorManual) $('btn-prior-reset').textContent = 'Use ledger value (' + hm(state.ledger.minutes) + ')';
}

// ---------------------------------------------------------------------------
// Vehicle memory (per inspector, this browser only)
// ---------------------------------------------------------------------------
function rememberVehicle(doc) {
  if (!doc.inspector) return;
  const v = doc.vehicle || {};
  if (!(v.make || v.model || v.plate)) return;
  const m = lsGet(LS_VEHICLE) || {};
  m[normName(doc.inspector)] = { make: v.make || '', model: v.model || '', plate: v.plate || '' };
  lsSet(LS_VEHICLE, m);
}
function recallVehicle(inspector) {
  if (!inspector) return;
  if ($('f-make').value || $('f-model').value || $('f-plate').value) return;
  const m = lsGet(LS_VEHICLE) || {};
  const v = m[normName(inspector)];
  if (v) { $('f-make').value = v.make || ''; $('f-model').value = v.model || ''; $('f-plate').value = v.plate || ''; }
}
function autoMiles() {
  const b = numOrNull($('f-odo-begin').value), e = numOrNull($('f-odo-end').value);
  if (b != null && e != null) $('f-miles').value = String(e - b);
}

// ---------------------------------------------------------------------------
// Entry: load / reset / save
// ---------------------------------------------------------------------------
function setEntryContext(doc, asCopy) {
  const ctx = $('entry-context');
  if (state.editingId && doc) {
    ctx.textContent = 'Editing ' + (doc.inspector || '(no inspector)') + ' · ' + fmtDate(doc.date) + ' · ' + (STATUS_LABEL[doc.status] || doc.status || 'unsaved') + '. Saving again overwrites this entry.';
    $('btn-new').hidden = false;
  } else if (asCopy && doc) {
    ctx.textContent = 'New entry copied from the example for ' + (doc.inspector || '') + '. Edit anything, then submit; the example stays as it is.';
    $('btn-new').hidden = false;
  } else {
    ctx.textContent = 'New entry. Fill in the shift; the results card updates as you go.';
    $('btn-new').hidden = false;
  }
}
function resetForm() {
  state.editingId = null; state.priorManual = false; state.eaAuto = true;
  $('f-entry-id').value = '';
  $('f-date').value = todayYMD();
  $('f-project').value = '105-Express'; applyProject();
  $('f-task-order').value = '';
  $('f-prior').value = '0:00'; $('f-prior-note').value = '';
  $('f-holiday').checked = false; $('f-lunch2-waived').checked = false;
  $('blocks').innerHTML = ''; addBlock();
  $('f-odo-begin').value = ''; $('f-odo-end').value = ''; $('f-miles').value = ''; $('f-itinerary').value = '';
  Array.from($('blocks').querySelectorAll('.is-incomplete')).forEach((r) => r.classList.remove('is-incomplete'));
  setMsg('entry-msg', '');
  setEntryContext(null);
  $('btn-new').hidden = true;
  updateLedger(); recompute();
}
function loadIntoForm(doc, asCopy) {
  resetForm();
  state.editingId = asCopy ? null : doc.id;
  $('f-entry-id').value = state.editingId || '';
  const sel = $('f-inspector');
  if (ROSTER.includes(doc.inspector)) { sel.value = doc.inspector; $('f-inspector-other').value = ''; }
  else { sel.value = '__other__'; $('f-inspector-other').value = doc.inspector || ''; }
  toggleOther();
  if (doc.enteredBy) $('f-entered-by').value = doc.enteredBy;
  $('f-date').value = doc.date || todayYMD();
  $('f-project').value = PROJECTS[doc.project] ? doc.project : '105-Express';
  state.eaAuto = false; applyProject();
  $('f-ea').value = doc.ea || '';
  state.eaAuto = !doc.ea || doc.ea === PROJECTS[$('f-project').value].ea;
  $('f-task-order').value = doc.taskOrder || '';
  ensureGroupOption(doc.group);
  $('f-prior').value = hm(doc.priorMinutes || 0);
  $('f-prior-note').value = doc.priorNote || '';
  state.priorManual = !!doc.priorMinutesManual;
  $('f-holiday').checked = !!doc.holiday;
  $('f-lunch2-waived').checked = !!doc.secondLunchWaived;
  $('blocks').innerHTML = '';
  for (const b of (doc.blocks || [])) addBlock(b);
  if (!(doc.blocks || []).length) addBlock();
  const v = doc.vehicle || {};
  $('f-odo-begin').value = v.begin != null ? v.begin : '';
  $('f-odo-end').value = v.end != null ? v.end : '';
  $('f-miles').value = v.miles != null ? v.miles : (v.begin != null && v.end != null ? v.end - v.begin : '');
  $('f-itinerary').value = Array.isArray(v.itinerary) ? v.itinerary.join('\n') : (v.itinerary || '');
  $('f-make').value = v.make || ''; $('f-model').value = v.model || ''; $('f-plate').value = v.plate || '';
  updateLedger(); recompute();
  setEntryContext(doc, asCopy);
  location.hash = '#entry';
  try { $('entry').focus({ preventScroll: false }); } catch (e) { /* ignore */ }
  window.scrollTo(0, 0);
}

async function saveFromForm(status) {
  recompute();
  const last = state.last;
  if (status === 'submitted' && last.blocked) return;
  const doc = clone(last.doc);
  if (!doc.inspector) { setMsg('entry-msg', 'Choose an inspector before saving.', 'err'); $('f-inspector').focus(); return; }
  if (!doc.date) { setMsg('entry-msg', 'Pick the date before saving.', 'err'); $('f-date').focus(); return; }
  if (state.readOnly) { setMsg('entry-msg', 'This account has view-only access here.', 'err'); return; }
  setMsg('entry-msg', 'Saving…');
  $('btn-draft').disabled = true;
  try {
    await state.ready;
    const existing = state.editingId ? state.entries[state.editingId] : null;
    doc.id = state.editingId || makeId(doc);
    doc.status = status;
    doc.managerNote = existing && existing.managerNote ? existing.managerNote : '';
    doc.createdAtClient = existing && existing.createdAtClient ? existing.createdAtClient : new Date().toISOString();
    doc.updatedAtClient = new Date().toISOString();
    if (state.meId) doc.enteredById = state.meId;
    // Mark this id as "the entry being edited" BEFORE the store echoes it
    // back, so the day ledger never counts the entry against itself.
    state.editingId = doc.id;
    $('f-entry-id').value = doc.id;
    const where = await saveEntry(doc);
    rememberVehicle(doc);
    setEntryContext(doc, false);
    setMsg('entry-msg', (status === 'submitted' ? 'Submitted. ' : 'Draft saved. ') + whereText(where) + ' Find it under Review.', 'ok');
  } catch (e) {
    setMsg('entry-msg', 'Could not save: ' + (e && e.message ? e.message : e), 'err');
  } finally {
    $('btn-draft').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Storage layer
// ---------------------------------------------------------------------------
function lsAvailable() {
  try { const k = '__socal_probe__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
}
function lsGet(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

function sanitizeMap(m) {
  const out = {};
  for (const [id, doc] of Object.entries(m || {})) {
    if (!doc || typeof doc !== 'object') continue;
    out[id] = Object.assign({}, doc, { id });
  }
  return out;
}
function loadLocal() {
  if (lsAvailable()) {
    state.mode = 'local';
    const m = lsGet(LS_KEY);
    if (m && typeof m === 'object') state.entries = sanitizeMap(m);
    const r = lsGet(LS_RATES);
    if (r && typeof r === 'object') state.rates = r;
  } else {
    state.mode = 'memory';
  }
  state.storeAnswered = true;
  onEntriesChanged(); onRatesChanged();
}
function subscribeShared() {
  try {
    state.db.collection('timesheets').onSnapshot((snap) => {
      const m = {};
      for (const d of snap.docs) {
        if (!d.exists) continue;
        m[d.id] = Object.assign({}, d.data() || {}, { id: d.id });
      }
      state.entries = m; state.storeAnswered = true;
      onEntriesChanged();
    }, (err) => {
      state.storeAnswered = true;
      setModeNote('Shared database stopped responding (' + (err && err.code || 'error') + '). Reload to reconnect; what you typed is still on screen.');
      onEntriesChanged();
    });
  } catch (e) { setModeNote('Could not open the shared database: ' + e.message); state.storeAnswered = true; }
  try {
    state.db.collection('rates').onSnapshot((snap) => {
      const m = {};
      for (const d of snap.docs) { if (!d.exists) continue; m[d.id] = Object.assign({}, d.data() || {}); }
      state.rates = m; onRatesChanged();
    }, () => { /* rates stay as last seen */ });
  } catch (e) { /* rates unavailable */ }
}
async function initUser() {
  try {
    const user = await window.claude.use('user');
    if (!user) return;
    state.user = user;
    const me = await user.me();
    if (me) {
      state.meId = me.id || null;
      if (me.name && !$('f-entered-by').value.trim()) $('f-entered-by').value = me.name;
    }
    const canWrite = await user.can('data.write');
    if (canWrite === false) {
      state.readOnly = true;
      setModeNote($('mode-note').textContent + ' You have view-only access: entries can be read but not saved from this account.');
      recompute();
    }
  } catch (e) { /* identity is optional */ }
}
async function initStore() {
  const hasClaude = !!(window.claude && typeof window.claude.use === 'function');
  if (hasClaude) {
    document.documentElement.classList.add('artifact');
    setModeNote('Connecting to the shared database…');
    let db = null;
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
    if (db) {
      state.db = db; state.mode = 'shared';
      subscribeShared();
      setModeNote('Shared mode: entries sync through this artifact for everyone with access.');
      initUser();
      return;
    }
    loadLocal();
    setModeNote('Local only — sign in on claude.ai for shared mode');
    initUser();
    return;
  }
  loadLocal();
  setModeNote(state.mode === 'local'
    ? 'Local: entries save in this browser only. Open the claude.ai artifact for shared mode.'
    : 'Memory only: browser storage is blocked, so entries last until this tab closes.');
}
async function saveEntry(doc) {
  const body = clone(doc);
  if (state.mode === 'shared' && state.db) {
    await state.db.doc('timesheets/' + doc.id).set(body);
    state.entries[doc.id] = body;
    onEntriesChanged();
    return 'shared';
  }
  state.entries[doc.id] = body;
  if (state.mode === 'local' && !lsSet(LS_KEY, state.entries)) {
    state.mode = 'memory';
    setModeNote('Browser storage refused the write. Entries are kept in memory for this visit.');
  }
  onEntriesChanged();
  return state.mode;
}
async function saveRatesDoc(doc) {
  if (state.mode === 'shared' && state.db) {
    await state.db.doc('rates/' + doc.project).set(doc);
    state.rates[doc.project] = doc;
    return 'shared';
  }
  state.rates[doc.project] = doc;
  if (state.mode === 'local' && !lsSet(LS_RATES, state.rates)) {
    state.mode = 'memory';
    setModeNote('Browser storage refused the write. Rates are kept in memory for this visit.');
  }
  return state.mode;
}
function onEntriesChanged() {
  renderReviewList();
  if (state.selectedId && (location.hash || '').startsWith('#review/')) {
    const noteEl = $('f-manager-note');
    const pending = noteEl ? noteEl.value : '';
    openDetail(state.selectedId, false);
    const after = $('f-manager-note');
    if (after && pending && after.value !== pending) after.value = pending;
  }
  updateLedger(); recompute();
  if (!state.ratesDraft[$('r-project').value]) renderRatesTable();
}
function onRatesChanged() {
  recompute();
  if (state.selectedId && (location.hash || '').startsWith('#review/')) openDetail(state.selectedId, false);
  if (!state.ratesDraft[$('r-project').value]) renderRatesTable();
}

// ---------------------------------------------------------------------------
// Review: list, detail, approve / kick back
// ---------------------------------------------------------------------------
function sortedEntries() {
  return Object.values(state.entries).sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAtClient || '').localeCompare(String(a.createdAtClient || '')));
}
function countBySev(flags) {
  const c = { error: 0, warn: 0, info: 0, ruling: 0 };
  for (const f of flags) c[f.severity] = (c[f.severity] || 0) + 1;
  return c;
}
function renderReviewList() {
  const filter = $('f-review-filter').value;
  const all = sortedEntries();
  const list = filter === 'all' ? all : all.filter((e) => e.status === filter);
  const root = $('review-list');
  if (!all.length) {
    if (!state.storeAnswered && state.mode !== 'memory') {
      root.innerHTML = '<div class="card empty-state"><h4>Loading entries</h4><p>Waiting for storage to answer. If nothing has been submitted yet, this will stay empty.</p></div>';
    } else if (root.innerHTML !== REVIEW_EMPTY) root.innerHTML = REVIEW_EMPTY;
    return;
  }
  if (!list.length) {
    root.innerHTML = '<div class="card empty-state"><h4>Nothing matches</h4><p>No entries with status "' + esc(STATUS_LABEL[filter] || filter) + '". Switch the filter to All entries.</p></div>';
    return;
  }
  root.innerHTML = list.map((e) => {
    const ev = evaluate(e);
    const tiers = ev.res ? (ev.res.tiers || []).filter((t) => t.minutes > 0) : [];
    const c = countBySev(ev.flags);
    return '<button type="button" class="entry-row' + (e.id === state.selectedId ? ' is-selected' : '') + '" data-id="' + esc(e.id) + '">'
      + '<span class="er-main"><strong>' + esc(e.inspector || '(no inspector)') + '</strong><span class="num">' + esc(fmtDate(e.date)) + '</span>'
      + '<span>' + esc(projLabel(e.project)) + (e.group ? ' · ' + esc(e.group) : '') + '</span></span>'
      + '<span class="er-tiers">' + (tiers.length ? tiers.map((t) => esc(t.code) + ' ' + tierHours(t)).join(' · ') : (ev.engineError ? 'engine error' : 'no paid hours')) + '</span>'
      + '<span class="er-chips">' + statusChip(e.status) + (e.example ? '<span class="chip chip-example">Example</span>' : '')
      + (c.error ? '<span class="chip chip-err">' + c.error + ' error' + (c.error > 1 ? 's' : '') + '</span>' : '')
      + (c.warn ? '<span class="chip chip-warn">' + c.warn + ' warning' + (c.warn > 1 ? 's' : '') + '</span>' : '')
      + (c.ruling ? '<span class="chip chip-ruling">' + c.ruling + ' ruling' + (c.ruling > 1 ? 's' : '') + '</span>' : '')
      + (!c.error && !c.warn && !c.ruling ? '<span class="chip chip-ok">Clear</span>' : '')
      + '</span></button>';
  }).join('');
}
function kv(label, value, cls) {
  return '<dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + (value === '' || value == null ? '<span class="hint">—</span>' : value) + '</dd>';
}
function detailHTML(e, ev) {
  const v = e.vehicle || {};
  const miles = milesOf(e);
  let h = '<div class="detail-head"><button type="button" id="btn-detail-back" class="btn btn-sm">All entries</button>'
    + '<h3 id="detail-h" tabindex="-1">' + esc(e.inspector || '(no inspector)') + ' · ' + esc(fmtDate(e.date)) + '</h3>'
    + statusChip(e.status) + (e.example ? '<span class="chip chip-example">Example</span>' : '') + '</div>';
  h += '<dl class="kv">'
    + kv('Project', esc(projLabel(e.project)))
    + kv('EA', esc(e.ea), 'num')
    + (e.project === 'D8' ? kv('Task order', esc(e.taskOrder)) : '')
    + kv('Group', esc(e.group))
    + kv('Entered by', esc(e.enteredBy))
    + kv('Prior today', (e.priorMinutes ? '<span class="num">' + hm(e.priorMinutes) + '</span>' + (e.priorMinutesManual ? ' <span class="chip chip-warn">Manual override</span>' : ' <span class="chip chip-info">From ledger</span>') : '<span class="num">0:00</span>') + (e.priorNote ? ' · ' + esc(e.priorNote) : ''))
    + kv('Holiday', e.holiday ? 'Yes' : 'No')
    + kv('2nd lunch waived', e.secondLunchWaived ? 'Yes' : 'No')
    + kv('Saved', esc(localStamp(e.updatedAtClient || e.createdAtClient)), 'num')
    + kv('Manager note', esc(e.managerNote))
    + '</dl>';
  h += '<h4>Time blocks</h4><div class="table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col">Start</th><th scope="col">Stop</th><th scope="col">Job / log #</th><th scope="col">Description</th></tr></thead><tbody>'
    + (e.blocks || []).map((b) => '<tr><td>' + esc(b.category) + '</td><td class="num">' + esc(b.start) + '</td><td class="num">' + esc(b.stop) + '</td><td>' + esc(b.jobRef) + '</td><td>' + esc(b.note) + '</td></tr>').join('')
    + ((e.blocks || []).length ? '' : '<tr><td colspan="5"><span class="hint">No blocks.</span></td></tr>')
    + '</tbody></table></div>';
  h += '<h4>Vehicle</h4><dl class="kv">'
    + kv('Odometer', v.begin != null || v.end != null ? '<span class="num">' + esc(v.begin != null ? v.begin : '—') + ' → ' + esc(v.end != null ? v.end : '—') + '</span>' : '')
    + kv('Miles', miles === '' ? '' : '<span class="num">' + esc(miles) + '</span>')
    + kv('Itinerary', Array.isArray(v.itinerary) ? esc(v.itinerary.join(' → ')) : esc(v.itinerary))
    + kv('Vehicle', esc([v.make, v.model].filter(Boolean).join(' ')) + (v.plate ? ' · ' + esc(v.plate) : ''))
    + '</dl>';
  h += '<div id="detail-results" class="card results">' + resultsHTML(e, ev) + '</div>';
  h += '<h4>Manager action</h4><div class="field"><label for="f-manager-note">Note (required to kick back)</label><textarea id="f-manager-note" rows="2">' + esc(e.managerNote) + '</textarea></div>';
  h += '<div class="actions">'
    + '<button type="button" id="btn-approve" class="btn btn-primary"' + (state.readOnly ? ' disabled' : '') + '>Approve</button>'
    + '<button type="button" id="btn-kickback" class="btn"' + (state.readOnly ? ' disabled' : '') + '>Kick back</button>'
    + '<button type="button" id="btn-edit-entry" class="btn">' + (e.example ? 'Use as template' : 'Open in Entry') + '</button>'
    + '<button type="button" id="btn-print-detail" class="btn btn-print">Print daily report</button>'
    + '</div>';
  const m = state.detailMsg && state.detailMsg.id === e.id ? state.detailMsg : null;
  h += '<p id="detail-msg" class="status' + (m && m.cls ? ' status-' + m.cls : '') + '" role="status">' + esc(m ? m.text : '') + '</p>';
  return h;
}
function openDetail(id, focus) {
  const d = $('review-detail');
  const changed = state.selectedId !== id;
  state.selectedId = id;
  if (changed) state.detailMsg = null;
  const e = state.entries[id];
  d.hidden = false;
  if (!e) {
    d.innerHTML = '<div class="detail-head"><button type="button" id="btn-detail-back" class="btn btn-sm">All entries</button><h3 id="detail-h" tabindex="-1">'
      + (state.storeAnswered ? 'Entry not found' : 'Loading entry…') + '</h3></div>'
      + (state.storeAnswered ? '<p class="hint">It may have been removed, or the link came from a different copy of this tool.</p>' : '');
  } else {
    d.innerHTML = detailHTML(e, evaluate(e));
  }
  renderReviewList();
  if (focus) { const h3 = $('detail-h'); if (h3) { try { h3.focus({ preventScroll: true }); } catch (err) { /* ignore */ } d.scrollIntoView({ block: 'start' }); } }
}
function closeDetail() {
  state.selectedId = null; state.detailMsg = null;
  const d = $('review-detail'); d.hidden = true; d.innerHTML = '';
  renderReviewList();
}
function detailMsg(text, cls) {
  state.detailMsg = { id: state.selectedId, text, cls };
  const el = $('detail-msg');
  if (el) { el.textContent = text; el.className = 'status' + (cls ? ' status-' + cls : ''); }
}
async function reviewAction(action) {
  const e = state.entries[state.selectedId];
  if (!e) return;
  const noteEl = $('f-manager-note');
  const note = noteEl ? noteEl.value.trim() : '';
  if (action === 'kicked_back' && !note) {
    detailMsg('Say what needs fixing in the note before kicking it back.', 'err');
    if (noteEl) noteEl.focus();
    return;
  }
  const doc = clone(e);
  doc.status = action; doc.managerNote = note; doc.reviewedAtClient = new Date().toISOString();
  if (state.meId) doc.reviewedById = state.meId;
  detailMsg('Saving…');
  try {
    await state.ready;
    const where = await saveEntry(doc);
    detailMsg((action === 'approved' ? 'Approved. ' : 'Kicked back with your note. ') + whereText(where), 'ok');
  } catch (err) {
    detailMsg('Could not save: ' + (err && err.message ? err.message : err), 'err');
  }
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
function milesOf(e) {
  const v = e.vehicle || {};
  if (typeof v.miles === 'number' && Number.isFinite(v.miles)) return v.miles;
  if (typeof v.begin === 'number' && typeof v.end === 'number') return v.end - v.begin;
  return '';
}
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function buildCSV() {
  const out = [['Date', 'Inspector', 'Project', 'EA', 'TaskOrder', 'Group', 'JobRef', 'LaborCode', 'Hours', 'Miles', 'Status', 'Flags', 'Rate', 'Amount']];
  const entries = sortedEntries().reverse().filter((e) => e.status === 'approved' || e.status === 'submitted');
  for (const e of entries) {
    const ev = evaluate(e);
    const flagStr = ev.flags.map((f) => f.code).filter(Boolean).join('; ');
    const miles = milesOf(e);
    const rateRow = rateRowFor(e.project, e.inspector);
    const rows = [];
    if (ev.engineError || !ev.res) {
      rows.push({ date: e.date, job: '', code: '', hours: '', extra: 'ENGINE_ERROR: ' + (ev.engineError && ev.engineError.message || 'no result') });
    } else {
      const res = ev.res;
      const jobs = Array.isArray(res.byJob) && res.byJob.length ? res.byJob : [{ jobRef: '', tiers: res.tiers || [] }];
      if (!res.split) {
        for (const j of jobs) for (const t of (j.tiers || [])) if (t.minutes > 0) rows.push({ date: e.date, job: j.jobRef || '', code: t.code, hours: tierHours(t), extra: '' });
      } else {
        // One row per date portion × tier × jobRef. The engine gives each split
        // half its own byJob; the merged fallback only runs if that is missing.
        const refs = Array.from(new Set(jobs.map((j) => j.jobRef || '')));
        const jobLabel = refs.length <= 1 ? (refs[0] || '') : refs.map((r) => r || '(none)').join(' + ');
        const extra = refs.length > 1 ? 'MULTI_JOB_OVERNIGHT: job split by date not available' : '';
        for (const p of [res.split.dayOne, res.split.dayTwo]) {
          if (!p) continue;
          if (Array.isArray(p.byJob) && p.byJob.length) {
            for (const j of p.byJob) for (const t of (j.tiers || [])) if (t.minutes > 0) rows.push({ date: p.date, job: j.jobRef || '', code: t.code, hours: tierHours(t), extra: '' });
          } else {
            for (const t of (p.tiers || [])) if (t.minutes > 0) rows.push({ date: p.date, job: jobLabel, code: t.code, hours: tierHours(t), extra });
          }
        }
      }
      if (!rows.length) rows.push({ date: e.date, job: '', code: '', hours: '0.00', extra: '' });
    }
    rows.forEach((r, i) => {
      const raw = rateRow && r.code ? rateRow[r.code] : null;
      const rate = raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
      const amount = rate != null && r.hours !== '' ? (Number(r.hours) * rate).toFixed(2) : '';
      out.push([r.date, e.inspector, e.project, e.ea, e.taskOrder, e.group, r.job, r.code, r.hours, i === 0 ? miles : '',
        STATUS_LABEL[e.status] || e.status, [flagStr, r.extra].filter(Boolean).join('; '), rate != null ? rate.toFixed(2) : '', amount]);
    });
  }
  return { text: out.map((r) => r.map(csvCell).join(',')).join('\n'), entries: entries.length, rows: out.length - 1 };
}
function showCSV() {
  const { text, entries, rows } = buildCSV();
  $('csv-out').value = text;
  $('csv-panel').hidden = false;
  setMsg('csv-msg', entries ? rows + ' row' + (rows === 1 ? '' : 's') + ' from ' + entries + ' submitted/approved entr' + (entries === 1 ? 'y' : 'ies') + '.' : 'No submitted or approved entries yet. Drafts and kicked-back entries are left out.');
  $('csv-out').focus();
}
async function copyCSV() {
  const ta = $('csv-out');
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(ta.value); ok = true; } } catch (e) { ok = false; }
  if (!ok) { try { ta.focus(); ta.select(); ok = !!(document.execCommand && document.execCommand('copy')); } catch (e) { ok = false; } }
  if (ok) setMsg('csv-msg', 'Copied to the clipboard.', 'ok');
  else { try { ta.focus(); ta.select(); } catch (e) { /* ignore */ } setMsg('csv-msg', 'Clipboard is blocked here. The text is selected; press Ctrl+C (Cmd+C on Mac).', 'err'); }
}

// ---------------------------------------------------------------------------
// Print (Materials Engineering Staff Daily Report layout)
// ---------------------------------------------------------------------------
function printHTML(doc, ev) {
  const v = doc.vehicle || {};
  const res = ev && ev.res;
  const tiersBy = {};
  for (const t of (res && res.tiers || [])) tiersBy[t.code] = tierHours(t);
  const miles = milesOf(doc);
  let h = '<h1>Materials Engineering Staff Daily Report</h1>';
  h += '<p>Atlas SoCal · SoCal Timesheet pilot · ' + esc(STATUS_LABEL[doc.status] || 'Unsaved') + ' · printed ' + esc(new Date().toLocaleString()) + '</p>';
  h += '<div class="ps-grid">'
    + '<div><b>Contract / project:</b> ' + esc(projLabel(doc.project)) + '</div>'
    + '<div><b>EA:</b> ' + esc(doc.ea) + '</div>'
    + '<div><b>Date performed:</b> ' + esc(fmtDate(doc.date)) + '</div>'
    + '<div><b>Tester name:</b> ' + esc(doc.inspector) + '</div>'
    + '<div><b>Task order:</b> ' + esc(doc.taskOrder || '—') + '</div>'
    + '<div><b>Group:</b> ' + esc(doc.group) + '</div>'
    + '</div>';
  h += '<h2>Time</h2><table><thead><tr><th>Category</th><th>Start</th><th>Stop</th><th>Job / log #</th><th>Task description</th></tr></thead><tbody>'
    + (doc.blocks || []).map((b) => '<tr><td>' + esc(b.category) + '</td><td>' + esc(clock12(b.start)) + '</td><td>' + esc(clock12(b.stop)) + '</td><td>' + esc(b.jobRef) + '</td><td>' + esc(b.note) + '</td></tr>').join('')
    + '</tbody></table>';
  h += '<h2>Vehicle use</h2><div class="ps-grid">'
    + '<div><b>Beginning odometer:</b> ' + esc(v.begin != null ? v.begin : '') + '</div>'
    + '<div><b>Ending odometer:</b> ' + esc(v.end != null ? v.end : '') + '</div>'
    + '<div><b>Mileage:</b> ' + esc(miles) + '</div>'
    + '<div style="grid-column:1/-1"><b>Itinerary:</b> ' + esc(Array.isArray(v.itinerary) ? v.itinerary.join(' → ') : (v.itinerary || '')) + '</div>'
    + '<div><b>Make / model:</b> ' + esc([v.make, v.model].filter(Boolean).join(' ')) + '</div>'
    + '<div><b>Plate:</b> ' + esc(v.plate) + '</div>'
    + '</div>';
  h += '<h2>Hours worked</h2><div class="ps-hours">' + TIER_CODES.map((c) => '<div>' + esc(c) + '<b>' + (tiersBy[c] || '0.00') + '</b></div>').join('') + '</div>';
  if (res) {
    h += '<p><b>Family:</b> ' + esc(res.family) + ' — ' + esc(res.familyReason) + ' <b>Worked:</b> ' + hm(res.workedMinutes) + ' <b>Lunch:</b> ' + hm(res.lunchMinutes)
      + (doc.priorMinutes ? ' <b>Prior today:</b> ' + hm(doc.priorMinutes) : '') + (doc.holiday ? ' <b>Holiday</b>' : '') + '</p>';
    if (res.split) {
      h += '<p><b>Midnight split:</b> ' + esc(fmtDate(res.split.dayOne.date)) + ': ' + (res.split.dayOne.tiers || []).filter((t) => t.minutes > 0).map((t) => esc(t.code) + ' ' + tierHours(t)).join(', ')
        + ' · ' + esc(fmtDate(res.split.dayTwo.date)) + ' (Shift Change): ' + (res.split.dayTwo.tiers || []).filter((t) => t.minutes > 0).map((t) => esc(t.code) + ' ' + tierHours(t)).join(', ') + '</p>';
    }
  }
  const flags = ev ? ev.flags : [];
  h += '<h2>Flags</h2>' + (flags.length ? '<ul>' + flags.map((f) => '<li>' + esc(SEV_LABEL[f.severity] || f.severity) + ' · ' + esc(f.code) + ': ' + esc(f.message) + '</li>').join('') + '</ul>' : '<p>None.</p>');
  if (doc.managerNote) h += '<p><b>Manager note:</b> ' + esc(doc.managerNote) + '</p>';
  h += '<div class="ps-sign"><div>Inspector signature / date</div><div>Reviewed by / date</div></div>';
  return h;
}
function printEntry(doc, ev) {
  if (!doc) return;
  $('print-sheet').innerHTML = printHTML(doc, ev);
  try { window.print(); } catch (e) { /* printing unavailable */ }
}

// ---------------------------------------------------------------------------
// Settings: invoice rates
// ---------------------------------------------------------------------------
function ratesNames(project) {
  const names = new Map();
  for (const n of ROSTER) names.set(normName(n), n);
  const add = (n) => { if (n && !names.has(normName(n))) names.set(normName(n), n); };
  const stored = state.rates[project];
  if (stored && stored.byInspector) Object.keys(stored.byInspector).forEach(add);
  const draft = state.ratesDraft[project];
  if (draft && draft.byInspector) Object.keys(draft.byInspector).forEach(add);
  for (const e of Object.values(state.entries)) add(e && e.inspector);
  state.ratesExtraNames.forEach(add);
  return Array.from(names.values());
}
function readRatesTable() {
  const by = {};
  for (const inp of $('rates-table').querySelectorAll('input[data-name]')) {
    const n = inp.dataset.name;
    if (!by[n]) by[n] = {};
    by[n][inp.dataset.code] = inp.value;
  }
  return { period: $('r-period').value, byInspector: by };
}
function renderRatesTable() {
  const project = $('r-project').value;
  const draft = state.ratesDraft[project];
  const stored = state.rates[project] || {};
  const src = draft || stored;
  const by = src.byInspector || {};
  $('r-period').value = src.period != null ? String(src.period) : '';
  const names = ratesNames(project);
  let h = '<table class="rates-table"><thead><tr><th scope="col">Inspector</th>' + RATE_CODES.map((c) => '<th scope="col" class="num">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>';
  for (const n of names) {
    let row = by[n];
    if (!row) { const k = Object.keys(by).find((x) => normName(x) === normName(n)); row = k ? by[k] : {}; }
    h += '<tr><th scope="row">' + esc(n) + '</th>' + RATE_CODES.map((c) => {
      const id = 'r-' + slug(n) + '-' + slug(c);
      const v = row[c];
      return '<td class="num"><input type="number" id="' + id + '" data-name="' + esc(n) + '" data-code="' + esc(c) + '" min="0" step="0.01" inputmode="decimal" aria-label="' + esc(n) + ' ' + esc(c) + ' invoice rate" value="' + (v == null || v === '' ? '' : esc(v)) + '" placeholder="—"></td>';
    }).join('') + '</tr>';
  }
  h += '</tbody></table>';
  $('rates-table').innerHTML = h;
  if (draft) setMsg('rates-msg', 'Unsaved changes for ' + projLabel(project) + '. Press Save rates to keep them.', 'err');
  else if (!state.storeAnswered) setMsg('rates-msg', 'Waiting for storage to answer…');
  else if (stored.byInspector && Object.keys(stored.byInspector).length) setMsg('rates-msg', 'Rates on file for ' + projLabel(project) + (stored.period ? ' · period ' + stored.period : '') + '.');
  else setMsg('rates-msg', 'No rates on file for ' + projLabel(project) + ' yet. Enter them and press Save rates.');
}
function onRatesEdited() {
  state.ratesDraft[$('r-project').value] = readRatesTable();
  setMsg('rates-msg', 'Unsaved changes. Press Save rates to keep them.', 'err');
}
async function saveRates() {
  const project = $('r-project').value;
  const by = {};
  for (const inp of $('rates-table').querySelectorAll('input[data-name]')) {
    const v = inp.value.trim();
    if (v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { setMsg('rates-msg', 'Rate for ' + inp.dataset.name + ' / ' + inp.dataset.code + ' is not a number.', 'err'); inp.focus(); return; }
    if (!by[inp.dataset.name]) by[inp.dataset.name] = {};
    by[inp.dataset.name][inp.dataset.code] = n;
  }
  const doc = { project, period: $('r-period').value.trim(), byInspector: by };
  if (state.readOnly) { setMsg('rates-msg', 'This account has view-only access here.', 'err'); return; }
  setMsg('rates-msg', 'Saving…');
  $('btn-rates-save').disabled = true;
  try {
    await state.ready;
    const where = await saveRatesDoc(doc);
    delete state.ratesDraft[project];
    renderRatesTable();
    onRatesChanged();
    setMsg('rates-msg', 'Rates saved for ' + projLabel(project) + '. ' + whereText(where), 'ok');
  } catch (e) {
    setMsg('rates-msg', 'Could not save rates: ' + (e && e.message ? e.message : e), 'err');
  } finally {
    $('btn-rates-save').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function onFormEdit(e) {
  const t = e.target;
  if (!t) return;
  const id = t.id || '';
  if (id === 'f-inspector') { if (e.type === 'change') { toggleOther(); recallVehicle(currentInspector()); updateLedger(); if (t.value === '__other__') $('f-inspector-other').focus(); } }
  else if (id === 'f-inspector-other') { updateLedger(); }
  else if (id === 'f-date') { updateLedger(); }
  else if (id === 'f-project') { if (e.type === 'change') applyProject(); }
  else if (id === 'f-ea') { state.eaAuto = false; }
  else if (id === 'f-prior') { onPriorEdit(); }
  else if (id === 'f-odo-begin' || id === 'f-odo-end') { autoMiles(); }
  recompute();
}

function wire() {
  document.documentElement.classList.add('js');
  const form = $('entry-form');
  form.addEventListener('input', onFormEdit);
  form.addEventListener('change', onFormEdit);
  form.addEventListener('submit', (e) => { e.preventDefault(); saveFromForm('submitted'); });
  $('btn-draft').addEventListener('click', () => saveFromForm('draft'));
  $('btn-print').addEventListener('click', () => { recompute(); printEntry(state.last.doc, state.last.ev); });
  $('btn-new').addEventListener('click', () => { resetForm(); $('f-date').focus(); });
  $('btn-add-block').addEventListener('click', () => { addBlock(null, true); recompute(); });
  $('btn-prior-reset').addEventListener('click', () => { state.priorManual = false; updateLedger(); recompute(); $('f-prior').focus(); });
  $('blocks').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('.block-row');
    if (btn.dataset.act === 'rm') {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); reindexBlocks();
      const target = next ? next.querySelector('[data-k="start"]') : $('btn-add-block');
      if (target) target.focus();
    } else {
      const copy = addBlock(readBlockRow(row));
      row.after(copy); reindexBlocks();
      copy.querySelector('[data-k="start"]').focus();
    }
    recompute();
  });

  $('f-review-filter').addEventListener('change', renderReviewList);
  $('btn-csv').addEventListener('click', showCSV);
  $('btn-csv-copy').addEventListener('click', copyCSV);
  $('btn-csv-close').addEventListener('click', () => { $('csv-panel').hidden = true; $('btn-csv').focus(); });
  $('review-list').addEventListener('click', (e) => {
    const row = e.target.closest('.entry-row');
    if (!row) return;
    location.hash = '#review/' + encodeURIComponent(row.dataset.id);
  });
  $('review-detail').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'btn-detail-back') { location.hash = '#review'; $('tab-review').focus(); }
    else if (btn.id === 'btn-approve') reviewAction('approved');
    else if (btn.id === 'btn-kickback') reviewAction('kicked_back');
    else if (btn.id === 'btn-edit-entry') { const e2 = state.entries[state.selectedId]; if (e2) loadIntoForm(e2, !!e2.example); }
    else if (btn.id === 'btn-print-detail') { const e2 = state.entries[state.selectedId]; if (e2) printEntry(e2, evaluate(e2)); }
  });

  $('r-project').addEventListener('change', renderRatesTable);
  $('r-period').addEventListener('input', onRatesEdited);
  $('rates-table').addEventListener('input', onRatesEdited);
  $('btn-rate-add').addEventListener('click', () => {
    const name = $('r-add-name').value.trim();
    if (!name) { $('r-add-name').focus(); return; }
    if (!state.ratesExtraNames.some((n) => normName(n) === normName(name))) state.ratesExtraNames.push(name);
    const project = $('r-project').value;
    state.ratesDraft[project] = readRatesTable();
    if (!state.ratesDraft[project].byInspector[name]) state.ratesDraft[project].byInspector[name] = {};
    $('r-add-name').value = '';
    renderRatesTable();
    const first = $('r-' + slug(name) + '-' + slug(RATE_CODES[0]));
    if (first) first.focus();
  });
  $('btn-rates-save').addEventListener('click', saveRates);
  $('btn-rates-reload').addEventListener('click', () => { delete state.ratesDraft[$('r-project').value]; renderRatesTable(); });

  window.addEventListener('hashchange', () => route(true));
}

// ---------------------------------------------------------------------------
// Boot: first frame is the static HTML; enhance, then ask storage.
// ---------------------------------------------------------------------------
wire();
$('f-date').value = todayYMD();
applyProject();
addBlock();
updateLedger();
recompute();
route(false);
state.ready = initStore();
