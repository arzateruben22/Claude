// The lines (PROJECT_OC_SPORTS_BAR.md, "Conversations and lines"): the starter set of 30 for the talking groups (S3a)
// and S3b's interaction lines, about 120 in all, tagged by interaction and outcome, by topic, by time of day, by the
// player's state and by memory (`remembers`: a memory of that kind with the listener). Short, original, written by us. They never mention a real business, person, team, league, event or
// anything live: the teams named are our fictional ones, and the matches are simulated. Nothing is staked on anything
// (no line offers a bet, a wager or a forfeit, the bar's own games included).
export type LineTopic = 'match' | 'teams' | 'pool' | 'darts' | 'food' | 'cars' | 'freeway' | 'weather' | 'week';
/** what a line is for: an interaction's beat (by outcome), your reply chips, a wrap-up, a hello */
export type LineKind = 'talk' | 'joke' | 'laugh' | 'cheer' | 'high-five' | 'toast' | 'round' | 'thanks' | 'introduce' | 'challenge' | 'team' | 'console' | 'goodbye' | 'warm' | 'quip' | 'wrap' | 'hello';
export interface Line {
  text: string; topic?: LineTopic; when?: 'day' | 'night'; needsMatch?: boolean;
  /** S3b: the interaction (or reply, wrap-up, hello) and its outcome (yes accepted, no not) */
  kind?: LineKind; outcome?: 'yes' | 'no';
  /** a memory of this kind with the listener picks it (remembers:<kind>) */
  remembers?: string;
  /** the player's state it fits */
  state?: 'holding' | 'thirsty' | 'tired' | 'won';
  /** a line that says a goal just went in ('goal': picked only within 60 s of one) or that it was a late winner ('late':
   *  picked only within 60 s of a goal scored in its match's late stage, the last fifth of play), so no line claims a
   *  goal that didn't happen */
  moment?: 'goal' | 'late';
}

export const STARTER_LINES: readonly Line[] = [
  { text: 'Ref added three minutes. Three! Where\'d he find three?', topic: 'match', needsMatch: true },
  { text: 'Undertow can\'t hold a lead to save their lives. Watch.', topic: 'teams' },
  { text: 'Table two\'s free and I need someone to beat.', topic: 'pool' },
  { text: 'Wings are actually hot tonight. Get the lemon-pepper if you value your life.', topic: 'food', when: 'night' },
  { text: 'You come off the 5? Katella\'s a parking lot this time of night.', topic: 'freeway', when: 'night' },
  { text: 'Three darts, three different zip codes. Story of my life.', topic: 'darts' },
  { text: 'Shuffleboard\'s all touch. Don\'t muscle it.', topic: 'pool' },
  { text: 'My darts game is like my parking. Technically on the board.', topic: 'darts' },
  { text: 'If the Kestrels press like that all half, they win this.', topic: 'match', needsMatch: true },
  { text: 'That keeper\'s been on fire. Somebody check his gloves.', topic: 'match', needsMatch: true },
  { text: 'I\'ve backed the Lanterns since I was a kid. It\'s a lot.', topic: 'teams' },
  { text: 'Basin Freight run it up the middle every single time.', topic: 'teams' },
  { text: 'The Sparrows look tired. Long week for them.', topic: 'teams' },
  { text: 'Who ordered the loaded fries? Because I want a bite.', topic: 'food' },
  { text: 'The al pastor sliders are the move. Trust me.', topic: 'food' },
  { text: 'Café de olla at this hour? You\'re going to be up till four.', topic: 'food', when: 'night' },
  { text: 'Got the car washed and it rained on the way. Of course.', topic: 'cars' },
  { text: 'I took the long way round just to drive it. No regrets.', topic: 'cars' },
  { text: 'There\'s a merge on the 57 that I swear changes every week.', topic: 'freeway' },
  { text: 'You can hear the freeway from the patio. I kind of like it.', topic: 'freeway' },
  { text: 'Perfect night to sit out by the heaters.', topic: 'weather', when: 'night' },
  { text: 'It was so hot today the steering wheel bit me.', topic: 'weather', when: 'day' },
  { text: 'Is it Friday yet? It feels like it should be Friday.', topic: 'week' },
  { text: 'Long week. This is the first time I\'ve sat down since Monday.', topic: 'week' },
  { text: 'We should make this a weekly thing. Same table.', topic: 'week' },
  { text: 'That was offside by a mile. A mile!', topic: 'match', needsMatch: true },
  { text: 'One more like that and I\'m calling it the goal of the season.', topic: 'match', needsMatch: true, moment: 'goal' },
  { text: 'I lost to the house at darts again. Rocío doesn\'t miss.', topic: 'darts' },
  { text: 'Rack \'em. Best of three, just for fun.', topic: 'pool' },
  { text: 'Somebody turn the big screen up. I can\'t hear the crowd.', topic: 'match', needsMatch: true },
];

/** S3b's interaction lines: {team} is the listener's team, {mine} the speaker's, {name} the listener's first name. No
 *  real business, person, team, league or event; nothing live; nothing staked */
export const INTERACTION_LINES: readonly Line[] = [
  // Talk: the opener (accepted) and the brush-off
  { text: 'Hey! Pull up a spot, there\'s room.', kind: 'talk', outcome: 'yes' },
  { text: 'Oh hey. You here for the match too?', kind: 'talk', outcome: 'yes', needsMatch: true },
  { text: 'Good timing. We were just arguing about the offside rule.', kind: 'talk', outcome: 'yes' },
  { text: 'Hi! First time here? The booths are the best seats.', kind: 'talk', outcome: 'yes' },
  { text: 'Sure, join us. Nobody here agrees on anything.', kind: 'talk', outcome: 'yes' },
  { text: 'Hey, I like your energy. What brings you in?', kind: 'talk', outcome: 'yes' },
  { text: 'Welcome to the loud corner.', kind: 'talk', outcome: 'yes', when: 'night' },
  { text: 'Quiet afternoon, right? I like it like this.', kind: 'talk', outcome: 'yes', when: 'day' },
  { text: 'Sorry, we\'re kind of in the middle of something.', kind: 'talk', outcome: 'no' },
  { text: 'Maybe later? I\'m trying to watch this.', kind: 'talk', outcome: 'no' },
  { text: 'Not right now, sorry.', kind: 'talk', outcome: 'no' },
  { text: 'Hm? Oh. Yeah. Anyway…', kind: 'talk', outcome: 'no' },
  // Joke: the joke told, then the room's reaction
  { text: 'My darts game is like my parking. Technically on the board.', kind: 'joke' },
  { text: 'I\'d tell you a pool joke, but I\'d probably scratch.', kind: 'joke' },
  { text: 'The ref and my GPS have one thing in common. Both pretend they saw it.', kind: 'joke' },
  { text: 'I\'m on a seafood diet. I see wings, I order wings.', kind: 'joke' },
  { text: 'Shuffleboard is just curling for people who like sitting down.', kind: 'joke' },
  { text: 'I asked for the lemon-pepper and they asked if I\'d signed a waiver.', kind: 'joke' },
  { text: 'My team plays like they\'re merging onto the 5. Nobody knows who goes first.', kind: 'joke' },
  { text: 'Three screens, three matches, and I still missed the goal.', kind: 'joke', needsMatch: true },
  { text: 'Ha! Okay, that one got me.', kind: 'laugh', outcome: 'yes' },
  { text: 'Stop, I\'m going to spill this.', kind: 'laugh', outcome: 'yes' },
  { text: 'That\'s terrible. I love it.', kind: 'laugh', outcome: 'yes' },
  { text: 'Oh no. Oh no, that\'s good.', kind: 'laugh', outcome: 'yes' },
  { text: 'I… don\'t get it.', kind: 'laugh', outcome: 'no' },
  { text: 'Tough room tonight, huh?', kind: 'laugh', outcome: 'no' },
  { text: 'Was that the joke?', kind: 'laugh', outcome: 'no' },
  // Cheer together
  { text: 'YES! Did you see that?!', kind: 'cheer', outcome: 'yes', moment: 'goal' },
  { text: 'Come on! That\'s how you do it!', kind: 'cheer', outcome: 'yes', moment: 'goal' },
  { text: 'What a finish! Unreal!', kind: 'cheer', outcome: 'yes', moment: 'late' },
  { text: 'That\'s the one we needed!', kind: 'cheer', outcome: 'yes', moment: 'goal' },
  { text: 'Now that\'s a moment. Come on!', kind: 'cheer', outcome: 'yes' },
  { text: 'Eh. Good for them, I guess.', kind: 'cheer', outcome: 'no', moment: 'goal' },
  { text: 'Eh. I\'ll save my voice for later.', kind: 'cheer', outcome: 'no' },
  // High-five
  { text: 'Up top!', kind: 'high-five', outcome: 'yes' },
  { text: 'Yes! Give me five!', kind: 'high-five', outcome: 'yes' },
  { text: 'That deserves a high-five.', kind: 'high-five', outcome: 'yes' },
  { text: '…and I\'m left hanging.', kind: 'high-five', outcome: 'no' },
  { text: 'Oh, you\'re holding a drink. Never mind.', kind: 'high-five', outcome: 'no' },
  // Toast
  { text: 'To good company!', kind: 'toast', outcome: 'yes' },
  { text: 'Cheers to that one!', kind: 'toast', outcome: 'yes', moment: 'goal' },
  { text: 'To a late winner and a long night.', kind: 'toast', outcome: 'yes', when: 'night', moment: 'late' },
  { text: 'To the {team}, wherever they are.', kind: 'toast', outcome: 'yes' },
  { text: 'Salud!', kind: 'toast', outcome: 'yes' },
  // Buy a round, and the thanks
  { text: 'This round\'s on me. Everybody gets their usual.', kind: 'round', outcome: 'yes' },
  { text: 'Next round\'s mine. Don\'t argue.', kind: 'round', outcome: 'yes' },
  { text: 'Round for the table! House tokens, not real money, don\'t get excited.', kind: 'round', outcome: 'yes' },
  { text: 'You didn\'t have to do that. Thank you!', kind: 'thanks', outcome: 'yes' },
  { text: 'Oh, you\'re a legend. Thanks.', kind: 'thanks', outcome: 'yes' },
  { text: 'Next one\'s on me, okay?', kind: 'thanks', outcome: 'yes' },
  { text: 'Thanks, but we\'re good for now.', kind: 'round', outcome: 'no' },
  // Introduce
  { text: 'Oh, nice to meet you! Any friend of theirs…', kind: 'introduce', outcome: 'yes' },
  { text: 'Hey, good to meet you. You watching the match?', kind: 'introduce', outcome: 'yes' },
  { text: 'Hi! I think I\'ve seen you at the darts before.', kind: 'introduce', outcome: 'yes' },
  { text: 'Nice to meet you. Pull up a stool.', kind: 'introduce', outcome: 'yes' },
  { text: 'Uh, hi. Sorry, I\'m kind of mid-conversation.', kind: 'introduce', outcome: 'no' },
  // Challenge
  { text: 'You\'re on. Loser racks.', kind: 'challenge', outcome: 'yes' },
  { text: 'Oh, I hope you\'re ready to lose. Kidding. Mostly.', kind: 'challenge', outcome: 'yes' },
  { text: 'Let\'s go. Just for fun.', kind: 'challenge', outcome: 'yes' },
  { text: 'Sure, but I warn you, I\'ve been practising.', kind: 'challenge', outcome: 'yes' },
  { text: 'Not tonight. My arm\'s still recovering from last week.', kind: 'challenge', outcome: 'no' },
  { text: 'Maybe after this half.', kind: 'challenge', outcome: 'no', needsMatch: true },
  { text: 'I\'ll sit this one out, thanks.', kind: 'challenge', outcome: 'no' },
  // Ask about their team
  { text: 'The {team}, all the way. Since I was a kid.', kind: 'team', outcome: 'yes' },
  { text: 'Me? The {team}. It\'s a lifestyle.', kind: 'team', outcome: 'yes' },
  { text: 'The {team}. Don\'t laugh.', kind: 'team', outcome: 'yes' },
  { text: 'The {team}. Ask me how my week\'s going.', kind: 'team', outcome: 'yes' },
  { text: 'The {team}. We\'re due a good season.', kind: 'team', outcome: 'yes' },
  // Console
  { text: 'Thanks. They\'ll be back. They always come back.', kind: 'console', outcome: 'yes' },
  { text: 'Yeah. It stings. Next week, though.', kind: 'console', outcome: 'yes' },
  { text: 'I needed that. Okay. Deep breaths.', kind: 'console', outcome: 'yes' },
  { text: 'Appreciate it. I\'m not even mad. I\'m a little mad.', kind: 'console', outcome: 'yes' },
  { text: 'I don\'t want to talk about it.', kind: 'console', outcome: 'no' },
  { text: 'Please don\'t. I\'m processing.', kind: 'console', outcome: 'no' },
  // Say goodbye
  { text: 'Good talking to you. Catch you around!', kind: 'goodbye' },
  { text: 'Take it easy. Drive safe out there.', kind: 'goodbye' },
  { text: 'See you next time. Same table?', kind: 'goodbye' },
  { text: 'Alright, I\'ll let you get back to it.', kind: 'goodbye' },
  { text: 'Later! Watch out for the merge on Katella.', kind: 'goodbye', when: 'night' },
  // your reply chips: warm or quip
  { text: 'Ha, fair enough. How\'s your night going?', kind: 'warm' },
  { text: 'Same here. Good crowd tonight.', kind: 'warm' },
  { text: 'That\'s great. Tell me more.', kind: 'warm' },
  { text: 'Honestly, me too.', kind: 'warm' },
  { text: 'Love that. I\'ll have to try it.', kind: 'warm' },
  { text: 'Glad I came in tonight.', kind: 'warm' },
  { text: 'Bold words from someone holding a lime soda.', kind: 'quip' },
  { text: 'Is that a promise or a threat?', kind: 'quip' },
  { text: 'I\'d argue, but you seem dangerous at darts.', kind: 'quip' },
  { text: 'Write that down. Frame it.', kind: 'quip' },
  { text: 'Says the person who parked across two spots.', kind: 'quip' },
  { text: 'Hot take. Very hot. Lemon-pepper hot.', kind: 'quip' },
  // wrap-ups after two or three exchanges
  { text: 'Anyway, I should get back to my table. Good chat!', kind: 'wrap' },
  { text: 'Okay, I\'m going to go yell at the big screen. Talk soon.', kind: 'wrap', needsMatch: true },
  { text: 'Right, I need a refill. Great talking to you.', kind: 'wrap' },
  { text: 'This was fun. Come find us later.', kind: 'wrap' },
  // memory: lines a speaker picks when they remember something with you (remembers:<kind>)
  { text: 'You\'re the one who bought the round when the {scored} scored. Respect.', kind: 'talk', outcome: 'yes', remembers: 'round' },
  { text: 'You\'re the one who bought that round. Respect.', kind: 'talk', outcome: 'yes', remembers: 'round' },
  { text: 'Hey, it\'s the round-buyer! Good to see you again.', kind: 'talk', outcome: 'yes', remembers: 'round' },
  { text: 'Got any more jokes like the last one? I still think about it.', kind: 'talk', outcome: 'yes', remembers: 'joke' },
  { text: 'It\'s you! The worst joke I ever laughed at.', kind: 'talk', outcome: 'yes', remembers: 'joke' },
  { text: 'We toasted the {scored} goal together, remember? Good times.', kind: 'talk', outcome: 'yes', remembers: 'toast' },
  { text: 'We had a toast last time, remember? Good times.', kind: 'talk', outcome: 'yes', remembers: 'toast' },
  { text: 'My rival returns. Rematch later?', kind: 'talk', outcome: 'yes', remembers: 'game' },
  { text: 'You still owe me a rematch, you know.', kind: 'talk', outcome: 'yes', remembers: 'game' },
  { text: 'Hey, thanks again for the introduction. We\'re playing darts later.', kind: 'talk', outcome: 'yes', remembers: 'introduce' },
  { text: 'You were nice to me after that loss. I owe you one.', kind: 'talk', outcome: 'yes', remembers: 'console' },
  { text: 'Up top again? That last one was a good high-five.', kind: 'talk', outcome: 'yes', remembers: 'high-five' },
  // your state
  { text: 'You\'ve got a drink, I\'ve got a drink. We\'re basically a toast already.', kind: 'talk', outcome: 'yes', state: 'holding' },
  { text: 'You look parched. The bar\'s just over there, you know.', kind: 'talk', outcome: 'yes', state: 'thirsty' },
  { text: 'You look wiped. Long drive in?', kind: 'talk', outcome: 'yes', state: 'tired' },
  { text: 'Saw you win at the tables. Not bad at all.', kind: 'talk', outcome: 'yes', state: 'won' },
  // hellos
  { text: 'Hey!', kind: 'hello' },
  { text: 'Oh, hey.', kind: 'hello' },
  { text: 'How\'s it going?', kind: 'hello' },
  { text: 'Good crowd tonight.', kind: 'hello', when: 'night' },
];
/** every line: the starter 30 and the interaction lines */
export const ALL_LINES: readonly Line[] = [...STARTER_LINES, ...INTERACTION_LINES];
export interface LineCtx {
  night: boolean; matchOn: boolean; remembers?: Set<string>; state?: Line['state'] | null; team?: string | null; mine?: string | null; name?: string;
  /** a goal in the last 60 s, and whether it came in its match's late stage (the moment-tagged lines need them) */
  goal60?: boolean; late?: boolean;
  /** a remembered moment's team (by the memory's kind): the team that had just scored when it happened, for {scored} */
  scored?: Map<string, string>;
}
/** a moment-tagged line fits only with a goal in the last 60 s (a late winner's, with that goal in its match's late
 *  stage) */
export const momentFits = (l: Line, goal60: boolean, late: boolean) => !l.moment || (goal60 && (l.moment === 'goal' || late));
/** an interaction's line: a remembered moment first, then your state, then the plain lines for this kind and outcome;
 *  {team}, {mine}, {name} and {scored} filled in (a {team} line is skipped when the listener has none, a {scored} line
 *  when the remembered moment had no goal in it) */
export function pickFor(kind: LineKind, outcome: 'yes' | 'no' | null, seed: number, c: LineCtx): Line {
  const fits = (l: Line) => l.kind === kind && (outcome === null || !l.outcome || l.outcome === outcome) && (!l.needsMatch || c.matchOn) && (!l.when || (l.when === 'night') === c.night)
    && (!l.text.includes('{team}') || !!c.team) && (!l.text.includes('{mine}') || !!c.mine) && momentFits(l, !!c.goal60, !!c.late)
    && (!l.text.includes('{scored}') || (!!l.remembers && !!c.scored?.get(l.remembers)));
  const pools = [
    INTERACTION_LINES.filter((l) => fits(l) && !!l.remembers && !!c.remembers?.has(l.remembers)),
    INTERACTION_LINES.filter((l) => fits(l) && !l.remembers && !!l.state && l.state === c.state),
    INTERACTION_LINES.filter((l) => fits(l) && !l.remembers && !l.state),
  ];
  for (const pool of pools) if (pool.length) { const l = pool[seed % pool.length]; return fill(l, c); }
  return { text: '…', kind };
}
function fill(l: Line, c: LineCtx): Line {
  if (!l.text.includes('{')) return l;
  return { ...l, text: l.text.replace('{team}', c.team ?? '').replace('{mine}', c.mine ?? '').replace('{name}', c.name ?? '').replace('{scored}', (l.remembers && c.scored?.get(l.remembers)) ?? '') };
}

/** a line for a speaker: by a seeded draw, skipping lines that want a match in play when none is, lines for the
 *  other part of the day, and lines about a goal just now when none came in the last 60 s */
export function pickLine(seed: number, night: boolean, matchOn: boolean, goal60 = false, late = false): Line {
  const n = STARTER_LINES.length;
  for (let k = 0; k < n; k++) {
    const l = STARTER_LINES[(seed + k * 7) % n];
    if (l.needsMatch && !matchOn) continue;
    if (l.when && (l.when === 'night') !== night) continue;
    if (!momentFits(l, goal60, late)) continue;
    return l;
  }
  return STARTER_LINES[seed % n];
}
