// Which AI disclosures an imported episode needs, read from its film.json `disclosures` (the compile step writes it).
// Narration: synthetic unless film.json says `disclosures.aiVoice: false` (a real person's recording, such as the owner's
// or Evelyn's). The default stays synthetic, so a film that says nothing is never labelled as a real voice. Picture: AI-
// generated when film.json says so (`disclosures.aiVisuals`), or, when it is silent, when the episode has an art slot
// (art.json: owner-made AI pictures animated in code). A code-only scene is not AI imagery.
import fs from "node:fs";
import path from "node:path";

export type Disclosures = { aiVoice: boolean; aiVisuals: boolean };

function filmDisclosures(dir: string): Record<string, unknown> | null {
  const filmPath = path.join(dir, "film.json");
  const film = fs.existsSync(filmPath) ? JSON.parse(fs.readFileSync(filmPath, "utf8")) : null;
  return film?.disclosures && typeof film.disclosures === "object" ? film.disclosures : null;
}

export function usesAiVisuals(dir: string): boolean {
  const d = filmDisclosures(dir);
  if (typeof d?.aiVisuals === "boolean") return d.aiVisuals;
  return fs.existsSync(path.join(dir, "art.json"));
}

/** Whether the narration is synthetic: film.json's `disclosures.aiVoice` when it is a boolean, else true. */
export function usesAiVoice(dir: string): boolean {
  const d = filmDisclosures(dir);
  return typeof d?.aiVoice === "boolean" ? d.aiVoice : true;
}

/** Both disclosures of an episode folder. */
export function episodeDisclosures(dir: string): Disclosures {
  return { aiVoice: usesAiVoice(dir), aiVisuals: usesAiVisuals(dir) };
}

/** The note stored with each platform export's disclosures (what the picture and the narration are). */
export function disclosureNotes(d: Disclosures): string {
  const picture = d.aiVisuals ? "AI-generated illustrations (owner-made), animated in code" : "Code-rendered (procedural) animation";
  return `${picture}; ${d.aiVoice ? "synthetic narration" : "narration recorded by a person (not AI)"}.`;
}
