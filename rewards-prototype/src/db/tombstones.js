// Erasure tombstones: a tiny append-only file of member ids that have been erased.
//
// Why: if an older backup of the database is ever restored, the erased people would come
// back. At boot the server re-erases every tombstoned id it still finds. The file holds
// only opaque random ids and dates — nothing that identifies a person.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MEMBER_ID = /^mbr_[0-9a-z]{10,40}$/;

export function appendTombstone(path, memberId, at) {
  if (!MEMBER_ID.test(memberId)) throw new TypeError('appendTombstone: not a member id');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  appendFileSync(path, `${JSON.stringify({ member_id: memberId, erased_at: at })}\n`, { mode: 0o600 });
}

/** @returns {string[]} unique member ids, oldest first. Unreadable lines are skipped. */
export function readTombstones(path) {
  if (!existsSync(path)) return [];
  const ids = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed.member_id === 'string' && MEMBER_ID.test(parsed.member_id)) ids.add(parsed.member_id);
    } catch {
      // A damaged line must not stop the server from starting.
    }
  }
  return [...ids];
}
