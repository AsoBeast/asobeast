import type {
  PortfolioApp,
  PortfolioAppInsight,
  PortfolioGroup,
} from "@asobeast/shared";
import { PortfolioAppCard } from "./PortfolioAppCard";
import { PortfolioGroupCard } from "./PortfolioGroupCard";
import { toRows } from "./portfolio-rows";

export function PortfolioGrid({
  apps,
  groups,
  insights,
}: {
  apps: PortfolioApp[];
  groups: PortfolioGroup[];
  insights: PortfolioAppInsight[];
}) {
  const rows = toRows(apps);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const insightById = new Map(
    insights.map((insight) => [insight.appId, insight]),
  );
  const insightFor = (appId: string) => insightById.get(appId);

  return (
    <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]">
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
