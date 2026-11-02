import { describe, expect, it } from "vitest";
import { plannedSeason, seasonLabel, seasonLine, seasonProgress } from "../src/domain/season";

const ep = (state: string, n: number) => ({ state, title: `Ep ${n}`, seriesOrder: n, number: 100 + n });

describe("season progress", () => {
  it("counts ready from ready-for-review on, posted from published on, and ignores cancelled and superseded", () => {
    const p = seasonProgress("Season 1: Forces you can see", [
      ep("script", 3), ep("ready_for_review", 1), ep("approved", 2), ep("published", 4), ep("correction_needed", 5), ep("cancelled", 6), ep("superseded", 7), ep("analytics", 8),
    ]);
    expect(p).toMatchObject({ label: "Season 1", total: 6, ready: 4, posted: 2, planned: false });
    expect(p.titles).toEqual(["Ep 1", "Ep 2", "Ep 3", "Ep 4", "Ep 5", "Ep 8"]);
    expect(seasonLine(p)).toBe("Season 1 · 4 of 6 ready · 2 posted");
  });
  it("a blocked or failed episode is not ready", () => {
    expect(seasonProgress("Season 2", [ep("blocked", 1), ep("failed", 2), ep("render", 3)]).ready).toBe(0);
  });
  it("a planned season shows its titles and never a number", () => {
    const p = plannedSeason({ label: "Season 1", titles: ["A", "B", "C", "D", "E", "F"] });
    expect(p).toMatchObject({ total: 6, ready: 0, posted: 0, planned: true });
    expect(seasonLine(p)).toBe("Season 1 in production");
  });
  it("labels", () => {
    expect(seasonLabel("Season 1: The traffic inside you")).toBe("Season 1");
    expect(seasonLabel("Odd ones")).toBe("Odd ones");
    expect(seasonLine(seasonProgress("Season 3: x", []))).toBe("Season 3 in production");
  });
});
