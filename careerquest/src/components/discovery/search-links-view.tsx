import { ExternalLink } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { SEARCH_BOARDS, type SearchGroup } from "@/lib/discovery/search-links";

function BoardLink({ href, label, context }: { href: string; label: string; context: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center gap-1.5 rounded-ctl border border-line-strong px-3 text-sm text-fg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
      <span className="sr-only">
        search for {context} (opens {label} in a new tab)
      </span>
    </a>
  );
}

/** Outbound board searches per interest × region. Plain links; nothing is fetched by CareerQuest. */
export function SearchLinksView({ groups }: { groups: SearchGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.label}>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {g.label}
                {g.apprenticeship && <Badge tone="info">Apprenticeship</Badge>}
              </CardTitle>
              <CardDescription>Searches for “{g.query}”.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {g.regions.map((r) => (
              <div key={r.region}>
                <p className="mb-2 text-xs font-medium text-fg-muted">{r.region}</p>
                <ul className="flex flex-wrap gap-2">
                  {r.links.map((l) => (
                    <li key={l.board}>
                      <BoardLink href={l.href} label={l.label} context={`${g.query} in ${r.region}`} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {g.statewide.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-fg-muted">Statewide (filter by county on the site)</p>
                <ul className="flex flex-wrap gap-2">
                  {g.statewide.map((l) => (
                    <li key={l.board}>
                      <BoardLink href={l.href} label={l.label} context={`${g.query} statewide`} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>What each board covers</CardTitle>
            <CardDescription>Use the public-sector boards too — utilities, cities, school districts and the state hire electricians and building engineers.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {SEARCH_BOARDS.map((b) => (
              <div key={b.key} className="min-w-0">
                <dt className="font-medium">{b.label}</dt>
                <dd className="text-fg-muted">{b.note}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
