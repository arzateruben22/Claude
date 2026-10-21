#!/usr/bin/env node
// Validates the email fixture corpus in this directory.
//
//   node tests/fixtures/emails/parse-check.mjs
//
// For every .eml file it splits headers from body, unfolds headers and asserts:
//   - consistent line endings (all CRLF or all LF, never mixed) and no line over 998 chars
//   - required headers present exactly once: From, To, Subject, Date, Message-ID, MIME-Version, Content-Type
//   - From has a display name and an angle-bracket address; To is the fixed test recipient
//   - Date is RFC 5322, in 2026, and the weekday name matches the calendar date
//   - Message-ID is well formed and unique across the corpus
//   - Content-Type is text/plain, text/html or multipart/alternative with the expected
//     charset/boundary/Content-Transfer-Encoding, and every (decoded) body part is non-empty
// Then it cross-checks index.json (schema, enum values, label/body consistency) and all.mbox
// (message count, envelope lines, and that each message round-trips to its .eml byte-for-byte).
// Exit code 1 and a list of failures if anything is wrong; a per-class summary otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TO = 'Ruben Test <ruben.test@example.com>';
const REQUIRED = ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type'];
const CLASSES = [
  'APPLICATION_SUBMITTED', 'EMPLOYER_ACKNOWLEDGMENT', 'RECRUITER_MESSAGE', 'INTERVIEW_INVITATION',
  'ASSESSMENT_INVITATION', 'REJECTION', 'OFFER', 'ONBOARDING', 'JOB_ALERT', 'INCOMPLETE_APPLICATION',
  'APPLICATION_INVITATION', 'UNRELATED',
];
const PLATFORMS = [
  'INDEED', 'LINKEDIN', 'GLASSDOOR', 'ZIPRECRUITER', 'WORKDAY', 'GREENHOUSE', 'LEVER', 'SMARTRECRUITERS',
  'ICIMS', 'ADP', 'GOVERNMENTJOBS', 'USAJOBS', 'COMPANY_SITE', 'OTHER',
];
const SUBMISSION_CLASSES = new Set(['APPLICATION_SUBMITTED', 'EMPLOYER_ACKNOWLEDGMENT']);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

// ---------------------------------------------------------------- helpers
function splitMessage(raw) {
  const m = /\r?\n\r?\n/.exec(raw);
  if (!m) return null;
  return { headerBlock: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}

function parseHeaders(block) {
  const map = new Map();
  for (const line of block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = /^([!-9;-~]+):[ \t]*(.*)$/.exec(line);
    if (!m) throw new Error(`malformed header line "${line.slice(0, 60)}"`);
    const key = m[1].toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m[2].trim());
  }
  return map;
}

function parseContentType(value) {
  const [type, ...rest] = value.split(';');
  const params = {};
  for (const p of rest) {
    const m = /^\s*([^=]+)=\s*"?([^"]*)"?\s*$/.exec(p);
    if (m) params[m[1].trim().toLowerCase()] = m[2];
  }
  return { type: type.trim().toLowerCase(), params };
}

function decodeBody(body, cte) {
  const enc = (cte || '7bit').toLowerCase();
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (enc === 'quoted-printable') {
    const s = body.replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
        bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(s.charCodeAt(i) & 0xff);
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }
  if (enc === '7bit' || enc === '8bit' || enc === 'binary') return body;
  throw new Error(`unsupported Content-Transfer-Encoding "${cte}"`);
}

const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);

function checkDate(file, value) {
  const m = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(value);
  if (!m) return fail(file, `Date is not RFC 5322 "Www, DD Mon YYYY HH:MM:SS +ZZZZ": ${value}`);
  if (m[4] !== '2026') fail(file, `Date year must be 2026: ${value}`);
  if (Number.isNaN(Date.parse(value))) fail(file, `Date does not parse: ${value}`);
  const wd = DAYS[new Date(Date.UTC(+m[4], MONTHS.indexOf(m[3]), +m[2])).getUTCDay()];
  if (wd !== m[1]) fail(file, `Date weekday "${m[1]}" does not match calendar (${wd}): ${value}`);
}

// ---------------------------------------------------------------- .eml checks
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.eml')).sort();
if (files.length === 0) fail('(corpus)', 'no .eml files found');

const seenIds = new Map();
const parsed = new Map(); // file -> { headers, format, searchable, lfRaw }
const formatCounts = { 'text/plain': 0, 'text/html': 0, 'multipart/alternative': 0 };
const eolCounts = { CRLF: 0, LF: 0 };

function checkTextPart(file, label, headers, body, expectedType) {
  const ctRaw = headers.get('content-type')?.[0];
  if (!ctRaw) return fail(file, `${label}: missing Content-Type`), '';
  const ct = parseContentType(ctRaw);
  if (ct.type !== expectedType) fail(file, `${label}: expected ${expectedType}, got ${ct.type}`);
  if (!ct.params.charset) fail(file, `${label}: Content-Type has no charset`);
  else if (ct.params.charset.toLowerCase() !== 'utf-8') fail(file, `${label}: charset should be UTF-8, got ${ct.params.charset}`);
  const cte = headers.get('content-transfer-encoding')?.[0];
  if (!cte) return fail(file, `${label}: missing Content-Transfer-Encoding`), '';
  if (!['7bit', '8bit', 'quoted-printable', 'base64'].includes(cte.toLowerCase())) fail(file, `${label}: unexpected Content-Transfer-Encoding "${cte}"`);
  if (cte.toLowerCase() === '7bit' && !isAscii(body)) fail(file, `${label}: declared 7bit but body contains non-ASCII bytes`);
  if (cte.toLowerCase() === 'base64' && !/^[A-Za-z0-9+/=\r\n]+$/.test(body)) fail(file, `${label}: base64 body contains invalid characters`);
  let decoded = '';
  try {
    decoded = decodeBody(body, cte);
  } catch (err) {
    fail(file, `${label}: ${err.message}`);
  }
  if (decoded.trim().length === 0) fail(file, `${label}: decoded body is empty`);
  if (expectedType === 'text/html' && !/<(html|body|div|table|p)\b/i.test(decoded)) fail(file, `${label}: text/html part does not look like HTML`);
  if (expectedType === 'text/plain' && /<\/(html|body|table|div)>/i.test(decoded)) fail(file, `${label}: text/plain part contains HTML markup`);
  return decoded;
}

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');

  // Line endings and line length
  const hasCrlf = raw.includes('\r\n');
  const bareLf = raw.replace(/\r\n/g, '').includes('\n');
  const bareCr = raw.replace(/\r\n/g, '').includes('\r');
  if (hasCrlf && (bareLf || bareCr)) fail(file, 'mixed line endings (CRLF with bare LF/CR)');
  if (!hasCrlf && bareCr) fail(file, 'bare CR characters');
  eolCounts[hasCrlf ? 'CRLF' : 'LF']++;
  const lines = raw.split(/\r?\n/);
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest > 998) fail(file, `line longer than 998 characters (${longest})`);
  if (!/\r?\n$/.test(raw)) fail(file, 'file does not end with a newline');

  const split = splitMessage(raw);
  if (!split) { fail(file, 'no blank line separating headers from body'); continue; }
  let headers;
  try {
    headers = parseHeaders(split.headerBlock);
  } catch (err) {
    fail(file, err.message);
    continue;
  }

  for (const h of REQUIRED) {
    const n = headers.get(h)?.length ?? 0;
    if (n !== 1) fail(file, `header ${h} must appear exactly once (found ${n})`);
  }

  const from = headers.get('from')?.[0] ?? '';
  if (!/^("[^"]+"|[^"<]+?)\s*<[^@\s<>]+@[^\s<>]+>$/.test(from)) fail(file, `From must be "Display Name <addr>": ${from}`);
  if ((headers.get('to')?.[0] ?? '') !== TO) fail(file, `To must be exactly "${TO}"`);
  const subject = headers.get('subject')?.[0] ?? '';
  if (!subject.trim()) fail(file, 'Subject is empty');
  if (!isAscii(subject)) fail(file, 'Subject contains raw non-ASCII (would need RFC 2047 encoding)');
  if (headers.has('date')) checkDate(file, headers.get('date')[0]);
  const mid = headers.get('message-id')?.[0] ?? '';
  if (!/^<[^@\s<>]+@[^@\s<>]+>$/.test(mid)) fail(file, `Message-ID malformed: ${mid}`);
  if (seenIds.has(mid)) fail(file, `Message-ID duplicates ${seenIds.get(mid)}`);
  seenIds.set(mid, file);
  if ((headers.get('mime-version')?.[0] ?? '') !== '1.0') fail(file, 'MIME-Version must be 1.0');

  const ctRaw = headers.get('content-type')?.[0] ?? '';
  const ct = parseContentType(ctRaw);
  let format = ct.type;
  const decodedParts = [];
  if (ct.type === 'text/plain' || ct.type === 'text/html') {
    decodedParts.push(checkTextPart(file, 'body', headers, split.body, ct.type));
  } else if (ct.type === 'multipart/alternative') {
    const b = ct.params.boundary;
    if (!b) { fail(file, 'multipart without boundary'); continue; }
    const delim = `--${b}`;
    const bodyLines = split.body.split(/\r?\n/);
    const starts = [];
    let closed = false;
    bodyLines.forEach((l, i) => {
      if (l === delim) starts.push(i);
      else if (l === `${delim}--`) closed = true;
      else if (l.startsWith(delim)) fail(file, `unexpected boundary-like line: ${l}`);
    });
    if (!closed) fail(file, 'multipart has no closing boundary');
    if (starts.length !== 2) fail(file, `multipart/alternative should have exactly 2 parts, found ${starts.length}`);
    const closeIdx = bodyLines.indexOf(`${delim}--`);
    const partTypes = [];
    starts.forEach((start, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1] : closeIdx;
      const partRaw = bodyLines.slice(start + 1, end).join('\n');
      const ps = splitMessage(partRaw + '\n\n');
      if (!ps) { fail(file, `part ${idx + 1}: no header/body separator`); return; }
      let ph;
      try { ph = parseHeaders(ps.headerBlock); } catch (err) { fail(file, `part ${idx + 1}: ${err.message}`); return; }
      const pct = parseContentType(ph.get('content-type')?.[0] ?? '');
      partTypes.push(pct.type);
      const expected = idx === 0 ? 'text/plain' : 'text/html';
      decodedParts.push(checkTextPart(file, `part ${idx + 1}`, ph, ps.body.replace(/\n+$/, ''), expected));
    });
    if (partTypes.join(',') !== 'text/plain,text/html') fail(file, `multipart/alternative parts must be text/plain then text/html, got ${partTypes.join(',')}`);
  } else {
    fail(file, `unexpected top-level Content-Type ${ct.type}`);
    format = 'other';
  }
  if (format in formatCounts) formatCounts[format]++;

  if (split.body.trim().length === 0) fail(file, 'body is empty');

  parsed.set(file, {
    headers,
    format,
    lfRaw: raw.replace(/\r\n/g, '\n'),
    searchable: [subject, from, ...decodedParts].join('\n'),
  });
}

// ---------------------------------------------------------------- index.json checks
const indexPath = path.join(dir, 'index.json');
let index = null;
if (!fs.existsSync(indexPath)) {
  fail('index.json', 'missing');
} else {
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (err) {
    fail('index.json', `invalid JSON: ${err.message}`);
  }
}
const classCounts = Object.fromEntries(CLASSES.map((c) => [c, 0]));
const platformCounts = {};
if (Array.isArray(index)) {
  const indexed = new Set();
  const EXPECTED_KEYS = ['classification', 'employer', 'positionTitle', 'requisitionNumber', 'platform', 'interviewAt', 'recruiterName', 'countsAsSubmission', 'minConfidence'];
  index.forEach((entry, i) => {
    const where = `index.json[${i}]`;
    if (!entry || typeof entry.file !== 'string') return fail(where, 'missing "file"');
    if (indexed.has(entry.file)) fail(where, `duplicate entry for ${entry.file}`);
    indexed.add(entry.file);
    if (!files.includes(entry.file)) fail(where, `${entry.file} does not exist`);
    if (typeof entry.notes !== 'string' || !entry.notes.trim()) fail(where, 'notes must be a non-empty string');
    const ex = entry.expected;
    if (!ex || typeof ex !== 'object') return fail(where, 'missing "expected"');
    const keys = Object.keys(ex).sort().join(',');
    if (keys !== [...EXPECTED_KEYS].sort().join(',')) fail(where, `expected keys mismatch: ${keys}`);
    if (!CLASSES.includes(ex.classification)) fail(where, `bad classification ${ex.classification}`);
    else classCounts[ex.classification]++;
    if (ex.platform !== null && !PLATFORMS.includes(ex.platform)) fail(where, `bad platform ${ex.platform}`);
    platformCounts[ex.platform ?? 'null'] = (platformCounts[ex.platform ?? 'null'] || 0) + 1;
    for (const k of ['employer', 'positionTitle', 'requisitionNumber', 'recruiterName']) {
      if (ex[k] !== null && (typeof ex[k] !== 'string' || !ex[k].trim())) fail(where, `${k} must be a non-empty string or null`);
    }
    if (ex.interviewAt !== null) {
      if (typeof ex.interviewAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(ex.interviewAt) || Number.isNaN(Date.parse(ex.interviewAt))) {
        fail(where, `interviewAt must be null or an ISO-8601 datetime with offset: ${ex.interviewAt}`);
      }
      if (ex.classification !== 'INTERVIEW_INVITATION') fail(where, 'interviewAt is only set for INTERVIEW_INVITATION in this corpus');
    }
    if (typeof ex.countsAsSubmission !== 'boolean') fail(where, 'countsAsSubmission must be boolean');
    if (ex.countsAsSubmission && !SUBMISSION_CLASSES.has(ex.classification)) fail(where, `countsAsSubmission=true not allowed for ${ex.classification}`);
    if (ex.classification === 'APPLICATION_SUBMITTED' && !ex.countsAsSubmission) fail(where, 'APPLICATION_SUBMITTED must count as a submission');
    if (typeof ex.minConfidence !== 'number' || ex.minConfidence < 0.6 || ex.minConfidence > 0.95) fail(where, `minConfidence out of range: ${ex.minConfidence}`);
    if (['JOB_ALERT', 'UNRELATED'].includes(ex.classification) && (ex.employer !== null || ex.positionTitle !== null)) fail(where, `${ex.classification} must have null employer/positionTitle`);

    // Label/body consistency: every non-null string label must literally appear in the message.
    const msg = parsed.get(entry.file);
    if (msg) {
      for (const k of ['employer', 'positionTitle', 'requisitionNumber', 'recruiterName']) {
        if (ex[k] !== null && !msg.searchable.includes(ex[k])) fail(where, `${k} "${ex[k]}" does not appear in ${entry.file}`);
      }
    }
  });
  for (const f of files) if (!indexed.has(f)) fail('index.json', `no entry for ${f}`);
}

// ---------------------------------------------------------------- all.mbox checks
const mboxPath = path.join(dir, 'all.mbox');
let mboxEscapedLines = 0;
if (!fs.existsSync(mboxPath)) {
  fail('all.mbox', 'missing (run build-mbox.mjs)');
} else {
  const mbox = fs.readFileSync(mboxPath, 'utf8');
  if (mbox.includes('\r')) fail('all.mbox', 'should use LF line endings');
  const chunks = mbox.split(/^(?=From )/m).filter((c) => c.length > 0);
  if (chunks.length !== files.length) fail('all.mbox', `expected ${files.length} messages, found ${chunks.length}`);
  mboxEscapedLines = (mbox.match(/^>From /gm) || []).length;
  chunks.forEach((chunk, i) => {
    const file = files[i];
    const nl = chunk.indexOf('\n');
    const envelope = chunk.slice(0, nl);
    const em = /^From (\S+@\S+) (Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/.exec(envelope);
    if (!em) return fail('all.mbox', `message ${i + 1}: bad envelope line "${envelope}"`);
    const msg = parsed.get(file);
    if (!msg) return;
    const fromAddr = /<([^>]+)>/.exec(msg.headers.get('from')?.[0] ?? '')?.[1];
    if (em[1] !== fromAddr) fail('all.mbox', `message ${i + 1}: envelope sender ${em[1]} != From address ${fromAddr}`);
    const content = chunk.slice(nl + 1).replace(/\n$/, ''); // drop the blank separator line
    const unescaped = content.replace(/^>(>*From )/gm, '$1');
    if (unescaped !== msg.lfRaw) fail('all.mbox', `message ${i + 1} does not round-trip to ${file}`);
  });
}

// ---------------------------------------------------------------- report
console.log(`Checked ${files.length} .eml files in ${path.relative(process.cwd(), dir) || '.'}`);
console.log(`Line endings: ${eolCounts.CRLF} CRLF, ${eolCounts.LF} LF`);
console.log(`Formats: ${Object.entries(formatCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
if (index) {
  console.log('Classes:');
  for (const [k, v] of Object.entries(classCounts)) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`Platforms: ${Object.entries(platformCounts).sort().map(([k, v]) => `${k}=${v}`).join(', ')}`);
}
console.log(`all.mbox: ${mboxEscapedLines} escaped ">From " line(s)`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nOK - corpus is valid.');
