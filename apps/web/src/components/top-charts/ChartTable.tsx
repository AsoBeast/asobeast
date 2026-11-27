"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  flexRender,
  useTable,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type {
  AppListItem,
  ChartCaptureSummary,
  ChartEntryItem,
  ChartPage,
} from "@asobeast/shared";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@/components/data-table/table-features";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import {
  PANEL_ACTION,
  PANEL_BLEED,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  formatDateInLocale,
  formatDateTimeInLocale,
  formatDayMonthInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { chartTableParsers, type ChartTableView } from "@/lib/search-params";
import { numericProps } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import { rowContextOf } from "./chart-actions";
import { chartColumns } from "./chart-columns";
import { ChartHistory } from "./ChartHistory";
import { chartTitle, collectionLabel } from "./chart-params";
import { HISTORY_APPS, historyDates, historyReady } from "./chart-summary";
import { compareLabel } from "./movement";
import { OWN_ROW_BAR } from "./RowActions";

const TABLE_VIEWS: ReadonlyArray<{
  id: ChartTableView;
  key: "table" | "history";
}> = [
  { id: "rows", key: "table" },
  { id: "history", key: "history" },
];

function footerLine(
  page: ChartPage & { capture: ChartCaptureSummary },
  t: MessageTranslator,
  locale: Locale,
) {
  const total = page.entries.length;
  return [
    t("appCount", { count: total }),
    t("captured", {
      date: formatDateTimeInLocale(page.capture.capturedAt, locale),
    }),
    ...(page.comparison
      ? [
          t("comparedWith", {
            date: formatDayMonthInLocale(page.comparison.date, locale),
          }),
        ]
      : []),
  ].join(" · ");
}

function historyLine(
  page: ChartPage & { capture: ChartCaptureSummary },
  t: MessageTranslator,
  locale: Locale,
) {
  const days = historyDates(page.dates, page.capture.date).length;
  return t("historyFooter", {
    shown: Math.min(HISTORY_APPS, page.entries.length),
    date: formatDayMonthInLocale(page.capture.date, locale),
    days,
    limit: HISTORY_APPS,
  });
}

type ChartRowsTable = TableInstance<DataTableFeatures, ChartEntryItem>;

function ChartRows({
  table,
  caption,
  isOwn,
  onClear,
}: {
  table: ChartRowsTable;
  caption: string;
  isOwn: (storeAppId: string) => boolean;
  onClear: () => void;
}) {
  const t = useTranslations("topCharts");
  const rows = table.getRowModel().rows;
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                aria-sort={ariaSort(header.column.getIsSorted())}
                {...numericProps(header.column)}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={table.getVisibleLeafColumns().length}>
              <FilteredEmpty title={t("noMatches")} onClear={onClear} />
            </TableCell>
          </TableRow>
        ) : null}
        {rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell, index) => (
              <TableCell
                key={cell.id}
                className={
                  index === 0 && isOwn(row.id) ? OWN_ROW_BAR : undefined
                }
                {...numericProps(cell.column)}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ChartTable({
  page,
  apps,
}: {
  page: ChartPage & { capture: ChartCaptureSummary };
  apps: readonly AppListItem[];
}) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  const [params, setParams] = useQueryStates(chartTableParsers);
  const period = compareLabel(page.compare, page.comparison, t, locale);
  const context = useMemo(
    () => rowContextOf({ chart: page.chart, apps: page.apps }, apps),
    [page.chart, page.apps, apps],
  );
  const withGenre = page.entries.some((entry) => entry.genreName !== null);
  const withPrice = page.chart.collection !== "free";
  const columns = useMemo(
    () => chartColumns(period, context, { withGenre, withPrice }, t, locale),
    [period, context, withGenre, withPrice, t, locale],
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "top-chart",
    columns,
  );
  const { sorting, onSortingChange } = useUrlSorting(
    params,
    columns,
    (next) =>
      void setParams({
        sort:
          next.sort === null ? null : chartTableParsers.sort.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: dataTableFeatures,
    data: page.entries,
    columns,
    getRowId: (row) => row.storeAppId,
    state: {
      sorting,
      globalFilter: params.q,
      columnVisibility: visibility,
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "app",
  });
  const rows = table.getRowModel().rows;

  const own = (storeAppId: string) =>
    context.links.get(storeAppId)?.role === "own";
  const history = params.tableView === "history";

  return (
    <Card className="gap-3">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{collectionLabel(page.chart.collection, t)}</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <Tabs
            value={params.tableView}
            onValueChange={(next) => {
              const chosen = TABLE_VIEWS.find(({ id }) => id === next);
              if (chosen) {
                void setParams({ tableView: chosen.id }, { history: "push" });
              }
            }}
          >
            <TabsList aria-label={t("display")}>
              {TABLE_VIEWS.map(({ id, key }) => (
                <TabsOption key={id} value={id}>
                  {t(key)}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      {history ? (
        <CardContent>
          <ChartHistory page={page} />
        </CardContent>
      ) : (
        <>
          <CardContent className="flex flex-wrap items-center gap-2">
            <SearchInput
              label={t("search")}
              value={params.q}
              onSearch={(q, options) => void setParams({ q }, options)}
            />
            <RowCount
              shown={rows.length}
              total={page.entries.length}
              noun="app"
            />
            <div className="ml-auto">
              <ColumnMenu columns={table.getAllLeafColumns()} />
            </div>
          </CardContent>
          <CardContent className={cn(PANEL_BLEED, "mt-0 border-t")}>
            <ChartRows
              table={table}
              caption={t("caption", {
                chart: chartTitle(page.chart, t, locale),
                date: formatDateInLocale(page.capture.date, locale),
              })}
              isOwn={own}
              onClear={() => void setParams({ q: null })}
            />
          </CardContent>
        </>
      )}
      {history && !historyReady(page.dates, page.capture.date) ? null : (
        <CardFooter>
          <span>
            {history
              ? historyLine(page, t, locale)
              : footerLine(page, t, locale)}
          </span>
        </CardFooter>
      )}
    </Card>
  );
}
