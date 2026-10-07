// Run with: node --test prompt-crawler/test/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PA = require('../analyze.js');
const studioPrompt = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .split('<script type="text/plain" id="studio-prompt">')[1].split('</script>')[0];

const fullSection = 'Every page names its owner and cites one source for each claim the client makes on it today.';

test('tokenize keeps versions, money, ratios and accents in one piece', () => {
  const words = PA.tokenize('Ship v5.5 at $5k, contrast 4.5:1 for Los Güeros. Done.').map((t) => t.text);
  assert.deepEqual(words, ['Ship', 'v5.5', 'at', '$5k', 'contrast', '4.5:1', 'for', 'Los', 'Güeros', 'Done']);
  const ends = PA.tokenize('one. two three').map((t) => t.end);
  assert.deepEqual(ends, [true, false, false]);
});

test('classify sorts words into kinds', () => {
  assert.deepEqual(PA.classify('full'), { kind: 'vague', group: 'measure' });
  assert.deepEqual(PA.classify('Modern'), { kind: 'vague', group: 'quality' });
  assert.equal(PA.classify('etc').kind, 'vague');
  assert.equal(PA.classify('5.5').kind, 'spec');
  assert.equal(PA.classify('#E8A356').kind, 'spec');
  assert.equal(PA.classify('index.html').kind, 'spec');
  assert.equal(PA.classify('staff').kind, 'owner');
  assert.equal(PA.classify("owner's").kind, 'owner');
  assert.equal(PA.classify('traceable').kind, 'claim');
  assert.equal(PA.classify('approve').kind, 'approval');
  assert.equal(PA.classify('the').kind, null);
});

test('headings map to the seven sections', () => {
  const key = (h) => PA.matchHeading(h).key;
  assert.equal(key('role'), 'role');
  assert.equal(key('roles'), 'roles');
  assert.equal(key('01 ROLE'), 'role');
  assert.equal(key('Team'), 'roles');
  assert.equal(key('Your role'), 'role');
  assert.equal(key('Constraints'), 'rules');
  assert.equal(key('Success criteria'), 'review');
  assert.equal(key('Examples'), null);
  assert.equal(PA.matchHeading('objective · one release · one manual run').sub, 'one release · one manual run');
});

test('markdown, bold, colon and tag headings all split sections', () => {
  const text = '## Role\nYou write copy.\n**Rules**\nNever use emoji.\nReview:\nCheck spelling.\n<start>\nRead the brief.\n</start>';
  const doc = PA.analyze(text);
  const words = Object.fromEntries(doc.sections.map((s) => [s.key, s.words.map((w) => w.text).join(' ')]));
  assert.equal(words.role, 'You write copy');
  assert.equal(words.rules, 'Never use emoji');
  assert.equal(words.review, 'Check spelling');
  assert.equal(words.start, 'Read the brief');
  assert.equal(doc.guessed, 0);
});

test('a prompt without headings is sorted sentence by sentence and counted as guessed', () => {
  const doc = PA.analyze('You are a copywriter for a bakery. Never use emoji. Check every price twice. Write three captions.');
  const by = Object.fromEntries(doc.sections.map((s) => [s.key, s]));
  assert.equal(by.role.words[0].text, 'You');
  assert.equal(by.rules.words.map((w) => w.text).join(' '), 'Never use emoji');
  assert.equal(by.review.words.map((w) => w.text).join(' '), 'Check every price twice');
  assert.equal(by.objective.words.map((w) => w.text).join(' '), 'Write three captions');
  assert.equal(doc.guessed, 4);
  assert.ok(by.role.words.every((w) => w.guessed));
});

test('score: a full, specific prompt gets 100 and vague words cost points', () => {
  const clean = PA.SECTIONS.map((s) => `# ${s.key}\n${fullSection}`).join('\n');
  assert.equal(PA.score(PA.analyze(clean)).total, 100);
  // One section of 25 words with 2 flags, the rest still unread: 11 points.
  assert.equal(Math.round(PA.sectionPoints(25, 25, 2)), 11);
  assert.equal(PA.sectionPoints(0, 0, 0), 0);
  // Half read is half the points.
  assert.equal(PA.sectionPoints(24, 12, 0), PA.sectionPoints(24, 24, 0) / 2);
});

test('questions: one per distinct vague word, plus one per missing section', () => {
  const doc = PA.analyze('# role\nYou build a clean site with some pages.\n# objective\nA clean, fast homepage, etc.');
  const qs = PA.questions(doc);
  const words = qs.filter((q) => !q.missing).map((q) => q.lower);
  assert.deepEqual(words, ['clean', 'some', 'fast', 'etc']);
  assert.equal(qs.find((q) => q.lower === 'clean').count, 2);
  assert.deepEqual(qs.find((q) => q.lower === 'clean').sections, ['role', 'objective']);
  assert.equal(qs.find((q) => q.lower === 'etc').ask, '“etc.”: finish the list.');
  const missing = qs.filter((q) => q.missing).map((q) => q.sections[0]);
  assert.deepEqual(missing, ['context', 'roles', 'rules', 'review', 'start']);
  assert.equal(qs.find((q) => q.lower === 'some').context.word, 'some');
});

test('the built-in studio.prompt covers all seven sections with headings', () => {
  const doc = PA.analyze(studioPrompt);
  assert.equal(doc.guessed, 0);
  for (const s of doc.sections) {
    assert.ok(s.headed, `${s.key} has a heading`);
    assert.ok(s.words.length >= 12, `${s.key} is at least 12 words`);
  }
  const flagged = doc.sections.flatMap((s) => s.words.filter((w) => w.kind === 'vague').map((w) => w.lower));
  assert.deepEqual(flagged, ['full', 'complete', 'clean', 'modern', 'some', 'etc', 'fast', 'premium']);
  assert.equal(doc.sections[1].sub, 'one site · one manual run');
  assert.equal(PA.score(doc).total, 86);
});

test('very long prompts stop at the word cap', () => {
  const doc = PA.analyze('# context\n' + 'word '.repeat(PA.MAX_WORDS + 50));
  assert.equal(doc.total, PA.MAX_WORDS);
  assert.ok(doc.truncated);
});
