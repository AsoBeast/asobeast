"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { KeywordDiscoveryItem } from "@asobeast/shared";
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
import { focusIsLost } from "@/lib/focus-handoff";
import { formatNumber } from "@/lib/format";
import {
  isNumericColumn,
  isWideOnlyColumn,
} from "@/lib/table/column-visibility";
import { ariaSort } from "@/lib/table/sorting";
import type { KeywordTableFeatures } from "../keyword-table-features";
import { DISCOVERY_PAGE_SIZE } from "./discovery-rows";

export type DiscoveryTable = TanstackTable<
  KeywordTableFeatures,
  KeywordDiscoveryItem
>;

const narrowHidden = (meta: unknown): string | undefined =>
  isWideOnlyColumn(meta) ? "max-sm:hidden" : undefined;

export function DiscoveryRows({
  table,
  footer,
  onClearSearch,
}: {
  table: DiscoveryTable;
  footer: ReactNode;
  onClearSearch: () => void;
}) {
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
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table
          className="[&_td]:md:px-3 [&_th]:md:px-3"
          scrollLabel="Keyword discoveries"
          scrollFocus="overflow"
        >
          <TableCaption className="sr-only">
            Keyword discoveries: keywords near your listing that you do not
            track yet, with where your app ranks for each.
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(header.column.getIsSorted())}
                    numeric={isNumericColumn(header.column.columnDef.meta)}
                    className={narrowHidden(header.column.columnDef.meta)}
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
          <TableBody ref={body}>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                  <FilteredEmpty
                    title="No discovered keywords match this search"
                    body="Change or clear the search to see the rows again."
                    onClear={onClearSearch}
                  />
                </TableCell>
              </TableRow>
            ) : null}
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
                      className="h-11 px-2 py-1.5 text-left font-normal md:px-3"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </th>
                  ) : (
                    <TableCell
                      key={cell.id}
                      numeric={isNumericColumn(cell.column.columnDef.meta)}
                      className={narrowHidden(cell.column.columnDef.meta)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-3 py-2">{footer}</div>
      </div>
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
