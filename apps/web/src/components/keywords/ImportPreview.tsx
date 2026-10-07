"use client";

import { useMemo, useState } from "react";
import { flexRender, useTable } from "@tanstack/react-table";
import {
  KEYWORD_IMPORT_STATUSES,
  type KeywordImportResult,
  type KeywordImportStatus,
} from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { RowCount } from "@/components/data-table/RowCount";
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
import { IMPORT_STATUS_LABELS, summarySentence } from "@/lib/keyword-import";
import { cn } from "@/lib/utils";
import { importColumns, type PreviewRow } from "./import-columns";

const STATUS_OPTIONS = KEYWORD_IMPORT_STATUSES.map((value) => ({
  value,
  label: IMPORT_STATUS_LABELS[value],
}));

export function ImportPreview({
  result,
  lines,
  busy,
}: {
  result: KeywordImportResult;
  lines: readonly number[];
  busy: boolean;
}) {
  const [statuses, setStatuses] = useState<KeywordImportStatus[]>([]);
  const data = useMemo<PreviewRow[]>(
    () => result.results.map((row) => ({ ...row, line: lines[row.index] })),
    [result, lines],
  );
  const columns = useMemo(() => importColumns(lines), [lines]);
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId: (row) => String(row.index),
    state: {
      columnFilters:
        statuses.length > 0 ? [{ id: "status", value: statuses }] : [],
    },
  });
  const counts = useMemo(
    () =>
      new Map(
        KEYWORD_IMPORT_STATUSES.map((status) => [
          status,
          result.summary[status],
        ]),
      ),
    [result],
  );
  const rows = table.getRowModel().rows;

  return (
    <section
      aria-label="Review"
      aria-busy={busy}
      className={cn("flex flex-col gap-3", busy && "opacity-60")}
    >
      <p role="status" className="text-sm font-medium">
        {summarySentence(result.summary)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <FacetFilter
          title="Status"
          options={STATUS_OPTIONS}
          selected={statuses}
          counts={counts}
          onChange={setStatuses}
        />
        <RowCount shown={rows.length} total={data.length} noun="row" />
      </div>
      <Table
        scrollLabel="Rows of the file"
        containerClassName="max-h-72 overflow-y-auto rounded-xl border bg-card"
      >
        <TableCaption className="sr-only">
          Every row of the file, with what an import would do with it.
        </TableCaption>
        <TableHeader className="sticky top-0 bg-card">
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
              <TableCell colSpan={columns.length}>
                <FilteredEmpty
                  title="No rows match this status"
                  onClear={() => setStatuses([])}
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
    </section>
  );
}
