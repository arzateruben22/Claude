// The ONLY module that touches node:sqlite. Everything else receives a `Db`.
//
// node:sqlite is synchronous. That is a feature here: a transaction body runs start to
// finish with no other request able to interleave, as long as the body never awaits.
// `tx()` enforces that by rejecting async bodies.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// SQLite extended result codes we care about.
const SQLITE_CONSTRAINT_CHECK = 275;
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;
const SQLITE_CONSTRAINT_NOTNULL = 1299;
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;
const SQLITE_CONSTRAINT_TRIGGER = 1811;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const SQLITE_CONSTRAINT_DATATYPE = 3091;

const CONSTRAINT_KINDS = new Map([
  [SQLITE_CONSTRAINT_CHECK, 'check'],
  [SQLITE_CONSTRAINT_FOREIGNKEY, 'foreign_key'],
  [SQLITE_CONSTRAINT_NOTNULL, 'not_null'],
  [SQLITE_CONSTRAINT_PRIMARYKEY, 'unique'],
  [SQLITE_CONSTRAINT_TRIGGER, 'trigger'],
  [SQLITE_CONSTRAINT_UNIQUE, 'unique'],
  [SQLITE_CONSTRAINT_DATATYPE, 'datatype'],
]);

/**
 * Classifies a thrown SQLite error.
 * @returns {'unique'|'check'|'foreign_key'|'not_null'|'trigger'|'datatype'|null}
 */
export function constraintKind(error) {
  if (!error || error.code !== 'ERR_SQLITE_ERROR') return null;
  return CONSTRAINT_KINDS.get(error.errcode) ?? null;
}

/** True when `error` is a UNIQUE/PRIMARY KEY violation, optionally on a given "table.column". */
export function isUniqueViolation(error, column) {
  if (constraintKind(error) !== 'unique') return false;
  return column ? String(error.message).includes(column) : true;
}

/** True when `error` was raised by one of the schema's guard triggers (RAISE(ABORT, ...)). */
export function isTriggerAbort(error, messageFragment) {
  if (constraintKind(error) !== 'trigger') return false;
  return messageFragment ? String(error.message).includes(messageFragment) : true;
}

export class Db {
  #raw;
  #statements = new Map();
  #depth = 0;
  #closed = false;

  /** @param {DatabaseSync} raw */
  constructor(raw) {
    this.#raw = raw;
  }

  #prepare(sql) {
    let statement = this.#statements.get(sql);
    if (!statement) {
      statement = this.#raw.prepare(sql);
      this.#statements.set(sql, statement);
    }
    return statement;
  }

  static #args(params) {
    if (params === undefined) return [];
    return Array.isArray(params) ? params : [params];
  }

  /** First row or undefined. `params` is an array (positional `?`) or an object (named `:name`). */
  get(sql, params) {
    return this.#prepare(sql).get(...Db.#args(params));
  }

  /** All rows. */
  all(sql, params) {
    return this.#prepare(sql).all(...Db.#args(params));
  }

  /** Executes a write. Returns { changes, lastInsertRowid } as plain numbers. */
  run(sql, params) {
    const result = this.#prepare(sql).run(...Db.#args(params));
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  /** Runs one or more statements with no parameters (DDL, PRAGMAs). */
  exec(sql) {
    this.#raw.exec(sql);
  }

  get inTransaction() {
    return this.#depth > 0;
  }

  /**
   * Runs `fn` inside a write transaction (BEGIN IMMEDIATE). Nested calls join the outer
   * transaction. `fn` MUST be synchronous: returning a promise is a programming error,
   * because awaiting inside a transaction would let other requests interleave.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  tx(fn) {
    if (this.#depth > 0) {
      this.#depth += 1;
      try {
        return Db.#assertSync(fn());
      } finally {
        this.#depth -= 1;
      }
    }
    this.#raw.exec('BEGIN IMMEDIATE');
    this.#depth = 1;
    try {
      const result = Db.#assertSync(fn());
      this.#raw.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.#raw.exec('ROLLBACK');
      } catch {
        // The transaction may already have been rolled back by SQLite; nothing more to do.
      }
      throw error;
    } finally {
      this.#depth = 0;
    }
  }

  static #assertSync(value) {
    if (value && typeof value.then === 'function') {
      throw new TypeError('Db.tx() body must be synchronous (it returned a promise)');
    }
    return value;
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#statements.clear();
    this.#raw.close();
  }
}

/**
 * Opens a database with the safety settings the schema relies on.
 * @param {string} path  file path, or ':memory:' for tests
 * @returns {Db}
 */
export function openDatabase(path) {
  const inMemory = path === ':memory:';
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  // foreign_keys      : the schema's REFERENCES clauses are only enforced when this is on.
  // recursive_triggers: without it, INSERT OR REPLACE deletes rows WITHOUT firing the
  //                     append-only delete triggers.
  // trusted_schema    : defence in depth against a tampered database file.
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA recursive_triggers = ON; PRAGMA trusted_schema = OFF; PRAGMA busy_timeout = 5000;');
  if (!inMemory) raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  // secure_delete: erased rows are overwritten with zeros instead of being left in free pages.
  raw.exec('PRAGMA secure_delete = ON;');
  const db = new Db(raw);
  const fk = db.get('PRAGMA foreign_keys');
  const rt = db.get('PRAGMA recursive_triggers');
  if (fk?.foreign_keys !== 1 || rt?.recursive_triggers !== 1) {
    throw new Error('SQLite safety pragmas could not be enabled');
  }
  return db;
}
