// Mock TikTok adapter. TikTok offers a small private app no way to attest who liked,
// commented on or owns a video, so every check answers "unsupported" — in mock mode and,
// as far as the research shows, in any live mode this product could realistically get.

import { checkResult, failure, statsResult } from './contract.js';
import { capabilitiesFor } from './capabilities.js';
import { MOCK_FAILURES, MOCK_TIKTOK_VIDEOS } from './mockData.js';

const SOURCE = 'mock_adapter';

export function createMockTiktokAdapter({ clock }) {
  const unsupported = (capability, reason) => async () => checkResult('unsupported', reason, { source: SOURCE, capability });
  return Object.freeze({
    platform: 'tiktok',
    mode: 'mock',
    capabilities: () => capabilitiesFor('tiktok'),

    async fetchVideoStats(platformVideoId) {
      const fail = MOCK_FAILURES[platformVideoId];
      if (fail) return failure(fail.code, fail.message);
      const video = MOCK_TIKTOK_VIDEOS[platformVideoId];
      if (!video) return failure('not_found', 'That video could not be found. It may be private or deleted.');
      return statsResult(video.stats, { fetchedAt: clock.now().toISOString(), source: SOURCE });
    },

    checkVideoOwnership: unsupported('video_ownership', 'TikTok ownership cannot be checked automatically. A person reviews TikTok submissions.'),
    checkComment: unsupported('comment_attribution', 'TikTok does not let an app like this one see who commented on a video.'),
    checkLike: unsupported('like_attribution', 'TikTok does not let an app like this one see who liked a video.'),
  });
}
