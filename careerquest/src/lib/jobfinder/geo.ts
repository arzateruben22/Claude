/**
 * Geography for the Job Finder: distance from the applicant's home base and the pay each distance
 * needs. Coordinates are approximate city centres, so distances are straight-line estimates.
 */
export type County = "Los Angeles" | "Orange";
export type Area = "LA" | "OC";
type Place = { lat: number; lon: number; county: County };

export const HOME = { name: "Canoga Park", lat: 34.2011, lon: -118.5981 };

/**
 * The applicant's rule: about $35/hr near Canoga Park, more the further away. Beyond FREE_MILES each
 * extra one-way mile adds PER_MILE to the hourly target. $0.45 comes from two stated assumptions:
 * about $0.70 per mile of driving both ways spread over an 8-hour day ($0.175/hr per mile) plus the
 * extra commute time at 30 mph valued at the base wage ($0.29/hr per mile).
 */
export const PAY_RULE = { baseHourly: 35, freeMiles: 15, perMile: 0.45, fullTimeHours: 2080 } as const;

const P = (lat: number, lon: number, county: County): Place => ({ lat, lon, county });
const LA = "Los Angeles" as const;
const OC = "Orange" as const;

export const PLACES: Record<string, Place> = {
  "canoga park": P(34.2011, -118.5981, LA), chatsworth: P(34.2572, -118.6012, LA), "woodland hills": P(34.1683, -118.6059, LA),
  "west hills": P(34.1973, -118.644, LA), northridge: P(34.2283, -118.5368, LA), reseda: P(34.2011, -118.5361, LA),
  "van nuys": P(34.1899, -118.4514, LA), encino: P(34.1517, -118.5214, LA), tarzana: P(34.1736, -118.5536, LA),
  calabasas: P(34.1367, -118.6615, LA), "sherman oaks": P(34.1508, -118.449, LA), "north hollywood": P(34.187, -118.3813, LA),
  "panorama city": P(34.2247, -118.4497, LA), "mission hills": P(34.2572, -118.467, LA), sylmar: P(34.3078, -118.4492, LA),
  "san fernando": P(34.2819, -118.439, LA), pacoima: P(34.2625, -118.427, LA), "sun valley": P(34.2175, -118.3703, LA),
  burbank: P(34.1808, -118.309, LA), glendale: P(34.1425, -118.2551, LA), "universal city": P(34.1389, -118.3534, LA),
  "studio city": P(34.1396, -118.3871, LA), "santa clarita": P(34.3917, -118.5426, LA), valencia: P(34.4436, -118.6095, LA),
  "granada hills": P(34.2794, -118.5015, LA), "porter ranch": P(34.2806, -118.5545, LA), agoura: P(34.1533, -118.7617, LA),
  "los angeles": P(34.0522, -118.2437, LA), hollywood: P(34.0928, -118.3287, LA), "culver city": P(34.0211, -118.3965, LA),
  "santa monica": P(34.0195, -118.4912, LA), "marina del rey": P(33.9803, -118.4517, LA), "el segundo": P(33.9192, -118.4165, LA),
  hawthorne: P(33.9164, -118.3526, LA), inglewood: P(33.9617, -118.3531, LA), torrance: P(33.8358, -118.3406, LA),
  carson: P(33.8317, -118.282, LA), wilmington: P(33.78, -118.262, LA), "san pedro": P(33.7361, -118.2923, LA),
  "long beach": P(33.7701, -118.1937, LA), pasadena: P(34.1478, -118.1445, LA), vernon: P(34.0039, -118.2301, LA),
  commerce: P(34.0006, -118.1598, LA), "city of industry": P(34.0197, -117.9587, LA), pomona: P(34.0551, -117.75, LA),
  duarte: P(34.1395, -117.9773, LA), downey: P(33.9401, -118.1332, LA), norwalk: P(33.9022, -118.0817, LA),
  "santa fe springs": P(33.9472, -118.0853, LA), lancaster: P(34.6868, -118.1542, LA), palmdale: P(34.5794, -118.1165, LA),
  "redondo beach": P(33.8492, -118.3884, LA), "west hollywood": P(34.09, -118.3617, LA), westwood: P(34.0635, -118.4455, LA),
  malibu: P(34.0259, -118.7798, LA), arcadia: P(34.1397, -118.0353, LA), irwindale: P(34.107, -117.9353, LA),
  azusa: P(34.1336, -117.9076, LA), "el monte": P(34.0686, -118.0276, LA), compton: P(33.8958, -118.2201, LA),
  gardena: P(33.8883, -118.309, LA), cerritos: P(33.8583, -118.0648, LA), lakewood: P(33.8536, -118.134, LA),
  whittier: P(33.9792, -118.0328, LA), monrovia: P(34.1442, -118.0019, LA), "beverly hills": P(34.0736, -118.4004, LA),
  playa: P(33.9617, -118.4275, LA), lax: P(33.9416, -118.4085, LA),
  anaheim: P(33.8366, -117.9143, OC), "santa ana": P(33.7455, -117.8677, OC), irvine: P(33.6846, -117.8265, OC),
  fullerton: P(33.8704, -117.9242, OC), "huntington beach": P(33.6595, -117.9988, OC), "costa mesa": P(33.6411, -117.9187, OC),
  "newport beach": P(33.6189, -117.9289, OC), "garden grove": P(33.7743, -117.938, OC), brea: P(33.9167, -117.9001, OC),
  "buena park": P(33.8675, -117.9981, OC), tustin: P(33.7458, -117.8262, OC), "fountain valley": P(33.7092, -117.9536, OC),
  westminster: P(33.7513, -117.994, OC), cypress: P(33.817, -118.0373, OC), "la palma": P(33.8464, -118.0467, OC),
  placentia: P(33.8722, -117.8703, OC), "yorba linda": P(33.8886, -117.8131, OC), "lake forest": P(33.647, -117.6892, OC),
  "mission viejo": P(33.6, -117.672, OC), "aliso viejo": P(33.5676, -117.7256, OC), "san clemente": P(33.427, -117.612, OC),
  "seal beach": P(33.7414, -118.1048, OC), "los alamitos": P(33.8031, -118.0726, OC), "la habra": P(33.9319, -117.9461, OC),
  "laguna": P(33.5427, -117.7854, OC), "dana point": P(33.4672, -117.6981, OC), "san juan capistrano": P(33.5017, -117.6625, OC),
};

export function haversineMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export type Location = { place: string; county: County; area: Area; miles: number; estimated: boolean };

/**
 * Resolve a posting's city text to a known place. The first known name in the text wins. When
 * nothing matches, the county's main job centre is used and the result is marked estimated; a bare
 * "Los Angeles" is also estimated because the city spans from the Valley to the harbor.
 */
export function locate(cityText: string, county?: string): Location {
  const text = ` ${String(cityText ?? "").toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ")} `;
  let best: { name: string; at: number } | null = null;
  for (const name of Object.keys(PLACES)) {
    const at = text.indexOf(` ${name} `);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && name.length > best.name.length)) best = { name, at };
  }
  const fallback = county === "Orange" ? "santa ana" : "los angeles";
  const name = best ? best.name : fallback;
  const place = PLACES[name]!;
  const miles = Math.round(haversineMiles(HOME, place));
  return { place: name.replace(/\b\w/g, (c) => c.toUpperCase()), county: place.county, area: place.county === "Orange" ? "OC" : "LA", miles, estimated: !best || name === "los angeles" };
}

/** Hourly pay the applicant's rule asks for at this distance, rounded to the nearest 25 cents. */
export function targetHourly(miles: number): number {
  const raw = PAY_RULE.baseHourly + Math.max(0, miles - PAY_RULE.freeMiles) * PAY_RULE.perMile;
  return Math.round(raw * 4) / 4;
}

/** 1 within the free radius, falling linearly to 0.3 at 60 miles. */
export function proximityValue(miles: number): number {
  if (miles <= PAY_RULE.freeMiles) return 1;
  return Math.max(0.3, 1 - ((miles - PAY_RULE.freeMiles) / (60 - PAY_RULE.freeMiles)) * 0.7);
}
