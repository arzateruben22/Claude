/**
 * Adapter architecture with fake fetch: Greenhouse/Lever public postings lookups (never live-verified),
 * NotSupportedError for operations a provider cannot do, mailbox query/filter rules and cursors.
 */
import { describe, expect, it } from "vitest";
import { canRun, createManualAdapter, getAdapter, runOperation } from "@/lib/integrations/adapters";
import { gmailWindowDays, parseGmailCursor } from "@/lib/integrations/adapters/gmail";
import { buildOutlookFirstPageUrl, isGraphUrl, outlookWindowStart, parseOutlookCursor } from "@/lib/integrations/adapters/outlook";
import {
  fetchGreenhouseJob,
  fetchLeverPosting,
  greenhouseApiUrl,
  leverApiUrl,
  parseGreenhouseUrl,
  parseLeverUrl,
} from "@/lib/integrations/adapters/postings";
import { IntegrationHttpError, NotSupportedError, emptySyncResult, type FetchLike } from "@/lib/integrations/adapters/types";
import { JOB_SENDERS, buildGmailQuery, isLikelyJobEmail } from "@/lib/integrations/email-filter";
import { runStatusFor } from "@/lib/integrations/sync";

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fn: FetchLike = async (url) => {
    calls.push(url);
    const handler = routes[url];
    if (!handler) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    return handler();
  };
  return { fn, calls };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Greenhouse postings adapter (experimental)", () => {
  it("parses board URLs and builds the public API URL on the fixed host", () => {
    expect(parseGreenhouseUrl("https://boards.greenhouse.io/AcmeElectric/jobs/4567890?gh_src=abc")).toEqual({ board: "acmeelectric", jobId: "4567890" });
    expect(parseGreenhouseUrl("https://job-boards.greenhouse.io/acme/jobs/12")).toEqual({ board: "acme", jobId: "12" });
    expect(parseGreenhouseUrl("https://boards.greenhouse.io/embed/job_app?for=acme&token=99")).toEqual({ board: "acme", jobId: "99" });
    expect(parseGreenhouseUrl("https://acme.com/careers?gh_jid=99")).toBeNull();
    expect(parseGreenhouseUrl("https://boards.greenhouse.io.evil.com/acme/jobs/1")).toBeNull();
    // Path segments are validated before they reach the API URL.
    expect(parseGreenhouseUrl("https://boards.greenhouse.io/ac%2Fme/jobs/1")).toBeNull();
    expect(parseGreenhouseUrl("https://boards.greenhouse.io/acme/jobs/1;drop")).toBeNull();
    expect(greenhouseApiUrl({ board: "acme", jobId: "12" })).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/12");
  });

  it("maps a job response (entity-escaped HTML content) to job details marked not live-verified", async () => {
    const api = "https://boards-api.greenhouse.io/v1/boards/acme/jobs/4567";
    const { fn, calls } = fakeFetch({
      [api]: json({
        id: 4567,
        title: "Apprentice Electrician",
        updated_at: "2026-10-01T12:00:00-04:00",
        company_name: "Acme Electric",
        location: { name: "Anaheim, CA" },
        absolute_url: "https://boards.greenhouse.io/acme/jobs/4567",
        content: "&lt;p&gt;Pull wire &amp;amp; bend conduit.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;OSHA 10&lt;/li&gt;&lt;/ul&gt;",
        departments: [{ name: "Field" }],
      }),
    });
    const d = await fetchGreenhouseJob(fn, "https://boards.greenhouse.io/acme/jobs/4567");
    expect(calls).toEqual([api]);
    expect(d).toMatchObject({
      provider: "GREENHOUSE",
      externalId: "4567",
      title: "Apprentice Electrician",
      company: "Acme Electric",
      location: "Anaheim, CA",
      department: "Field",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/4567",
      liveVerified: false,
    });
    expect(d.descriptionText).toContain("Pull wire & bend conduit.");
    expect(d.descriptionText).toContain("OSHA 10");
    expect(d.descriptionText).not.toContain("<p>");
    expect(d.updatedAt?.toISOString()).toBe("2026-10-01T16:00:00.000Z");
  });

  it("reports closed postings and refuses URLs that are not Greenhouse boards", async () => {
    const { fn, calls } = fakeFetch({});
    await expect(fetchGreenhouseJob(fn, "https://boards.greenhouse.io/acme/jobs/1")).rejects.toMatchObject({ name: "IntegrationHttpError", status: 404 });
    await expect(fetchGreenhouseJob(fn, "https://www.indeed.com/viewjob?jk=1")).rejects.toBeInstanceOf(NotSupportedError);
    expect(calls).toEqual(["https://boards-api.greenhouse.io/v1/boards/acme/jobs/1"]);
  });

  it("rejects unexpected response shapes and network failures with typed errors", async () => {
    const shape = fakeFetch({ "https://boards-api.greenhouse.io/v1/boards/a/jobs/1": json({ nope: true }) });
    await expect(fetchGreenhouseJob(shape.fn, "https://boards.greenhouse.io/a/jobs/1")).rejects.toBeInstanceOf(IntegrationHttpError);
    const down: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(fetchGreenhouseJob(down, "https://boards.greenhouse.io/a/jobs/1")).rejects.toMatchObject({ status: 0, retryable: true });
  });
});

describe("Lever postings adapter (experimental)", () => {
  const id = "5ac1e3f2-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

  it("parses posting URLs (global and EU) and builds the API URL", () => {
    expect(parseLeverUrl(`https://jobs.lever.co/AcmeElectric/${id}/apply`)).toEqual({ site: "acmeelectric", postingId: id, region: "global" });
    expect(parseLeverUrl(`https://jobs.eu.lever.co/acme/${id}`)).toMatchObject({ region: "eu" });
    expect(parseLeverUrl("https://jobs.lever.co/acme/not-a-uuid")).toBeNull();
    expect(parseLeverUrl(`https://lever.co.evil.com/acme/${id}`)).toBeNull();
    expect(leverApiUrl({ site: "acme", postingId: id, region: "global" })).toBe(`https://api.lever.co/v0/postings/acme/${id}`);
    expect(leverApiUrl({ site: "acme", postingId: id, region: "eu" })).toBe(`https://api.eu.lever.co/v0/postings/acme/${id}`);
  });

  it("maps a posting without inventing an employer name", async () => {
    const api = `https://api.lever.co/v0/postings/acme/${id}`;
    const { fn } = fakeFetch({
      [api]: json({
        id,
        text: "Journeyman Electrician",
        categories: { location: "Irvine, CA", team: "Field Ops", commitment: "Full-time" },
        descriptionPlain: "Install and maintain electrical systems.",
        hostedUrl: `https://jobs.lever.co/acme/${id}`,
        applyUrl: `https://jobs.lever.co/acme/${id}/apply`,
        createdAt: 1767225600000,
      }),
    });
    const d = await fetchLeverPosting(fn, `https://jobs.lever.co/acme/${id}`);
    expect(d).toMatchObject({
      provider: "LEVER",
      title: "Journeyman Electrician",
      company: null,
      location: "Irvine, CA",
      department: "Field Ops",
      employmentType: "Full-time",
      descriptionText: "Install and maintain electrical systems.",
      applyUrl: `https://jobs.lever.co/acme/${id}/apply`,
      liveVerified: false,
    });
  });

  it("rejects a response for a different posting", async () => {
    const api = `https://api.lever.co/v0/postings/acme/${id}`;
    const { fn } = fakeFetch({ [api]: json({ id: "00000000-0000-4000-8000-000000000000", text: "Other" }) });
    await expect(fetchLeverPosting(fn, `https://jobs.lever.co/acme/${id}`)).rejects.toBeInstanceOf(IntegrationHttpError);
  });
});

describe("adapter operations", () => {
  it("raises NotSupportedError for operations a provider cannot do", async () => {
    const indeed = getAdapter("INDEED");
    expect(indeed.capabilities.importApplications).toBe("unsupported");
    expect(canRun(indeed, "importApplications")).toBe(false);
    await expect(runOperation(indeed, "getJobDetails", "https://www.indeed.com/viewjob?jk=1")).rejects.toBeInstanceOf(NotSupportedError);
    await expect(runOperation(createManualAdapter("UNION_PORTALS"), "syncStatuses", {} as never)).rejects.toMatchObject({
      name: "NotSupportedError",
      provider: "UNION_PORTALS",
      operation: "syncStatuses",
    });
    const gh = getAdapter("GREENHOUSE", { fetch: fakeFetch({}).fn });
    expect(canRun(gh, "getJobDetails")).toBe(true);
    await expect(runOperation(gh, "importApplications", {} as never)).rejects.toBeInstanceOf(NotSupportedError);
    expect(canRun(getAdapter("GMAIL"), "importApplications")).toBe(true);
    expect(canRun(getAdapter("GMAIL"), "getJobDetails")).toBe(false);
    expect(canRun(getAdapter("CHROME_EXTENSION"), "importApplications")).toBe(false);
  });

  it("derives a run status from the result", () => {
    const r = emptySyncResult();
    expect(runStatusFor(r)).toBe("SUCCEEDED");
    r.issues.push({ code: "CAP_REACHED", message: "cap" });
    expect(runStatusFor(r)).toBe("SUCCEEDED");
    r.issues.push({ code: "MESSAGE_FAILED", message: "x" });
    expect(runStatusFor(r)).toBe("PARTIAL");
    expect(runStatusFor({ ...emptySyncResult(), fatal: { message: "down", auth: false } })).toBe("FAILED");
    expect(runStatusFor({ ...emptySyncResult(), scanned: 3, fatal: { message: "down", auth: false } })).toBe("PARTIAL");
  });
});

describe("mailbox filters and cursors", () => {
  it("builds a narrow Gmail query", () => {
    const q = buildGmailQuery(90);
    expect(q.startsWith("newer_than:90d -in:chats (from:(")).toBe(true);
    expect(q).toContain("jobs-noreply@linkedin.com");
    expect(q).toContain("subject:(application OR applying OR interview OR offer OR assessment)");
    expect(q).not.toMatch(/\badp\.com\b/);
    expect(JOB_SENDERS).not.toContain("linkedin.com");
    expect(buildGmailQuery(0)).toMatch(/^newer_than:1d/);
  });

  it("keeps job mail and drops personal, social and payroll mail", () => {
    expect(isLikelyJobEmail({ fromAddress: "noreply@indeed.com", subject: "Your weekly digest" })).toBe(true);
    expect(isLikelyJobEmail({ fromAddress: "no-reply@greenhouse.io", subject: "Hello" })).toBe(true);
    expect(isLikelyJobEmail({ fromAddress: "jobs-noreply@linkedin.com", subject: "Your application was sent" })).toBe(true);
    expect(isLikelyJobEmail({ fromAddress: "notifications@linkedin.com", subject: "Sam liked your post" })).toBe(false);
    expect(isLikelyJobEmail({ fromAddress: "friend@gmail.com", subject: "Dinner Saturday?" })).toBe(false);
    expect(isLikelyJobEmail({ fromAddress: "friend@gmail.com", subject: "Re: your interview" })).toBe(true);
    expect(isLikelyJobEmail({ fromAddress: "SecurityServices_NoReply@adp.com", subject: "Your pay statement is available" })).toBe(false);
    expect(isLikelyJobEmail({ fromAddress: "careers@acme.com", subject: "Thank you for your Application" })).toBe(true);
    expect(isLikelyJobEmail({ fromAddress: null, subject: null })).toBe(false);
  });

  it("parses Gmail cursors defensively and narrows the window after a completed run", () => {
    expect(parseGmailCursor(null)).toEqual({ v: 1 });
    expect(parseGmailCursor("not json")).toEqual({ v: 1 });
    expect(parseGmailCursor(JSON.stringify({ v: 2, completedAt: "2026-01-01" }))).toEqual({ v: 1 });
    const now = new Date("2026-10-22T12:00:00Z");
    expect(gmailWindowDays({ v: 1 }, 180, now)).toBe(180);
    expect(gmailWindowDays({ v: 1, completedAt: "2026-10-20T12:00:00Z" }, 180, now)).toBe(3);
    expect(gmailWindowDays({ v: 1, completedAt: "2025-01-01T00:00:00Z" }, 30, now)).toBe(30);
  });

  it("only ever follows Graph links on graph.microsoft.com", () => {
    expect(isGraphUrl("https://graph.microsoft.com/v1.0/me/messages?$skiptoken=x")).toBe(true);
    expect(isGraphUrl("https://graph.microsoft.com.evil.com/v1.0/me/messages")).toBe(false);
    expect(isGraphUrl("http://graph.microsoft.com/v1.0/me/messages")).toBe(false);
    expect(isGraphUrl("https://user:pw@graph.microsoft.com/v1.0")).toBe(false);
    const bad = parseOutlookCursor(JSON.stringify({ v: 1, resume: { link: "https://evil.example/steal", skip: 0, chainStartedAt: "2026-10-01T00:00:00Z" } }));
    expect(bad.resume).toBeUndefined();
  });

  it("builds the first Graph page URL with select, filter, order and page size", () => {
    const url = buildOutlookFirstPageUrl(new Date("2026-07-24T00:00:00.000Z"));
    expect(url.startsWith("https://graph.microsoft.com/v1.0/me/messages?$select=")).toBe(true);
    const u = new URL(url);
    expect(u.searchParams.get("$select")).toBe("id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,body");
    expect(u.searchParams.get("$filter")).toBe("receivedDateTime ge 2026-07-24T00:00:00Z");
    expect(u.searchParams.get("$orderby")).toBe("receivedDateTime asc");
    expect(u.searchParams.get("$top")).toBe("50");
    const now = new Date("2026-10-22T00:00:00Z");
    expect(outlookWindowStart({ v: 1 }, 90, now).toISOString()).toBe("2026-07-24T00:00:00.000Z");
    expect(outlookWindowStart({ v: 1, completedAt: "2026-10-21T00:00:00.000Z" }, 90, now).toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});
