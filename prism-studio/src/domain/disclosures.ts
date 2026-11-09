// Which AI disclosures an imported episode needs. Narration is always synthetic. The picture counts as AI-generated
// when film.json says so (`disclosures.aiVisuals`), or, when it is silent, when the episode has an art slot
// (art.json: owner-made AI pictures animated in code). A code-only scene is not AI imagery.
import fs from "node:fs";
import path from "node:path";

export function usesAiVisuals(dir: string): boolean {
  const filmPath = path.join(dir, "film.json");
  const film = fs.existsSync(filmPath) ? JSON.parse(fs.readFileSync(filmPath, "utf8")) : null;
  if (typeof film?.disclosures?.aiVisuals === "boolean") return film.disclosures.aiVisuals;
  return fs.existsSync(path.join(dir, "art.json"));
}
