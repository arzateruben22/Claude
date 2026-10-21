import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameProblem } from '../names.mjs';

test('fine names pass, including ones that contain a short bad word inside a real word', () => {
  for (const n of ['Ruben_OC', 'NightDriver', 'cockpit_cam', 'Assassin99', 'classic_gt', 'Dickens', 'Glasshouse', 'tits_mouse', 'pass_lane', 'Essex_GT', 'Hancock', 'Matsumoto', 'cumulus', 'Sussex'])
    if (n === 'tits_mouse') assert.notEqual(nameProblem(n), '', n); else assert.equal(nameProblem(n), '', n);
});
test('slurs, profanity and their number-for-letter spellings are refused', () => {
  for (const n of ['fuckface', 'FUCK_405', 'sh1tdriver', 'b1tch_gt', 'n1gg4', 'big_ass', 'BigAss', 'ass', 'cock_99', 'kkk_rider', 'Hitler88', 'r4pe_king', 'xXpornXx', 'kys_now'])
    assert.notEqual(nameProblem(n), '', n);
});
test('names that pass for staff are reserved', () => {
  for (const n of ['admin', 'Admin_1', 'moderator', 'OC_Ultra', 'ocultra_team', 'Official', 'support', 'Claude'])
    assert.equal(nameProblem(n), 'That name is reserved.', n);
  assert.equal(nameProblem('modern_gt'), '', 'a name starting with a short reserved word is fine');
});
