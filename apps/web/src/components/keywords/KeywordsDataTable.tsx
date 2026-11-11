"use client";

import { useRef } from "react";
import { flexRender, type Table as TableInstance } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { DataTableFooter } from "@/components/data-table/DataTableFooter";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { keywordTableCaption } from "./keyword-caption";
import type { KeywordTableFeatures } from "./keyword-table-features";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isNumericColumn } from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";

const STICKY_COLUMNS: Record<string, string | undefined> = {
  select: "sticky left-0 z-10 w-10 min-w-10 bg-inherit",
  keyword: "sticky left-10 z-10 bg-inherit",
};

const ROW_HEIGHT = 37;
const OVERSCAN = 12;
const VIRTUALIZE_ABOVE = 50;

export function KeywordsDataTable({
  table,
  chartedSet,
  emptyBody,
  onClearFilters,
}: {
  table: TableInstance<KeywordTableFeatures, TrackedKeywordItem>;
  chartedSet: ReadonlySet<string>;
  emptyBody?: string;
  onClearFilters: () => void;
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
  const playInstalls = table
    .getAllLeafColumns()
    .some((column) => column.id === "acquisitions");
  const shown = (id: string) => table.getColumn(id)?.getIsVisible() === true;

  return (
    <Table
      containerRef={scrollRef}
      density="compact"
      containerClassName="max-h-[70svh] overflow-y-auto rounded-lg border bg-card"
      aria-rowcount={rows.length + (rows.length > 0 ? 2 : 1)}
    >
      <TableCaption className="sr-only">
        {keywordTableCaption({
          added: shown("added"),
          playInstalls,
          competitors: shown("competitors"),
          insights: shown("insights"),
          totals: rows.length > 0,
        })}
      </TableCaption>
      <TableHeader className="sticky top-0 z-20">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                aria-sort={ariaSort(header.column.getIsSorted())}
                numeric={isNumericColumn(header.column.columnDef.meta)}
                className={cn(
                  "max-md:whitespace-normal",
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
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnCount}>
              <FilteredEmpty
                title="No keywords match these filters"
                body={emptyBody}
                onClear={onClearFilters}
              />
            </TableCell>
          </TableRow>
        ) : null}
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
            data-charted={chartedSet.has(row.id) || undefined}
            className={cn(
              "group/row",
              "data-[charted]:bg-accent",
              !row.original.active && "text-muted-foreground",
            )}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                numeric={isNumericColumn(cell.column.columnDef.meta)}
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
      {rows.length > 0 ? (
        <DataTableFooter
          table={table}
          rowIndex={rows.length + 2}
          cellClassName={(id) => STICKY_COLUMNS[id]}
        />
      ) : null}
    </Table>
  );
}
