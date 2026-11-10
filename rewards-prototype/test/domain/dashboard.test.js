import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMemberWithUser, insertTaskType, expectAppError, T0 } from '../helpers.js';
import { dashboard, memberActivity, rankMembers } from '../../src/domain/leaderboard.js';
import { competitionStandings, createCompetition, listCompetitions, updateCompetition } from '../../src/domain/competitions.js';
import { reviewClaim, revokeClaim, submitClaim } from '../../src/domain/claims.js';
import { adjust, grantBonus } from '../../src/domain/ledger.js';
import { createVideo, refreshVideoStats } from '../../src/domain/videos.js';
import { updateSettings } from '../../src/domain/settings.js';
import { createPlatformRegistry } from '../../src/platforms/registry.js';

const NOTE = 'SECRET-NOTE-MARKER the pacing is strong until the midpoint; cut the second montage and tighten the captions please.';

function setup() {
  const world = makeWorld();
  const ada = insertMemberWithUser(world.db, 'Ada');
  const bo = insertMemberWithUser(world.db, 'Bo');
  const cy = insertMemberWithUser(world.db, 'Cy');
  const task = insertTaskType(world.db, { requiresVideo: 1 });
  const video = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoLong001', kind: 'video', title: 'Sample long video', owner_member_id: ada.memberId });
  const video2 = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoShort02', kind: 'short', title: 'Sample short', owner_member_id: ada.memberId });
  const registry = createPlatformRegistry({ mode: 'mock', clock: world.clock });
  const env = { registry, authMode: 'dev' };
  const approve = (who, vid, n) => reviewClaim(world.admin, submitClaim(world.as(who.actor), { task_type_id: task, video_id: vid.id, evidence_text: `${NOTE} #${n}` }).id, { outcome: 'approve' });
  return { world, ada, bo, cy, task, video, video2, registry, env, approve };
}

test('ACCEPTANCE: three members on one screen, with balances, tiers, rank and a leaderboard that follows the ledger', () => {
  const s = setup();
  let board = dashboard(s.world.as(s.ada.actor), s.env);
  assert.equal(board.members.length, 3);
  assert.deepEqual(board.members.map((member) => member.rank), [1, 1, 1], 'everyone starts level');
  assert.equal(board.tiers.length, 5);
  assert.equal(board.demo_mode, true);
  assert.equal(board.auth_mode, 'dev');
  assert.match(board.disclaimer, /no cash value/);
  assert.equal(board.members[0].tier.level, 1);

  s.approve(s.bo, s.video, 1);
  s.approve(s.bo, s.video2, 2);
  s.approve(s.cy, s.video, 3);
  submitClaim(s.world.as(s.cy.actor), { task_type_id: s.task, video_id: s.video2.id, evidence_text: `${NOTE} #4` }); // stays pending
  grantBonus(s.world.admin, { memberId: s.cy.memberId, points: 10, xp: 60, reason: 'Monthly challenge winner', idempotencyKey: 'dashboard-0001' });

  board = dashboard(s.world.as(s.cy.actor), s.env);
  const byName = Object.fromEntries(board.members.map((member) => [member.display_name, member]));
  assert.deepEqual(byName.Bo.points, { earned: 50, bonus: 0, pending: 0, total: 50 });
  assert.deepEqual(byName.Cy.points, { earned: 25, bonus: 10, pending: 25, total: 35 });
  assert.deepEqual(byName.Ada.points, { earned: 0, bonus: 0, pending: 0, total: 0 });
  assert.deepEqual([byName.Bo.rank, byName.Cy.rank, byName.Ada.rank], [1, 2, 3]);
  assert.deepEqual(board.leaderboard.map((row) => [row.rank, row.display_name, row.points]), [[1, 'Bo', 50], [2, 'Cy', 35], [3, 'Ada', 0]]);
  assert.equal(byName.Cy.xp, 85);
  assert.equal(byName.Cy.tier.level, 1);
  assert.equal(byName.Cy.tier.next.xp_needed, 15);
  assert.equal(byName.Cy.is_you, true);
  assert.equal(board.period.month, '2026-11');
  assert.equal(board.period.budget.used, 85);

  // Ranking by XP instead is a setting, not a code change.
  updateSettings(s.world.admin, { leaderboard_rank_by: 'xp' });
  board = dashboard(s.world.as(s.cy.actor), s.env);
  assert.deepEqual(board.leaderboard.map((row) => row.display_name), ['Cy', 'Bo', 'Ada']);

  // Revoking an approval moves the board back.
  updateSettings(s.world.admin, { leaderboard_rank_by: 'points' });
  const bosClaims = s.world.db.all('SELECT id FROM claims WHERE member_id = ? ORDER BY created_at, id', [s.bo.memberId]);
  revokeClaim(s.world.admin, bosClaims[0].id, { reason: 'Withdrawn after review' });
  revokeClaim(s.world.admin, bosClaims[1].id, { reason: 'Withdrawn after review' });
  board = dashboard(s.world.as(s.cy.actor), s.env);
  assert.deepEqual(board.leaderboard.map((row) => [row.rank, row.display_name, row.points]), [[1, 'Cy', 35], [2, 'Ada', 0], [2, 'Bo', 0]]);
});

test('what members see of each other is limited to totals and public activity items', () => {
  const s = setup();
  s.approve(s.bo, s.video, 1);
  submitClaim(s.world.as(s.bo.actor), { task_type_id: s.task, video_id: s.video2.id, evidence_text: `${NOTE} #2` });
  adjust(s.world.admin, { memberId: s.bo.memberId, points: -5, reason: 'SECRET-REASON-MARKER deduction', idempotencyKey: 'dashboard-0002' });

  const asAda = dashboard(s.world.as(s.ada.actor), s.env);
  const bo = asAda.members.find((member) => member.display_name === 'Bo');
  assert.deepEqual(bo.recent_activity, [{ id: bo.recent_activity[0].id, type: 'task', label: 'Constructive feedback', video_title: 'Sample long video', points: 25, xp: 25, at: T0 }]);
  assert.equal(bo.cap, undefined, "another member's cap usage is not shown");
  assert.equal(bo.pending_submissions, undefined);
  assert.equal(bo.points.pending, 25);
  const text = JSON.stringify(asAda);
  for (const hidden of ['SECRET-NOTE-MARKER', 'SECRET-REASON-MARKER', '@example.test', 'google_sub', 'youtube_channel_id', 'actor_user_id', 'evidence_text', 'evidence_url', 'decision_note', 'reason']) {
    assert.ok(!text.includes(hidden), `${hidden} leaked into another member's dashboard`);
  }
  // The member themselves and the admin get the extra figures.
  const asBo = dashboard(s.world.as(s.bo.actor), s.env);
  const self = asBo.members.find((member) => member.is_you);
  assert.deepEqual(self.cap, { member_id: s.bo.memberId, limit: 300, used: 25, remaining: 275 });
  assert.equal(self.pending_submissions, 1);
  assert.deepEqual(asBo.viewer.submissions_today, { limit: 5, used: 2, remaining: 3 });
  assert.ok(dashboard(s.world.admin, s.env).members.every((member) => member.cap));

  expectAppError(assert, () => dashboard(s.world.as({ userId: null, role: 'member', memberId: null }), s.env), 'not_signed_in', 401);
});

test('platform statistics are shown separately and never move points, XP or rank', async () => {
  const s = setup();
  s.approve(s.bo, s.video, 1);
  const before = dashboard(s.world.admin, s.env);
  await refreshVideoStats(s.world.admin, s.video.id, s.registry.get('youtube'));
  const after = dashboard(s.world.admin, s.env);
  const video = after.videos.find((item) => item.id === s.video.id);
  assert.deepEqual(video.stats, { views: 1840, likes: 96, comments: 14, source: 'mock_adapter', fetched_at: T0, simulated: true });
  assert.deepEqual(after.leaderboard, before.leaderboard);
  assert.deepEqual(after.members.map((member) => [member.points, member.xp, member.tier]), before.members.map((member) => [member.points, member.xp, member.tier]));
  // The capability matrix states the like-attribution limit in words.
  const like = after.platforms.youtube.find((item) => item.key === 'like_attribution');
  assert.equal(like.status, 'unsupported');
  assert.equal(like.can_earn_points, false);
  // Statistics older than the allowed age disappear from the payload.
  s.world.clock.advance(31 * 24 * 60 * 60 * 1000);
  assert.equal(dashboard(s.world.admin, s.env).videos.find((item) => item.id === s.video.id).stats, null);
});

test('public activity is paginated and excludes reversed, pending and rejected items', () => {
  const s = setup();
  const first = s.approve(s.bo, s.video, 1);
  s.approve(s.bo, s.video2, 2);
  grantBonus(s.world.admin, { memberId: s.bo.memberId, points: 5, reason: 'Surprise', idempotencyKey: 'dashboard-0003' });
  revokeClaim(s.world.admin, first.claim.id, { reason: 'Revoked for the test' });

  const all = memberActivity(s.world.as(s.ada.actor), s.bo.memberId);
  assert.deepEqual(all.items.map((item) => [item.type, item.label, item.points]), [['bonus', 'Bonus', 5], ['task', 'Constructive feedback', 25]]);
  const page1 = memberActivity(s.world.as(s.ada.actor), s.bo.memberId, { limit: 1 });
  assert.equal(page1.items.length, 1);
  const page2 = memberActivity(s.world.as(s.ada.actor), s.bo.memberId, { limit: 1, beforeId: page1.nextBeforeId });
  assert.equal(page2.items[0].type, 'task');
  assert.equal(page2.nextBeforeId, null);
  expectAppError(assert, () => memberActivity(s.world.as(s.ada.actor), 'mbr_missing'), 'member_not_found', 404);
});

test('rankMembers: ties share a place and the next place skips', () => {
  const rows = [
    { id: 'a', display_name: 'A', sort_order: 0, total: 50, xp: 10 },
    { id: 'b', display_name: 'B', sort_order: 0, total: 50, xp: 10 },
    { id: 'c', display_name: 'C', sort_order: 0, total: 50, xp: 5 },
    { id: 'd', display_name: 'D', sort_order: 0, total: 0, xp: 99 },
  ];
  assert.deepEqual(rankMembers(rows, 'points').map((row) => [row.id, row.rank]), [['a', 1], ['b', 1], ['c', 3], ['d', 4]]);
  assert.deepEqual(rankMembers(rows, 'xp').map((row) => [row.id, row.rank]), [['d', 1], ['a', 2], ['b', 2], ['c', 4]]);
});

test('competitions: a window over the ledger, with drafts hidden from members and a replay-safe result bonus', () => {
  const s = setup();
  const window = { name: 'November sprint', description: 'Most approved contributions this fortnight.', starts_at: '2026-11-01T08:00:00.000Z', ends_at: '2026-11-15T08:00:00.000Z' };
  expectAppError(assert, () => createCompetition(s.world.as(s.bo.actor), window), 'admin_only', 403);
  expectAppError(assert, () => createCompetition(s.world.admin, { ...window, name: 'Most likes wins' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => createCompetition(s.world.admin, { ...window, description: 'Cash prize for first place' }), 'money_wording_not_allowed', 422);
  expectAppError(assert, () => createCompetition(s.world.admin, { ...window, ends_at: window.starts_at }), 'invalid_input', 422);
  const competition = createCompetition(s.world.admin, window);
  assert.equal(competition.status, 'draft');
  assert.equal(listCompetitions(s.world.as(s.bo.actor)).length, 0);
  expectAppError(assert, () => competitionStandings(s.world.as(s.bo.actor), competition.id), 'competition_not_found', 404);
  expectAppError(assert, () => updateCompetition(s.world.admin, competition.id, { status: 'closed' }), 'invalid_status_change', 409);
  updateCompetition(s.world.admin, competition.id, { status: 'active' });
  expectAppError(assert, () => updateCompetition(s.world.admin, competition.id, { ends_at: '2026-12-01T08:00:00.000Z' }), 'competition_started', 409);

  s.approve(s.bo, s.video, 1); // inside the window (T0 is 9 November)
  s.world.clock.set('2026-11-20T20:00:00.000Z');
  s.approve(s.cy, s.video, 2); // after the window
  const { standings } = competitionStandings(s.world.as(s.ada.actor), competition.id);
  assert.deepEqual(standings.map((row) => [row.place, row.display_name, row.points]), [[1, 'Bo', 25], [2, 'Ada', 0], [2, 'Cy', 0]]);

  const bonus = { memberId: s.bo.memberId, points: 20, reason: 'November sprint winner', competitionId: competition.id, idempotencyKey: `competition:${competition.id}:${s.bo.memberId}` };
  const granted = grantBonus(s.world.admin, bonus);
  assert.equal(grantBonus(s.world.admin, bonus).entry.id, granted.entry.id, 'granting the same result twice is a replay');
  assert.equal(memberActivity(s.world.as(s.ada.actor), s.bo.memberId).items[0].label, 'Bonus: November sprint');
  assert.equal(updateCompetition(s.world.admin, competition.id, { status: 'closed' }).status, 'closed');
});
