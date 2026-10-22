/**
 * Render smoke test for /analytics/forecast: the page (auth + data mocked) and its sections must
 * render for empty, thin and usable histories, label observed vs estimated vs hypothetical values,
 * and never print a date or a promise.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), usePathname: () => "/analytics/forecast" }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/forecast/queries", () => ({ getForecastData: vi.fn(), MAX_FORECAST_APPLICATIONS: 5000 }));

import ForecastPage from "@/app/(app)/analytics/forecast/page";
import { getForecastData } from "@/lib/forecast/queries";
import { computeForecast, type ForecastInput } from "@/lib/forecast/model";
import { ClusteringCard, Methodology, NextApplicationsCard, ObservedTiles, RatesCard, ThresholdsCard, TimingCard } from "@/components/forecast/sections";
import { ScenarioPanel } from "@/components/forecast/scenario-panel";

const usable: ForecastInput = {
  applied: 100,
  interviews: 8,
  offers: 1,
  clusterSizes: [...Array.from({ length: 10 }, () => 5), ...Array.from({ length: 50 }, () => 1)],
  responseDays: [2, 3, 5, 6, 9, 12, 20],
  awaitingAgesDays: [1, 3, 40, 50],
};
const empty: ForecastInput = { applied: 0, interviews: 0, offers: 0, clusterSizes: [], responseDays: [], awaitingAgesDays: [] };
const thin: ForecastInput = { applied: 3, interviews: 0, offers: 0, clusterSizes: [1, 1, 1], responseDays: [], awaitingAgesDays: [2, 4, 5] };

async function renderPage(input: ForecastInput, sp: Record<string, string> = {}) {
  vi.mocked(getForecastData).mockResolvedValueOnce({ input, capped: false, horizon: 25, horizonSource: "profile", loaded: input.applied });
  const el = await ForecastPage({ searchParams: Promise.resolve(sp) });
  return renderToStaticMarkup(el);
}

const NO_DATES = /\b20\d\d-\d\d-\d\d\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, 20\d\d/;
// Affirmative promises only (the page does say "nothing here predicts whether or when you will be hired").
const NO_PROMISES = /you will (get|receive|land) (an?|the|your) (interview|offer|job)|guaranteed to (get|receive|land)|you will be hired (by|in|within)|hired by (week|day|month)/i;

describe("forecast page", () => {
  it("shows an honest empty state plus the hypothetical scenario mode when nothing was applied", async () => {
    const html = await renderPage(empty);
    expect(html).toContain("No applied applications yet");
    expect(html).toContain("Hypothetical");
    expect(html).toContain("Methodology");
    expect(html).not.toContain("fc-rates");
  });

  it("renders observed counts, estimates with intervals, ranges, the clustering caveat and methodology", async () => {
    const html = await renderPage(usable);
    expect(html).toContain("Reached interview · Observed");
    expect(html).toContain("8 of 100 = 8% observed");
    expect(html).toContain("Estimate with clustering");
    expect(html).toContain("If your current rates hold, roughly");
    expect(html).toContain("more applications would be expected to produce one interview (estimate");
    expect(html).toContain("Outcomes are not independent");
    expect(html).toContain("Beta(1, 9)");
    expect(html).toContain("Beta(1, 49)");
    expect(html).toContain("Hypothetical");
    expect(html).toContain('data-testid="forecast-chart"');
    expect(html).toContain("Recent applications are still open");
    expect(html).toContain('href="/analytics"');
    expect(html).not.toMatch(NO_DATES);
    expect(html).not.toMatch(NO_PROMISES);
  });

  it("flags a prior-dominated history and honours the ρ option", async () => {
    const html = await renderPage(thin, { rho: "0.8" });
    expect(html).toContain("Mostly assumption so far");
    expect(html).toContain("Mostly prior");
    expect(html).toMatch(/<option value="0.8" selected="">/);
  });
});

describe("forecast sections", () => {
  const f = computeForecast(usable, { rho: 0.3, horizon: 25 });

  it("each section renders on its own", () => {
    for (const el of [
      createElement(ObservedTiles, { forecast: f }),
      createElement(RatesCard, { forecast: f }),
      createElement(ThresholdsCard, { forecast: f }),
      createElement(NextApplicationsCard, { forecast: f }),
      createElement(ClusteringCard, { forecast: f, rho: 0.3 }),
      createElement(TimingCard, { forecast: f }),
      createElement(Methodology),
      createElement(ScenarioPanel, { initialInterviewPct: "8", initialOfferPct: "1" }),
    ]) {
      expect(renderToStaticMarkup(el).length).toBeGreaterThan(100);
    }
  });

  it("shows the naive result next to the adjusted one when clustering matters", () => {
    const html = renderToStaticMarkup(createElement(ThresholdsCard, { forecast: f }));
    expect(html).toMatch(/if independent · \d+ with clustering/);
    const flat = computeForecast({ ...usable, clusterSizes: Array.from({ length: 100 }, () => 1) });
    expect(renderToStaticMarkup(createElement(ThresholdsCard, { forecast: flat }))).not.toContain("with clustering</span>");
  });

  it("computes the hypothetical scenario on first render from the typed rates", () => {
    const html = renderToStaticMarkup(createElement(ScenarioPanel, { initialInterviewPct: "10", initialOfferPct: "2" }));
    expect(html).toContain("fc-scenario-result");
    expect(html).toContain("≈ 7 apps");
    expect(html).toContain("Interviews at 10% per application");
  });

  it("time-to-response explains censoring", () => {
    const html = renderToStaticMarkup(createElement(TimingCard, { forecast: f }));
    expect(html).toContain("biased short");
    expect(html).toContain("6 days");
    expect(html).toContain("4–11 days");
  });
});
