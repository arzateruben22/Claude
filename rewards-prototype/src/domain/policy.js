// Guardrails that keep the product inside its own rules:
//
//   1. Points may reward CONTRIBUTIONS (private constructive feedback, original creative
//      work, approved challenges). They may never reward ENGAGEMENT: likes, comments,
//      views, shares, follows or subscriptions. Platforms prohibit incentivised
//      engagement, and the owner's brief rules it out.
//   2. Points are virtual. Nothing a member reads may suggest money, payment or redemption.
//
// The structural guarantee is in the schema (no table links an engagement statistic to
// the ledger). This module is the second line: it stops an admin from *describing* a
// task, bonus or adjustment as a reward for engagement, or in money terms, by accident.
// It is a lint, not a lie detector: it cannot stop someone determined to mislabel, so
// every admin action is also audit-logged.

import { unprocessable } from '../lib/errors.js';

// Short identifiers (task keys and labels): any engagement word is refused outright.
const ENGAGEMENT_WORDS =
  /(?<![a-z])(likes?|liked|liking|comments?|commented|commenting|views?|viewed|viewing|watch(?:ed|ing|es)?|watch[\s_-]?time|shares?|shared|sharing|follows?|followed|following|followers?|subscribes?|subscribed|subscribing|subscribers?|subscriptions?|subs?|sub4sub|upvotes?|reposts?|reactions?|impressions?|clicks?|engagement)(?![a-z])/i;

// Longer text (descriptions, reasons): words such as "like" and "view" are ordinary
// English ("what did you like about the edit?"), so only phrases that describe doing an
// engagement action to a piece of content are refused.
const TARGET = '(?:video|videos|short|shorts|post|posts|clip|clips|reel|reels|tiktok|tiktoks|channel|channels|account|accounts|page|upload|uploads|content|stream|streams)';
const DETERMINER = "(?:the|this|that|these|those|a|an|my|our|your|his|her|their|each|every|any|all|\\d+|\\w+'s)";
const ENGAGEMENT_PHRASES = [
  new RegExp(`(?<![a-z])(?:lik(?:e|es|ed|ing)|comment(?:s|ed|ing)?\\s+on|subscrib(?:e|es|ed|ing)\\s+to|follow(?:s|ed|ing)?|shar(?:e|es|ed|ing)|repost(?:s|ed|ing)?|upvot(?:e|es|ed|ing)|view(?:s|ed|ing)?|watch(?:es|ed|ing)?)\\s+(?:${DETERMINER}\\s+)?(?:\\w+\\s+){0,2}${TARGET}(?![a-z])`, 'i'),
  /(?<![a-z])(?:leav(?:e|es|ing)|left|drop(?:s|ped|ping)?|post(?:s|ed|ing)?|writ(?:e|es|ing)|wrote)\s+(?:a|an|\d+|some|public)?\s*(?:public\s+)?comments?(?![a-z])/i,
  /(?<![a-z])(?:hit|smash|tap|press|click)(?:s|ed|ing)?\s+(?:the\s+)?(?:like|subscribe|follow|share|bell)(?![a-z])/i,
  /(?<![a-z])(?:per|for\s+each|for\s+every|for)\s+(?:like|comment|view|share|follow|follower|subscriber|subscription|sub|repost|upvote)s?(?![a-z])/i,
  /(?<![a-z])(?:thumbs?\s*up|sub4sub|like4like|follow4follow|f4f|l4l)(?![a-z])/i,
  /(?<![a-z])(?:likes?|comments?|views?|shares?|follows?|subscribers?|subs)\s+(?:count|counts|goal|goals|target|targets|milestone|milestones|bonus|reward|rewards)(?![a-z])/i,
];

const MONEY_TERMS =
  /[$€£¥₿]|(?<![a-z])(?:usd|eur|gbp|dollars?|bucks?|cents?|cash|money|payouts?|pay(?:s|ing|ment|ments)?|paid|salary|wages?|redeem(?:s|ed|able|ing)?|redemption|withdraw(?:s|al|als|ing)?|cash[\s-]?out|gift\s?cards?|venmo|paypal|zelle|cashapp|interest|invoice)(?![a-z])/i;

/** @returns {string|null} the offending fragment, or null when the text is clean */
export function findEngagementWord(text) {
  const match = ENGAGEMENT_WORDS.exec(String(text ?? ''));
  return match ? match[0] : null;
}

/** @returns {string|null} */
export function findEngagementPhrase(text) {
  const value = String(text ?? '');
  for (const pattern of ENGAGEMENT_PHRASES) {
    const match = pattern.exec(value);
    if (match) return match[0];
  }
  return null;
}

/** @returns {string|null} */
export function findMoneyTerm(text) {
  const match = MONEY_TERMS.exec(String(text ?? ''));
  return match ? match[0] : null;
}

const ENGAGEMENT_MESSAGE =
  'Points can only reward contributions (private feedback, original creative work, approved challenges). Likes, comments, views, shares, follows and subscriptions can be shown as statistics but can never earn points.';
const MONEY_MESSAGE =
  'Points are virtual and have no cash value, so wording that suggests money, payment or redemption is not allowed.';

/**
 * Short identifier a member will see as the name of something rewardable
 * (task key, task label). Refuses any engagement word and any money wording.
 */
export function assertRewardableName(field, text) {
  const engagement = findEngagementWord(text) ?? findEngagementPhrase(text);
  if (engagement) throw unprocessable('engagement_not_rewardable', ENGAGEMENT_MESSAGE, { field, matched: engagement });
  const money = findMoneyTerm(text);
  if (money) throw unprocessable('money_wording_not_allowed', MONEY_MESSAGE, { field, matched: money });
}

/**
 * Longer free text attached to something that moves or explains points (task
 * description, bonus / adjustment / reversal reason, competition text, tier name).
 * Refuses phrases that describe an engagement action, and any money wording.
 */
export function assertRewardableText(field, text) {
  const engagement = findEngagementPhrase(text);
  if (engagement) throw unprocessable('engagement_not_rewardable', ENGAGEMENT_MESSAGE, { field, matched: engagement });
  const money = findMoneyTerm(text);
  if (money) throw unprocessable('money_wording_not_allowed', MONEY_MESSAGE, { field, matched: money });
}

/** Engagement kinds the product may DISPLAY as statistics and can never reward. */
export const ENGAGEMENT_STAT_KINDS = Object.freeze(['views', 'likes', 'comments', 'shares', 'followers', 'subscribers']);

export const POINTS_DISCLAIMER =
  'Points are virtual. They have no cash value, cannot be redeemed or withdrawn, and are not a promise of future payment.';
