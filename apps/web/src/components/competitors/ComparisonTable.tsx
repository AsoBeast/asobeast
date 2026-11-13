"use client";

import { useMemo } from "react";
import {
  flexRender,
  useTable,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import type {
  CompetitorItem,
  KeywordComparison,
  KeywordComparisonRow,
} from "@asobeast/shared";
import { DataTableFooter } from "@/components/data-table/DataTableFooter";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@/components/data-table/table-features";
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
  matrixFilterParsers,
  matrixSortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { appDetailOptions } from "@/lib/queries";
import { numericProps } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import {
  comparisonColumns,
  HIDDEN_COMPARISON_COLUMNS,
} from "./comparison-columns";
import { exportComparison } from "./comparison-csv";
import { comparisonMarkets } from "./comparison-markets";
import { ComparisonFilterBar } from "./ComparisonFilterBar";
import { useOpenBreakdown } from "./breakdown-opener";
import { SECTION_BODY, SECTION_SHEET } from "./section-layout";

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
      you: "bg-muted",
    },
    cell: {
      market: `${MARKET_PIN} md:z-10`,
      keyword: `${keywordPin} z-10`,
      you: "bg-muted",
    },
  };
}

function MatrixSheet({
  table,
  pins,
  multiMarket,
  onClear,
}: {
  table: TableInstance<DataTableFeatures, KeywordComparisonRow>;
  pins: ReturnType<typeof pinClasses>;
  multiMarket: boolean;
  onClear: () => void;
}) {
  const rows = table.getRowModel().rows;
  return (
    <div className={SECTION_SHEET}>
      <Table aria-rowcount={rows.length + (rows.length > 0 ? 2 : 1)}>
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
                  className={pins.head[header.column.id]}
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
                <FilteredEmpty
                  title="No keywords match these filters"
                  onClear={onClear}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              aria-rowindex={index + 2}
              data-gap={row.original.gap || undefined}
              className="bg-card"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={pins.cell[cell.column.id]}
                  {...numericProps(cell.column)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {rows.length > 0 ? (
          <DataTableFooter
            table={table}
            rowIndex={rows.length + 2}
            cellClassName={(columnId) => pins.cell[columnId]}
          />
        ) : null}
      </Table>
    </div>
  );
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
  const openBreakdown = useOpenBreakdown();
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
      openBreakdown,
      { appId, multiMarket },
    );
  }, [appId, competitors, data.competitors, openBreakdown, multiMarket]);

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
    <div className={SECTION_BODY}>
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
      <MatrixSheet
        table={table}
        pins={pins}
        multiMarket={multiMarket}
        onClear={() => void setFilters(null)}
      />
    </div>
  );
}
