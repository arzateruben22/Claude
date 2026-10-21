import { describe, expect, it } from "vitest";
import {
  dateInputValue,
  dateTimeInputValue,
  daysBetweenInTz,
  formatInTz,
  parseDateInput,
  zonedToUtc,
} from "@/lib/applications/time";
import {
  DEFAULT_PAGE_SIZE,
  dayRange,
  hasActiveFilters,
  listHref,
  parseListFilters,
} from "@/lib/applications/query";
import { buildTimeline } from "@/lib/applications/timeline";

const LA = "America/Los_Angeles";

describe("time helpers", () => {
  it("parses a date-only input as noon in the user's timezone", () => {
    // October → PDT (UTC-7): noon LA = 19:00Z
    expect(parseDateInput("2026-10-21", LA)?.toISOString()).toBe(
      "2026-10-21T19:00:00.000Z",
    );
    // January → PST (UTC-8)
    expect(parseDateInput("2026-01-15", LA)?.toISOString()).toBe(
      "2026-01-15T20:00:00.000Z",
    );
    expect(parseDateInput("2026-01-15", "Asia/Tokyo")?.toISOString()).toBe(
      "2026-01-15T03:00:00.000Z",
    );
  });

  it("parses a datetime-local input as wall-clock time in the user's timezone", () => {
    expect(parseDateInput("2026-10-21T14:30", LA)?.toISOString()).toBe(
      "2026-10-21T21:30:00.000Z",
    );
    expect(parseDateInput("2026-03-08T01:30", LA)?.toISOString()).toBe(
      "2026-03-08T09:30:00.000Z",
    ); // before DST starts
    expect(parseDateInput("2026-03-08T03:30", LA)?.toISOString()).toBe(
      "2026-03-08T10:30:00.000Z",
    ); // after DST starts
  });

  it("returns null for empty or invalid input and passes ISO instants through", () => {
    expect(parseDateInput("", LA)).toBeNull();
    expect(parseDateInput(undefined, LA)).toBeNull();
    expect(parseDateInput("nonsense", LA)).toBeNull();
    expect(parseDateInput("2026-10-21T19:00:00.000Z", LA)?.toISOString()).toBe(
      "2026-10-21T19:00:00.000Z",
    );
  });

  it("round-trips input values through the user's timezone", () => {
    const d = zonedToUtc(LA, 2026, 10, 21, 9, 5);
    expect(dateInputValue(d, LA)).toBe("2026-10-21");
    expect(dateTimeInputValue(d, LA)).toBe("2026-10-21T09:05");
    expect(dateInputValue(null, LA)).toBe("");
    // Just after midnight UTC is still the previous evening in LA.
    expect(dateInputValue(new Date("2026-10-22T03:00:00Z"), LA)).toBe(
      "2026-10-21",
    );
  });

  it("formats in the user's timezone", () => {
    const d = new Date("2026-10-22T03:00:00Z");
    expect(formatInTz(d, LA, "date")).toBe("Oct 21, 2026");
    expect(formatInTz(d, "UTC", "date")).toBe("Oct 22, 2026");
    expect(formatInTz(null, LA)).toBe("—");
    expect(formatInTz(d, LA, "time")).toBe("8:00 PM");
  });

  it("counts calendar days in the user's timezone", () => {
    expect(
      daysBetweenInTz(
        new Date("2026-10-21T19:00:00Z"),
        new Date("2026-10-24T19:00:00Z"),
        LA,
      ),
    ).toBe(3);
    expect(
      daysBetweenInTz(
        new Date("2026-10-22T03:00:00Z"),
        new Date("2026-10-22T19:00:00Z"),
        LA,
      ),
    ).toBe(1);
    expect(
      daysBetweenInTz(
        new Date("2026-10-24T19:00:00Z"),
        new Date("2026-10-21T19:00:00Z"),
        LA,
      ),
    ).toBe(-3);
  });
});

describe("list query parsing", () => {
  it("applies defaults for an empty query", () => {
    const f = parseListFilters({});
    expect(f).toEqual({
      q: undefined,
      status: undefined,
      source: undefined,
      category: undefined,
      from: undefined,
      to: undefined,
      includeArchived: false,
      sort: "updated",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("parses and sanitises every field", () => {
    const f = parseListFilters({
      q: "  acme ",
      status: "submitted,INTERVIEWING,bogus,submitted",
      source: "indeed",
      category: "Electrician",
      from: "2026-10-01",
      to: "not-a-date",
      sort: "company",
      page: "3",
      pageSize: "500",
      archived: "1",
    });
    expect(f.q).toBe("acme");
    expect(f.status).toEqual(["SUBMITTED", "INTERVIEWING"]);
    expect(f.source).toBe("INDEED");
    expect(f.category).toBe("Electrician");
    expect(f.from).toBe("2026-10-01");
    expect(f.to).toBeUndefined();
    expect(f.sort).toBe("company");
    expect(f.page).toBe(3);
    expect(f.pageSize).toBe(100);
    expect(f.includeArchived).toBe(true);
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("ignores invalid page/sort values", () => {
    const f = parseListFilters({
      page: "-2",
      sort: "nope",
      status: ["OFFER", "HIRED"],
    });
    expect(f.page).toBe(1);
    expect(f.sort).toBe("updated");
    expect(f.status).toEqual(["OFFER", "HIRED"]);
  });

  it("builds hrefs that round-trip and reset the page on filter changes", () => {
    const f = parseListFilters({
      q: "acme",
      status: "SUBMITTED",
      page: "4",
      sort: "applied",
    });
    const href = listHref(f, { page: 4 });
    expect(href).toBe(
      "/applications?q=acme&status=SUBMITTED&sort=applied&page=4",
    );
    const sp = Object.fromEntries(
      new URL("http://x" + href).searchParams.entries(),
    );
    expect(parseListFilters(sp)).toEqual(f);
    expect(listHref(f, { status: ["OFFER"] })).toBe(
      "/applications?q=acme&status=OFFER&sort=applied",
    );
    expect(listHref(f, { q: null, status: null, sort: "updated" })).toBe(
      "/applications",
    );
  });

  it("computes an inclusive day range", () => {
    const r = dayRange("2026-10-01", "2026-10-02");
    expect(r.gte?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(r.lt?.toISOString()).toBe("2026-10-03T00:00:00.000Z");
    expect(dayRange(undefined, undefined)).toEqual({});
  });
});

describe("timeline", () => {
  it("merges history and events newest-first, hides STATUS_CHANGED duplicates and labels sources", () => {
    const t1 = new Date("2026-10-01T10:00:00Z");
    const t2 = new Date("2026-10-02T10:00:00Z");
    const entries = buildTimeline(
      [
        {
          id: "h1",
          fromStatus: null,
          toStatus: "SAVED",
          occurredAt: t1,
          source: "USER",
          verified: true,
          note: null,
        },
        {
          id: "h2",
          fromStatus: "SAVED",
          toStatus: "SUBMITTED",
          occurredAt: t2,
          source: "EMAIL",
          verified: false,
          note: "Confirmation email",
        },
      ],
      [
        {
          id: "e1",
          type: "SAVED",
          occurredAt: t1,
          source: "USER",
          verified: true,
          payload: {},
        },
        {
          id: "e2",
          type: "STATUS_CHANGED",
          occurredAt: t2,
          source: "EMAIL",
          verified: false,
          payload: { from: "SAVED", to: "SUBMITTED" },
        },
        {
          id: "e3",
          type: "APPLIED",
          occurredAt: t2,
          source: "EMAIL",
          verified: false,
          payload: {},
        },
        {
          id: "e4",
          type: "NOTE_ADDED",
          occurredAt: new Date("2026-10-03T10:00:00Z"),
          source: "USER",
          verified: true,
          payload: { note: "Called the office" },
        },
      ],
    );
    expect(entries.map((e) => e.id)).toEqual([
      "e:e4",
      "h:h2",
      "e:e3",
      "h:h1",
      "e:e1",
    ]);
    expect(entries[0]!.detail).toBe("Called the office");
    expect(entries[1]!.title).toBe("Saved → Submitted");
    expect(entries[1]!.detail).toBe("Confirmation email");
    expect(entries[1]!.verified).toBe(false);
    expect(entries[3]!.title).toBe("Created as Saved");
    expect(entries.some((e) => e.eventType === "STATUS_CHANGED")).toBe(false);
  });
});
