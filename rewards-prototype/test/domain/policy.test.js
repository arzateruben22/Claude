import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRewardableName,
  assertRewardableText,
  findEngagementPhrase,
  findEngagementWord,
  findMoneyTerm,
  POINTS_DISCLAIMER,
} from '../../src/domain/policy.js';

const throwsCode = (fn, code) =>
  assert.throws(fn, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.status, 422);
    return true;
  });

test('task names that describe engagement are refused', () => {
  for (const name of [
    'Like the video', 'like_video', 'Comment', 'comments', 'Leave a comment', 'Subscribe', 'new_subscriber',
    'Watch time', 'watch_video', 'Share to story', 'Follow us', 'Followers', 'Views milestone', 'Repost',
    'Upvote', 'Engagement boost', 'sub4sub', 'LIKE', 'Viewing party',
  ]) {
    throwsCode(() => assertRewardableName('label', name), 'engagement_not_rewardable');
  }
});

test('contribution names are accepted', () => {
  for (const name of [
    'Constructive feedback', 'constructive_feedback', 'Original creative submission', 'creative_submission',
    'Thumbnail concept', 'Script notes', 'Editing help', 'Challenge entry', 'Title brainstorm', 'Subtitle translation',
    'Likeness sketch', 'Preview cut', 'Interview questions', 'Shareholder parody script', 'Submission',
  ]) {
    assert.doesNotThrow(() => assertRewardableName('label', name), name);
  }
});

test('descriptions may use ordinary English but not engagement instructions', () => {
  for (const text of [
    'Tell the creator what you liked about the edit and one thing to improve.',
    'What did you like most? Be specific and kind.',
    'Write at least three sentences of private feedback after you have seen the cut.',
    'Submit an original short of your own. It must be your own work.',
    'In my view the pacing drags in the middle.',
    'Share your notes privately with the creator through this form.',
    'Feedback is private; it is not a public comment.',
  ]) {
    assert.doesNotThrow(() => assertRewardableText('description', text), text);
  }
  for (const text of [
    'Like the video and tell us', 'Please comment on this short', 'Subscribe to the channel first',
    'Leave a comment under the upload', 'Drop 3 comments', 'Hit like before submitting', 'Smash the subscribe button',
    '25 points per like', 'Bonus for every comment', 'for each view you bring', 'Share this video with friends',
    'Watch the whole video twice', 'Follow our account', 'Thumbs up required', 'likes goal reached', 'Reposted the clip',
    "Liked Sam's latest short", 'View all 5 videos',
  ]) {
    throwsCode(() => assertRewardableText('description', text), 'engagement_not_rewardable');
  }
});

test('money wording is refused everywhere', () => {
  for (const text of ['$5 bonus', '25 cents each', 'Cash prize', 'Payout pending', 'Redeem later', 'paid monthly', 'Withdraw anytime', '€10', 'Gift card raffle', 'earns interest']) {
    throwsCode(() => assertRewardableText('reason', text), 'money_wording_not_allowed');
    assert.ok(findMoneyTerm(text), text);
  }
  for (const text of ['Correcting a double entry', 'Monthly challenge winner', 'Paper craft entry', 'Centered thumbnail concept', 'An interesting idea', 'Repaid kindness']) {
    assert.equal(findMoneyTerm(text), null, text);
  }
});

test('finders return the matched fragment or null', () => {
  assert.equal(findEngagementWord('Constructive feedback'), null);
  assert.equal(findEngagementWord('Like the video').toLowerCase(), 'like');
  assert.equal(findEngagementPhrase('nothing to see'), null);
  assert.match(findEngagementPhrase('please subscribe to the channel'), /subscribe to the channel/i);
});

test('the disclaimer itself says points are not money without tripping the money lint on product copy rules', () => {
  assert.match(POINTS_DISCLAIMER, /no cash value/);
  assert.match(POINTS_DISCLAIMER, /cannot be redeemed/);
});
