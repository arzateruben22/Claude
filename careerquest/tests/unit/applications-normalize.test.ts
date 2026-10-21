import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  extractRequisitionId,
  normalizeCompany,
  normalizeTitle,
  normalizeUrl,
  similarity,
} from "@/lib/applications/normalize";

describe("normalizeUrl", () => {
  it("reduces Indeed URLs to the job key and drops tracking params", () => {
    expect(
      normalizeUrl(
        "https://www.indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a&from=serp&vjs=3&utm_source=x",
      ),
    ).toBe("https://indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a");
    // Redirect-style click URLs with an upper-case key collapse to the same canonical form.
    expect(
      normalizeUrl("https://www.indeed.com/rc/clk?jk=5E8C7A1B2D3F4E6A&tk=abc"),
    ).toBe("https://indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a");
  });

  it("reduces LinkedIn job URLs (slug or currentJobId) to the numeric id", () => {
    expect(
      normalizeUrl(
        "https://www.linkedin.com/jobs/view/electrician-at-acme-3456789012/?refId=abc&trackingId=xyz",
      ),
    ).toBe("https://linkedin.com/jobs/view/3456789012");
    expect(
      normalizeUrl(
        "https://www.linkedin.com/jobs/search/?currentJobId=3456789012&keywords=electrician",
      ),
    ).toBe("https://linkedin.com/jobs/view/3456789012");
  });

  it("canonicalises Greenhouse boards regardless of subdomain/case", () => {
    expect(
      normalizeUrl(
        "https://boards.greenhouse.io/acmecorp/jobs/4012345?gh_src=abc",
      ),
    ).toBe("https://boards.greenhouse.io/acmecorp/jobs/4012345");
    expect(
      normalizeUrl("https://job-boards.greenhouse.io/AcmeCorp/jobs/4012345"),
    ).toBe("https://boards.greenhouse.io/acmecorp/jobs/4012345");
  });

  it("keeps only gh_jid for Greenhouse boards embedded on company sites", () => {
    expect(
      normalizeUrl(
        "https://acme.com/careers?gh_jid=4012345&utm_source=linkedin&gh_src=xyz",
      ),
    ).toBe("https://acme.com/careers?gh_jid=4012345");
  });

  it("canonicalises Lever postings (drops /apply and source params)", () => {
    expect(
      normalizeUrl(
        "https://jobs.lever.co/AcmeCorp/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b/apply?lever-source=LinkedIn",
      ),
    ).toBe(
      "https://jobs.lever.co/acmecorp/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b",
    );
  });

  it("reduces Workday postings to the tenant + requisition id", () => {
    expect(
      normalizeUrl(
        "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Los-Angeles-CA/Electrician_JR-2024-1234?source=LinkedIn",
      ),
    ).toBe("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/JR-2024-1234");
    expect(
      normalizeUrl(
        "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Los-Angeles-CA/Electrician_R123456-1/apply",
      ),
    ).toBe("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/R123456-1");
  });

  it("reduces ZipRecruiter URLs via jid param or slug id", () => {
    expect(
      normalizeUrl(
        "https://www.ziprecruiter.com/c/Acme/Job/Electrician/-in-Irvine,CA?jid=8f4e2a1b3c5d6e7f&utm_campaign=x",
      ),
    ).toBe("https://ziprecruiter.com/jobs/8f4e2a1b3c5d6e7f");
    expect(
      normalizeUrl(
        "https://www.ziprecruiter.com/jobs/acme-8f4e2a1b3c5d6e7f/electrician",
      ),
    ).toBe("https://ziprecruiter.com/jobs/8f4e2a1b3c5d6e7f");
  });

  it("reduces Glassdoor listings to the listing id", () => {
    expect(
      normalizeUrl(
        "https://www.glassdoor.com/job-listing/electrician-acme-JV_IC1146821_KO0,11_KE12,16.htm?jl=1009123456789&pos=101",
      ),
    ).toBe("https://glassdoor.com/job-listing/1009123456789");
    expect(
      normalizeUrl(
        "https://www.glassdoor.com/Job/irvine-jobs-SRCH_IL.0,6_IC1146821_KO7,18.htm?jobListingId=1009123456789",
      ),
    ).toBe("https://glassdoor.com/job-listing/1009123456789");
  });

  it("strips tracking params, fragments, www and trailing slashes on generic sites and sorts remaining params", () => {
    expect(
      normalizeUrl(
        "https://careers.acme.com/jobs/12345/electrician/?utm_source=indeed&utm_medium=cpc&ref=home&fbclid=1#apply",
      ),
    ).toBe("https://careers.acme.com/jobs/12345/electrician");
    expect(
      normalizeUrl("https://careers.acme.com/jobs/12345/electrician?b=2&a=1"),
    ).toBe("https://careers.acme.com/jobs/12345/electrician?a=1&b=2");
    expect(normalizeUrl("HTTPS://WWW.ACME.COM/Jobs/12345/")).toBe(
      "https://acme.com/Jobs/12345",
    );
  });

  it("returns null for empty or invalid input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("maps well-known hosts to their ApplicationSource", () => {
    expect(detectPlatform("https://www.indeed.com/viewjob?jk=1")).toBe(
      "INDEED",
    );
    expect(detectPlatform("https://www.linkedin.com/jobs/view/1")).toBe(
      "LINKEDIN",
    );
    expect(detectPlatform("https://boards.greenhouse.io/x/jobs/1")).toBe(
      "GREENHOUSE",
    );
    expect(detectPlatform("https://jobs.lever.co/x/1")).toBe("LEVER");
    expect(detectPlatform("https://acme.wd5.myworkdayjobs.com/x")).toBe(
      "WORKDAY",
    );
    expect(detectPlatform("https://www.governmentjobs.com/careers/x")).toBe(
      "GOVERNMENTJOBS",
    );
    expect(detectPlatform("https://www.usajobs.gov/job/1")).toBe("USAJOBS");
    expect(detectPlatform("https://www.ibew11.org/apply")).toBe("UNION_PORTAL");
  });
  it("treats unknown hosts as company sites and invalid input as OTHER", () => {
    expect(detectPlatform("https://careers.acme.com/jobs/1")).toBe(
      "COMPANY_SITE",
    );
    expect(detectPlatform("nope")).toBe("OTHER");
    expect(detectPlatform(null)).toBe("OTHER");
  });
});

describe("normalizeCompany", () => {
  it("strips legal-form suffixes, punctuation and a leading 'the'", () => {
    expect(normalizeCompany("Acme Electric, Inc.")).toBe("acme electric");
    expect(normalizeCompany("ACME ELECTRIC INC")).toBe("acme electric");
    expect(normalizeCompany("The Acme Electric Company")).toBe("acme electric");
    expect(normalizeCompany("Acme Electric LLC")).toBe("acme electric");
    expect(normalizeCompany("Acme Electric L.L.C.")).toBe("acme electric");
    expect(normalizeCompany("Acme Electric Co. Inc.")).toBe("acme electric");
    expect(normalizeCompany("ABM Industries Incorporated")).toBe(
      "abm industries",
    );
    expect(normalizeCompany("Acme & Sons Holdings Ltd.")).toBe("acme and sons");
  });
  it("only strips suffix words at the end of the name", () => {
    expect(normalizeCompany("Co-op City Electric")).toBe("co op city electric");
    expect(normalizeCompany("Acme Group Electric")).toBe("acme group electric");
    expect(normalizeCompany("Johnson Controls")).toBe("johnson controls");
  });
  it("never collapses a name to an empty string", () => {
    expect(normalizeCompany("Company")).toBe("company");
    expect(normalizeCompany("The Group")).toBe("group");
  });
});

describe("normalizeTitle", () => {
  it("drops parentheticals, requisition ids and punctuation", () => {
    expect(normalizeTitle("Electrician (Req #12345)")).toBe("electrician");
    expect(
      normalizeTitle("Journeyman Electrician - Los Angeles [JR-99887]"),
    ).toBe("journeyman electrician los angeles");
    expect(normalizeTitle("Apprentice Electrician, Job ID: R-123456")).toBe(
      "apprentice electrician",
    );
    expect(normalizeTitle("Maintenance Technician II")).toBe(
      "maintenance technician ii",
    );
  });
});

describe("extractRequisitionId", () => {
  it("finds ids in free text", () => {
    expect(extractRequisitionId("Req #12345")).toBe("12345");
    expect(extractRequisitionId("Requisition ID: ABC-12345")).toBe("ABC-12345");
    expect(extractRequisitionId("Job ID 98765")).toBe("98765");
    expect(extractRequisitionId("Job Number: 2024-001234")).toBe("2024-001234");
    expect(extractRequisitionId("R-123456")).toBe("R-123456");
    expect(extractRequisitionId("JR123456")).toBe("JR123456");
    expect(extractRequisitionId("jr-123456")).toBe("JR-123456");
    expect(extractRequisitionId("12345BR")).toBe("12345BR");
    expect(extractRequisitionId("ABCD12345")).toBe("ABCD12345");
  });
  it("finds Workday-style ids in posting URLs", () => {
    expect(
      extractRequisitionId(
        "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Los-Angeles-CA/Electrician_JR-2024-1234?source=LinkedIn",
      ),
    ).toBe("JR-2024-1234");
    expect(
      extractRequisitionId(
        "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Los-Angeles-CA/Electrician_R123456-1/apply",
      ),
    ).toBe("R123456-1");
  });
  it("returns null when nothing looks like a requisition id", () => {
    expect(extractRequisitionId("We need an electrician")).toBeNull();
    expect(extractRequisitionId("Job: Electrician")).toBeNull();
    expect(
      extractRequisitionId(
        "https://www.indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a",
      ),
    ).toBeNull();
    expect(
      extractRequisitionId(
        "https://www.linkedin.com/jobs/view/electrician-at-acme-3456789012/",
      ),
    ).toBeNull();
    expect(extractRequisitionId("")).toBeNull();
    expect(extractRequisitionId(null)).toBeNull();
  });
});

describe("similarity", () => {
  it("is 1 for identical strings (ignoring case/punctuation) and 0 for disjoint strings", () => {
    expect(similarity("Electrician", "electrician")).toBe(1);
    expect(similarity("Electrician", "Plumber")).toBe(0);
  });
  it("is high for near-duplicates", () => {
    expect(
      similarity("Journeyman Electrician", "Journeyman Electrician - LA"),
    ).toBeGreaterThan(0.9);
  });
  it("handles empty and single-character input without NaN", () => {
    expect(similarity("", "x")).toBe(0);
    expect(similarity("a", "b")).toBe(0);
    expect(similarity("a", "a")).toBe(1);
  });
});
