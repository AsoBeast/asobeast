"use client";

import { useEffect, useRef, useState } from "react";
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { KeywordDiscoveryItem } from "@asobeast/shared";
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
import { focusIsLost } from "@/lib/focus-handoff";
import { formatNumber } from "@/lib/format";
import type { KeywordTableFeatures } from "../keyword-table-features";
import { DISCOVERY_PAGE_SIZE } from "./discovery-rows";

export type DiscoveryTable = TanstackTable<
  KeywordTableFeatures,
  KeywordDiscoveryItem
>;

export function DiscoveryRows({ table }: { table: DiscoveryTable }) {
  const [pages, setPages] = useState(1);
  const rows = table.getRowModel().rows;
  const shown = rows.slice(0, pages * DISCOVERY_PAGE_SIZE);
  const next = Math.min(DISCOVERY_PAGE_SIZE, rows.length - shown.length);
  const body = useRef<HTMLTableSectionElement>(null);
  const revealedFrom = useRef<number | null>(null);

  useEffect(() => {
    const first = revealedFrom.current;
    if (first === null) return;
    revealedFrom.current = null;
    if (!focusIsLost()) return;
    body.current?.rows[first]
      ?.querySelector<HTMLElement>("[data-discovery-select]")
      ?.focus();
  });

  return (
    <div className="flex flex-col gap-3">
      <Table
        containerClassName="rounded-xl border bg-card"
        scrollLabel="Keyword discoveries"
        scrollFocus="overflow"
      >
        <TableCaption className="sr-only">
          Keyword discoveries: keywords near your listing that you do not track
          yet, with where your app ranks for each.
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
        <TableBody ref={body}>
          {shown.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
            >
              {row.getVisibleCells().map((cell) =>
                cell.column.id === "keyword" ? (
                  <th
                    key={cell.id}
                    scope="row"
                    className="px-2 py-1.5 text-left font-normal"
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
      {rows.length > DISCOVERY_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground" aria-live="polite">
            {`Showing ${formatNumber(shown.length)} of ${formatNumber(rows.length)}`}
          </p>
          {next > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                revealedFrom.current = shown.length;
                setPages((count) => count + 1);
              }}
            >
              {`Show ${next} more`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
