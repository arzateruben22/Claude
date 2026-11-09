// What each platform can attest, in words a person can read. The UI shows this so that
// limits (above all: nobody can see who liked a video) are stated, not hidden.
//
// Source of truth for the claims: docs/PLATFORM_CAPABILITIES.md. `evidence` uses its tiers:
//   A  read directly from the official machine-readable API description
//   B  official page, seen through search excerpts (not checked verbatim)
//   C  inference from the absence of any such method
//
// status
//   supported     available through the official API
//   conditional   available only when a stated condition holds
//   unsupported   the platform does not offer it to an app like this
//
// used_by_product
//   yes            the prototype relies on it
//   informational  may be displayed, never rewarded
//   no             possible in principle, deliberately not used
//
// can_earn_points is false for every engagement capability, always.

const freeze = (list) => Object.freeze(list.map((item) => Object.freeze(item)));

export const CAPABILITIES = Object.freeze({
  youtube: freeze([
    {
      key: 'video_stats',
      label: 'View, like and comment counts',
      status: 'supported',
      used_by_product: 'informational',
      can_earn_points: false,
      explanation: 'Total counts for a video can be shown as statistics. They never affect points, XP or rank.',
      evidence: 'A',
      source_url: 'https://developers.google.com/youtube/v3/docs/videos/list',
    },
    {
      key: 'like_attribution',
      label: 'Which people liked a video',
      status: 'unsupported',
      used_by_product: 'no',
      can_earn_points: false,
      explanation: 'YouTube does not let any app see who liked a video — only the total. A like can therefore never be verified here, and likes never earn points.',
      evidence: 'C',
      source_url: 'https://developers.google.com/youtube/v3/docs/videos',
    },
    {
      key: 'own_like_check',
      label: "A member's own like",
      status: 'conditional',
      condition: 'Only with that member granting YouTube access themselves.',
      used_by_product: 'no',
      can_earn_points: false,
      explanation: 'YouTube can tell an app how the signed-in person rated a video, if they grant access. This product does not ask for it, because likes are never rewarded.',
      evidence: 'A',
      source_url: 'https://developers.google.com/youtube/v3/docs/videos/getRating',
    },
    {
      key: 'comment_attribution',
      label: 'Whether a member commented on a video',
      status: 'conditional',
      condition: 'The member has linked their YouTube channel, the comment is public, and it carries an author channel id.',
      used_by_product: 'informational',
      can_earn_points: false,
      explanation: 'A public comment can be matched to a linked channel. There is no search by author, so a video’s comments must be scanned; hidden, held or removed comments cannot be seen. Comments never earn points.',
      evidence: 'A',
      source_url: 'https://developers.google.com/youtube/v3/docs/commentThreads/list',
    },
    {
      key: 'video_ownership',
      label: "That a submitted video is on the member's own channel",
      status: 'conditional',
      condition: 'The member has linked their YouTube channel.',
      used_by_product: 'yes',
      can_earn_points: true,
      explanation: 'For an original creative submission, the video’s channel can be compared with the member’s linked channel. A match is the only automatic “verified” in this product; an admin still decides whether to credit it.',
      evidence: 'to_confirm',
      source_url: 'https://developers.google.com/youtube/v3/docs/videos',
    },
    {
      key: 'subscription_check',
      label: "A member's own subscription to a channel",
      status: 'conditional',
      condition: 'Only with that member granting YouTube access themselves.',
      used_by_product: 'no',
      can_earn_points: false,
      explanation: 'Possible with the member’s consent, and deliberately unused: subscriptions never earn points.',
      evidence: 'A',
      source_url: 'https://developers.google.com/youtube/v3/docs/subscriptions/list',
    },
  ]),
  tiktok: freeze([
    {
      key: 'video_stats',
      label: 'View, like, comment and share counts',
      status: 'conditional',
      condition: 'Only for the videos of an account that has authorised an approved app.',
      used_by_product: 'informational',
      can_earn_points: false,
      explanation: 'TikTok shares totals only for the authorising creator’s own public videos, and only to an app that passed TikTok’s review.',
      evidence: 'B',
      source_url: 'https://developers.tiktok.com/doc/tiktok-api-scopes',
    },
    {
      key: 'like_attribution',
      label: 'Which people liked a video',
      status: 'unsupported',
      used_by_product: 'no',
      can_earn_points: false,
      explanation: 'TikTok does not offer this to an app like this one. Likes can never be verified here and never earn points.',
      evidence: 'B',
      source_url: 'https://developers.tiktok.com/doc/tiktok-api-scopes',
    },
    {
      key: 'comment_attribution',
      label: 'Whether a member commented on a video',
      status: 'unsupported',
      used_by_product: 'no',
      can_earn_points: false,
      explanation: 'TikTok does not offer this to an app like this one. Comments never earn points.',
      evidence: 'B',
      source_url: 'https://developers.tiktok.com/doc/tiktok-api-scopes',
    },
    {
      key: 'video_ownership',
      label: "That a submitted video is on the member's own account",
      status: 'unsupported',
      used_by_product: 'no',
      can_earn_points: true,
      explanation: 'Not available without an approved TikTok app, which a small private dashboard is unlikely to get. TikTok submissions are reviewed by a person.',
      evidence: 'B',
      source_url: 'https://developers.tiktok.com/doc/display-api-overview',
    },
  ]),
});

export function capabilitiesFor(platform) {
  const list = CAPABILITIES[platform];
  if (!list) throw new TypeError(`unknown platform: ${platform}`);
  return list;
}

export function capability(platform, key) {
  return capabilitiesFor(platform).find((item) => item.key === key) ?? null;
}
