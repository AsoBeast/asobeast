"use client";

import { useMemo } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import type { DensityRow } from "@asobeast/shared";
import { dataTableFeatures } from "@/components/data-table/table-features";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { numericProps } from "@/lib/table/column-visibility";
import {
  DensityMarksContext,
  densityColumns,
  type DensityMarks,
} from "./density-columns";

export function DensityTable({
  rows,
  caption,
  empty,
  noun,
  marks,
}: {
  rows: DensityRow[];
  caption: string;
  empty: string;
  noun: string;
  marks: DensityMarks;
}) {
  const columns = useMemo(() => densityColumns(noun), [noun]);
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.text,
  });

  return (
    <DensityMarksContext value={marks}>
      <Table containerClassName="min-h-0 flex-1 scroll-pt-9 overflow-y-auto rounded-lg border border-border bg-card">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader className="sticky top-0 z-10 bg-card [&_th]:shadow-[inset_0_-1px_0_var(--color-border)] [&_tr]:border-b-0">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} {...numericProps(header.column)}>
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
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground"
              >
                <span>{empty}</span>
              </TableCell>
            </TableRow>
          ) : null}
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  dir={cell.column.id === "text" ? "auto" : undefined}
                  {...numericProps(cell.column)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DensityMarksContext>
  );
}
