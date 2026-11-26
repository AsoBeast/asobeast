"use client";

import { useDeferredValue } from "react";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { PortfolioAppInsight, PortfolioGroup } from "@asobeast/shared";
import { useQueryStates } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { storeLabel } from "@/lib/format";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import { appListParsers } from "@/lib/search-params";
import { isWideOnlyColumn } from "@/lib/table/column-visibility";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useNarrowerThan } from "@/lib/use-narrower-than";
import { AppsToolbar } from "./AppsToolbar";
import { PortfolioGrid } from "./PortfolioGrid";
import {
  PortfolioTable,
  usePortfolioTable,
  WIDE_COLUMNS_FROM_REM,
} from "./PortfolioTable";
import {
  filterRows,
  matchesQuery,
  sortRows,
  toRows,
  type PortfolioRow,
} from "./portfolio-rows";
import { useRangeHistory } from "./use-range-history";
import {
  APPS_HEADING_ID,
  APPS_PANEL,
  APPS_SECTION,
  PANEL_FOOTER,
} from "./layout-classes";

function AppsBody({
  table,
  rows,
  groups,
  insights,
  days,
}: {
  table: ReturnType<typeof usePortfolioTable> | null;
  rows: PortfolioRow[];
  groups: PortfolioGroup[];
  insights: ReadonlyMap<string, PortfolioAppInsight>;
  days: number;
}) {
  const t = useTranslations("dashboard");
  if (table === null) {
    return <PortfolioGrid rows={rows} groups={groups} insights={insights} />;
  }
  return (
    <>
      <PortfolioTable table={table} />
      <p className={PANEL_FOOTER}>
        {t("apps.footer", {
          unit: t("table.rangeUnit", { days }),
          days,
        })}
      </p>
    </>
  );
}

export function AppsDashboard() {
  const t = useTranslations("dashboard");
  const { data } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { days, history } = useRangeHistory();
  const [{ q, sort, dir, view, store }, setList] =
    useQueryStates(appListParsers);
  const query = useDeferredValue(q);

  const insightById = new Map(
    insights.apps.map((insight) => [insight.appId, insight]),
  );
  const rangeById = new Map(
    (history.apps ?? []).map((range) => [range.appId, range]),
  );
  const listed = data.apps.filter(
    (app) => store === null || app.store === store,
  );
  const tableRows = listed
    .filter((app) => matchesQuery(app, query))
    .map((app) => ({
      app,
      insight: insightById.get(app.id),
      range: rangeById.get(app.id),
      days,
    }));
  const table = usePortfolioTable(tableRows);
  const [section, narrow] = useNarrowerThan(WIDE_COLUMNS_FROM_REM);
  const phone = useIsMobile();
  const dropsWideColumns = narrow && !phone;
  const menuColumns = table
    .getAllLeafColumns()
    .filter(
      (column) =>
        !(dropsWideColumns && isWideOnlyColumn(column.columnDef.meta)),
    );
  const cardRows = sortRows(
    filterRows(toRows(listed, t), query),
    { sort, dir },
    insightById,
  );

  const tabular = view === "table";
  const frame = tabular ? APPS_PANEL : APPS_SECTION;
  const empty = cardRows.length === 0;

  return (
    <section
      ref={section}
      aria-labelledby={APPS_HEADING_ID}
      className={frame.section}
    >
      <div className={frame.header}>
        <h2 id={APPS_HEADING_ID} className="text-heading">
          {t("apps.heading")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AppsToolbar
            columns={tabular ? <ColumnMenu columns={menuColumns} /> : null}
          />
        </div>
      </div>
      {empty ? (
        <FilteredEmpty
          title={
            q === "" && store !== null
              ? t("apps.noStoreApps", { store: storeLabel(store) })
              : t("apps.noMatch", { query: q })
          }
          onClear={() => void setList({ q: null, store: null })}
        />
      ) : (
        <AppsBody
          table={tabular ? table : null}
          rows={cardRows}
          groups={data.groups}
          insights={insightById}
          days={days}
        />
      )}
    </section>
  );
}
