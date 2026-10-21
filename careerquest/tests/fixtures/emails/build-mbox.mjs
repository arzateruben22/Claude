#!/usr/bin/env node
// Rebuilds all.mbox from every .eml in this directory (run after adding or editing a fixture).
//
// Format: classic Unix mbox ("mboxrd" flavour). Each message is preceded by an envelope line
//   From <sender-address> <asctime of the message's own Date header>
// and every content line that matches /^>*From / gets one extra ">" so it cannot be mistaken
// for an envelope line. The .eml files use CRLF; the mbox uses LF, as mbox readers expect.
//
// Usage: node build-mbox.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.eml')).sort();

function envelopeLine(raw) {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = raw.slice(0, headerEnd).replace(/\r?\n[ \t]+/g, ' ');
  const from = /^From:[ \t]*(.+)$/im.exec(headers)?.[1] ?? '';
  const addr = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim();
  const date = /^Date:[ \t]*(.+)$/im.exec(headers)?.[1] ?? '';
  const m = /^(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\d{2}:\d{2}:\d{2})/.exec(date);
  if (!addr || !m) throw new Error('cannot build envelope line: missing From or Date');
  // asctime(3) layout: "Mon Jan  5 09:00:00 2026" (day of month is space-padded to width 2)
  const asctime = `${m[1]} ${m[3]} ${m[2].replace(/^0/, ' ')} ${m[5]} ${m[4]}`;
  return `From ${addr} ${asctime}`;
}

let out = '';
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  const escaped = raw.replace(/^(>*From )/gm, '>$1');
  out += envelopeLine(raw) + '\n' + escaped.replace(/\n*$/, '\n') + '\n';
}
fs.writeFileSync(path.join(dir, 'all.mbox'), out);
console.log(`wrote all.mbox with ${files.length} messages`);
