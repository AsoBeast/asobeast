"use client";

import { useMemo } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import type { CompetitorItem, KeywordComparison } from "@asobeast/shared";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  breakdownParser,
  matrixFilterParsers,
  matrixSortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { appDetailOptions } from "@/lib/queries";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import {
  comparisonColumns,
  HIDDEN_COMPARISON_COLUMNS,
} from "./comparison-columns";
import { exportComparison } from "./comparison-csv";
import { comparisonMarkets } from "./comparison-markets";
import { ComparisonFilterBar } from "./ComparisonFilterBar";

const MARKET_PIN = "w-24 min-w-24 max-w-24 bg-inherit md:sticky md:left-0";

function pinClasses(
  marketShown: boolean,
): Record<"head" | "cell", Record<string, string>> {
  const keywordPin = marketShown
    ? "sticky left-0 bg-inherit md:left-24"
    : "sticky left-0 bg-inherit";
  return {
    head: {
      market: `${MARKET_PIN} md:z-20`,
      keyword: `${keywordPin} z-20`,
      you: "border-x bg-secondary text-center",
    },
    cell: {
      market: `${MARKET_PIN} md:z-10`,
      keyword: `${keywordPin} z-10`,
      you: "border-x bg-secondary/40 text-center",
    },
  };
}

export function ComparisonTable({
  data,
  competitors,
  appId,
  onlyGaps,
}: {
  data: KeywordComparison;
  competitors: readonly CompetitorItem[];
  appId: string;
  onlyGaps: boolean;
}) {
  const [sortParams, setSortParams] = useQueryStates({
    sort: matrixSortParser,
    dir: sortDirectionParser,
  });
  const [filters, setFilters] = useQueryStates(matrixFilterParsers);
  const [, setKeyword] = useQueryState("keyword", breakdownParser);
  const { data: app } = useSuspenseQuery(appDetailOptions(appId));
  const markets = useMemo(
    () => comparisonMarkets(data.rows, app.country, filters.country),
    [data.rows, app.country, filters.country],
  );
  const multiMarket = markets.length > 1;

  const columns = useMemo(() => {
    const icons = new Map(competitors.map((item) => [item.id, item.iconUrl]));
    return comparisonColumns(
      data.competitors.map((competitor) => ({
        ...competitor,
        iconUrl: icons.get(competitor.id) ?? null,
      })),
      (keywordId) => void setKeyword(keywordId),
      { appId, multiMarket },
    );
  }, [appId, competitors, data.competitors, setKeyword, multiMarket]);

  const [visibility, setVisibility] = useStoredColumnVisibility(
    "comparison",
    columns,
  );

  const knownSort = columns.some((column) => column.id === sortParams.sort);
  const { sorting, onSortingChange } = useUrlSorting(
    { sort: knownSort ? sortParams.sort : null, dir: sortParams.dir },
    columns,
    (next) => void setSortParams(next),
  );

  const table = useTable({
    features: dataTableFeatures,
    data: data.rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: {
      sorting,
      globalFilter: filters.q,
      columnFilters: [
        ...(filters.vs === "all" ? [] : [{ id: "versus", value: filters.vs }]),
        ...(filters.country ? [{ id: "market", value: filters.country }] : []),
      ],
      columnVisibility: {
        ...visibility,
        ...HIDDEN_COMPARISON_COLUMNS,
        market: multiMarket && (visibility.market ?? true),
      },
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  const rows = table.getRowModel().rows;
  const pins = pinClasses(table.getColumn("market")?.getIsVisible() ?? false);

  return (
    <div className="flex flex-col gap-3">
      <ComparisonFilterBar
        filters={filters}
        setFilters={setFilters}
        markets={markets}
        shown={rows.length}
        total={data.rows.length}
        columns={table
          .getAllLeafColumns()
          .filter((column) => multiMarket || column.id !== "market")}
        onExport={() =>
          exportComparison(
            appId,
            onlyGaps,
            data.competitors,
            rows.map((row) => row.original),
          )
        }
      />
      <Table containerClassName="rounded-xl border">
        <TableCaption className="sr-only">
          Your keyword positions compared with each tracked competitor. Gap rows
          are keywords a competitor ranks for and you do not.
          {multiMarket
            ? " The market column names the storefront of each row."
            : null}
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-card">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column.getIsSorted())}
                  className={pins.head[header.column.id] ?? "text-center"}
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
                <FilteredEmpty
                  title="No keywords match these filters"
                  onClear={() => void setFilters(null)}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(row.original.gap ? "bg-warning-subtle" : "bg-card")}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={pins.cell[cell.column.id] ?? "text-center"}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
