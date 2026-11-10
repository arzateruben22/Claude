// Rewardable task types. These are CONTRIBUTIONS only. policy.js refuses names and
// descriptions that describe engagement (likes, comments, views, ...) or money.
//
// A task's points and XP are copied onto each claim when it is submitted, so changing a
// task later never changes what an existing claim is worth.

import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdmin, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';
import { assertRewardableName, assertRewardableText } from './policy.js';

const KEY = /^[a-z][a-z0-9_]{2,39}$/;
const API_CHECKS = ['none', 'video_ownership'];

const view = (row) => ({
  id: row.id,
  key: row.key,
  label: row.label,
  description: row.description,
  points: row.points,
  xp: row.xp,
  requires_video: row.requires_video === 1,
  api_check: row.api_check,
  active: row.active === 1,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

function load(ctx, taskTypeId) {
  const row = ctx.db.get('SELECT * FROM task_types WHERE id = ?', [taskTypeId]);
  if (!row) throw notFound('task_type_not_found', 'That task does not exist.');
  return row;
}

export function requireTaskTypeRow(ctx, taskTypeId) {
  return load(ctx, taskTypeId);
}

export function listTaskTypes(ctx, { includeInactive = false } = {}) {
  requireSignedIn(ctx);
  return ctx.db.all(`SELECT * FROM task_types ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY label COLLATE NOCASE, id`).map(view);
}

function assertWorthSomething(points, xp) {
  if (points === 0 && xp === 0) throw unprocessable('invalid_input', 'A task must be worth points or XP.', { field: 'points' });
}

export function createTaskType(ctx, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['key', 'label', 'description', 'points', 'xp', 'requires_video', 'api_check']);
  const key = v.string(data.key, 'key', { min: 3, max: 40, pattern: KEY });
  const label = v.string(data.label, 'label', { max: 60 });
  const description = data.description === undefined ? '' : v.string(data.description, 'description', { min: 0, max: 500 });
  const points = v.integer(data.points, 'points', { min: 0, max: 1000 });
  const xp = v.integer(data.xp, 'xp', { min: 0, max: 1000 });
  const requiresVideo = data.requires_video === undefined ? false : v.boolean(data.requires_video, 'requires_video');
  const apiCheck = data.api_check === undefined ? 'none' : v.oneOf(data.api_check, 'api_check', API_CHECKS);
  assertWorthSomething(points, xp);
  assertRewardableName('key', key.replaceAll('_', ' '));
  assertRewardableName('label', label);
  assertRewardableText('description', description);
  const id = newId('tsk');
  return ctx.db.tx(() => {
    const at = nowIso(ctx);
    try {
      ctx.db.run(
        'INSERT INTO task_types (id, key, label, description, points, xp, requires_video, api_check, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, key, label, description, points, xp, requiresVideo ? 1 : 0, apiCheck, at, at],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'task_types.key')) throw conflict('task_key_taken', 'Another task already uses that key.');
      throw error;
    }
    recordAudit(ctx, { action: 'task_type.create', entityType: 'task_type', entityId: id, detail: { key, points, xp, api_check: apiCheck } });
    return view(load(ctx, id));
  });
}

/** The key is permanent. Everything else can change; existing claims keep their snapshot. */
export function updateTaskType(ctx, taskTypeId, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['label', 'description', 'points', 'xp', 'requires_video', 'api_check', 'active']);
  const changes = {
    label: v.optional(data.label, (x) => v.string(x, 'label', { max: 60 })),
    description: v.optional(data.description, (x) => v.string(x, 'description', { min: 0, max: 500 })),
    points: v.optional(data.points, (x) => v.integer(x, 'points', { min: 0, max: 1000 })),
    xp: v.optional(data.xp, (x) => v.integer(x, 'xp', { min: 0, max: 1000 })),
    requires_video: v.optional(data.requires_video, (x) => (v.boolean(x, 'requires_video') ? 1 : 0)),
    api_check: v.optional(data.api_check, (x) => v.oneOf(x, 'api_check', API_CHECKS)),
    active: v.optional(data.active, (x) => (v.boolean(x, 'active') ? 1 : 0)),
  };
  if (changes.label !== undefined) assertRewardableName('label', changes.label);
  if (changes.description !== undefined) assertRewardableText('description', changes.description);
  const fields = Object.keys(changes).filter((key) => changes[key] !== undefined);
  return ctx.db.tx(() => {
    const before = load(ctx, taskTypeId);
    const changed = fields.filter((key) => before[key] !== changes[key]);
    assertWorthSomething(changes.points ?? before.points, changes.xp ?? before.xp);
    if (changed.length > 0) {
      ctx.db.run(`UPDATE task_types SET ${changed.map((key) => `${key} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
        ...changed.map((key) => changes[key]),
        nowIso(ctx),
        taskTypeId,
      ]);
      const numeric = {};
      for (const key of ['points', 'xp', 'active']) if (changed.includes(key)) numeric[key] = { from: before[key], to: changes[key] };
      recordAudit(ctx, { action: 'task_type.update', entityType: 'task_type', entityId: taskTypeId, detail: { fields: changed, ...numeric } });
    }
    return view(load(ctx, taskTypeId));
  });
}
