// Routes for every signed-in person (docs/API.md §4).
//
// Each handler names its inputs, calls ONE domain function as the signed-in actor and
// shapes the answer. Every business rule (whose claim it is, what a member may see of
// another member, duplicates, limits) lives in src/domain and is not repeated here.
//
// Rules protected here:
//   * "Me" is the session's account. No route takes the caller's own id from the path,
//     the query or the body.
//   * A claim's automatic check runs as the system, after the submission has been
//     stored. Its failure is reported in the answer and never undoes the submission.
//   * The answer to a member is always built with the member as the viewer, never with
//     the system's wider view.
//   * After an erasure commits, the member id goes into the tombstone file and the
//     browser is told to drop its session cookie.

import { isAppError } from '../lib/errors.js';
import * as v from '../lib/validate.js';
import { clearSessionCookie } from '../auth/cookies.js';
import { getClaim, listClaims, runApiCheck, submitClaim, withdrawClaim } from '../domain/claims.js';
import { competitionStandings, listCompetitions } from '../domain/competitions.js';
import { eraseMember, eraseOwnAccount, exportMemberData, exportOwnAccount } from '../domain/erasure.js';
import { dashboard, memberActivity } from '../domain/leaderboard.js';
import { listEntries } from '../domain/ledger.js';
import { getMember, unlinkYoutubeChannel } from '../domain/members.js';
import { requireTaskTypeRow } from '../domain/taskTypes.js';
import { queryInteger, queryOneOf, queryToken } from './request.js';

const CLAIM_DECISIONS = ['pending', 'approved', 'rejected', 'withdrawn', 'revoked'];
// The cursor listClaims hands out: "<created_at>|<claim id>".
const CLAIM_CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[A-Za-z0-9_]{1,64}$/;
const MAX_ROW_ID = Number.MAX_SAFE_INTEGER;

/**
 * @param {{
 *   config: { authMode: 'google'|'dev', appOrigin: string },
 *   registry: { get(platform: string): object, simulated: boolean, mode: string, capabilities(): object },
 *   logger: { error(entry: object): void },
 *   afterErasure: (memberId: string, at: string) => boolean }} deps
 * @returns {import('./router.js').Route[]}
 */
export function memberRoutes({ config, registry, logger, afterErasure }) {
  /** Runs the platform check for a claim whose task has one. Never throws. */
  async function checkIfAutomatic(system, claim) {
    if (requireTaskTypeRow(system, claim.task_type.id).api_check === 'none') return undefined;
    try {
      return (await runApiCheck(system, claim.id, registry)).check;
    } catch (error) {
      logger.error({ event: 'error', request_id: system.requestId, name: String(error?.name ?? 'Error'), message: isAppError(error) ? error.code : String(error?.message ?? '').slice(0, 300) });
      return { outcome: 'unavailable', reason: 'The automatic check could not be completed. An admin can run it again.', evidence: {} };
    }
  }

  async function submit({ ctx, system, body }) {
    const submitted = submitClaim(ctx, body);
    const check = await checkIfAutomatic(system, submitted);
    // Read again as the caller: the check may have changed the claim, and the caller
    // must get their own view of it.
    return { status: 201, body: { claim: check ? getClaim(ctx, submitted.id) : submitted, ...(check ? { check } : {}) } };
  }

  function eraseMe({ ctx, body }) {
    const { confirm } = v.only(body, ['confirm']);
    const cookies = [clearSessionCookie(config.appOrigin)];
    if (!ctx.actor.memberId) return { body: eraseOwnAccount(ctx, { confirm }), cookies };
    const result = eraseMember(ctx, ctx.actor.memberId, { confirm });
    return { body: { ...result, tombstone_recorded: afterErasure(result.member_id, ctx.clock.now().toISOString()) }, cookies };
  }

  return [
    { method: 'GET', path: '/api/dashboard', audience: 'signed_in', handler: ({ ctx }) => ({ body: dashboard(ctx, { registry, authMode: config.authMode }) }) },

    { method: 'GET', path: '/api/members/:id', audience: 'signed_in', handler: ({ ctx, params }) => ({ body: { member: getMember(ctx, params.id) } }) },
    {
      method: 'GET',
      path: '/api/members/:id/activity',
      audience: 'signed_in',
      handler({ ctx, params, query }) {
        const page = memberActivity(ctx, params.id, {
          limit: queryInteger(query, 'limit', { min: 1, max: 100 }),
          beforeId: queryInteger(query, 'before_id', { min: 1, max: MAX_ROW_ID }),
        });
        return { body: { items: page.items, next_before_id: page.nextBeforeId } };
      },
    },

    {
      method: 'GET',
      path: '/api/claims',
      audience: 'signed_in',
      handler: ({ ctx, query }) => ({
        body: listClaims(ctx, {
          memberId: queryToken(query, 'member_id'),
          decision: queryOneOf(query, 'decision', CLAIM_DECISIONS),
          limit: queryInteger(query, 'limit', { min: 1, max: 200 }),
          before: queryToken(query, 'before', CLAIM_CURSOR),
        }),
      }),
    },
    { method: 'POST', path: '/api/claims', audience: 'signed_in', handler: submit },
    { method: 'GET', path: '/api/claims/:id', audience: 'signed_in', handler: ({ ctx, params }) => ({ body: { claim: getClaim(ctx, params.id) } }) },
    {
      method: 'POST',
      path: '/api/claims/:id/withdraw',
      audience: 'signed_in',
      handler({ ctx, params, body }) {
        v.only(body, []);
        return { body: { claim: withdrawClaim(ctx, params.id) } };
      },
    },

    {
      method: 'GET',
      path: '/api/ledger',
      audience: 'signed_in',
      handler({ ctx, query }) {
        const page = listEntries(ctx, {
          memberId: queryToken(query, 'member_id'),
          limit: queryInteger(query, 'limit', { min: 1, max: 200 }),
          beforeId: queryInteger(query, 'before_id', { min: 1, max: MAX_ROW_ID }),
        });
        return { body: { items: page.items, next_before_id: page.nextBeforeId } };
      },
    },

    { method: 'GET', path: '/api/competitions', audience: 'signed_in', handler: ({ ctx }) => ({ body: { items: listCompetitions(ctx) } }) },
    { method: 'GET', path: '/api/competitions/:id/standings', audience: 'signed_in', handler: ({ ctx, params }) => ({ body: competitionStandings(ctx, params.id) }) },

    {
      method: 'GET',
      path: '/api/me/export',
      audience: 'signed_in',
      handler: ({ ctx }) => ({ body: ctx.actor.memberId ? exportMemberData(ctx, ctx.actor.memberId) : exportOwnAccount(ctx) }),
    },
    { method: 'DELETE', path: '/api/me', audience: 'signed_in', handler: eraseMe },
    {
      method: 'DELETE',
      path: '/api/me/youtube-link',
      audience: 'member',
      handler({ ctx, body }) {
        v.only(body, []);
        return { body: { member: unlinkYoutubeChannel(ctx, ctx.actor.memberId) } };
      },
    },
  ];
}
