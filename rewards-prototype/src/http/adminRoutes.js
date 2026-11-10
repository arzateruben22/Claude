// Admin routes (docs/API.md §5). Every path here starts with /api/admin/ and is declared
// `admin`, so the pipeline answers 403 to anyone else before a handler runs. The domain
// functions check again on their own (requireAdmin / requireAdminUser), and add the rules
// a role alone cannot express: nobody decides their own submission or credits their own
// member, an admin cannot change their own account, the last admin cannot be removed.
//
// Each handler names its inputs, calls ONE domain function as the signed-in admin and
// shapes the answer. Nothing here re-implements a business rule.
//
// Rules protected here:
//   * A body may carry exactly the fields its route lists; anything else is 422
//     unknown_field. Where the domain function takes the body whole it applies that rule
//     itself; where a handler picks fields out, it applies it here.
//   * Idempotency-Key travels from the header to the domain untouched.
//   * There is no route that accepts a channel id typed by a person.

import { notFound } from '../lib/errors.js';
import * as v from '../lib/validate.js';
import { clearSessionCookie } from '../auth/cookies.js';
import { listAudit } from '../domain/audit.js';
import { reviewClaim, revokeClaim, runApiCheck } from '../domain/claims.js';
import { createCompetition, updateCompetition } from '../domain/competitions.js';
import { eraseMember, exportMemberData } from '../domain/erasure.js';
import { checkIntegrity } from '../domain/integrity.js';
import { adjust, grantBonus, reverseEntry } from '../domain/ledger.js';
import { createMember, listMembers, unlinkYoutubeChannel, updateMember } from '../domain/members.js';
import { SETTING_KEYS, getSettings, updateSettings } from '../domain/settings.js';
import { createTaskType, listTaskTypes, updateTaskType } from '../domain/taskTypes.js';
import { replaceTiers } from '../domain/tiers.js';
import { createUser, deleteUser, listUsers, updateUser } from '../domain/users.js';
import { createVideo, listVideos, refreshVideoStats, requireVideoRow, updateVideo } from '../domain/videos.js';
import { queryInteger, queryToken } from './request.js';

const MAX_ROW_ID = Number.MAX_SAFE_INTEGER;
const AUDIT_ACTION = /^[a-z_]+\.[a-z_]+$/;
const ENTITY_TYPE = /^[a-z_]{1,40}$/;
const LEDGER_ENTRY_ID = /^[1-9]\d{0,14}$/;
const TIER_FIELDS = ['level', 'name', 'min_xp', 'art_key'];

const memberId = (body) => v.string(body.member_id, 'member_id', { max: 64 });
const optionalId = (value, field) => (value === undefined || value === null ? null : v.string(value, field, { max: 64 }));

/**
 * @param {{
 *   config: { appOrigin: string },
 *   db: import('../db/sqlite.js').Db,
 *   registry: { get(platform: string): object },
 *   afterErasure: (memberId: string, at: string) => boolean }} deps
 * @returns {import('./router.js').Route[]}
 */
export function adminRoutes({ config, db, registry, afterErasure }) {
  const route = (method, path, handler) => ({ method, path: `/api/admin${path}`, audience: 'admin', handler });
  /** For routes that take no fields at all: any key in the body is refused. */
  const noFields = (body) => v.only(body, []);

  return [
    // Submissions
    route('POST', '/claims/:id/check', async ({ ctx, params, body }) => {
      noFields(body);
      return { body: await runApiCheck(ctx, params.id, registry) };
    }),
    route('POST', '/claims/:id/review', ({ ctx, params, body }) => ({ body: reviewClaim(ctx, params.id, body) })),
    route('POST', '/claims/:id/revoke', ({ ctx, params, body }) => {
      const { reason } = v.only(body, ['reason']);
      return { body: revokeClaim(ctx, params.id, { reason }) };
    }),

    // Ledger
    route('POST', '/ledger/bonuses', ({ ctx, body, idempotencyKey }) => {
      const input = v.only(body, ['member_id', 'points', 'xp', 'reason', 'competition_id']);
      const result = grantBonus(ctx, {
        memberId: memberId(input),
        points: input.points ?? 0,
        xp: input.xp ?? 0,
        reason: input.reason,
        competitionId: optionalId(input.competition_id, 'competition_id'),
        idempotencyKey,
      });
      return { status: result.replayed ? 200 : 201, body: result };
    }),
    route('POST', '/ledger/adjustments', ({ ctx, body, idempotencyKey }) => {
      const input = v.only(body, ['member_id', 'points', 'xp', 'bucket', 'reason']);
      const result = adjust(ctx, {
        memberId: memberId(input),
        points: input.points ?? 0,
        xp: input.xp ?? 0,
        // Left out, the domain's own default applies.
        ...(input.bucket === undefined ? {} : { bucket: input.bucket }),
        reason: input.reason,
        idempotencyKey,
      });
      return { status: result.replayed ? 200 : 201, body: result };
    }),
    route('POST', '/ledger/:id/reverse', ({ ctx, params, body }) => {
      const { reason } = v.only(body, ['reason']);
      // Ledger ids are row numbers; anything else cannot be an entry.
      if (!LEDGER_ENTRY_ID.test(params.id)) throw notFound('entry_not_found', 'That ledger entry does not exist.');
      const result = reverseEntry(ctx, { entryId: Number(params.id), reason });
      return { status: result.replayed ? 200 : 201, body: result };
    }),

    // Oversight
    route('GET', '/audit', ({ ctx, query }) => {
      const page = listAudit(ctx, {
        limit: queryInteger(query, 'limit', { min: 1, max: 200 }),
        beforeId: queryInteger(query, 'before_id', { min: 1, max: MAX_ROW_ID }),
        action: queryToken(query, 'action', AUDIT_ACTION),
        subjectMemberId: queryToken(query, 'subject_member_id'),
        entityType: queryToken(query, 'entity_type', ENTITY_TYPE),
        entityId: queryToken(query, 'entity_id'),
      });
      return { body: { items: page.items, next_before_id: page.nextBeforeId } };
    }),
    route('GET', '/integrity', () => ({ body: checkIntegrity(db) })),

    // Numbers the owner can tune
    route('GET', '/settings', ({ ctx }) => ({ body: { settings: getSettings(ctx) } })),
    route('PATCH', '/settings', ({ ctx, body }) => ({ body: { settings: updateSettings(ctx, v.only(body, SETTING_KEYS)) } })),
    route('PUT', '/tiers', ({ ctx, body }) => {
      const { tiers } = v.only(body, ['tiers']);
      if (Array.isArray(tiers)) tiers.forEach((tier, index) => v.only(tier, TIER_FIELDS, `tiers[${index}]`));
      return { body: { tiers: replaceTiers(ctx, tiers) } };
    }),

    // Task types (contributions only; the domain refuses engagement and money wording)
    route('GET', '/task-types', ({ ctx }) => ({ body: { items: listTaskTypes(ctx, { includeInactive: true }) } })),
    route('POST', '/task-types', ({ ctx, body }) => ({ status: 201, body: { task_type: createTaskType(ctx, body) } })),
    route('PATCH', '/task-types/:id', ({ ctx, params, body }) => ({ body: { task_type: updateTaskType(ctx, params.id, body) } })),

    // Videos and their informational statistics
    route('GET', '/videos', ({ ctx }) => ({ body: { items: listVideos(ctx, { includeArchived: true }) } })),
    route('POST', '/videos', ({ ctx, body }) => ({ status: 201, body: { video: createVideo(ctx, body) } })),
    route('PATCH', '/videos/:id', ({ ctx, params, body }) => ({ body: { video: updateVideo(ctx, params.id, body) } })),
    route('POST', '/videos/:id/refresh-stats', async ({ ctx, params, body }) => {
      noFields(body);
      const adapter = registry.get(requireVideoRow(ctx, params.id).platform);
      // A failed refresh is a 200 whose result says what went wrong, so the screen can show it.
      return { body: await refreshVideoStats(ctx, params.id, adapter) };
    }),

    // Members
    route('GET', '/members', ({ ctx }) => ({ body: { items: listMembers(ctx, { includeArchived: true }) } })),
    route('POST', '/members', ({ ctx, body }) => ({ status: 201, body: { member: createMember(ctx, body) } })),
    route('PATCH', '/members/:id', ({ ctx, params, body }) => ({ body: { member: updateMember(ctx, params.id, body) } })),
    route('DELETE', '/members/:id', ({ ctx, params, body }) => {
      const { confirm } = v.only(body, ['confirm']);
      const ownMember = ctx.actor.memberId === params.id;
      const result = eraseMember(ctx, params.id, { confirm });
      return {
        body: { ...result, tombstone_recorded: afterErasure(result.member_id, ctx.clock.now().toISOString()) },
        // An admin who erases the member their own account belongs to has been signed out by it.
        ...(ownMember ? { cookies: [clearSessionCookie(config.appOrigin)] } : {}),
      };
    }),
    route('GET', '/members/:id/export', ({ ctx, params }) => ({ body: exportMemberData(ctx, params.id) })),
    route('DELETE', '/members/:id/youtube-link', ({ ctx, params, body }) => {
      noFields(body);
      return { body: { member: unlinkYoutubeChannel(ctx, params.id) } };
    }),

    // The sign-in allowlist
    route('GET', '/users', ({ ctx }) => ({ body: { items: listUsers(ctx) } })),
    route('POST', '/users', ({ ctx, body }) => ({ status: 201, body: { user: createUser(ctx, body) } })),
    route('PATCH', '/users/:id', ({ ctx, params, body }) => ({ body: { user: updateUser(ctx, params.id, body) } })),
    route('DELETE', '/users/:id', ({ ctx, params, body }) => {
      noFields(body);
      const result = deleteUser(ctx, params.id);
      return { body: result, ...(ctx.actor.userId === params.id ? { cookies: [clearSessionCookie(config.appOrigin)] } : {}) };
    }),

    // Competitions
    route('POST', '/competitions', ({ ctx, body }) => ({ status: 201, body: { competition: createCompetition(ctx, body) } })),
    route('PATCH', '/competitions/:id', ({ ctx, params, body }) => ({ body: { competition: updateCompetition(ctx, params.id, body) } })),
  ];
}
