"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { AppIcon } from "@/components/AppIcon";
import {
  FOOTER_LINK,
  LIST_HEAD,
  LIST_ROW,
} from "@/components/layout/panel-classes";
import { TrendChip } from "@/components/ui/delta-chip";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatNumberInLocale } from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import { useAppLocale } from "@/lib/use-app-locale";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import {
  dashboardBreakdownParsers,
  type DashboardMetric,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";
import {
  BREAKDOWN_MORE_ID,
  breakdownBy,
  breakdownRowId,
  breakdownRows,
  hasSeveralStores,
  isBrokenDown,
  leavesWithScope,
  rowLabel,
  rowSize,
  shownRows,
  sortRows,
  type BreakdownRow,
} from "./breakdown";
import {
  APPS_HEADING_ID,
  BREAKDOWN_HEADER,
  BREAKDOWN_PANEL,
} from "./layout-classes";
import { MovementValue } from "./MovementValue";
import { focusScopeSurvivor, leavingProps } from "./scope-focus";
import { useRangeHistory } from "./use-range-history";

const BAR_REACH_PERCENT = 60;

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_2.5rem_4rem] gap-2 px-2";

const WIDE = "relative col-span-2 justify-self-end";

const orderText = (
  metric: DashboardMetric,
  days: number,
  t: MessageTranslator,
): string => {
  if (metric === "actions") return t("breakdown.sortedPriority");
  return t(
    metric === "moved" ? "breakdown.sortedMoved" : "breakdown.sortedChange",
    { days },
  );
};

function Heads({ metric, unit }: { metric: DashboardMetric; unit: string }) {
  const t = useTranslations("dashboard");
  if (metric === "moved") {
    return (
      <span className="col-span-2 text-right">
        {t("breakdown.movedUnit", { unit })}
      </span>
    );
  }
  if (metric === "actions") {
    return (
      <span className="col-span-2 text-right">
        {t("breakdown.openActions")}
      </span>
    );
  }
  return (
    <>
      <span className="text-right">{t("breakdown.now")}</span>
      <span className="text-right">{unit}</span>
    </>
  );
}

function Figures({
  row,
  metric,
  unit,
}: {
  row: BreakdownRow;
  metric: DashboardMetric;
  unit: string;
}) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (metric === "moved") {
    return (
      <span className={cn(WIDE, "numeric")}>
        <MovementValue movement={row.change.movement} />
      </span>
    );
  }
  if (metric === "actions") {
    return (
      <span className={cn(WIDE, "numeric inline-flex gap-1")}>
        <span>{formatNumberInLocale(row.open, locale)}</span>
        {row.critical > 0 ? (
          <span className="text-signal-down">
            {t("breakdown.critical", { count: row.critical })}
          </span>
        ) : null}
      </span>
    );
  }
  const visible = metric === "visibility";
  return (
    <>
      <span className="numeric relative text-right">
        {formatNumberInLocale(
          visible ? Math.round(row.change.visibility) : row.change.top10,
          locale,
        )}
      </span>
      <span className="relative justify-self-end">
        <TrendChip
          label={unit}
          value={visible ? row.change.visibilityDelta : row.change.top10Delta}
          labelled={false}
        />
      </span>
    </>
  );
}

export function PortfolioBreakdown({ metric }: { metric: DashboardMetric }) {
  const t = useTranslations("dashboard");
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { days, history } = useRangeHistory();
  const [{ by, scope }, setBreakdown] = useQueryStates(
    dashboardBreakdownParsers,
  );
  const shownBy = breakdownBy(by, portfolio.apps);
  const switchable = hasSeveralStores(portfolio.apps);
  const sorted = sortRows(
    breakdownRows(
      history,
      portfolio.apps,
      new Map(insights.apps.map((insight) => [insight.appId, insight])),
      { by: shownBy, t },
    ),
    metric,
  );
  if (!isBrokenDown(history) || sorted.length === 0) return null;

  const rows = shownRows(sorted, scope);
  const largest = Math.max(1, ...sorted.map((row) => rowSize(row, metric)));
  const unit = t("table.rangeUnit", { days });
  const headingId = "breakdown-heading";

  return (
    <section aria-labelledby={headingId} className={BREAKDOWN_PANEL}>
      <div className={cn(BREAKDOWN_HEADER, "justify-between")}>
        <h2
          id={headingId}
          className="text-label font-medium text-muted-foreground"
        >
          {t(shownBy === "app" ? "breakdown.byApp" : "breakdown.byStore")}
        </h2>
        {switchable ? (
          <Tabs
            value={shownBy}
            onValueChange={(next) =>
              void setBreakdown({
                by: dashboardBreakdownParsers.by.parse(next),
                scope: null,
              })
            }
          >
            <TabsList aria-label={t("breakdown.switchLabel")}>
              <TabsOption value="app">
                <span>{t("breakdown.apps")}</span>
              </TabsOption>
              <TabsOption value="store">
                <span>{t("breakdown.stores")}</span>
              </TabsOption>
            </TabsList>
          </Tabs>
        ) : null}
      </div>
      <div aria-hidden className={cn(COLUMNS, LIST_HEAD, "pt-1")}>
        <span>
          {t(shownBy === "app" ? "breakdown.app" : "breakdown.store")}
        </span>
        <Heads metric={metric} unit={unit} />
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const selected = row.id === scope;
          return (
            <li key={row.id}>
              <button
                type="button"
                id={breakdownRowId(row.id)}
                {...leavingProps(leavesWithScope(sorted, row.id))}
                aria-label={rowLabel(row, metric, unit, t)}
                aria-pressed={selected}
                onClick={() => {
                  if (selected) focusScopeSurvivor(row.id);
                  void setBreakdown({ scope: selected ? null : row.id });
                }}
                className={cn(
                  COLUMNS,
                  LIST_ROW,
                  "group/row w-full text-left aria-pressed:rounded-l-none aria-pressed:bg-muted aria-pressed:shadow-[inset_2px_0_0_var(--foreground)]",
                )}
              >
                <span
                  aria-hidden
                  data-slot="breakdown-bar"
                  className="absolute inset-y-1 left-0 rounded-md bg-chart-tint group-aria-pressed/row:left-0.5"
                  style={{
                    width: `${Math.round((rowSize(row, metric) / largest) * BAR_REACH_PERCENT)}%`,
                  }}
                />
                <span className="relative flex min-w-0 items-center gap-2">
                  {row.iconUrl === undefined ? null : (
                    <AppIcon src={row.iconUrl} size={16} />
                  )}
                  <span
                    title={row.name}
                    className="min-w-0 truncate font-medium"
                  >
                    {row.name}
                  </span>
                  <span
                    title={row.mark}
                    className="shrink-0 text-label whitespace-nowrap text-muted-foreground"
                  >
                    {row.shortMark}
                  </span>
                </span>
                <Figures row={row} metric={metric} unit={unit} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-2 text-caption text-faint-foreground">
        <span>{orderText(metric, days, t)}</span>
        {sorted.length > rows.length ? (
          <Link
            id={BREAKDOWN_MORE_ID}
            href={`#${APPS_HEADING_ID}`}
            className={FOOTER_LINK}
          >
            {t("breakdown.more", {
              count: sorted.length - rows.length,
            })}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
