import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listTargetCompanies, MAX_TARGET_COMPANIES } from "@/lib/discovery/companies";
import { XP } from "@/lib/game/xp-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TargetCompanyForm } from "@/components/discovery/target-company-form";
import { TargetCompanyCard } from "@/components/discovery/target-company-card";

export const metadata: Metadata = { title: "Target companies · Job Discovery" };

const COMPANY_CATEGORIES = [
  "Electrical contractor",
  "Mechanical / HVAC contractor",
  "General contractor",
  "Elevator company",
  "Utility",
  "Property management",
  "Manufacturing plant",
  "Hospital / healthcare",
  "City / county / public agency",
  "School district / university",
  "Union / JATC",
];

export default async function TargetCompaniesPage() {
  const user = await requireUser("/discovery/companies");
  const companies = await listTargetCompanies(user.id);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Add a target company</CardTitle>
            <CardDescription>
              Employers you want to work for. CareerQuest counts your applications to each one (matched by company name). Adding a company earns{" "}
              {XP.TARGET_COMPANY_ADDED} XP once per company.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TargetCompanyForm categories={COMPANY_CATEGORIES} />
        </CardContent>
      </Card>

      <section aria-labelledby="targets-heading" className="space-y-3">
        <h2 id="targets-heading" className="text-lg font-semibold">
          Your list{companies.length ? <span className="ml-1 text-sm font-normal text-fg-muted tnum">({companies.length})</span> : null}
        </h2>
        {companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title="No target companies yet"
            description="Add the contractors, utilities and building owners you want to work for, with a link to their careers page so you can check it regularly."
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {companies.map((c) => (
              <li key={c.id}>
                <TargetCompanyCard company={c} categories={COMPANY_CATEGORIES} />
              </li>
            ))}
          </ul>
        )}
        {companies.length >= MAX_TARGET_COMPANIES && <p className="text-xs text-fg-muted">The list holds up to {MAX_TARGET_COMPANIES} companies.</p>}
      </section>
    </div>
  );
}
