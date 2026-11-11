import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { disclosureNotes, episodeDisclosures, usesAiVisuals, usesAiVoice } from "../src/domain/disclosures";

function episode(files: Record<string, unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ep-"));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(body));
  return dir;
}

describe("AI visuals disclosure", () => {
  it("a code-only episode is not AI imagery", () => expect(usesAiVisuals(episode({ "film.json": { id: "x" } }))).toBe(false));
  it("an art slot (owner-made AI pictures) is AI imagery", () => expect(usesAiVisuals(episode({ "film.json": { id: "x" }, "art.json": {} }))).toBe(true));
  it("film.json decides when it says so", () => {
    expect(usesAiVisuals(episode({ "film.json": { disclosures: { aiVisuals: false } }, "art.json": {} }))).toBe(false);
    expect(usesAiVisuals(episode({ "film.json": { disclosures: { aiVisuals: true } } }))).toBe(true);
  });
  it("a missing folder or film.json is not AI imagery", () => expect(usesAiVisuals(path.join(os.tmpdir(), "no-such-episode"))).toBe(false));
});

describe("AI voice disclosure", () => {
  it("is synthetic unless film.json says the voice is real", () => {
    expect(usesAiVoice(episode({ "film.json": { id: "x" } }))).toBe(true);
    expect(usesAiVoice(episode({ "film.json": { disclosures: { aiVisuals: false } } }))).toBe(true);
    expect(usesAiVoice(episode({ "film.json": { disclosures: { aiVoice: false } } }))).toBe(false);
    expect(usesAiVoice(episode({ "film.json": { disclosures: { aiVoice: true } } }))).toBe(true);
    expect(usesAiVoice(episode({ "film.json": { disclosures: { aiVoice: "no" } } }))).toBe(true);   // only a boolean decides
    expect(usesAiVoice(path.join(os.tmpdir(), "no-such-episode"))).toBe(true);
  });
  it("reads both flags together, and notes what each export carries", () => {
    expect(episodeDisclosures(episode({ "film.json": { disclosures: { aiVoice: false } }, "art.json": {} }))).toEqual({ aiVoice: false, aiVisuals: true });
    expect(disclosureNotes({ aiVoice: true, aiVisuals: true })).toBe("AI-generated illustrations (owner-made), animated in code; synthetic narration.");
    expect(disclosureNotes({ aiVoice: true, aiVisuals: false })).toBe("Code-rendered (procedural) animation; synthetic narration.");
    expect(disclosureNotes({ aiVoice: false, aiVisuals: false })).toBe("Code-rendered (procedural) animation; narration recorded by a person (not AI).");
  });
});
