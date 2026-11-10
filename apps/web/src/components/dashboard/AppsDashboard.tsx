"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import { appListParsers } from "@/lib/search-params";
import { AppsToolbar } from "./AppsToolbar";
import { PortfolioGrid } from "./PortfolioGrid";
import { PortfolioTable, usePortfolioTable } from "./PortfolioTable";
import { filterRows, matchesQuery, sortRows, toRows } from "./portfolio-rows";
import {
  APPS_HEADING_ID,
  APPS_PANEL,
  APPS_SECTION,
  PANEL_FOOTER,
} from "./layout-classes";

export function AppsDashboard() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const [{ q, sort, dir, view }, setList] = useQueryStates(appListParsers);
  const query = useDeferredValue(q);

  const insightById = new Map(
    insights.apps.map((insight) => [insight.appId, insight]),
  );
  const tableRows = data.apps
    .filter((app) => matchesQuery(app, query))
    .map((app) => ({ app, insight: insightById.get(app.id) }));
  const table = usePortfolioTable(tableRows);
  const cardRows = sortRows(
    filterRows(toRows(data.apps), query),
    { sort, dir },
    insightById,
  );

  const tabular = view === "table";
  const frame = tabular ? APPS_PANEL : APPS_SECTION;
  const empty = cardRows.length === 0;

  return (
    <section aria-labelledby={APPS_HEADING_ID} className={frame.section}>
      <div className={frame.header}>
        <h2 id={APPS_HEADING_ID} className="text-heading">
          Apps
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AppsToolbar
            columns={
              tabular ? (
                <ColumnMenu columns={table.getAllLeafColumns()} />
              ) : null
            }
          />
        </div>
      </div>
      {empty ? (
        <FilteredEmpty
          title={`No apps match "${q}"`}
          onClear={() => void setList({ q: null })}
        />
      ) : tabular ? (
        <>
          <PortfolioTable table={table} />
          <p className={PANEL_FOOTER}>
            Trend is visibility over the last 30 days
          </p>
        </>
      ) : (
        <PortfolioGrid
          rows={cardRows}
          groups={data.groups}
          insights={insightById}
        />
      )}
    </section>
  );
}
