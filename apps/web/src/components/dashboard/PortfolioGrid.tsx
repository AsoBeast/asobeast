import type { PortfolioAppInsight, PortfolioGroup } from "@asobeast/shared";
import { PortfolioAppCard } from "./PortfolioAppCard";
import { PortfolioGroupCard } from "./PortfolioGroupCard";
import type { PortfolioRow } from "./portfolio-rows";

export function PortfolioGrid({
  rows,
  groups,
  insights,
}: {
  rows: PortfolioRow[];
  groups: PortfolioGroup[];
  insights: ReadonlyMap<string, PortfolioAppInsight>;
}) {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const insightFor = (appId: string) => insights.get(appId);

  return (
    <ul
      data-slot="app-grid"
      className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]"
    >
      {rows.map((row) => (
        <li
          key={row.kind === "group" ? `${row.variant}-${row.id}` : row.app.id}
        >
          {row.kind === "group" ? (
            <PortfolioGroupCard
              name={row.name}
              members={row.members}
              variant={row.variant}
              group={byId.get(row.id)}
              insightFor={insightFor}
            />
          ) : (
            <PortfolioAppCard app={row.app} insight={insightFor(row.app.id)} />
          )}
        </li>
      ))}
    </ul>
  );
}
