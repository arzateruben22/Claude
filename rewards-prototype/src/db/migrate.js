// Schema versioning.
//
//   version 1            = src/db/schema.sql (the baseline)
//   version 2, 3, ...    = src/db/migrations/0002_<name>.sql, 0003_<name>.sql, ...
//
// The applied version is stored in SQLite's own `PRAGMA user_version`, which is
// transactional: a migration and its version bump commit or roll back together.
// Never edit schema.sql or an applied migration after real data exists; add a new file.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(here, 'schema.sql');
const MIGRATIONS_DIR = join(here, 'migrations');

function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => ({ version: Number(name.slice(0, 4)), name, path: join(MIGRATIONS_DIR, name) }));
}

export function currentVersion(db) {
  return Number(db.get('PRAGMA user_version').user_version);
}

/**
 * Brings the database up to the latest schema version.
 * @returns {{ from: number, to: number, applied: string[] }}
 */
export function migrate(db) {
  const from = currentVersion(db);
  const applied = [];

  if (from === 0) {
    db.tx(() => {
      db.exec(readFileSync(BASELINE, 'utf8'));
      db.exec('PRAGMA user_version = 1');
    });
    applied.push('schema.sql');
  }

  for (const migration of listMigrations()) {
    if (migration.version <= currentVersion(db)) continue;
    if (migration.version !== currentVersion(db) + 1) {
      throw new Error(`migration ${migration.name} is out of sequence (database is at version ${currentVersion(db)})`);
    }
    db.tx(() => {
      db.exec(readFileSync(migration.path, 'utf8'));
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
    applied.push(migration.name);
  }

  return { from, to: currentVersion(db), applied };
}
