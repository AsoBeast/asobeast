"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type {
  KeywordImportRowResult,
  KeywordImportStatus,
} from "@asobeast/shared";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import {
  IMPORT_STATUS_LABELS,
  IMPORT_STATUS_VARIANT,
  rowNote,
} from "@/lib/keyword-import";
import { oneOf } from "@/lib/table/facets";

export interface PreviewRow extends KeywordImportRowResult {
  line: number;
}

const columnHelper = createColumnHelper<DataTableFeatures, PreviewRow>();

export function importColumns(lines: readonly number[]) {
  return columnHelper.columns([
    columnHelper.accessor("line", {
      id: "line",
      header: "Line",
      cell: ({ row }) => (
        <span className="numeric font-mono text-muted-foreground">
          {row.original.line}
        </span>
      ),
    }),
    columnHelper.accessor("keyword", {
      id: "keyword",
      header: "Keyword",
      cell: ({ row }) => (
        <span className="whitespace-normal [overflow-wrap:anywhere]">
          {row.original.keyword}
        </span>
      ),
    }),
    columnHelper.accessor("country", {
      id: "country",
      header: "Market",
      cell: ({ row }) => row.original.country.toUpperCase(),
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: "Status",
      filterFn: (row, id, selected: KeywordImportStatus[]) =>
        oneOf(row.getValue<KeywordImportStatus>(id), selected),
      cell: ({ row }) => (
        <Badge variant={IMPORT_STATUS_VARIANT[row.original.status]}>
          {IMPORT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <span className="whitespace-normal text-muted-foreground">
          {rowNote(row.original, lines)}
        </span>
      ),
    }),
  ]);
}
