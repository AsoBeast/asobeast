"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Check, CircleDashed, Minus } from "lucide-react";
import {
  type CoverageFieldStatus,
  KEYWORD_BUCKETS,
  type KeywordCoverageRow,
  type MetadataField,
} from "@asobeast/shared";
import { BucketLabel } from "@/components/BucketBadge";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { localizationName } from "@/lib/localizations";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";
import { screenshotTextMark } from "./screenshot-text-marks";

export const HIDDEN_COVERAGE_COLUMNS = { uncovered: false };

const columnHelper = createColumnHelper<
  DataTableFeatures,
  KeywordCoverageRow
>();

const MARK = "inline-flex size-6 items-center justify-center";

function CoverageMark({ covered, label }: { covered: boolean; label: string }) {
  const name = `${covered ? "in" : "missing from"} ${label}`;
  return (
    <span
      title={name}
      className={cn(
        MARK,
        covered ? "text-foreground" : "text-faint-foreground",
      )}
    >
      {covered ? (
        <Check className="size-4" strokeWidth={2.25} aria-hidden />
      ) : (
        <Minus className="size-3.5" aria-hidden />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

function FieldMark({
  field,
  status,
}: {
  field: MetadataField;
  status: CoverageFieldStatus | undefined;
}) {
  const name = METADATA_FIELD_LABELS[field];
  const covered = status?.covered ?? false;
  const label =
    covered && status?.localization !== undefined
      ? `${name} (${localizationName(status.localization)})`
      : name;
  return <CoverageMark covered={covered} label={label} />;
}

function NotReadMark({ label }: { label: string }) {
  return (
    <span className={cn(MARK, "text-faint-foreground")}>
      <CircleDashed className="size-4" aria-hidden />
      <span className="sr-only">{`${label} not read`}</span>
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
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span translate="no" className="font-medium text-foreground">
            {row.original.text}
          </span>
          {row.original.uncovered ? (
            <span className="text-label text-warning">Uncovered</span>
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
        cell: ({ row }) => <BucketLabel bucket={row.original.bucket} />,
      },
    ),
    ...fields.map((field) =>
      columnHelper.display({
        id: field,
        header: METADATA_FIELD_LABELS[field],
        cell: ({ row }) => (
          <FieldMark
            field={field}
            status={row.original.fields.find((entry) => entry.field === field)}
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
