"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
import { actionActivityScope, queueFilters } from "@/lib/action-filters";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  actionActivityOptions,
  actionsOptions,
  actionSummaryFor,
} from "@/lib/queries";
import { overviewTiles } from "./overview-tiles";

export function ActionOverview({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );
  const { data: todo } = useQuery(actionsOptions(queueFilters(), appId));

  return (
    <MetricStrip columns={4} label={t("queueFigures")}>
      {overviewTiles(summary, activity, todo?.items ?? [], { t, locale }).map(
        (tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            note={tile.note}
            delta={
              tile.delta ? (
                <Badge variant="flat" className="numeric">
                  {tile.delta}
                </Badge>
              ) : null
            }
          />
        ),
      )}
    </MetricStrip>
  );
}
