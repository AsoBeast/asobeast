"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { actionActivityScope } from "@/lib/action-filters";
import {
  actionActivityOptions,
  actionsOptions,
  actionSummaryFor,
} from "@/lib/queries";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";
import { overviewTiles } from "./overview-tiles";
import { OVERVIEW_GRID } from "./skeletons";

export function ActionOverview({ appId }: { appId?: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );
  const { data: todo } = useQuery(
    actionsOptions({ status: [...ACTION_DEFAULT_STATUSES] }, appId),
  );

  return (
    <StatTileGroup className={OVERVIEW_GRID}>
      {overviewTiles(summary, activity, todo?.items ?? []).map((tile) => (
        <StatTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          note={tile.note}
        />
      ))}
    </StatTileGroup>
  );
}
