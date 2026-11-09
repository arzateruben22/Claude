// Chooses the adapters for the configured mode.
//
//   mock : sample data, every result labelled as simulated
//   live : real platform APIs. NOT BUILT YET — it needs credentials and the checks listed
//          in docs/PLATFORM_CAPABILITIES.md §5. Until then "live" answers `not_configured`
//          to everything, which the UI shows as "not connected". It never guesses.

import { assertAdapter, checkResult, failure, PLATFORMS } from './contract.js';
import { capabilitiesFor } from './capabilities.js';
import { createMockYoutubeAdapter } from './mockYoutube.js';
import { createMockTiktokAdapter } from './mockTiktok.js';

const NOT_CONNECTED = 'This platform is not connected yet, so nothing can be checked automatically.';

function createNotConnectedAdapter(platform) {
  const notConfigured = async () => checkResult('not_configured', NOT_CONNECTED, { source: 'none' });
  return Object.freeze({
    platform,
    mode: 'live',
    capabilities: () => capabilitiesFor(platform),
    fetchVideoStats: async () => failure('not_configured', NOT_CONNECTED),
    checkVideoOwnership: notConfigured,
    checkComment: notConfigured,
    checkLike: async () => checkResult('unsupported', capabilitiesFor(platform).find((item) => item.key === 'like_attribution').explanation, { source: 'none', capability: 'like_attribution' }),
  });
}

/**
 * @param {{ mode: 'mock'|'live', clock: { now(): Date }, overrides?: Record<string, object> }} options
 *        `overrides` lets tests (and later the live build) supply an adapter per platform.
 */
export function createPlatformRegistry({ mode, clock, overrides = {} }) {
  if (mode !== 'mock' && mode !== 'live') throw new TypeError('PLATFORM_MODE must be "mock" or "live"');
  const adapters = new Map();
  for (const platform of PLATFORMS) {
    let adapter = overrides[platform];
    if (!adapter) {
      if (mode === 'mock') adapter = platform === 'youtube' ? createMockYoutubeAdapter({ clock }) : createMockTiktokAdapter({ clock });
      else adapter = createNotConnectedAdapter(platform);
    }
    adapters.set(platform, assertAdapter(adapter));
  }
  return Object.freeze({
    mode,
    /** True when results are simulated; the API reports this as `demo_mode`. */
    simulated: mode === 'mock',
    get(platform) {
      const adapter = adapters.get(platform);
      if (!adapter) throw new TypeError(`unknown platform: ${platform}`);
      return adapter;
    },
    /** Capability matrix for every platform, for display. */
    capabilities() {
      return Object.fromEntries(PLATFORMS.map((platform) => [platform, adapters.get(platform).capabilities()]));
    },
  });
}
