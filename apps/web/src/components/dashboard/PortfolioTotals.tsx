import type { PortfolioTotals as Totals } from "@asobeast/shared";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber } from "@/lib/format";

export function PortfolioTotals({
  totals,
  openActions,
}: {
  totals: Totals;
  openActions: number | null;
}) {
  return (
    <StatTileGroup>
      <StatTile
        label="Apps"
        value={formatNumber(totals.apps)}
        note="tracked in this workspace"
      />
      <StatTile
        label="Keywords"
        value={formatNumber(totals.trackedKeywords)}
        note="across every market"
      />
      <StatTile
        label="Competitors"
        value={formatNumber(totals.competitors)}
        note="watched alongside your apps"
      />
      <StatTile
        label="Open actions"
        value={openActions === null ? "—" : formatNumber(openActions)}
        note={openActions === null ? "not generated yet" : "waiting on you"}
      />
      <StatTile
        label="Changes this week"
        value={formatNumber(totals.changes7d)}
        note="metadata updates in the last 7 days"
      />
    </StatTileGroup>
  );
}
