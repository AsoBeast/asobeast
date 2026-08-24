"use client";

import { useRef } from "react";
import { flexRender, type Table as TableInstance } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STICKY_COLUMNS: Record<string, string | undefined> = {
  select: "sticky left-0 z-10 w-10 min-w-10 bg-inherit",
  text: "sticky left-10 z-10 bg-inherit",
};

const ROW_HEIGHT = 41;
const OVERSCAN = 12;
const VIRTUALIZE_ABOVE = 50;

export function KeywordsDataTable({
  table,
}: {
  table: TableInstance<TrackedKeywordItem>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualize = rows.length > VIRTUALIZE_ABOVE;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    enabled: virtualize,
  });

  const items = virtualizer.getVirtualItems();
  const before = virtualize && items.length > 0 ? items[0].start : 0;
  const after =
    virtualize && items.length > 0
      ? virtualizer.getTotalSize() - items[items.length - 1].end
      : 0;
  const visible = virtualize
    ? items.map((item) => ({ index: item.index, row: rows[item.index] }))
    : rows.map((row, index) => ({ index, row }));
  const columnCount = table.getVisibleFlatColumns().length;

  return (
    <Table
      containerRef={scrollRef}
      containerClassName="max-h-[70svh] overflow-y-auto overscroll-contain rounded-xl border bg-card"
      aria-rowcount={rows.length + 1}
    >
      <TableCaption className="sr-only">
        Tracked keywords with source, position and its daily change, traffic,
        difficulty, opportunity, 7 day change and top 10 volatility.
      </TableCaption>
      <TableHeader className="sticky top-0 z-20">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(
                  header.column.id === "actions" && "w-0",
                  STICKY_COLUMNS[header.column.id],
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {before > 0 ? (
          <tr aria-hidden>
            <td colSpan={columnCount} style={{ height: before }} />
          </tr>
        ) : null}
        {visible.map(({ index, row }) => (
          <TableRow
            key={row.id}
            ref={virtualize ? virtualizer.measureElement : undefined}
            data-index={index}
            aria-rowindex={index + 2}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn("group/row", !row.original.active && "opacity-55")}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(STICKY_COLUMNS[cell.column.id])}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {after > 0 ? (
          <tr aria-hidden>
            <td colSpan={columnCount} style={{ height: after }} />
          </tr>
        ) : null}
      </TableBody>
    </Table>
  );
}
