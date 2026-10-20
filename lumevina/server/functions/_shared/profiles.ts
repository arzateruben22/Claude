// Lumevina — a client's skin profile and what the chat remembers about them.
//
// The profile is what the client tells us in My Lumevina (js/profile.js), in
// their own words, saved only with their yes:
//   { skinType, concerns[], goal, morning, night, weekly, supplements, treatments, sensitivities }
// The memory is what they've told the chat since: one short line each
// ("Uses CeraVe Hydrating Cleanser at night"), saved by the ask function's
// remember tool, newest first, which they can see and delete.
//
// Both go into the client's chat file (plans.ts → clientFile) and Evelyn's
// view of them (functions/studio → client_profile), never to anyone else.
// Medications, prescriptions, pregnancy and health conditions are not saved
// here: those stay on the pre-visit form, for Evelyn.

// deno-lint-ignore-file no-explicit-any

/* the same skin types as her skin plans (plans.ts), kept here so neither file imports the other */
export const SKIN_TYPES = ["Dry", "Normal", "Combination", "Oily", "Sensitive", "Acne-prone"];

export const CONCERN_OPTIONS = ["Breakouts", "Dark spots", "Redness", "Dryness", "Oiliness", "Fine lines", "Texture", "Dullness", "Sensitivity", "Ingrown hairs"];
export const MEMORY_KINDS = ["skin", "concern", "product", "supplement", "treatment", "sensitivity", "goal", "other"];
export const MEMORY_CAP = 60;

const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+\n/g, "\n").trim().slice(0, n);

/** A profile as stored: every field bounded. */
export function cleanProfile(p: any) {
  return {
    skinType: SKIN_TYPES.includes(p?.skinType) ? String(p.skinType) : "",
    concerns: (Array.isArray(p?.concerns) ? p.concerns : []).slice(0, 12).map((c: unknown) => str(c, 60)).filter(Boolean) as string[],
    goal: str(p?.goal, 400),
    morning: str(p?.morning, 600),
    night: str(p?.night, 600),
    weekly: str(p?.weekly, 400),
    supplements: str(p?.supplements, 400),
    treatments: str(p?.treatments, 600),
    sensitivities: str(p?.sensitivities, 400),
  };
}
export type Profile = ReturnType<typeof cleanProfile>;
export const isEmpty = (p: Profile) => !p.skinType && !p.concerns.length && !Object.entries(p).some(([k, v]) => k !== "concerns" && k !== "skinType" && v);

const day = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The profile as plain text, for the assistant and for drafts. */
export function profileText(p: Profile, updated?: string) {
  const out = [`Their skin profile, in their own words${updated ? ` (updated ${day(updated)})` : ""}:`];
  if (p.skinType) out.push(`- Skin: ${p.skinType}`);
  if (p.concerns.length) out.push(`- Working on: ${p.concerns.join(", ")}`);
  if (p.goal) out.push(`- What they'd love their skin to do: ${p.goal}`);
  if (p.morning) out.push(`- Morning routine now: ${p.morning}`);
  if (p.night) out.push(`- Night routine now: ${p.night}`);
  if (p.weekly) out.push(`- Once or twice a week: ${p.weekly}`);
  if (p.supplements) out.push(`- Supplements they take: ${p.supplements}`);
  if (p.treatments) out.push(`- Treatments they've had (here or elsewhere): ${p.treatments}`);
  if (p.sensitivities) out.push(`- What their skin reacts to: ${p.sensitivities}`);
  return out.join("\n");
}

export async function getProfile(db: any, email: string) {
  const { data } = await db.from("client_profiles").select("profile, consent_at, updated_at").eq("email", email.toLowerCase()).maybeSingle();
  return data ? { profile: cleanProfile(data.profile), consent_at: data.consent_at, updated_at: data.updated_at } : null;
}

export async function memories(db: any, email: string, limit = 40) {
  const { data } = await db.from("client_memory").select("id, kind, fact, source, created_at").eq("email", email.toLowerCase())
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as { id: string; kind: string; fact: string; source: string; created_at: string }[];
}

/* not for this memory: medicines and health, which Evelyn keeps on the pre-visit form */
const HEALTH = /\b(accutane|isotretinoin|absorica|claravis|tretinoin|retin-?a|adapalene|differin|tazarotene|spironolactone|doxycycline|minocycline|antibiotic|prescri|birth control|the pill|medication|medicine|pregnan|breastfeed|nursing|diagnos|eczema|psoriasis|rosacea|dermatitis|lupus|diabet|thyroid|pcos|cancer|chemo)/i;
const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/**
 * Save one thing a client told the chat. Returns "saved", "known" (already
 * there), "health" (not kept here: Evelyn's) or "empty".
 */
export async function remember(db: any, email: string, fact: unknown, kind: unknown, source = "chat") {
  const text = str(fact, 200).replace(/\n+/g, " ");
  if (text.length < 3) return "empty";
  if (HEALTH.test(text)) return "health";
  const e = email.toLowerCase();
  const have = await memories(db, e, MEMORY_CAP);
  if (have.some((m) => key(m.fact) === key(text))) return "known";
  const { error } = await db.from("client_memory").insert({ email: e, kind: MEMORY_KINDS.includes(String(kind)) ? String(kind) : "other", fact: text, source });
  if (error) { console.error("memory", error); return "empty"; }
  // the newest MEMORY_CAP stay
  if (have.length >= MEMORY_CAP) {
    const old = have.slice(MEMORY_CAP - 1).map((m) => m.id);
    if (old.length) await db.from("client_memory").delete().in("id", old);
  }
  return "saved";
}

/** Both, as the lines that go into the chat's file for this client. */
export async function profileParts(db: any, email: string) {
  const [p, mem] = await Promise.all([getProfile(db, email).catch(() => null), memories(db, email, 25).catch(() => [])]);
  const parts: string[] = [];
  if (p && !isEmpty(p.profile)) parts.push(profileText(p.profile, p.updated_at));
  if (mem.length) parts.push("What they've told you in earlier chats, newest first:\n" + mem.map((m) => `- ${day(m.created_at)}: ${m.fact}`).join("\n"));
  return { parts, hasProfile: !!p && !isEmpty(p.profile), supplements: !!p?.profile.supplements || mem.some((m) => m.kind === "supplement") };
}
