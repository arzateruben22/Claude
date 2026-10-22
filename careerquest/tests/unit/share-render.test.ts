/**
 * Server-render smoke tests for /share (auth and the match loader mocked).
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/discovery/share", () => ({ loadShareContext: vi.fn(async () => ({ matches: [], lead: null })) }));

import SharePage from "@/app/(app)/share/page";
import { ShareCapture } from "@/components/share/share-capture";
import { SharePasteForm } from "@/components/share/share-paste-form";
import { loadShareContext } from "@/lib/discovery/share";

/** A button with this name and value, in either attribute order. */
const button = (name: string, value: string) => new RegExp(`<button[^>]*(?:name="${name}"[^>]*value="${value}"|value="${value}"[^>]*name="${name}")`);

const render = async (sp: Record<string, string>) => renderToStaticMarkup(await SharePage({ searchParams: Promise.resolve(sp) }));

describe("/share", () => {
  it("opened directly shows only the paste box and the platform notes", async () => {
    const html = await render({});
    expect(html).toContain("Paste a job");
    expect(html).toMatch(/<form[^>]*action="\/share"[^>]*method="get"|<form[^>]*method="get"[^>]*action="\/share"/);
    expect(html).toContain("does not reliably list web apps");
    expect(html).not.toContain("I applied — confirm");
    expect(loadShareContext).not.toHaveBeenCalled();
  });

  it("a shared posting is parsed and offers the three decisions, prefilled", async () => {
    const html = await render({
      title: "Electrician Helper - Volt Line Electric - Anaheim, CA - Indeed.com",
      text: "https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60718 Company vehicle provided.",
    });
    expect(html).toContain("What was shared");
    expect(html).toContain("Indeed");
    expect(html).toContain('value="Volt Line Electric"');
    expect(html).toContain('value="Electrician Helper"');
    expect(html).toContain('value="Anaheim, CA"');
    expect(html).toContain("Flag: Company vehicle");
    for (const label of ["Save as lead", "Save to tracker", "Not applied yet", "I applied — confirm"]) expect(html).toContain(label);
    expect(html).toMatch(button("decision", "lead"));
    expect(html).toMatch(button("decision", "track"));
    expect(html).toMatch(button("decision", "applied"));
    expect(vi.mocked(loadShareContext).mock.calls.at(-1)?.[0]).toBe("u1");
  });

  it("asks for company and title when they cannot be read", async () => {
    const html = await render({ text: "look at this" });
    expect(html).toContain("Add the company and job title");
    expect(html).toContain("No link found");
    expect(html).toContain('name="company" value=""');
  });

  it("lists tracked matches with an 'I applied to this one' choice", () => {
    const id = "1c2d3e4f-5555-4666-8777-888899990000";
    const html = renderToStaticMarkup(
      createElement(ShareCapture, {
        fields: { url: "", title: "Wireman", company: "Acme", location: "", salaryText: "" },
        sharedText: "Wireman at Acme",
        context: { matches: [{ id, label: "Acme – Wireman", status: "SAVED", statusLabel: "Saved", detail: "Added Oct 1, 2026" }], lead: { id: "l1", label: "Acme – Wireman", status: "NEW" } },
      }),
    );
    expect(html).toContain("Already in your tracker");
    expect(html).toMatch(button("choice", `applied:attach:${id}`));
    expect(html).toContain(`href="/applications/${id}"`);
    expect(html).toContain("Also a Job Discovery lead");
    expect(renderToStaticMarkup(createElement(SharePasteForm, {}))).toContain('name="text"');
  });
});
