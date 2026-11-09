import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedClock } from '../../src/lib/clock.js';
import { createPlatformRegistry } from '../../src/platforms/registry.js';
import { assertAdapter, CHECK_OUTCOMES, ERROR_CODES, outcomeForError } from '../../src/platforms/contract.js';
import { CAPABILITIES, capability } from '../../src/platforms/capabilities.js';
import { demoChannelId } from '../../src/platforms/mockData.js';

const clock = fixedClock('2026-11-09T20:00:00.000Z');
const mock = () => createPlatformRegistry({ mode: 'mock', clock });

test('every adapter in every mode implements the contract', () => {
  for (const mode of ['mock', 'live']) {
    const registry = createPlatformRegistry({ mode, clock });
    for (const platform of ['youtube', 'tiktok']) {
      const adapter = assertAdapter(registry.get(platform));
      assert.equal(adapter.platform, platform);
      assert.equal(adapter.mode, mode);
    }
    assert.equal(registry.simulated, mode === 'mock');
  }
  assert.throws(() => createPlatformRegistry({ mode: 'real', clock }), /PLATFORM_MODE/);
  assert.throws(() => mock().get('myspace'), /unknown platform/);
});

test('no engagement capability can earn points, on any platform', () => {
  const engagement = ['video_stats', 'like_attribution', 'own_like_check', 'comment_attribution', 'subscription_check'];
  for (const [platform, list] of Object.entries(CAPABILITIES)) {
    for (const item of list) {
      if (engagement.includes(item.key)) assert.equal(item.can_earn_points, false, `${platform}.${item.key}`);
      assert.ok(['supported', 'conditional', 'unsupported'].includes(item.status));
      assert.ok(['yes', 'informational', 'no'].includes(item.used_by_product));
      assert.ok(item.explanation.length > 20);
      assert.match(item.source_url, /^https:\/\/developers\.(google|tiktok)\.com\//);
      if (item.status === 'conditional') assert.ok(item.condition, `${platform}.${item.key} needs a stated condition`);
    }
  }
  assert.equal(capability('youtube', 'like_attribution').status, 'unsupported');
  assert.equal(capability('tiktok', 'like_attribution').status, 'unsupported');
});

test('like attribution is reported as unsupported everywhere, never guessed', async () => {
  for (const mode of ['mock', 'live']) {
    const registry = createPlatformRegistry({ mode, clock });
    for (const platform of ['youtube', 'tiktok']) {
      const result = await registry.get(platform).checkLike({ platformVideoId: 'demo-yt-long-01', memberChannelId: demoChannelId(1) });
      assert.equal(result.outcome, 'unsupported', `${mode}/${platform}`);
      assert.match(result.reason, /like/i);
    }
  }
});

test('mock YouTube: statistics, including a hidden like count and labelled source', async () => {
  const youtube = mock().get('youtube');
  const stats = await youtube.fetchVideoStats('demo-yt-long-01');
  assert.deepEqual(stats, { ok: true, stats: { views: 1840, likes: 96, comments: 14 }, fetched_at: '2026-11-09T20:00:00.000Z', source: 'mock_adapter' });
  const hidden = await youtube.fetchVideoStats('demo-yt-hidden-likes');
  assert.equal(hidden.stats.likes, null);
});

test('mock YouTube: API failures come back as results, with honest codes', async () => {
  const youtube = mock().get('youtube');
  const cases = { 'demo-fail-quota': ['quota_exceeded', true], 'demo-fail-missing': ['not_found', false], 'demo-fail-forbidden': ['forbidden', false], 'demo-fail-outage': ['unavailable', true], 'no-such-video': ['not_found', false] };
  for (const [id, [code, retryable]] of Object.entries(cases)) {
    const result = await youtube.fetchVideoStats(id);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.equal(result.error.retryable, retryable);
    assert.ok(ERROR_CODES.includes(result.error.code));
    assert.ok(result.error.message.length > 10);
  }
});

test('mock YouTube: ownership is attested only on an exact channel match', async () => {
  const youtube = mock().get('youtube');
  const own = await youtube.checkVideoOwnership({ platformVideoId: 'demo-yt-long-01', memberChannelId: demoChannelId(1) });
  assert.equal(own.outcome, 'attested');
  assert.equal(own.evidence.simulated, true);
  assert.match(own.reason, /Simulated/);

  const other = await youtube.checkVideoOwnership({ platformVideoId: 'demo-yt-long-01', memberChannelId: demoChannelId(2) });
  assert.equal(other.outcome, 'not_attested');

  const unlinked = await youtube.checkVideoOwnership({ platformVideoId: 'demo-yt-long-01', memberChannelId: null });
  assert.equal(unlinked.outcome, 'not_attested');
  assert.equal(unlinked.evidence.member_linked, false);

  const quota = await youtube.checkVideoOwnership({ platformVideoId: 'demo-fail-quota', memberChannelId: demoChannelId(1) });
  assert.equal(quota.outcome, 'unavailable');
  assert.equal(quota.evidence.error_code, 'quota_exceeded');

  const missing = await youtube.checkVideoOwnership({ platformVideoId: 'demo-fail-missing', memberChannelId: demoChannelId(1) });
  assert.equal(missing.outcome, 'not_attested');
  for (const result of [own, other, unlinked, quota, missing]) assert.ok(CHECK_OUTCOMES.includes(result.outcome));
});

test('mock YouTube: an incomplete comment scan is never reported as "did not comment"', async () => {
  const youtube = mock().get('youtube');
  const found = await youtube.checkComment({ platformVideoId: 'demo-yt-short-01', memberChannelId: demoChannelId(3) });
  assert.equal(found.outcome, 'attested');

  const completeMiss = await youtube.checkComment({ platformVideoId: 'demo-yt-short-02', memberChannelId: demoChannelId(1) });
  assert.equal(completeMiss.outcome, 'not_attested');
  assert.equal(completeMiss.evidence.scan_complete, true);

  const partialMiss = await youtube.checkComment({ platformVideoId: 'demo-yt-busy-01', memberChannelId: demoChannelId(1) });
  assert.equal(partialMiss.outcome, 'not_attested');
  assert.equal(partialMiss.evidence.scan_complete, false);
  assert.match(partialMiss.reason, /not proof/);
});

test('mock TikTok: statistics only; every attribution check is unsupported', async () => {
  const tiktok = mock().get('tiktok');
  assert.equal((await tiktok.fetchVideoStats('demo-tt-01')).ok, true);
  assert.equal((await tiktok.fetchVideoStats('demo-fail-quota')).error.code, 'quota_exceeded');
  for (const method of ['checkVideoOwnership', 'checkComment', 'checkLike']) {
    assert.equal((await tiktok[method]({ platformVideoId: 'demo-tt-01', memberChannelId: 'x' })).outcome, 'unsupported');
  }
});

test('live mode without credentials answers "not connected" instead of guessing', async () => {
  const registry = createPlatformRegistry({ mode: 'live', clock });
  const stats = await registry.get('youtube').fetchVideoStats('anything');
  assert.deepEqual(stats.error.code, 'not_configured');
  assert.equal((await registry.get('youtube').checkVideoOwnership({ platformVideoId: 'x', memberChannelId: 'y' })).outcome, 'not_configured');
  assert.equal((await registry.get('tiktok').checkComment({ platformVideoId: 'x', memberChannelId: 'y' })).outcome, 'not_configured');
});

test('error codes map to the outcome a caller must record', () => {
  assert.equal(outcomeForError({ code: 'not_configured' }), 'not_configured');
  assert.equal(outcomeForError({ code: 'unsupported' }), 'unsupported');
  assert.equal(outcomeForError({ code: 'not_found' }), 'not_attested');
  assert.equal(outcomeForError({ code: 'quota_exceeded' }), 'unavailable');
  assert.equal(outcomeForError({ code: 'forbidden' }), 'unavailable');
});

test('a registry accepts an override adapter and rejects a malformed one', () => {
  const stub = { platform: 'youtube', mode: 'live', capabilities: () => [], fetchVideoStats: async () => ({}), checkVideoOwnership: async () => ({}), checkComment: async () => ({}), checkLike: async () => ({}) };
  assert.equal(createPlatformRegistry({ mode: 'live', clock, overrides: { youtube: stub } }).get('youtube'), stub);
  assert.throws(() => createPlatformRegistry({ mode: 'live', clock, overrides: { youtube: { platform: 'youtube', mode: 'live' } } }), /must be a function/);
});
