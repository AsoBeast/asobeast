"use client";

import { useMemo } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type { CompetitorItem, KeywordComparison } from "@asobeast/shared";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
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
import { phoneColumnVisibility } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { useIsMobile } from "@/lib/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  COMPARISON_SORT_DEFAULTS,
  comparisonColumns,
  HIDDEN_COMPARISON_COLUMNS,
} from "./comparison-columns";
import { comparisonTableFeatures } from "./comparison-table-features";
import { ComparisonFilterBar } from "./ComparisonFilterBar";

const NO_HIDDEN_COLUMNS = {};

const HEAD_CLASS: Record<string, string> = {
  keyword: "sticky left-0 z-20 bg-inherit",
  you: "border-x bg-secondary text-center",
};

const CELL_CLASS: Record<string, string> = {
  keyword: "sticky left-0 z-10 bg-inherit",
  you: "border-x bg-secondary/40 text-center",
};

export function ComparisonTable({
  data,
  competitors,
}: {
  data: KeywordComparison;
  competitors: readonly CompetitorItem[];
}) {
  const [sortParams, setSortParams] = useQueryStates({
    sort: matrixSortParser,
    dir: sortDirectionParser,
  });
  const [filters, setFilters] = useQueryStates(matrixFilterParsers);

  const columns = useMemo(() => {
    const icons = new Map(competitors.map((item) => [item.id, item.iconUrl]));
    return comparisonColumns(
      data.competitors.map((competitor) => ({
        ...competitor,
        iconUrl: icons.get(competitor.id) ?? null,
      })),
    );
  }, [competitors, data.competitors]);

  const isMobile = useIsMobile();
  const defaultVisibility = useMemo(
    () => (isMobile ? phoneColumnVisibility(columns) : NO_HIDDEN_COLUMNS),
    [isMobile, columns],
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "comparison",
    defaultVisibility,
  );

  const knownSort = columns.some((column) => column.id === sortParams.sort);
  const { sorting, onSortingChange } = useUrlSorting(
    { sort: knownSort ? sortParams.sort : null, dir: sortParams.dir },
    COMPARISON_SORT_DEFAULTS,
    (next) => void setSortParams(next),
  );

  const table = useTable({
    features: comparisonTableFeatures,
    data: data.rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: {
      sorting,
      globalFilter: filters.q,
      columnFilters:
        filters.vs === "all" ? [] : [{ id: "versus", value: filters.vs }],
      columnVisibility: { ...visibility, ...HIDDEN_COMPARISON_COLUMNS },
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <ComparisonFilterBar
        filters={filters}
        setFilters={setFilters}
        shown={rows.length}
        total={data.rows.length}
        columns={table.getAllLeafColumns()}
      />
      <Table containerClassName="rounded-xl border">
        <TableCaption className="sr-only">
          Your keyword positions compared with each tracked competitor. Gap rows
          are keywords a competitor ranks for and you do not.
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-card">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column.getIsSorted())}
                  className={HEAD_CLASS[header.column.id] ?? "text-center"}
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
                  className={CELL_CLASS[cell.column.id] ?? "text-center"}
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
