// Mock YouTube adapter: behaves like the planned live adapter, on invented data.
// Every result is labelled `source: 'mock_adapter'` so nothing simulated can be
// mistaken for a real platform attestation.

import { checkResult, failure, statsResult } from './contract.js';
import { capabilitiesFor } from './capabilities.js';
import { MOCK_FAILURES, MOCK_YOUTUBE_VIDEOS } from './mockData.js';

const SOURCE = 'mock_adapter';
const SIMULATED = 'Simulated result from sample data — not a real YouTube check.';

export function createMockYoutubeAdapter({ clock }) {
  const lookup = (platformVideoId) => {
    const fail = MOCK_FAILURES[platformVideoId];
    if (fail) return failure(fail.code, fail.message);
    const video = MOCK_YOUTUBE_VIDEOS[platformVideoId];
    if (!video) return failure('not_found', 'That video could not be found. It may be private or deleted.');
    return { ok: true, video };
  };

  const failedCheck = (error) => {
    if (error.code === 'not_found') return checkResult('not_attested', error.message, { source: SOURCE, simulated: true });
    return checkResult('unavailable', error.message, { source: SOURCE, simulated: true, error_code: error.code, retryable: error.retryable });
  };

  return Object.freeze({
    platform: 'youtube',
    mode: 'mock',
    capabilities: () => capabilitiesFor('youtube'),

    async fetchVideoStats(platformVideoId) {
      const found = lookup(platformVideoId);
      if (!found.ok) return found;
      return statsResult(found.video.stats, { fetchedAt: clock.now().toISOString(), source: SOURCE });
    },

    async checkVideoOwnership({ platformVideoId, memberChannelId }) {
      if (!memberChannelId) {
        return checkResult('not_attested', 'This member has not linked a YouTube channel, so ownership cannot be checked.', { source: SOURCE, simulated: true, member_linked: false });
      }
      const found = lookup(platformVideoId);
      if (!found.ok) return failedCheck(found.error);
      const matches = found.video.channelId === memberChannelId;
      return checkResult(
        matches ? 'attested' : 'not_attested',
        matches ? `The video is on the member's linked channel. ${SIMULATED}` : `The video is not on the member's linked channel. ${SIMULATED}`,
        { source: SOURCE, simulated: true, member_linked: true, channel_matches: matches },
      );
    },

    // Informational only: a comment can never earn points.
    async checkComment({ platformVideoId, memberChannelId }) {
      if (!memberChannelId) {
        return checkResult('not_attested', 'This member has not linked a YouTube channel, so comments cannot be matched.', { source: SOURCE, simulated: true, member_linked: false });
      }
      const found = lookup(platformVideoId);
      if (!found.ok) return failedCheck(found.error);
      const { commenters, commentsScanned, commentsTotal = commentsScanned } = found.video;
      const complete = commentsScanned >= commentsTotal;
      const evidence = { source: SOURCE, simulated: true, comments_scanned: commentsScanned, comments_total: commentsTotal, scan_complete: complete };
      if (commenters.includes(memberChannelId)) {
        return checkResult('attested', `A public comment from the member's linked channel was found. ${SIMULATED}`, evidence);
      }
      return checkResult(
        'not_attested',
        complete
          ? `No public comment from the member's linked channel was found in all ${commentsScanned} comments. Hidden, held or removed comments cannot be seen. ${SIMULATED}`
          : `Not found in the ${commentsScanned} of ${commentsTotal} comments checked so far. This is not proof that there is no comment. ${SIMULATED}`,
        evidence,
      );
    },

    // The honest answer, for every video and every member, is that this cannot be known.
    async checkLike() {
      return checkResult('unsupported', 'YouTube does not let any app see who liked a video — only the total. A like can never be verified.', { source: SOURCE, capability: 'like_attribution' });
    },
  });
}
