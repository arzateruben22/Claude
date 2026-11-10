// The lines (PROJECT_OC_SPORTS_BAR.md, "Conversations and lines"): the starter set of 30 for the talking groups (S3a),
// S3b's interaction lines and S4's for both, about 250 in all, tagged by interaction and outcome, by topic, by time of day, by the
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
/** S4: the rest of the talking groups' lines (the plan's "about 250" in all), by topic and time of day; the same rules
 *  as the starter set */
export const MORE_TALK_LINES: readonly Line[] = [
  { text: 'That\'s a yellow all day. All day!', topic: 'match', needsMatch: true },
  { text: 'They\'ve had the ball for ten minutes and done nothing with it.', topic: 'match', needsMatch: true },
  { text: 'Watch the left side. Their fullback keeps wandering.', topic: 'match', needsMatch: true },
  { text: 'Every corner they take ends up in the third row.', topic: 'match', needsMatch: true },
  { text: 'Half-time can\'t come soon enough. I need a breather.', topic: 'match', needsMatch: true },
  { text: 'This keeper is going to give me grey hair.', topic: 'match', needsMatch: true },
  { text: 'Look at that pass. Forty yards, right on the boot.', topic: 'match', needsMatch: true },
  { text: 'Simulated or not, I\'m still yelling at it.', topic: 'match', needsMatch: true },
  { text: 'Did you see that? No? Good, it was terrible.', topic: 'match', needsMatch: true },
  { text: 'Number nine has missed three sitters. Three!', topic: 'match', needsMatch: true },
  { text: 'The Saltflat Terns always start slow. Always.', topic: 'teams' },
  { text: 'Mesa Quail fans are the loudest people I\'ve ever met.', topic: 'teams' },
  { text: 'Harborline FC changed their kit again. Third time this year.', topic: 'teams' },
  { text: 'The Ridgeview Sundials play like it\'s a Sunday stroll.', topic: 'teams' },
  { text: 'Ironwood Ratchets fans, you can always tell. The shirts.', topic: 'teams' },
  { text: 'Grove Pickers have the best crest in the league. Fight me.', topic: 'teams' },
  { text: 'The Interchange Flyovers? Fast, but they fade late.', topic: 'teams' },
  { text: 'Pool table one leans a little left. Don\'t tell anyone.', topic: 'pool' },
  { text: 'I\'ve been working on my bank shot. It\'s still bad.', topic: 'pool' },
  { text: 'Chalk the cue. Every time. That\'s the whole secret.', topic: 'pool' },
  { text: 'Rocío ran the table on me last week. Didn\'t even blink.', topic: 'pool' },
  { text: 'Somebody left the bridge on the rail again.', topic: 'pool' },
  { text: 'Aim small, miss small. That\'s what they say, right?', topic: 'darts' },
  { text: 'Hit the triple once. Never again. Still counts.', topic: 'darts' },
  { text: 'Board three is the lucky one. Everybody knows that.', topic: 'darts' },
  { text: 'The puck stopped right on the edge. Hanging. Beautiful.', topic: 'darts' },
  { text: 'The elote cups are back. Somebody tell the kitchen I love them.', topic: 'food' },
  { text: 'I came for the match. I stayed for the fries.', topic: 'food' },
  { text: 'Tamarindo agua fresca. Trust me on this one.', topic: 'food' },
  { text: 'They put a little chile on the cucumber cooler. Genius.', topic: 'food' },
  { text: 'I said one basket. We\'re on our third.', topic: 'food', when: 'night' },
  { text: 'Lunch here beats lunch at my desk, that\'s for sure.', topic: 'food', when: 'day' },
  { text: 'Found a spot right by the door. Never happens.', topic: 'cars' },
  { text: 'My check-engine light came on in the lot. It\'s a sign.', topic: 'cars' },
  { text: 'Somebody out there has their headlights on. Not it.', topic: 'cars', when: 'night' },
  { text: 'I just got new tyres. I keep looking at them.', topic: 'cars' },
  { text: 'You can hear the 5 from the patio. I kind of like it.', topic: 'freeway' },
  { text: 'Took Anaheim Way to skip the jam. Didn\'t skip the jam.', topic: 'freeway' },
  { text: 'From the patio the freeway looks like a string of lights.', topic: 'freeway', when: 'night' },
  { text: 'Traffic was light for once. I don\'t trust it.', topic: 'freeway', when: 'day' },
  { text: 'Perfect patio weather. Seventy-two and no wind.', topic: 'weather', when: 'day' },
  { text: 'It cools off fast once the sun goes. Grab a heater spot.', topic: 'weather', when: 'night' },
  { text: 'Is it going to rain? It never rains. It\'s going to rain.', topic: 'weather' },
  { text: 'The marine layer rolled in early today.', topic: 'weather', when: 'day' },
  { text: 'Long week. This is the first time I\'ve sat down.', topic: 'week' },
  { text: 'I told my boss I\'d answer emails tonight. I won\'t.', topic: 'week', when: 'night' },
  { text: 'Saturday plans: this. That\'s the whole plan.', topic: 'week' },
  { text: 'My cousin\'s quinceañera is next week. I\'m on decorations.', topic: 'week' },
  { text: 'Finally finished moving. My back has thoughts.', topic: 'week' },
  { text: 'Day off. Didn\'t set an alarm. Life is good.', topic: 'week', when: 'day' },
];
/** S4: the rest of the interaction beats, replies and wrap-ups (the same tags and rules as S3b's) */
export const MORE_INTERACTION_LINES: readonly Line[] = [
  { text: 'Oh hi! You picked a good night.', kind: 'talk', outcome: 'yes', when: 'night' },
  { text: 'Hey, grab a stool. We were just talking about the Kestrels.', kind: 'talk', outcome: 'yes' },
  { text: 'Hello! You look like someone with opinions about pool.', kind: 'talk', outcome: 'yes' },
  { text: 'Sure! We could use a tie-breaker on this argument.', kind: 'talk', outcome: 'yes' },
  { text: 'Hey there. Slow afternoon, huh? Pull up a chair.', kind: 'talk', outcome: 'yes', when: 'day' },
  { text: 'Hold on, it\'s a corner. Give me a second.', kind: 'talk', outcome: 'no', needsMatch: true },
  { text: 'We\'re just about to head out, sorry.', kind: 'talk', outcome: 'no' },
  { text: 'Why don\'t pool balls ever get lost? They always know their place.', kind: 'joke' },
  { text: 'I\'m not saying the ref is bad, but his whistle has a fan club.', kind: 'joke', needsMatch: true },
  { text: 'I tried to cook the al pastor at home. My smoke alarm is now a critic.', kind: 'joke' },
  { text: 'I park like I throw darts. Close enough, call it a win.', kind: 'joke' },
  { text: 'Ha! Okay, that\'s going in my group chat.', kind: 'laugh', outcome: 'yes' },
  { text: 'I hate that I laughed at that.', kind: 'laugh', outcome: 'yes' },
  { text: 'I\'ll laugh at that one later. Maybe.', kind: 'laugh', outcome: 'no' },
  { text: 'GOAL! Oh, that\'s gorgeous!', kind: 'cheer', outcome: 'yes', moment: 'goal' },
  { text: 'Right in the corner! Unbelievable!', kind: 'cheer', outcome: 'yes', moment: 'goal' },
  { text: 'At the death! I can\'t believe it!', kind: 'cheer', outcome: 'yes', moment: 'late' },
  { text: 'Not my team, so… nice goal, I guess.', kind: 'cheer', outcome: 'no', moment: 'goal' },
  { text: 'Yes! Slap it!', kind: 'high-five', outcome: 'yes' },
  { text: 'Oh, we\'re doing this? Okay, up top!', kind: 'high-five', outcome: 'yes' },
  { text: 'Sorry, sticky fingers. Wings.', kind: 'high-five', outcome: 'no' },
  { text: 'To the {team}, and to a better second half!', kind: 'toast', outcome: 'yes', needsMatch: true },
  { text: 'To the person who found us a booth on a Saturday.', kind: 'toast', outcome: 'yes' },
  { text: 'To that goal! What a strike!', kind: 'toast', outcome: 'yes', moment: 'goal' },
  { text: 'I\'ll get the next one. Tokens are burning a hole in my pocket.', kind: 'round', outcome: 'yes' },
  { text: 'Round\'s on me! Sodas and coolers for everybody.', kind: 'round', outcome: 'yes' },
  { text: 'Oh, that\'s sweet of you. Thank you!', kind: 'thanks', outcome: 'yes' },
  { text: 'You\'re officially my favourite person here.', kind: 'thanks', outcome: 'yes' },
  { text: 'Ah, I already have one, but thank you.', kind: 'round', outcome: 'no' },
  { text: 'Hi! Any friend of theirs is a friend of the table.', kind: 'introduce', outcome: 'yes' },
  { text: 'Hey! Wait, are you the one who\'s good at shuffleboard?', kind: 'introduce', outcome: 'yes' },
  { text: 'Hi. Nice to meet you, but I\'m heading out soon.', kind: 'introduce', outcome: 'no' },
  { text: 'Okay, you\'re on. Best of three.', kind: 'challenge', outcome: 'yes' },
  { text: 'I accept. Prepare to be gently defeated.', kind: 'challenge', outcome: 'yes' },
  { text: 'Not right now. I just sat down.', kind: 'challenge', outcome: 'no' },
  { text: 'The {team}. My whole family is. No choice in the matter.', kind: 'team', outcome: 'yes' },
  { text: 'The {team}. Had a season ticket once. Long story.', kind: 'team', outcome: 'yes' },
  { text: 'I mostly watch for the snacks, but the {team}, I guess.', kind: 'team', outcome: 'yes' },
  { text: 'Yeah. That one hurt. Thanks for saying something.', kind: 'console', outcome: 'yes' },
  { text: 'At least it was close. Right? It was close.', kind: 'console', outcome: 'yes' },
  { text: 'Nope. Not ready to talk about it yet.', kind: 'console', outcome: 'no' },
  { text: 'Great meeting you. Get home safe.', kind: 'goodbye' },
  { text: 'Bye! Come back for the next big match.', kind: 'goodbye' },
  { text: 'I\'m off. Don\'t let them win at darts without me.', kind: 'goodbye' },
  { text: 'Ha, you\'re funny. What do you do when you\'re not here?', kind: 'warm' },
  { text: 'Good call. I\'m glad I sat here.', kind: 'warm' },
  { text: 'Same! This is exactly what I needed tonight.', kind: 'warm', when: 'night' },
  { text: 'Bold. Very bold. I respect it.', kind: 'quip' },
  { text: 'You say that every match, don\'t you?', kind: 'quip' },
  { text: 'Pretty confident for someone on their third basket of fries.', kind: 'quip' },
  { text: 'Okay, I\'ll let you watch in peace. Good talk!', kind: 'wrap', needsMatch: true },
  { text: 'I\'m going to go check on my order. Catch you later.', kind: 'wrap' },
  { text: 'You beat me at the table last time. Not happening again.', kind: 'talk', outcome: 'yes', remembers: 'game' },
  { text: 'The joke person! Tell me another one.', kind: 'talk', outcome: 'yes', remembers: 'joke' },
  { text: 'You introduced me to half this bar. Thanks for that.', kind: 'talk', outcome: 'yes', remembers: 'introduce' },
  { text: 'Want to grab a basket? You look like you\'re starving.', kind: 'talk', outcome: 'yes', state: 'tired' },
  { text: 'Champion of the tables! What\'s your secret?', kind: 'talk', outcome: 'yes', state: 'won' },
  { text: 'Hi there!', kind: 'hello' },
  { text: 'Look who it is.', kind: 'hello' },
];
/** what the talking groups say (S3a's 30 and S4's), and what the interactions draw from (S3b's and S4's) */
export const TALK_LINES: readonly Line[] = [...STARTER_LINES, ...MORE_TALK_LINES];
export const BEAT_LINES: readonly Line[] = [...INTERACTION_LINES, ...MORE_INTERACTION_LINES];
/** every line: the starter 30, the interaction lines and S4's */
export const ALL_LINES: readonly Line[] = [...STARTER_LINES, ...INTERACTION_LINES, ...MORE_TALK_LINES, ...MORE_INTERACTION_LINES];
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
    BEAT_LINES.filter((l) => fits(l) && !!l.remembers && !!c.remembers?.has(l.remembers)),
    BEAT_LINES.filter((l) => fits(l) && !l.remembers && !!l.state && l.state === c.state),
    BEAT_LINES.filter((l) => fits(l) && !l.remembers && !l.state),
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
  const n = TALK_LINES.length;
  for (let k = 0; k < n; k++) {
    const l = TALK_LINES[(seed + k * 7) % n];
    if (l.needsMatch && !matchOn) continue;
    if (l.when && (l.when === 'night') !== night) continue;
    if (!momentFits(l, goal60, late)) continue;
    return l;
  }
  return TALK_LINES[seed % n];
}
