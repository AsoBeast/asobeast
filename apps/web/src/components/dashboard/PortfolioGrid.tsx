import type { PortfolioApp, PortfolioGroup } from "@asobeast/shared";
import { PortfolioAppCard } from "./PortfolioAppCard";
import { PortfolioGroupCard } from "./PortfolioGroupCard";
import { toRows } from "./portfolio-rows";

export function PortfolioGrid({
  apps,
  groups,
}: {
  apps: PortfolioApp[];
  groups: PortfolioGroup[];
}) {
  const rows = toRows(apps);
  const byId = new Map(groups.map((group) => [group.id, group]));

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
            />
          ) : (
            <PortfolioAppCard app={row.app} />
          )}
        </li>
      ))}
    </ul>
  );
}
