// Deterministic sample data for the mock adapters. Nothing here is real: the channel
// ids, video ids and numbers are invented, and every id is recognisable by its prefix.

export const DEMO_CHANNEL_PREFIX = 'UC-demo-';
export const DEMO_VIDEO_PREFIX = 'demo-';

/** Demo channel id for the n-th sample member (1-based). */
export const demoChannelId = (n) => `${DEMO_CHANNEL_PREFIX}${String(n).padStart(2, '0')}`;

export const MOCK_YOUTUBE_VIDEOS = Object.freeze({
  'demo-yt-long-01': { channelId: demoChannelId(1), stats: { views: 1840, likes: 96, comments: 14 }, commenters: [demoChannelId(2)], commentsScanned: 14 },
  'demo-yt-short-01': { channelId: demoChannelId(1), stats: { views: 12950, likes: 811, comments: 37 }, commenters: [demoChannelId(2), demoChannelId(3)], commentsScanned: 37 },
  'demo-yt-short-02': { channelId: demoChannelId(2), stats: { views: 4210, likes: 240, comments: 9 }, commenters: [], commentsScanned: 9 },
  'demo-yt-long-02': { channelId: demoChannelId(3), stats: { views: 655, likes: 41, comments: 3 }, commenters: [demoChannelId(1)], commentsScanned: 3 },
  // A video with more comments than one scan covers: a miss here is "not found so far", not "did not comment".
  'demo-yt-busy-01': { channelId: demoChannelId(2), stats: { views: 98200, likes: 5120, comments: 1460 }, commenters: [], commentsScanned: 500, commentsTotal: 1460 },
  // The owner hid the like count.
  'demo-yt-hidden-likes': { channelId: demoChannelId(3), stats: { views: 2300, likes: null, comments: 11 }, commenters: [], commentsScanned: 11 },
});

/** Video ids that make the mock adapter fail in a specific, honest way. */
export const MOCK_FAILURES = Object.freeze({
  'demo-fail-quota': { code: 'quota_exceeded', message: 'The daily API quota is used up. Try again after it resets.' },
  'demo-fail-missing': { code: 'not_found', message: 'That video could not be found. It may be private or deleted.' },
  'demo-fail-forbidden': { code: 'forbidden', message: 'The platform refused this request.' },
  'demo-fail-outage': { code: 'unavailable', message: 'The platform did not respond. Try again later.' },
});

export const MOCK_TIKTOK_VIDEOS = Object.freeze({
  'demo-tt-01': { stats: { views: 30400, likes: 2210, comments: 88 } },
  'demo-tt-02': { stats: { views: 870, likes: 52, comments: 4 } },
});
