// The studio's default catalogue: five channels, their creations and challenges, milestone rules, official links.
// Everything here is an editable default. Placeholder accounts are never presented as real (provenance "unset").
import type { Editorial } from "../db/schema";

export type Topic = "skincare" | "physics" | "body" | "space" | "whatif";

export const OFFICIAL = {
  // verified 2026-10-24 by search (INTEGRATIONS.md): generic official pages; account-specific links need a real ID
  youtube: { studio: "https://studio.youtube.com", upload: "https://studio.youtube.com", help: "https://support.google.com/youtube/answer/3046356", uploadHelp: "https://support.google.com/youtube/answer/57407" },
  tiktok: { studio: "https://www.tiktok.com/tiktokstudio", upload: "https://www.tiktok.com/tiktokstudio", help: "https://support.tiktok.com/en/using-tiktok/creating-videos/creator-tools-on-tiktok" },
  instagram: { studio: "https://business.facebook.com/", upload: "https://www.instagram.com/", help: "https://help.instagram.com/" },
} as const;

/** A channel-specific YouTube Studio link from a verified channel id (UC…); shown as "confirm active account". */
export function youtubeStudioFor(channelId: string): string {
  return /^UC[\w-]{22}$/.test(channelId) ? `https://studio.youtube.com/channel/${channelId}` : OFFICIAL.youtube.studio;
}

export const CHANNELS: {
  topic: Topic; slug: string; name: string; provisional: boolean; tagline: string; color: string; colorInk: string; label: string;
  voice: { narrator: string; provider: string }; editorial: Editorial; filmsPath: string | null; creation: { key: string; name: string };
}[] = [
  {
    topic: "skincare", slug: "skincare", name: "Skincare (name TBD)", provisional: true,
    tagline: "Skin biology, ingredients and routines, with the evidence on the screen.",
    color: "#D99A92", colorInk: "#8A4A44", label: "SKIN",
    voice: { narrator: "TBD (not af_heart: that voice is Lumevina's)", provider: "kokoro" },
    editorial: {
      audience: "Curious adults who want to understand their skin, not be sold to.",
      tone: "Calm, precise, kind. Myths are corrected without mocking anyone.",
      visualGrammar: "Procedural cross-sections of skin, clean labels, honest scale notes.",
      claimStandards: "Dermatology bodies, NIH and peer-reviewed sources; treatment statements need a dermatologist's sign-off; no diagnoses, no guarantees, no advice to individuals.",
      examples: ["Why does a pore clog?", "Does SPF 100 beat SPF 50?"],
      avoid: ["inferring behaviour from appearance", "promised results", "brand endorsements without disclosure", "Lumevina's look (black, rose and gold; glass bells)"],
    },
    filmsPath: null, creation: { key: "glass_garden", name: "The Glass Garden" },
  },
  {
    topic: "physics", slug: "physics", name: "Rest Frame", provisional: true,
    tagline: "Everyday things, slowed down until the physics shows.",
    color: "#2F5BFF", colorInk: "#1E3FCC", label: "PHYSICS",
    voice: { narrator: "af_bella (speed 1.0)", provider: "kokoro" },
    editorial: {
      audience: "Curious adults; no equations needed, but every number is checked.",
      tone: "Wonder from measurement: the strobe ladder, the stopwatch, the ruler.",
      visualGrammar: "Daylight lab, closed-form motion, ghost stamps at equal time steps, honesty badges for every cheat.",
      claimStandards: "OpenStax/university sources; calculations checked in code with units; air resistance stated when ignored.",
      examples: ["Thrown or dropped?", "The swing's secret"],
      avoid: ["simulations presented as footage", "rounded numbers that change a claim"],
    },
    filmsPath: "films/channels/physics", creation: { key: "gravity_marble", name: "The Gravity Marble" },
  },
  {
    topic: "body", slug: "body", name: "Meanwhile, Inside", provisional: true,
    tagline: "What your body is doing right now, while you watch.",
    color: "#FF6F5E", colorInk: "#B23A2C", label: "BODY",
    voice: { narrator: "bf_emma", provider: "kokoro" },
    editorial: {
      audience: "Curious adults; general education, never personal medical advice.",
      tone: "Warm, vivid, exact. A 'meanwhile' tally ties the film to the viewer's own body.",
      visualGrammar: "Stylised (badged) cells and vessels, no circles, the pulse line motif.",
      claimStandards: "NIH/MedlinePlus, physiology textbooks, peer-reviewed papers; a physiologist signs off; hedge as the sources do.",
      examples: ["Single file", "A billion passengers"],
      avoid: ["diagnoses", "treatment advice", "micrographs that aren't real", "fear-based hooks"],
    },
    filmsPath: "films/channels/body", creation: { key: "bioelectric_car", name: "The Bioelectric Car" },
  },
  {
    topic: "space", slug: "space", name: "Light Minute", provisional: true,
    tagline: "One minute, one 'whoa' about the universe, every number sourced.",
    color: "#5B3FD0", colorInk: "#46309F", label: "SPACE",
    voice: { narrator: "am_michael", provider: "kokoro" },
    editorial: {
      audience: "Curious adults who love scale.",
      tone: "Quiet awe; light-travel time as the channel's ruler.",
      visualGrammar: "Indigo night, teal light fronts, the light-time ring, honesty badges (not to scale, illustration, thought experiment).",
      claimStandards: "NASA/ESA/observatory and journal sources; observations, simulations and estimates labelled apart.",
      examples: ["If the Sun vanished", "Nearest star"],
      avoid: ["renders presented as photos", "dates confused with events (when it happened vs when we saw it)"],
    },
    filmsPath: "films/channels/space", creation: { key: "pocket_universe", name: "The Pocket Universe" },
  },
  {
    topic: "whatif", slug: "whatif", name: "What If? (name TBD)", provisional: true,
    tagline: "Impossible questions, honest assumptions, real calculations.",
    color: "#F2A93B", colorInk: "#8A5A00", label: "WHAT IF?",
    voice: { narrator: "TBD", provider: "kokoro" },
    editorial: {
      audience: "Curious adults and teens who like a thought experiment done properly.",
      tone: "Playful premise, rigorous middle, satisfying number at the end.",
      visualGrammar: "One continuous world, a spine readout, a human-scale anchor, a loopable last frame.",
      claimStandards: "Every assumption stated on screen; estimates computed in code with units and a sensitivity note; sources for every input.",
      examples: ["What if every cat meowed at the same time?"],
      avoid: ["presenting a scenario as a prediction", "hidden assumptions", "fake precision"],
    },
    filmsPath: null, creation: { key: "rift_dragon", name: "The Rift Dragon" },
  },
];

export const CHALLENGES: Record<Topic, { tier: "intro" | "series" | "advanced" | "masterwork"; key: string; title: string; description: string; check: string }[]> = {
  skincare: [
    { tier: "intro", key: "intro", title: "Plant the First Proof", description: "Publish a source-checked skincare myth explanation, every claim with a reference.", check: "published_sourced_episode" },
    { tier: "series", key: "series", title: "Grow the Barrier Path", description: "Complete a six-part ingredient or skin-barrier learning path and its expanded lesson.", check: "series_and_lesson" },
    { tier: "advanced", key: "advanced", title: "Prune the Myths", description: "Publish three original evidence-based myth explanations and complete a documented source/claim review.", check: "owner_confirm" },
    { tier: "masterwork", key: "masterwork", title: "Open the Sanctuary", description: "Create a lesson on building a routine that clearly separates general education from individual medical advice.", check: "owner_confirm" },
  ],
  physics: [
    { tier: "intro", key: "intro", title: "Stabilize the Orbit", description: "Publish a visual explanation with one checked calculation and correct units.", check: "published_sourced_episode" },
    { tier: "series", key: "series", title: "Wind the Engine", description: "Complete a six-part motion, light or sound series with three tested procedural demonstrations, plus its lesson.", check: "series_and_lesson" },
    { tier: "advanced", key: "advanced", title: "Forge the Worked Example", description: "Build a reusable worked-example scene and document its calculations and assumptions.", check: "owner_confirm" },
    { tier: "masterwork", key: "masterwork", title: "Bend Reality", description: "Create a landscape lesson connecting three everyday phenomena through one physical principle.", check: "owner_confirm" },
  ],
  body: [
    { tier: "intro", key: "intro", title: "Power the Chassis", description: "Publish a source-checked explanation of a body system with accurate labels.", check: "published_sourced_episode" },
    { tier: "series", key: "series", title: "Tune the Engine", description: "Complete a connected six-part journey (movement, energy, sleep or another physiology theme) and its lesson.", check: "series_and_lesson" },
    { tier: "advanced", key: "advanced", title: "Calibrate the Blueprint", description: "Complete an accuracy review of a reusable anatomy diagram and use it in an original explanation.", check: "owner_confirm" },
    { tier: "masterwork", key: "masterwork", title: "Cross the Finish Line", description: "Produce a deeper lesson connecting three body systems, with understandable narration and source support.", check: "owner_confirm" },
  ],
  space: [
    { tier: "intro", key: "intro", title: "Light the First Star", description: "Publish a sourced explanation with one correctly labelled scale or distance comparison.", check: "published_sourced_episode" },
    { tier: "series", key: "series", title: "Gather the Planets", description: "Complete a six-part journey with consistent units and verified scale comparisons, plus its lesson.", check: "series_and_lesson" },
    { tier: "advanced", key: "advanced", title: "Chart the Light", description: "Create a diagram or scene containing a checked light-travel-time or orbital-scale calculation.", check: "owner_confirm" },
    { tier: "masterwork", key: "masterwork", title: "Map the Living Cosmos", description: "Create a cosmic-scale lesson that distinguishes observations, simulations and estimates.", check: "owner_confirm" },
  ],
  whatif: [
    { tier: "intro", key: "intro", title: "Crack the Egg", description: "Publish an imaginative scenario with explicit assumptions and a checked estimate.", check: "published_sourced_episode" },
    { tier: "series", key: "series", title: "Teach the Hatchling", description: "Complete six related scenarios under one theme and a lesson explaining their shared principles.", check: "series_and_lesson" },
    { tier: "advanced", key: "advanced", title: "Ride the Rift", description: "Explore three original questions with stated uncertainty or sensitivity to assumptions.", check: "owner_confirm" },
    { tier: "masterwork", key: "masterwork", title: "Crown the Sovereign", description: "Turn a viewer-submitted or owner-selected question into a researched lesson exploring at least two defensible scenarios.", check: "owner_confirm" },
  ],
};

export const OPTIONAL_QUESTS = [
  { key: "q_scene", title: "Finish a scene", description: "Complete one reusable scene or set piece for the channel." },
  { key: "q_sources", title: "Check a source set", description: "Open every source link of one episode and tick its claims." },
  { key: "q_lesson", title: "Assemble a related lesson", description: "Outline a lesson from related published episodes." },
  { key: "q_compare", title: "Run an analytics comparison", description: "Compare two episodes of the same age and format, and note what differed." },
];

export const MILESTONES = [
  { key: "first_published", title: "First Light", description: "The studio's first published episode.", kind: "first_published", threshold: null, scope: "studio", rewardCents: null, xp: 100, badge: "spark", sort: 1 },
  { key: "first_series_lesson", title: "The Long Form", description: "The first complete series lesson.", kind: "series_lesson", threshold: null, scope: "studio", rewardCents: null, xp: 300, badge: "book", sort: 2 },
  { key: "views_10k", title: "Ten Thousand Eyes", description: "One post reaches 10,000 platform-reported views.", kind: "single_post_views", threshold: 10_000, scope: "studio", rewardCents: null, xp: 150, badge: "ring", sort: 3 },
  { key: "views_100k", title: "The Hundred Thousand", description: "One post reaches 100,000 platform-reported views.", kind: "single_post_views", threshold: 100_000, scope: "studio", rewardCents: null, xp: 300, badge: "prism", sort: 4 },
  { key: "1m_club", title: "1M Club — Our First Million", description: "The first single post on one platform to reach 1,000,000 platform-reported views. One studio-wide unlock.", kind: "single_post_views", threshold: 1_000_000, scope: "studio", rewardCents: 20_000, xp: 1000, badge: "crown", sort: 5 },
  { key: "channel_1m", title: "Ascension", description: "A channel's first million-view post: unlocks its creation's Ascended appearance (cosmetic, no money).", kind: "single_post_views", threshold: 1_000_000, scope: "channel", rewardCents: null, xp: 500, badge: "halo", sort: 6 },
  { key: "form4_views", title: "Form 4 threshold", description: "Views one post needs for a creation's advanced form (editable).", kind: "evolution_threshold", threshold: 10_000, scope: "channel", rewardCents: null, xp: 0, badge: "none", sort: 90 },
  { key: "form5_views", title: "Form 5 threshold", description: "Views one post needs for a creation's master form (editable).", kind: "evolution_threshold", threshold: 100_000, scope: "channel", rewardCents: null, xp: 0, badge: "none", sort: 91 },
] as const;

export const ONBOARDING_ITEMS = [
  { item: "email", label: "Brand email created (password manager, 2-step verification on)" },
  { item: "youtube", label: "YouTube channel created with that Google account" },
  { item: "tiktok", label: "TikTok account created with that brand email" },
  { item: "handles", label: "Names and @handles saved in the studio" },
  { item: "links", label: "Profile, Studio and upload links saved" },
  { item: "upload_test", label: "Upload workflow checked (download → copy caption → open upload page → confirm account)" },
];
export const SHARED_ONBOARDING = [
  { item: "admin_email", label: "Studio/admin email chosen (owner access, recovery, Instagram)" },
  { item: "instagram", label: "Shared Instagram account created or designated; bio explains the five topics" },
  { item: "instagram_links", label: "Instagram handle and links saved in the studio" },
];

export const HASHTAGS: Record<Topic, string> = {
  skincare: "#skincare #skinscience #dermatology #learnontiktok",
  physics: "#physics #science #slowmotion #learnontiktok",
  body: "#humanbody #biology #science #learnontiktok",
  space: "#space #astronomy #science #learnontiktok",
  whatif: "#whatif #science #thoughtexperiment #learnontiktok",
};
