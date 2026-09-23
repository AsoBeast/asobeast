"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Check, Minus } from "lucide-react";
import {
  KEYWORD_BUCKETS,
  type KeywordCoverageRow,
  type MetadataField,
} from "@asobeast/shared";
import { BucketBadge } from "@/components/BucketBadge";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export const HIDDEN_COVERAGE_COLUMNS = { uncovered: false };

export const FIELD_ORDER: MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

const columnHelper = createColumnHelper<
  DataTableFeatures,
  KeywordCoverageRow
>();

function CoverageMark({
  covered,
  field,
}: {
  covered: boolean;
  field: MetadataField;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full",
        covered
          ? "bg-success-subtle text-success"
          : "bg-muted text-muted-foreground",
      )}
    >
      {covered ? (
        <Check className="size-3.5" />
      ) : (
        <Minus className="size-3.5" />
      )}
      <span className="sr-only">
        {covered ? "in" : "missing from"} {METADATA_FIELD_LABELS[field]}
      </span>
    </span>
  );
}

export function coverageColumns(fields: readonly MetadataField[]) {
  return columnHelper.columns([
    columnHelper.accessor("text", {
      id: "keyword",
      sortFn: "text",
      sortDescFirst: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Keyword" />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          {row.original.text}
          {row.original.uncovered ? (
            <Badge variant="warning">Uncovered</Badge>
          ) : null}
        </span>
      ),
    }),
    columnHelper.accessor(
      (row) =>
        row.bucket === null ? undefined : KEYWORD_BUCKETS.indexOf(row.bucket),
      {
        id: "bucket",
        sortFn: "basic",
        sortUndefined: "last",
        sortDescFirst: false,
        header: ({ column }) => (
          <SortableHeader column={column} label="Bucket" />
        ),
        cell: ({ row }) => <BucketBadge bucket={row.original.bucket} />,
      },
    ),
    ...fields.map((field) =>
      columnHelper.display({
        id: field,
        header: METADATA_FIELD_LABELS[field],
        cell: ({ row }) => (
          <CoverageMark
            covered={
              row.original.fields.find((entry) => entry.field === field)
                ?.covered ?? false
            }
            field={field}
          />
        ),
      }),
    ),
    columnHelper.accessor("uncovered", {
      enableSorting: false,
      filterFn: (row, id, uncovered: boolean) =>
        row.getValue<boolean>(id) === uncovered,
    }),
  ]);
}
