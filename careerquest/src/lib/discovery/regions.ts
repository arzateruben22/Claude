/**
 * Does a posting's location fall inside one of the user's regions? (pure, client-safe)
 *
 * Profile regions are free text, defaulting to "Los Angeles County, CA" and "Orange County, CA".
 * For the Southern California counties we know the incorporated cities (and common community names
 * used in postings), so "Anaheim, CA" counts as Orange County. For any other region the region's
 * own name must appear in the location text. Nothing is looked up online.
 */

const COUNTY_CITIES: Record<string, readonly string[]> = {
  "los angeles": [
    "los angeles", "long beach", "glendale", "santa clarita", "lancaster", "palmdale", "pomona", "torrance", "pasadena",
    "el monte", "downey", "inglewood", "west covina", "norwalk", "burbank", "compton", "south gate", "carson", "santa monica",
    "whittier", "hawthorne", "alhambra", "lakewood", "bellflower", "baldwin park", "lynwood", "redondo beach", "pico rivera",
    "montebello", "monterey park", "gardena", "huntington park", "arcadia", "diamond bar", "paramount", "rosemead", "glendora",
    "cerritos", "la mirada", "covina", "azusa", "rancho palos verdes", "culver city", "bell gardens", "la puente",
    "manhattan beach", "claremont", "beverly hills", "monrovia", "temple city", "west hollywood", "san gabriel", "bell",
    "la verne", "hermosa beach", "walnut", "lawndale", "san dimas", "maywood", "south pasadena", "calabasas", "duarte",
    "agoura hills", "lomita", "cudahy", "la canada flintridge", "la cañada flintridge", "santa fe springs", "commerce",
    "el segundo", "palos verdes estates", "artesia", "san fernando", "signal hill", "south el monte", "hawaiian gardens",
    "irwindale", "malibu", "westlake village", "sierra madre", "la habra heights", "rolling hills estates", "san marino",
    "city of industry", "industry", "bradbury", "hidden hills", "rolling hills", "avalon", "vernon",
    // Communities and Los Angeles neighborhoods that postings use as a city name.
    "van nuys", "north hollywood", "sherman oaks", "encino", "chatsworth", "northridge", "reseda", "canoga park",
    "woodland hills", "sun valley", "sylmar", "pacoima", "san pedro", "wilmington", "hollywood", "venice", "westwood",
    "playa vista", "harbor city", "tarzana", "valencia", "newhall", "canyon country", "stevenson ranch", "east los angeles",
    "rowland heights", "hacienda heights", "altadena", "marina del rey", "lennox", "willowbrook", "valinda", "studio city",
    "panorama city", "granada hills", "winnetka", "west hills", "mission hills", "arleta", "lake view terrace", "tujunga",
    "sunland", "eagle rock", "highland park", "boyle heights", "watts", "west los angeles", "century city", "los feliz",
  ],
  orange: [
    "aliso viejo", "anaheim", "brea", "buena park", "costa mesa", "cypress", "dana point", "fountain valley", "fullerton",
    "garden grove", "huntington beach", "irvine", "la habra", "la palma", "laguna beach", "laguna hills", "laguna niguel",
    "laguna woods", "lake forest", "los alamitos", "mission viejo", "newport beach", "orange", "placentia",
    "rancho santa margarita", "san clemente", "san juan capistrano", "santa ana", "seal beach", "stanton", "tustin",
    "villa park", "westminster", "yorba linda",
    "ladera ranch", "rancho mission viejo", "foothill ranch", "trabuco canyon", "coto de caza", "rossmoor", "midway city",
    "sunset beach", "las flores", "corona del mar", "capistrano beach", "north tustin",
  ],
  riverside: [
    "riverside", "moreno valley", "corona", "temecula", "murrieta", "menifee", "jurupa valley", "hemet", "indio",
    "palm springs", "palm desert", "cathedral city", "perris", "lake elsinore", "eastvale", "beaumont", "banning",
    "san jacinto", "wildomar", "norco", "coachella", "la quinta", "desert hot springs", "rancho mirage", "blythe",
    "calimesa", "canyon lake", "indian wells",
  ],
  "san bernardino": [
    "san bernardino", "fontana", "rancho cucamonga", "ontario", "victorville", "rialto", "hesperia", "chino", "chino hills",
    "upland", "apple valley", "redlands", "highland", "colton", "yucaipa", "montclair", "adelanto", "loma linda", "barstow",
    "grand terrace", "twentynine palms", "yucca valley", "big bear lake", "needles",
  ],
  "san diego": [
    "san diego", "chula vista", "oceanside", "escondido", "carlsbad", "el cajon", "vista", "san marcos", "encinitas",
    "national city", "la mesa", "santee", "poway", "imperial beach", "lemon grove", "coronado", "solana beach", "del mar",
  ],
  ventura: [
    "oxnard", "thousand oaks", "simi valley", "ventura", "camarillo", "moorpark", "santa paula", "port hueneme", "fillmore",
    "ojai", "newbury park",
  ],
};

/** Metro-area phrasing used by job boards, mapped to the county it centers on. */
const METRO_ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:greater\s+los\s+angeles|los\s+angeles\s+metropolitan|los\s+angeles\s+metro|la\s+metro)\b/i, "los angeles"],
  [/\bl\.?a\.?\s+county\b/i, "los angeles"],
  [/(?:^|[\s,(])O\.?C\.?(?=$|[\s,)])/, "orange"],
  [/\binland\s+empire\b/i, "riverside"],
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Orange County, CA" → "orange"; null when the region is not "<name> County". */
export function countyKeyOfRegion(region: string): string | null {
  const m = /^\s*([a-z .'-]+?)\s+county\b/i.exec(region);
  if (!m) return null;
  const key = fold(m[1]!);
  return key || null;
}

export type RegionMatch =
  | { kind: "region"; region: string; reason: string }
  | { kind: "remote"; reason: string }
  | { kind: "state"; reason: string }
  | { kind: "outside"; reason: string }
  | { kind: "unknown"; reason: string };

function cityOf(location: string): string {
  return fold(location.split(/[,(|/]/)[0] ?? "");
}

function isCalifornia(location: string): boolean {
  return /(?:,\s*|\b)(?:ca|california)\b/i.test(location) && !/\bcanada\b/i.test(location);
}

/** Where a location sits relative to the user's regions, with a human-readable reason. */
export function matchRegion(location: string | null | undefined, regions: readonly string[]): RegionMatch {
  const loc = (location ?? "").trim();
  if (!loc) return { kind: "unknown", reason: "No location on the lead" };
  if (/\b(remote|work from home|wfh)\b/i.test(loc) && !/\bhybrid\b/i.test(loc)) {
    return { kind: "remote", reason: "Remote — the region does not apply (trade work is usually on site)" };
  }
  const folded = fold(loc);
  const city = cityOf(loc);
  for (const region of regions) {
    const county = countyKeyOfRegion(region);
    if (county) {
      if (new RegExp(`\\b${county}\\s+county\\b`).test(folded)) return { kind: "region", region, reason: `${loc} is in ${region}` };
      const cities = COUNTY_CITIES[county];
      if (cities && cities.includes(city) && (isCalifornia(loc) || !/,/.test(loc))) {
        return { kind: "region", region, reason: `${titleCaseCity(city)} is in ${region}` };
      }
      for (const [re, key] of METRO_ALIASES) {
        if (key === county && re.test(loc)) return { kind: "region", region, reason: `${loc} is in ${region}` };
      }
    } else {
      const name = fold(region.split(",")[0] ?? "");
      if (name.length >= 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(folded)) {
        return { kind: "region", region, reason: `${loc} matches your region ${region}` };
      }
    }
  }
  if (isCalifornia(loc)) return { kind: "state", reason: `${loc} is in California but outside your regions` };
  return { kind: "outside", reason: `${loc} is outside your regions` };
}

function titleCaseCity(city: string): string {
  return city.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}
