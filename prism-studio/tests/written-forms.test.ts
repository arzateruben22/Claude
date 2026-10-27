import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMetadata, clean, type MetaInput } from "../src/domain/metadata";
import { writtenForms } from "../src/domain/written";

const w = (vo: string) => writtenForms(clean(vo));

// Real narration, word for word from films/channels/*/ep0*/script.md (markup included), and how it reads in written copy.
const REAL: [string, string, string][] = [
  ["space/ep01 why", "Gravity is no faster: changes in it travel at the *speed of light*. {c5} In twenty seventeen, we caught two neutron stars colliding. {c13} Their light and gravitational waves crossed a hundred and thirty million light-years, and arrived under *two seconds* apart. {c6}",
    "Gravity is no faster: changes in it travel at the speed of light. In 2017, we caught two neutron stars colliding. Their light and gravitational waves crossed 130 million light-years, and arrived under two seconds apart."],
  ["space/ep02 normal", "Our ride is *Voyager 1*, the farthest thing we've sent. {c1} It left in nineteen seventy-seven. {c2} It coasts at about seventeen kilometers a second: Earth to the Moon in *six hours*. {c3,c4}",
    "Our ride is Voyager 1, the farthest thing we've sent. It left in 1977. It coasts at about seventeen kilometers a second: Earth to the Moon in six hours."],
  ["space/ep02 why", "In twenty twelve, it crossed into interstellar space. {c8} Nearly there, then? {-} It hasn't even reached the Sun's cloud of *comets*. {c9} That's three hundred years away. {c10} Getting through it: thirty thousand more. {c19}",
    "In 2012, it crossed into interstellar space. Nearly there, then? It hasn't even reached the Sun's cloud of comets. That's 300 years away. Getting through it: 30,000 more."],
  ["space/ep02 whoa", "The nearest star, Proxima Centauri, is about fifteen hundred light-days out. {c11} At Voyager's speed: about *seventy-five thousand years*. {c12}",
    "The nearest star, Proxima Centauri, is about 1,500 light-days out. At Voyager's speed: about 75,000 years."],
  ["space/ep03 normal", "On Earth, you see the Sun rise about three hundred sixty-five times a lap. {c1}", "On Earth, you see the Sun rise about 365 times a lap."],
  ["space/ep03 why", "In nineteen sixty-two, radar from a dish in California pierced the clouds. {c7} Both guesses were wrong. {c18} Venus turns once every two hundred forty-three days, longer than its year. {c8}",
    "In 1962, radar from a dish in California pierced the clouds. Both guesses were wrong. Venus turns once every 243 days, longer than its year."],
  ["space/ep03 whoa", "The Sun comes back every hundred and seventeen days, rising in the *west*. {c12,c13}", "The Sun comes back every 117 days, rising in the west."],
  ["space/ep04 why", "The Moon is sixty times farther from Earth's center than the apple. {c8} So the pull there is thirty-six hundred times *weaker*. {c9}",
    "The Moon is sixty times farther from Earth's center than the apple. So the pull there is 3,600 times weaker."],
  ["space/ep05 change", "Line Earths up across the Sun's face: a hundred and *nine*. {c3}", "Line Earths up across the Sun's face: 109."],
  ["space/ep05 why", "He was right. {c6} By a factor of about eight *thousand*. {c15}", "He was right. By a factor of about 8,000."],
  ["space/ep05 whoa", "Melt down one point three million Earths, and they'd *fill* it. {c7} Yet among the stars, it's ordinary. {c9} Some are more than a thousand times *wider*. {c8}",
    "Melt down 1.3 million Earths, and they'd fill it. Yet among the stars, it's ordinary. Some are more than a thousand times wider."],
  ["space/ep06 normal", "Earth spins: at the equator, the ground moves about sixteen hundred seventy kilometers an hour. {c1}", "Earth spins: at the equator, the ground moves about 1,670 kilometers an hour."],
  ["space/ep06 why", "In sixteen thirty-two, Galileo answered with a ship's cabin. {c6}", "In 1632, Galileo answered with a ship's cabin."],
  ["space/ep06 whoa", "The Sun drags us round the galaxy at about two hundred thirty kilometers a *second*. {c8} One lap: about two hundred thirty million years. {c9}",
    "The Sun drags us round the galaxy at about 230 kilometers a second. One lap: about 230 million years."],
  ["space/ep06 readout", "*Light time*, across your galactic trip so far: about a twentieth of a second. {c11} To the galaxy's center: about twenty-seven thousand years. {c12}",
    "Light time, across your galactic trip so far: about a twentieth of a second. To the galaxy's center: about 27,000 years."],
  ["physics/ep03 why", "In the eighteen-forties, he let falling weights turn a paddle in water, and the water *warmed*. {c6}", "In the 1840s, he let falling weights turn a paddle in water, and the water warmed."],
  ["physics/ep04 change", "On the Moon, in nineteen seventy-one, astronaut David Scott dropped both. {c3}", "On the Moon, in 1971, astronaut David Scott dropped both."],
  ["physics/ep04 why", "For nearly two thousand years, most scholars followed Aristotle: heavier things fall *faster*. {c5}", "For nearly 2,000 years, most scholars followed Aristotle: heavier things fall faster."],
  ["physics/ep04 whoa", "Starting in twenty sixteen, a satellite let two metals fall around Earth for months. {c9} They matched to within a few parts in a million *billion*. {c10}",
    "Starting in 2016, a satellite let two metals fall around Earth for months. They matched to within a few parts in a million billion."],
  ["physics/ep05 whoa", "In twenty fifteen, a young Canadian skater spun at three hundred forty-two turns a *minute*. {c6} Nearly six turns a second. {c7}",
    "In 2015, a young Canadian skater spun at 342 turns a minute. Nearly six turns a second."],
  ["body/ep01 normal", "You have about twenty-five trillion of them: most of your own cells. {c4}", "You have about 25 trillion of them: most of your own cells."],
  ["body/ep01 whoa", "The tightest vessels are about three micrometers: less than *half its width*. {c10} And it keeps squeezing through, all its life: about *a hundred and twenty days*. {c11}",
    "The tightest vessels are about three micrometers: less than half its width. And it keeps squeezing through, all its life: about 120 days."],
  ["body/ep01 meanwhile", "*Meanwhile*, as you watched, your bone marrow made over a hundred million new red cells. {c13}", "Meanwhile, as you watched, your bone marrow made over 100 million new red cells."],
];

// Real lines that must not change: small counts, fractions, decimals under a hundred, dates, a bare "a billion".
const UNCHANGED = [
  "Meet a *red blood cell*: a dimpled disc, about seven and a half micrometers. {c2}",
  "First, just the drop, slowed twenty times. {-} Ghosts every twentieth of a second, and the gaps keep *growing*: a falling ball speeds up the whole way down. {c1}",
  "A one-meter fall takes about *point four five seconds*, thrown or dropped. {c9}",
  "*Measure it*: twenty swings, and the big one is three tenths of a second *behind*. {c11} At thirty degrees, Galileo is off by about one part in sixty. {c12}",
  "One meter down. {-} Fifty-six centimeters back up. {c1} Then thirty-two. {c2} Then eighteen. {c16} Each bounce keeps just over *half* its height. {c3}",
  "*Measure it*: those missing forty-four centimeters? {-} A quarter of a joule. {c11} Even if it all stays in the ball: about three thousandths of a *degree*. {c12}",
  "*Measure it*: on the Moon, that drop takes about one point four *seconds*. {c11} On Earth, under six tenths. {c12}",
  "On November eighteenth, it crosses a line. {c5} Its signal now needs a full *day* to reach us. {c6}",
  "*Light time*, Earth to Voyager: one day. {c15} To Proxima Centauri: four years and three months. {c16}",
  "*Light time*, Sun to Earth: eight minutes, twenty seconds. {c11} Our galaxy's center: light from the last *Ice Age*. {c12,c14}",
  "Nearly twenty-five centuries ago, in Athens, Anaxagoras said the Sun was a fiery stone, bigger than southern *Greece*. {c4}",
  "The Cassinis, father and son, clocked about twenty-three hours. {c5}",
  "Next: what this cell *carries*. {-} Room for about a billion passengers. {c14,c15}",
];

describe("written forms (real narration)", () => {
  for (const [where, vo, want] of REAL) it(where, () => expect(w(vo)).toBe(want));
  it("leaves small counts, fractions, dates and short decimals in words", () => {
    for (const vo of UNCHANGED) expect(w(vo)).toBe(clean(vo));
  });

  const root = fileURLToPath(new URL("../../films/channels", import.meta.url));
  it.skipIf(!fs.existsSync(root))("every narration line in the scripts: only number words change, and a second pass changes nothing", () => {
    const lines = fs.readdirSync(root).flatMap((ch) => (fs.existsSync(path.join(root, ch)) && fs.statSync(path.join(root, ch)).isDirectory() ? fs.readdirSync(path.join(root, ch)) : [])
      .filter((e) => /^ep0\d$/.test(e) && fs.existsSync(path.join(root, ch, e, "script.md")))
      .flatMap((e) => fs.readFileSync(path.join(root, ch, e, "script.md"), "utf8").split(/\n\s*\n/)   // a vo line runs to the blank line after it
        .map((block) => /^vo: ([\s\S]*)$/m.exec(block)?.[1].replace(/\s+/g, " ").trim() ?? "").filter(Boolean)));
    expect(lines.length).toBeGreaterThan(50);
    expect(lines.some((l) => l.includes("a hundred and thirty million light-years"))).toBe(true);   // whole lines, not their first row
    const NUMBER_WORD = /^(a|and|point|zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|percent|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)$|-/;
    for (const vo of lines) {
      const before = clean(vo), after = writtenForms(before);
      expect(writtenForms(after)).toBe(after);
      // every word that disappeared is a number word; every word that stayed is in the same order
      const words = (s: string) => s.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? [];
      const kept = words(after);
      const gone = words(before).filter((x, i, all) => all.slice(0, i + 1).filter((y) => y === x).length > kept.filter((y) => y === x).length);
      for (const g of gone) expect(g, vo).toMatch(NUMBER_WORD);
    }
  });
});

describe("written forms (the rules)", () => {
  it("years after a year word, or opening a sentence before a comma or colon", () => {
    expect(writtenForms("In nineteen sixty-nine, we landed.")).toBe("In 1969, we landed.");
    expect(writtenForms("In nineteen sixty nine, we landed.")).toBe("In 1969, we landed.");
    expect(writtenForms("Nineteen sixty-nine: the landing.")).toBe("1969: the landing.");
    expect(writtenForms("Galileo published it in sixteen thirty-eight.")).toBe("Galileo published it in 1638.");
    expect(writtenForms("since nineteen oh five.")).toBe("since 1905.");
    expect(writtenForms("By July nineteen sixty-nine, it was done.")).toBe("By July 1969, it was done.");
    expect(writtenForms("In sixteen hundred, Kepler arrived.")).toBe("In 1600, Kepler arrived.");
    expect(writtenForms("In two thousand and eight, the probe woke.")).toBe("In 2008, the probe woke.");
    expect(writtenForms("In the nineteen sixties, and in the twenty-twenties.")).toBe("In the 1960s, and in the 2020s.");
    // two years joined by "and": the second takes the first one's year word
    expect(writtenForms("During nineteen eighteen and nineteen nineteen, flu spread.")).toBe("During 1918 and 1919, flu spread.");
    expect(writtenForms("In twenty twenty and twenty twenty-one, nothing.")).toBe("In 2020 and 2021, nothing.");
    expect(writtenForms("We saw nineteen eighteen and nineteen nineteen.")).toBe("We saw nineteen eighteen and nineteen nineteen.");   // no year word
  });
  it("spoken pairs that aren't years stay in words", () => {
    for (const s of ["We saw twenty seventeen times.", "at eleven fifteen", "at sixteen thirty", "in twenty minutes", "in twenty fifteen-minute blocks", "in twenty fifteen years", "in the twenties", "Nineteen sixty-nine was the year."]) {
      expect(writtenForms(s), s).toBe(s);
    }
    expect(writtenForms("in fifteen hundred years")).toBe("in 1,500 years");   // a count, not the year 1500
    // a pair followed by a noun may be a count: words stay, unless a name or a small word follows
    for (const s of ["In nineteen twelve patients, the drug failed.", "From fourteen eleven runners, three finished.", "In nineteen eighteen and twenty patients"]) {
      expect(writtenForms(s), s).toBe(s);
    }
    expect(writtenForms("In nineteen twelve the ship sank.")).toBe("In 1912 the ship sank.");
    expect(writtenForms("In nineteen sixty-nine Apollo landed.")).toBe("In 1969 Apollo landed.");
    expect(writtenForms("In twenty seventeen we caught it.")).toBe("In 2017 we caught it.");
    expect(writtenForms("Since nineteen ninety — a long time.")).toBe("Since 1990 — a long time.");
    expect(writtenForms("in two thousand years")).toBe("in 2,000 years");
  });
  it("percentages", () => {
    expect(writtenForms("about fifty percent of it")).toBe("about 50% of it");
    expect(writtenForms("twenty-five per cent")).toBe("25%");
    expect(writtenForms("one percent, a hundred percent")).toBe("1%, 100%");
    expect(writtenForms("zero point five percent and point five percent")).toBe("0.5% and 0.5%");
    expect(writtenForms("In twenty percent of cases")).toBe("In 20% of cases");
    expect(writtenForms("50 percent and 7.5 percent")).toBe("50% and 7.5%");
    expect(writtenForms("half a percent, a few percent")).toBe("half a percent, a few percent");
  });
  it("large numbers only when they can be read one way", () => {
    expect(writtenForms("a hundred and thirty million light-years")).toBe("130 million light-years");
    expect(writtenForms("twenty-seven thousand years")).toBe("27,000 years");
    expect(writtenForms("forty two thousand")).toBe("42,000");
    expect(writtenForms("two million three hundred thousand")).toBe("2,300,000");
    expect(writtenForms("one thousand")).toBe("1,000");
    for (const s of ["one", "a third", "half", "a thousand times", "a million Earths", "a million billion", "two and a half million", "three hundred and fortieth", "the two hundredth", "a two-thousand-year-old tree", "thousands of years", "seven and a half"]) {
      expect(writtenForms(s), s).toBe(s);
    }
  });
});

describe("written forms in the posting text", () => {
  const input: MetaInput = {
    channel: { name: "Light Minute", label: "SPACE", tagline: "Space, at the speed of light.", topic: "space" },
    episode: { number: 1, title: "In *twenty seventeen*, a hundred percent", seriesTitle: null },
    beats: [
      { beat: "hook", vo: "What if the Sun *vanished*? How soon would you *know*?" },
      { beat: "why", vo: "In twenty seventeen, we caught two neutron stars colliding. {c13} Their light crossed a hundred and thirty million light-years. {c6}" },
      { beat: "takeaway", vo: "About fifty percent of it arrived in twenty seventeen, a hundred and thirty million years late. {c9}" },
    ],
    sources: [{ key: "c6", claim: "GW170817: about 130 million light-years away", publisher: "ligo.caltech.edu", url: "https://www.ligo.caltech.edu/page/press-release-gw170817" }],
    disclosures: { aiVoice: true, aiVisuals: false },
    next: "Next: the *nearest star*, twenty seventeen",
  };
  it("descriptions and captions use written forms; titles, the next line, sources and hashtags are untouched", () => {
    const m = buildMetadata(input);
    expect(m.youtube.caption).toContain("In 2017, we caught two neutron stars colliding. Their light crossed 130 million light-years.");
    expect(m.tiktok.caption).toBe("What if the Sun vanished? About 50% of it arrived in 2017, 130 million years late. #space #astronomy #learnontiktok #science #cosmos");
    expect(m.instagram.caption).toContain("In 2017, we caught two neutron stars colliding. About 50% of it arrived in 2017, 130 million years late.");
    expect(m.youtube.title).toBe("In *twenty seventeen*, a hundred percent | Light Minute No. 001");
    expect(m.tiktok.title.startsWith("In *twenty seventeen*, a hundred percent")).toBe(true);
    expect(m.youtube.caption).toContain("Next: the nearest star, twenty seventeen");
    for (const p of ["youtube", "tiktok", "instagram"] as const) expect(m[p].caption.trimEnd().endsWith(m[p].hashtags)).toBe(true);
    expect(m.youtube.hashtags).toBe("#Shorts #space #astronomy");
  });
});
