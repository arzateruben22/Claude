// Sample data for local development: three members and a spread of submissions in every
// state, so the screen has something honest to show before real accounts exist.
//
//   npm run seed              refuses a database that already has members
//   npm run seed -- --reset   deletes the local database file first
//
// Rules protected here:
//   * Sample data is for AUTH_MODE=dev with PLATFORM_MODE=mock only. It never goes into
//     a database that Google sign-in has touched, and --reset never deletes one.
//   * Everything is created THROUGH the domain functions, acting as the seeded admin
//     account and as the members themselves. So every row has its audit entry, every
//     award has its reviewed claim, and the integrity check holds — exactly as it would
//     had people done the same things on the screen. Nothing is inserted behind the rules.
//   * Platform results come from the mock adapters and are stored labelled as simulated.
//   * Points are virtual. Likes, comments and views appear only as informational
//     statistics on videos; nothing here rewards them.
//   * Only the three sample first names and *.example.test addresses are used.

import { existsSync, realpathSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/sqlite.js';
import { migrate } from '../src/db/migrate.js';
import { createContext, withActor } from '../src/domain/context.js';
import { listAudit } from '../src/domain/audit.js';
import { listClaims, reviewClaim, revokeClaim, runApiCheck, submitClaim, withdrawClaim } from '../src/domain/claims.js';
import { assertIntegrity } from '../src/domain/integrity.js';
import { adjust, balanceOf, grantBonus, listEntries } from '../src/domain/ledger.js';
import { createMember, linkYoutubeChannel, listMembers } from '../src/domain/members.js';
import { createTaskType } from '../src/domain/taskTypes.js';
import { ensureDefaultTiers } from '../src/domain/tiers.js';
import { bootstrapAdmins, createUser, findActiveUserByEmail, listUsers } from '../src/domain/users.js';
import { createVideo, refreshVideoStats } from '../src/domain/videos.js';
import { systemClock } from '../src/lib/clock.js';
import { demoChannelId, youtubeDemoUrl } from '../src/platforms/mockData.js';
import { createPlatformRegistry } from '../src/platforms/registry.js';

export const SEED_ADMIN_EMAIL = 'admin@example.test';
/** The three sample members, in the order they stand on the screen. */
export const SEED_MEMBERS = Object.freeze(['Daryl', 'Leo', 'Alex']);

const HOUR_MS = 60 * 60 * 1000;
// The sample history is laid out over the three days before "now", oldest first, so the
// activity lists read like a few days of use rather than one instant.
const HISTORY_MS = 72 * HOUR_MS;

/** Thrown when the seed will not run. The message is safe to print as it is. */
export class SeedRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedRefusal';
  }
}

/** A clock that starts HISTORY_MS before `clock`'s now and only ever moves forward, up to that now. */
function historyClock(clock) {
  const end = clock.now().getTime();
  let current = end - HISTORY_MS;
  return {
    now: () => new Date(current),
    forward(hours) {
      current = Math.min(end, current + hours * HOUR_MS);
    },
    toPresent() {
      current = end;
    },
  };
}

const FEEDBACK = Object.freeze({
  leoOnLong001: 'The first minute sets the scene well. The middle section repeats the same point three times; cutting one repeat would keep the pace up.',
  alexOnLong001: 'Sound is clear throughout. The title card stays up too long, and the closing section would land better with the summary moved before the credits.',
  darylOnShort02: 'Strong opening shot. The captions run ahead of the voice from about ten seconds in, which makes the last line hard to follow.',
  darylOnBusy001: 'I thought it was fine overall and there is not much I would change about it, it was a good one and I enjoyed all of it.',
  leoOnLong002: 'The pacing is steady, but the colour shifts between the indoor and outdoor shots; matching them would make the cut feel like one piece.',
  alexOnShort02: 'The hook works. The middle is a little crowded with text on screen; two of the four labels could go without losing anything.',
  alexOnShort01: 'Good energy from the start. The ending stops abruptly; one more second on the final frame would give it a clear finish.',
});

/**
 * Fills an empty database with the sample data.
 * @param {{ db: import('../src/db/sqlite.js').Db, clock: { now(): Date } }} input
 * @returns {Promise<object>} counts only
 * @throws {SeedRefusal} when the database already has members or has seen Google sign-in
 */
export async function seed({ db, clock }) {
  migrate(db);
  const time = historyClock(clock);
  const system = createContext({ db, clock: time });

  if (listUsers(system).some((user) => user.signed_in_before)) {
    throw new SeedRefusal('This database has been used with Google sign-in. Sample data never goes into it.');
  }
  if (listMembers(system, { includeArchived: true }).length > 0) {
    throw new SeedRefusal('This database already has members. Run the seed with --reset to delete the local database and start again.');
  }

  ensureDefaultTiers(system);

  // The admin account is deliberately NOT one of the three members: an account can
  // neither approve nor credit the member it belongs to (DECISIONS.md B3).
  bootstrapAdmins(system, [SEED_ADMIN_EMAIL]);
  const adminUser = findActiveUserByEmail(system, SEED_ADMIN_EMAIL) ?? createUser(system, { email: SEED_ADMIN_EMAIL, role: 'admin' });
  const admin = withActor(system, { userId: adminUser.id, role: 'admin', memberId: null });

  const people = {};
  SEED_MEMBERS.forEach((name, index) => {
    const member = createMember(admin, { display_name: name, avatar_key: 'placeholder', sort_order: index + 1 });
    const user = createUser(admin, { email: `${name.toLowerCase()}@example.test`, role: 'member', member_id: member.id });
    people[name] = { memberId: member.id, as: withActor(system, { userId: user.id, role: 'member', memberId: member.id }) };
  });
  const { Daryl: daryl, Leo: leo, Alex: alex } = people;

  const feedbackTask = createTaskType(admin, {
    key: 'constructive_feedback',
    label: 'Constructive feedback',
    description: 'Private written feedback on one of the tracked videos: what works and what to change. An admin reads it; it is never posted anywhere.',
    points: 25,
    xp: 25,
    requires_video: true,
    api_check: 'none',
  });
  const creativeTask = createTaskType(admin, {
    key: 'creative_submission',
    label: 'Original creative submission',
    description: 'A link to an original piece you made and published yourself. Ownership is checked automatically when your channel is linked; an admin still decides.',
    points: 25,
    xp: 40,
    requires_video: false,
    api_check: 'video_ownership',
  });

  const registry = createPlatformRegistry({ mode: 'mock', clock: time });
  const track = (platform, id, kind, title, owner) =>
    createVideo(admin, { platform, platform_video_id: id, kind, title, owner_member_id: owner?.memberId ?? null });
  const videos = {
    long001: track('youtube', 'demoLong001', 'video', 'Sample long video: workshop tour', daryl),
    short01: track('youtube', 'demoShort01', 'short', 'Sample short: thirty-second cut', daryl),
    short02: track('youtube', 'demoShort02', 'short', 'Sample short: behind the scenes', leo),
    busy001: track('youtube', 'demoBusy001', 'video', 'Sample long video: live session recap', leo),
    long002: track('youtube', 'demoLong002', 'video', 'Sample long video: first edit', alex),
    // The owner hid the like count: the statistics block must show "hidden", not zero.
    hidden1: track('youtube', 'demoHidden1', 'video', 'Sample video with a hidden like count', alex),
    // The mock adapter answers "quota used up" for this one, so a failed refresh can be seen.
    quota01: track('youtube', 'demoQuota01', 'video', 'Sample video whose statistics cannot be fetched', null),
    tiktok1: track('tiktok', '7000000000000000001', 'short', 'Sample TikTok clip', null),
  };

  // Daryl and Leo have a (demo) linked channel; Alex has none, so "not linked" is visible too.
  linkYoutubeChannel(admin, { memberId: daryl.memberId, channelId: demoChannelId(1), attestedBy: 'demo_seed' });
  linkYoutubeChannel(admin, { memberId: leo.memberId, channelId: demoChannelId(2), attestedBy: 'demo_seed' });

  const feedback = (who, video, text) => submitClaim(who.as, { task_type_id: feedbackTask.id, video_id: video.id, evidence_text: text });
  const creative = (who, platformVideoId) => submitClaim(who.as, { task_type_id: creativeTask.id, evidence_url: youtubeDemoUrl(platformVideoId) });
  const approve = (claim) => reviewClaim(admin, claim.id, { outcome: 'approve' });

  // Approved, reviewed by a person.
  time.forward(6);
  const leoFeedback = feedback(leo, videos.long001, FEEDBACK.leoOnLong001);
  time.forward(2);
  const alexFeedback = feedback(alex, videos.long001, FEEDBACK.alexOnLong001);
  time.forward(3);
  approve(leoFeedback);
  approve(alexFeedback);
  time.forward(5);
  approve(feedback(daryl, videos.short02, FEEDBACK.darylOnShort02));

  // Approved after the (simulated) platform check attested ownership.
  time.forward(8);
  const darylCreative = creative(daryl, 'demoOwnA001');
  await runApiCheck(admin, darylCreative.id, registry);
  time.forward(2);
  approve(darylCreative);

  // Rejected, with a note the member can read.
  time.forward(4);
  const tooVague = feedback(daryl, videos.busy001, FEEDBACK.darylOnBusy001);
  time.forward(1);
  reviewClaim(admin, tooVague.id, { outcome: 'reject', note: 'Too general to act on. Name the moments you mean and what you would change.' });

  // Taken back by the member before anyone decided.
  time.forward(5);
  const secondThoughts = feedback(leo, videos.long002, FEEDBACK.leoOnLong002);
  time.forward(1);
  withdrawClaim(leo.as, secondThoughts.id);

  // Approved, then revoked: the award is reversed and the submission no longer counts.
  time.forward(6);
  const mistaken = approve(feedback(alex, videos.short02, FEEDBACK.alexOnShort02));
  time.forward(3);
  revokeClaim(admin, mistaken.claim.id, { reason: 'Sample correction: this approval was entered against the wrong submission.' });

  // One bonus and one deduction, each with its reason and its audit row.
  time.forward(4);
  grantBonus(admin, { memberId: leo.memberId, points: 15, xp: 20, reason: 'Sample bonus: finished the monthly challenge first.', idempotencyKey: 'seed-bonus-0001' });
  time.forward(2);
  adjust(admin, { memberId: daryl.memberId, points: -5, bucket: 'earned', reason: 'Sample deduction: an earlier approval was counted twice.', idempotencyKey: 'seed-adjustment-0001' });

  // Still waiting: one ordinary submission, and two whose automatic check did not attest
  // (the platform did not answer; the member has no linked channel).
  time.forward(6);
  feedback(alex, videos.short01, FEEDBACK.alexOnShort01);
  time.forward(3);
  await runApiCheck(admin, creative(leo, 'demoOutage1').id, registry);
  time.forward(2);
  await runApiCheck(admin, creative(alex, 'demoOwnB001').id, registry);

  // Statistics are fetched last, at the present moment, so they are not already stale.
  time.toPresent();
  let statsRefreshed = 0;
  let statsFailed = 0;
  for (const video of Object.values(videos)) {
    const { result } = await refreshVideoStats(admin, video.id, registry.get(video.platform));
    if (result.ok) statsRefreshed += 1;
    else statsFailed += 1;
  }

  assertIntegrity(db);

  const claims = {};
  for (const claim of listClaims(admin, { limit: 200 }).items) claims[claim.decision] = (claims[claim.decision] ?? 0) + 1;
  return {
    members: listMembers(admin, { includeArchived: true }).length,
    accounts: listUsers(admin).length,
    task_types: 2,
    videos: Object.keys(videos).length,
    stats_refreshed: statsRefreshed,
    stats_failed: statsFailed,
    claims,
    ledger_entries: listEntries(admin, { limit: 200 }).items.length,
    audit_rows: listAudit(admin, { limit: 200 }).items.length,
    // Three different totals, so the ranking on the screen is not a three-way tie.
    point_totals: SEED_MEMBERS.map((name) => balanceOf(admin, people[name].memberId).total),
  };
}

function formatSummary(summary) {
  const claims = Object.entries(summary.claims).map(([decision, count]) => `${count} ${decision}`).join(', ');
  return [
    'Sample data created (everything here is simulated):',
    `  members ${summary.members}, sign-in accounts ${summary.accounts}, task types ${summary.task_types}`,
    `  videos ${summary.videos} (statistics fetched for ${summary.stats_refreshed}, failed for ${summary.stats_failed} on purpose)`,
    `  submissions: ${claims}`,
    `  ledger entries ${summary.ledger_entries}, audit rows ${summary.audit_rows}`,
    `  point totals: ${summary.point_totals.join(' / ')}`,
    'The integrity check passed. Start the server with "npm run dev" and sign in with one of the sample addresses listed in README.md.',
  ].join('\n');
}

/** Deletes the local database file, unless Google sign-in has ever touched it. */
function resetDatabase(path) {
  if (existsSync(path)) {
    const db = openDatabase(path);
    try {
      const real = db.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'users'") && db.get('SELECT 1 AS found FROM users WHERE google_sub IS NOT NULL LIMIT 1');
      if (real) throw new SeedRefusal('This database has been used with Google sign-in. --reset will not delete it.');
    } finally {
      db.close();
    }
  }
  for (const file of [path, `${path}-journal`]) rmSync(file, { force: true });
}

/**
 * The command line: checks the modes, optionally resets, seeds, prints the summary.
 * @param {Record<string, string|undefined>} env  process.env, or a plain object in tests
 * @param {string[]} args  command-line arguments after the script name
 * @param {{ clock?: { now(): Date }, print?: (text: string) => void }} [parts]
 * @returns {Promise<object>} the summary
 * @throws {SeedRefusal | import('../src/config.js').ConfigError}
 */
export async function runSeed(env, args = [], { clock = systemClock, print = (text) => process.stdout.write(`${text}\n`) } = {}) {
  const unknown = args.filter((arg) => arg !== '--reset');
  if (unknown.length > 0) throw new SeedRefusal('Usage: npm run seed [-- --reset]');
  const config = loadConfig(env);
  if (config.authMode !== 'dev' || config.platformMode !== 'mock') {
    throw new SeedRefusal('Sample data is for local development only. The seed runs with AUTH_MODE=dev and PLATFORM_MODE=mock, and with nothing else.');
  }
  if (args.includes('--reset')) resetDatabase(config.databasePath);
  const db = openDatabase(config.databasePath);
  try {
    const summary = await seed({ db, clock });
    print(formatSummary(summary));
    return summary;
  } finally {
    db.close();
  }
}

function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  try {
    await runSeed(process.env, process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error?.name === 'SeedRefusal' || error?.name === 'ConfigError' ? error.message : (error?.stack ?? error)}\n`);
    process.exitCode = 1;
  }
}
