"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { Button } from "@/components/ui/button";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import { appListParsers } from "@/lib/search-params";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { PortfolioGrid } from "./PortfolioGrid";
import { filterRows, sortRows, toRows } from "./portfolio-rows";

export function AppsDashboard() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const [{ q, sort, dir }, setList] = useQueryStates(appListParsers);
  const query = useDeferredValue(q);

  if (data.apps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <div className="flex flex-col gap-1">
          <p className="font-medium">No apps yet</p>
          <p className="max-w-sm text-body text-muted-foreground">
            Import an app from an App Store or Google Play URL to start tracking
            its keywords.
          </p>
        </div>
        <ImportAppDialog>
          <Button>Import your first app</Button>
        </ImportAppDialog>
      </div>
    );
  }

  const insightById = new Map(
    insights.apps.map((insight) => [insight.appId, insight]),
  );
  const rows = sortRows(
    filterRows(toRows(data.apps), query),
    { sort, dir },
    insightById,
  );

  if (rows.length === 0) {
    return (
      <FilteredEmpty
        title={`No apps match "${q}"`}
        onClear={() => void setList({ q: null })}
      />
    );
  }

  return (
    <PortfolioGrid rows={rows} groups={data.groups} insights={insightById} />
  );
}
