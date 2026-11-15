"use client";

import {
  flexRender,
  type RowData,
  type Table as TableInstance,
} from "@tanstack/react-table";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ariaSort } from "@/lib/table/sorting";

export function AdminTable<TData extends RowData>({
  table,
  caption,
  scrollLabel,
}: {
  table: TableInstance<DataTableFeatures, TData>;
  caption: string;
  scrollLabel?: string;
}) {
  return (
    <Table
      scrollLabel={scrollLabel}
      scrollFocus={scrollLabel ? "overflow" : undefined}
    >
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                numeric={header.column.columnDef.meta?.numeric}
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
                numeric={cell.column.columnDef.meta?.numeric}
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
