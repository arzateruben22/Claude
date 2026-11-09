import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { usesAiVisuals } from "../src/domain/disclosures";

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
