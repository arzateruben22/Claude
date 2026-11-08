// What people say when you join them (PROJECT_OC_ON_FOOT.md, "Talk": "Someone says a short line (shown as a
// caption); you get two reply chips and Leave. They answer, and after two or three exchanges they wrap up ('Good
// talking. Drive safe.') and go back to their own conversation. There's no story or branching beyond that.")
//
// Every line is ours: short and original. They never mention real businesses, real people, real events or live
// data. Tags: the time of day ('day' or 'night', from the simulated clock) and your car (from the game's profile on
// this device). Speech is never voiced: captions only.

export interface Exchange {
  /** what they say ({car} is your car's name) */
  line: string;
  /** your two replies */
  replies: [string, string];
  /** their answer to each */
  answers: [string, string];
  when?: 'day' | 'night';
}

export const OPENERS: Exchange[] = [
  { line: 'That your {car} out front? Clean.', replies: ['Thanks. Drove it in off the 57.', 'It cleans up okay.'], answers: ['The 57 at night is the best road in the county.', 'Okay, modest. I see you.'] },
  { line: "Best streak? Mine's like forty seconds over a hundred. Don't laugh.", replies: ["Not laughing. That's solid.", "I'll beat it tonight."], answers: ['Ha. I\'ll take it.', 'Big talk. Come back and tell us.'] },
  { line: 'Two Lane does the birria. Trust me.', replies: ["I'll grab some on the way out.", "Tacos or noodles, I can't pick."], answers: ["You won't regret it.", 'Tacos. Then noodles. Easy.'] },
  { line: "Is it bag toss or cornhole? We've been arguing for an hour.", replies: ['Bag toss. Final answer.', "Whoever's winning picks."], answers: ['See? Told you.', "Then it's bag toss. I'm winning."] },
  { line: 'Those light towers get me every time.', replies: ['Like a stadium that never switches off.', 'You can see them from the freeway.'], answers: ['Right? Every single time.', "That's how I find this place."], when: 'night' },
  { line: "Long week. First time I've stopped moving since Monday.", replies: ['Same. This helps.', 'You picked the right place.'], answers: ['It really does.', 'Every time.'] },
  { line: 'I park at the back so nobody dings it.', replies: ["Smart. I'm right by the gate.", "Worth the walk."], answers: ['Brave.', 'Every step.'] },
  { line: "Sun's out, lawn's open. Best time to be here.", replies: ['Hard to argue.', 'Wait till the lights come on.'], answers: ['Right?', 'Fair. Night is good too.'], when: 'day' },
  { line: 'You come here a lot?', replies: ['First time, actually.', "When I'm off the freeway."], answers: ['Welcome. Get the horchata cold brew.', "Same. It's on the way to everywhere."] },
  { line: 'The string lights do something to this place after dark.', replies: ['It feels like a porch.', 'Better than any sign.'], answers: ['A porch for two hundred people.', 'Ha. True.'], when: 'night' },
];

export const FOLLOWUPS: Exchange[] = [
  { line: 'What are you driving tonight, the {car}?', replies: ['Yep. Wouldn\'t swap it.', 'For now. Saving for the next one.'], answers: ['Respect.', "Aren't we all."] },
  { line: 'You heading back on the freeway after this?', replies: ['Long way home, probably.', 'Straight home. Early start.'], answers: ['The long way is the right way.', 'Responsible. Love that.'] },
  { line: 'Somebody here swears the 57 is faster than the 5 after nine.', replies: ['They\'re right.', 'Depends who\'s driving.'], answers: ['Told you!', 'Ha. Fair.'] },
  { line: 'Did you try the noodle truck yet?', replies: ['Not yet. Is it good?', 'Garlic noodles. Twice.'], answers: ['Get the garlic ones.', 'A person of taste.'] },
  { line: 'I keep saying one more round of bag toss.', replies: ['One more is never one.', 'Go on, I\'ll watch.'], answers: ["Exactly the problem.", 'Pressure!'] },
];

export const WRAPS = ['Good talking. Drive safe.', 'Nice meeting you. Drive safe.', 'Catch you around. Drive safe.'];
export const LATER = ['Later!', 'See you.', 'Take care.'];
/** what a group says when you walk up and stand in their circle */
export const HELLO = ['Hey!', 'Oh, hey.', 'Come on in.', 'Hi!'];

/** first names for the regulars (fictional people; nobody here is a real person) */
export const NAMES = ['Dani', 'Marco', 'Priya', 'Jules', 'Tomás', 'Kenji', 'Rosa', 'Andre', 'Lena', 'Sam', 'Noor', 'Eli'];

/** the game's own cars, by id (ours) */
export const CAR_NAMES: Record<string, string> = { 'rossini-gt': 'Rossini GT', 'rossini-brio': 'Brio', 'rossini-corsa': 'Corsa', 'vela-e': 'Vela E' };

/** pick an exchange that suits the clock, seeded (so a test can reproduce a conversation) */
export function pick(list: Exchange[], night: boolean, seed: number, not?: Exchange): Exchange {
  const ok = list.filter((e) => e !== not && (!e.when || (e.when === 'night') === night));
  return ok[Math.abs(seed) % ok.length];
}
export const fill = (s: string, car: string) => s.replace('{car}', CAR_NAMES[car] ?? 'car');
