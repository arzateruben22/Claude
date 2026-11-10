// Deterministic sample data for the mock adapters. Nothing here is real: the channel
// ids, video ids and numbers are invented, and every id is recognisable by its prefix.
//
// The video ids have the SHAPE of real ones (11 characters for YouTube, digits for
// TikTok) so that sample links go through exactly the same parsing as real links.

export const DEMO_CHANNEL_PREFIX = 'UC-demo-';
export const DEMO_VIDEO_PREFIX = 'demo';

/** Demo channel id for the n-th sample member (1-based). */
export const demoChannelId = (n) => `${DEMO_CHANNEL_PREFIX}${String(n).padStart(2, '0')}`;

export const youtubeDemoUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export const MOCK_YOUTUBE_VIDEOS = Object.freeze({
  demoLong001: { channelId: demoChannelId(1), stats: { views: 1840, likes: 96, comments: 14 }, commenters: [demoChannelId(2)], commentsScanned: 14 },
  demoShort01: { channelId: demoChannelId(1), stats: { views: 12950, likes: 811, comments: 37 }, commenters: [demoChannelId(2), demoChannelId(3)], commentsScanned: 37 },
  demoShort02: { channelId: demoChannelId(2), stats: { views: 4210, likes: 240, comments: 9 }, commenters: [], commentsScanned: 9 },
  demoLong002: { channelId: demoChannelId(3), stats: { views: 655, likes: 41, comments: 3 }, commenters: [demoChannelId(1)], commentsScanned: 3 },
  // A video with more comments than one scan covers: a miss here is "not found so far", not "did not comment".
  demoBusy001: { channelId: demoChannelId(2), stats: { views: 98200, likes: 5120, comments: 1460 }, commenters: [], commentsScanned: 500, commentsTotal: 1460 },
  // The owner hid the like count.
  demoHidden1: { channelId: demoChannelId(3), stats: { views: 2300, likes: null, comments: 11 }, commenters: [], commentsScanned: 11 },
  // Not on the tracked list in the seed: used for "original creative submission" claims.
  demoOwnA001: { channelId: demoChannelId(1), stats: { views: 310, likes: 22, comments: 2 }, commenters: [], commentsScanned: 2 },
  demoOwnB001: { channelId: demoChannelId(2), stats: { views: 95, likes: 9, comments: 0 }, commenters: [], commentsScanned: 0 },
});

/** Video ids that make the mock adapters fail in a specific, honest way. */
export const MOCK_FAILURES = Object.freeze({
  demoQuota01: { code: 'quota_exceeded', message: 'The daily API quota is used up. Try again after it resets.' },
  demoMissing: { code: 'not_found', message: 'That video could not be found. It may be private or deleted.' },
  demoForbid1: { code: 'forbidden', message: 'The platform refused this request.' },
  demoOutage1: { code: 'unavailable', message: 'The platform did not respond. Try again later.' },
  // TikTok ids are long digit strings: always quoted, never number literals (they exceed 2^53).
  '7999999999999999001': { code: 'quota_exceeded', message: 'The daily API quota is used up. Try again after it resets.' },
});

export const MOCK_TIKTOK_VIDEOS = Object.freeze({
  '7000000000000000001': { stats: { views: 30400, likes: 2210, comments: 88 } },
  '7000000000000000002': { stats: { views: 870, likes: 52, comments: 4 } },
});
