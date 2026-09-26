"use client";

import { useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { COMBINATION_PAGE_SIZE } from "@/lib/keyword-combinations";
import type { CombinationTable } from "./CombinationFilters";

export function CombinationRows({
  table,
  onClearFilters,
}: {
  table: CombinationTable;
  onClearFilters: () => void;
}) {
  const [pages, setPages] = useState(1);
  const rows = table.getRowModel().rows;
  const shown = rows.slice(0, pages * COMBINATION_PAGE_SIZE);
  const next = Math.min(COMBINATION_PAGE_SIZE, rows.length - shown.length);

  return (
    <div className="flex flex-col gap-3">
      <Table containerClassName="rounded-xl border bg-card">
        <TableCaption className="sr-only">
          Keyword combinations built from the words of your listing, where those
          words appear, and whether each phrase is tracked.
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                  title="No combinations match these filters"
                  onClear={onClearFilters}
                />
              </TableCell>
            </TableRow>
          ) : null}
          {shown.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) =>
                cell.column.id === "phrase" ? (
                  <th
                    key={cell.id}
                    scope="row"
                    className="px-2 py-1.5 text-left font-medium"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </th>
                ) : (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ),
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > COMBINATION_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground" aria-live="polite">
            Showing {formatNumber(shown.length)} of {formatNumber(rows.length)}
          </p>
          {next > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPages((count) => count + 1)}
            >
              Show {next} more
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
