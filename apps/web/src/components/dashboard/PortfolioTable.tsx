"use client";

import { flexRender, useTable } from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
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
import { appListParsers, appSortParser } from "@/lib/search-params";
import { isNumericColumn } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { portfolioColumns, type PortfolioTableRow } from "./portfolio-columns";

export function PortfolioTable({ rows }: { rows: PortfolioTableRow[] }) {
  const [{ sort, dir }, setList] = useQueryStates(appListParsers);
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "portfolio",
    portfolioColumns,
  );
  const { sorting, onSortingChange } = useUrlSorting(
    { sort, dir },
    portfolioColumns,
    (next) =>
      void setList({
        sort: next.sort === null ? null : appSortParser.parse(next.sort),
        dir: next.dir,
      }),
  );

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns: portfolioColumns,
    getRowId: (row) => row.app.id,
    state: { sorting, columnVisibility: visibility },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex justify-end">
        <ColumnMenu columns={table.getAllLeafColumns()} />
      </div>
      <Table containerClassName="rounded-lg border bg-card">
        <TableCaption className="sr-only">Apps in this workspace</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  numeric={isNumericColumn(header.column.columnDef.meta)}
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  numeric={isNumericColumn(cell.column.columnDef.meta)}
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
