import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, insertMember, insertMemberWithUser, expectAppError } from '../helpers.js';
import { createVideo, listVideos, parseVideoUrl, purgeStaleStats, refreshVideoStats, updateVideo } from '../../src/domain/videos.js';
import { createTaskType, listTaskTypes, updateTaskType } from '../../src/domain/taskTypes.js';
import { createPlatformRegistry } from '../../src/platforms/registry.js';

test('video links are parsed and canonicalised; anything else is refused', () => {
  assert.deepEqual(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), { platform: 'youtube', platformVideoId: 'dQw4w9WgXcQ', kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.equal(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?si=abc').platformVideoId, 'dQw4w9WgXcQ');
  assert.deepEqual(parseVideoUrl('https://m.youtube.com/shorts/abcDEF12345'), { platform: 'youtube', platformVideoId: 'abcDEF12345', kind: 'short', url: 'https://www.youtube.com/shorts/abcDEF12345' });
  assert.deepEqual(parseVideoUrl('https://www.tiktok.com/@some.creator/video/7301234567890123456?lang=en'), { platform: 'tiktok', platformVideoId: '7301234567890123456', kind: 'short', url: 'https://www.tiktok.com/@some.creator/video/7301234567890123456' });
  for (const bad of [
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/channel/UCabc', 'https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)', 'not a link', 'https://www.tiktok.com/@a/video/abc', 'https://www.tiktok.com/video/7301234567890123456',
  ]) {
    assert.throws(() => parseVideoUrl(bad), (error) => error.status === 422, bad);
  }
});

test('videos: add by link, reject duplicates, update, and admin-only', () => {
  const world = makeWorld();
  const owner = insertMember(world.db, { name: 'Ada' });
  const video = createVideo(world.admin, { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'First upload', owner_member_id: owner });
  assert.equal(video.platform, 'youtube');
  assert.equal(video.stats, null);
  expectAppError(assert, () => createVideo(world.admin, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Same again' }), 'video_exists', 409);
  expectAppError(assert, () => createVideo(world.admin, { url: 'https://youtu.be/aaaaaaaaaaa', title: 'Ghost owner', owner_member_id: 'mbr_missing' }), 'member_not_found', 404);
  expectAppError(assert, () => createVideo(world.admin, { url: 'https://youtu.be/bbbbbbbbbbb', title: 'x', stats_json: '{}' }), 'unknown_field', 422);

  assert.equal(updateVideo(world.admin, video.id, { title: 'Renamed', status: 'archived' }).status, 'archived');
  assert.equal(listVideos(world.admin).length, 0);

  const member = insertMemberWithUser(world.db, 'Bo');
  expectAppError(assert, () => createVideo(world.as(member.actor), { url: 'https://youtu.be/ccccccccccc', title: 'Not allowed' }), 'admin_only', 403);
  assert.equal(listVideos(world.as(member.actor), { includeArchived: true }).length, 1);
});

test('statistics: stored with source and time, kept on failure, labelled as simulated, purged when stale', async () => {
  const world = makeWorld();
  const youtube = createPlatformRegistry({ mode: 'mock', clock: world.clock }).get('youtube');
  const video = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoLong001', kind: 'video', title: 'Sample long video' });

  const ok = await refreshVideoStats(world.admin, video.id, youtube);
  assert.equal(ok.result.ok, true);
  assert.deepEqual(ok.video.stats, { views: 1840, likes: 96, comments: 14, source: 'mock_adapter', fetched_at: '2026-11-09T20:00:00.000Z', simulated: true });

  // A failing refresh reports the error and leaves the earlier numbers alone.
  const failing = createVideo(world.admin, { platform: 'youtube', platform_video_id: 'demoQuota01', kind: 'video', title: 'Quota case' });
  const failed = await refreshVideoStats(world.admin, failing.id, youtube);
  assert.equal(failed.result.ok, false);
  assert.equal(failed.result.error.code, 'quota_exceeded');
  assert.equal(failed.video.stats, null);

  world.clock.advance(29 * 24 * 60 * 60 * 1000);
  assert.equal(purgeStaleStats(world.system), 0);
  world.clock.advance(2 * 24 * 60 * 60 * 1000);
  assert.equal(purgeStaleStats(world.system), 1);
  assert.equal(listVideos(world.admin).find((item) => item.id === video.id).stats, null);

  const member = insertMemberWithUser(world.db, 'Bo');
  await assert.rejects(() => refreshVideoStats(world.as(member.actor), video.id, youtube), (error) => error.code === 'admin_only');
});

test('task types: contributions only — engagement and money wording are refused', () => {
  const world = makeWorld();
  const task = createTaskType(world.admin, { key: 'constructive_feedback', label: 'Constructive feedback', description: 'Tell the creator what you liked about the edit and one thing to improve.', points: 25, xp: 25 });
  assert.equal(task.points, 25);
  assert.equal(task.requires_video, false);
  assert.equal(task.api_check, 'none');

  const base = { key: 'some_task', label: 'Some task', points: 25, xp: 0 };
  expectAppError(assert, () => createTaskType(world.admin, { ...base, key: 'like_video' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, label: 'Comment on the short' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, description: 'Subscribe to the channel, then submit.' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, label: 'Cash bonus task' }), 'money_wording_not_allowed', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, points: 0, xp: 0 }), 'invalid_input', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, points: 1001 }), 'invalid_input', 422);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, key: 'constructive_feedback' }), 'task_key_taken', 409);
  expectAppError(assert, () => createTaskType(world.admin, { ...base, category: 'engagement' }), 'unknown_field', 422);

  expectAppError(assert, () => updateTaskType(world.admin, task.id, { label: 'Leave a comment' }), 'engagement_not_rewardable', 422);
  expectAppError(assert, () => updateTaskType(world.admin, task.id, { key: 'renamed_key' }), 'unknown_field', 422);
  expectAppError(assert, () => updateTaskType(world.admin, task.id, { points: 0, xp: 0 }), 'invalid_input', 422);
  const updated = updateTaskType(world.admin, task.id, { points: 30, active: false });
  assert.equal(updated.points, 30);
  assert.equal(updated.active, false);
  assert.equal(listTaskTypes(world.admin).length, 0);
  assert.equal(listTaskTypes(world.admin, { includeInactive: true }).length, 1);

  const member = insertMemberWithUser(world.db, 'Bo');
  expectAppError(assert, () => createTaskType(world.as(member.actor), base), 'admin_only', 403);
  expectAppError(assert, () => updateTaskType(world.as(member.actor), task.id, { points: 999 }), 'admin_only', 403);
});

test('a task keeps its automatic check while submissions verified under it exist', async () => {
  const world = makeWorld();
  const { submitClaim, runApiCheck } = await import('../../src/domain/claims.js');
  const { linkYoutubeChannel } = await import('../../src/domain/members.js');
  const { checkIntegrity } = await import('../../src/domain/integrity.js');
  const member = insertMemberWithUser(world.db, 'Ada');
  linkYoutubeChannel(world.system, { memberId: member.memberId, channelId: 'UC-demo-01', attestedBy: 'demo_seed' });
  const task = createTaskType(world.admin, { key: 'creative_submission', label: 'Original creative submission', points: 25, xp: 40, api_check: 'video_ownership' });
  const registry = createPlatformRegistry({ mode: 'mock', clock: world.clock });
  const claim = submitClaim(world.as(member.actor), { task_type_id: task.id, evidence_url: 'https://youtu.be/demoOwnA001' });
  assert.equal((await runApiCheck(world.admin, claim.id, registry)).claim.verification_status, 'verified');

  // An ordinary admin edit must not be able to leave the database failing its own start-up check.
  expectAppError(assert, () => updateTaskType(world.admin, task.id, { api_check: 'none' }), 'task_has_verified_claims', 409);
  assert.throws(() => world.db.run("UPDATE task_types SET api_check = 'none' WHERE id = ?", [task.id]), /a task with verified claims keeps its automatic check/);
  assert.equal(updateTaskType(world.admin, task.id, { points: 30 }).api_check, 'video_ownership');
  assert.deepEqual(checkIntegrity(world.db).violations, []);

  // A task with no verified submissions can still have its check switched off.
  const other = createTaskType(world.admin, { key: 'second_creative_task', label: 'Second creative task', points: 10, xp: 10, api_check: 'video_ownership' });
  assert.equal(updateTaskType(world.admin, other.id, { api_check: 'none' }).api_check, 'none');
});
