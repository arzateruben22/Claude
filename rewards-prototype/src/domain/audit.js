// Append-only audit trail. Call recordAudit() inside the SAME transaction as the change
// it describes, so there is never a change without a row or a row without a change.
//
// `detail` is deliberately restricted to ids, enum values, numbers and booleans.
// Reasons and notes are NOT copied here: they live on the ledger entry or claim, which
// erasure deletes. Evidence text, e-mail addresses, tokens and URLs must never be written
// here; assertSafeDetail() refuses the obvious mistakes and the schema refuses '@' and
// '://' outright.
//
// A row about a member must name that member in `subjectMemberId`, otherwise erasure
// could never scrub it (the schema enforces this for claims, ledger entries and members).
// For a member actor the subject defaults to the member themselves.

import { nowIso, requireAdmin } from './context.js';

const FORBIDDEN_KEYS = /(^|_)(email|e_mail|evidence|token|credential|secret|password|cookie|csrf|nonce|authorization|sub|google_sub|display_name|name|url|text|body|content|reason|note|subject_key)($|_)/i;
const MAX_STRING = 80;
const MAX_DEPTH = 4;

function assertSafeDetail(value, path = 'detail', depth = 0) {
  if (value === null || value === undefined) return;
  if (depth > MAX_DEPTH) throw new TypeError(`audit ${path}: nested too deeply`);
  const type = typeof value;
  if (type === 'number' || type === 'boolean') return;
  if (type === 'string') {
    if (value.length > MAX_STRING) throw new TypeError(`audit ${path}: string too long (ids and enum values only)`);
    if (value.includes('@') || value.includes('://')) throw new TypeError(`audit ${path}: addresses and links must not be audit-logged`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeDetail(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (type === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new TypeError(`audit ${path}.${key}: this field must not be audit-logged`);
      assertSafeDetail(item, `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new TypeError(`audit ${path}: unsupported value type ${type}`);
}

/**
 * @param {ReturnType<import('./context.js').createContext>} ctx
 * @param {{ action: string, entityType: string, entityId?: string|number|null,
 *           subjectMemberId?: string|null, detail?: Record<string, unknown>|null }} entry
 * @returns {number} audit row id
 */
export function recordAudit(ctx, { action, entityType, entityId = null, subjectMemberId = null, detail = null }) {
  if (!/^[a-z_]+\.[a-z_]+$/.test(action)) throw new TypeError(`audit action must look like "entity.verb": ${action}`);
  assertSafeDetail(detail);
  const subject = subjectMemberId ?? (ctx.actor.role === 'member' ? ctx.actor.memberId : null) ?? null;
  const result = ctx.db.run(
    `INSERT INTO audit_log (at, actor_user_id, actor_role, action, entity_type, entity_id, subject_member_id, detail, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nowIso(ctx),
      ctx.actor.userId ?? null,
      ctx.actor.role,
      action,
      entityType,
      entityId === null || entityId === undefined ? null : String(entityId),
      subject,
      detail ? JSON.stringify(detail) : null,
      ctx.requestId ?? null,
    ],
  );
  return result.lastInsertRowid;
}

const parseRow = (row) => ({ ...row, detail: row.detail ? JSON.parse(row.detail) : null });

/**
 * Newest first, keyset-paginated. Admin only.
 * @param {{ limit?: number, beforeId?: number, action?: string, subjectMemberId?: string, entityType?: string, entityId?: string }} [filter]
 * @returns {{ items: object[], nextBeforeId: number|null }}
 */
export function listAudit(ctx, { limit = 50, beforeId, action, subjectMemberId, entityType, entityId } = {}) {
  requireAdmin(ctx);
  const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const where = [];
  const params = [];
  if (beforeId !== undefined && beforeId !== null) {
    where.push('id < ?');
    params.push(Number(beforeId));
  }
  if (action) {
    where.push('action = ?');
    params.push(action);
  }
  if (subjectMemberId) {
    where.push('subject_member_id = ?');
    params.push(subjectMemberId);
  }
  if (entityType) {
    where.push('entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    where.push('entity_id = ?');
    params.push(String(entityId));
  }
  const rows = ctx.db.all(
    `SELECT id, at, actor_user_id, actor_role, action, entity_type, entity_id, subject_member_id, detail, request_id
       FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY id DESC LIMIT ?`,
    [...params, size + 1],
  );
  const items = rows.slice(0, size).map(parseRow);
  return { items, nextBeforeId: rows.length > size ? items[items.length - 1].id : null };
}
