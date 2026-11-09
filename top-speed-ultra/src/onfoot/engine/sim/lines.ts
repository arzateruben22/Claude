// The starter set of 30 lines for the talking groups (PROJECT_OC_SPORTS_BAR.md, "Conversations and lines": "a starter
// set of 30 in S3a"; S3b brings about 120, tagged by interaction and outcome too). Short, original, written by us, tagged
// by topic and, where it matters, by time of day. They never mention a real business, person, team, league, event or
// anything live: the teams named are our fictional ones, and the matches are simulated. Nothing is staked on anything
// (no line offers a bet, a wager or a forfeit, the bar's own games included).
export type LineTopic = 'match' | 'teams' | 'pool' | 'darts' | 'food' | 'cars' | 'freeway' | 'weather' | 'week';
export interface Line { text: string; topic: LineTopic; when?: 'day' | 'night'; needsMatch?: boolean }

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
  { text: 'One more like that and I\'m calling it the goal of the season.', topic: 'match', needsMatch: true },
  { text: 'I lost to the house at darts again. Rocío doesn\'t miss.', topic: 'darts' },
  { text: 'Rack \'em. Best of three, just for fun.', topic: 'pool' },
  { text: 'Somebody turn the big screen up. I can\'t hear the crowd.', topic: 'match', needsMatch: true },
];

/** a line for a speaker: by a seeded draw, skipping lines that want a match in play when none is, and lines for the
 *  other part of the day */
export function pickLine(seed: number, night: boolean, matchOn: boolean): Line {
  const n = STARTER_LINES.length;
  for (let k = 0; k < n; k++) {
    const l = STARTER_LINES[(seed + k * 7) % n];
    if (l.needsMatch && !matchOn) continue;
    if (l.when && (l.when === 'night') !== night) continue;
    return l;
  }
  return STARTER_LINES[seed % n];
}
