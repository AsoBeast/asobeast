"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Check, CircleDashed, Minus } from "lucide-react";
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
import { screenshotTextMark } from "./screenshot-text-marks";

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

function CoverageMark({ covered, label }: { covered: boolean; label: string }) {
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
        {covered ? "in" : "missing from"} {label}
      </span>
    </span>
  );
}

function NotReadMark({ label }: { label: string }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground">
      <CircleDashed className="size-4" />
      <span className="sr-only">{label} not read</span>
    </span>
  );
}

function ScreenshotTextCell({ row }: { row: KeywordCoverageRow }) {
  const mark = screenshotTextMark(row);
  return mark === "unread" ? (
    <NotReadMark label="screenshot text" />
  ) : (
    <CoverageMark covered={mark === "covered"} label="screenshot text" />
  );
}

export function coverageColumns(
  fields: readonly MetadataField[],
  withScreenshotText: boolean,
) {
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
            <Badge variant="outline" className="border-warning/40 text-warning">
              Uncovered
            </Badge>
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
            label={METADATA_FIELD_LABELS[field]}
          />
        ),
      }),
    ),
    ...(withScreenshotText
      ? [
          columnHelper.display({
            id: "screenshotText",
            header: "Screenshot text",
            cell: ({ row }) => <ScreenshotTextCell row={row.original} />,
          }),
        ]
      : []),
    columnHelper.accessor("uncovered", {
      enableSorting: false,
      filterFn: (row, id, uncovered: boolean) =>
        row.getValue<boolean>(id) === uncovered,
    }),
  ]);
}
