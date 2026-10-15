"use client";

import { useMemo } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type { AppListItem, ChartPage } from "@asobeast/shared";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
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
import { formatDate } from "@/lib/format";
import { chartTableParsers } from "@/lib/search-params";
import { ariaSort } from "@/lib/table/sorting";
import { chartColumns } from "./chart-columns";
import { chartTitle } from "./chart-params";
import { compareLabel } from "./movement";

export function ChartTable({
  page,
  apps,
}: {
  page: ChartPage;
  apps: readonly AppListItem[];
}) {
  const [params, setParams] = useQueryStates(chartTableParsers);
  const period = compareLabel(page.compare, page.comparison);
  const context = useMemo(
    () => ({
      chart: page.chart,
      links: new Map(page.apps.map((link) => [link.storeAppId, link])),
      apps,
    }),
    [page.chart, page.apps, apps],
  );
  const columns = useMemo(
    () => chartColumns(period, context),
    [period, context],
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search apps"
          value={params.q}
          onSearch={(q, options) => void setParams({ q }, options)}
        />
        <RowCount shown={rows.length} total={page.entries.length} noun="app" />
        <div className="ml-auto">
          <ColumnMenu columns={table.getAllLeafColumns()} />
        </div>
      </div>
      <Table containerClassName="rounded-xl border">
        <TableCaption className="sr-only">
          {chartTitle(page.chart)} on {formatDate(page.capture?.date ?? null)}
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column.getIsSorted())}
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
                  title="No apps match this search"
                  onClear={() => void setParams({ q: null })}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
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
