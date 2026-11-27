"use client";

import { createContext, use } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import type { DensityRow } from "@asobeast/shared";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMeasureFixed, formatNumber } from "@/lib/format";
import { isTrackedRow } from "./density-marks";

export interface DensityMarks {
  tracked: readonly string[];
  marked: string | null;
  onMark: (text: string) => void;
}

export const DensityMarksContext = createContext<DensityMarks>({
  tracked: [],
  marked: null,
  onMark: () => {},
});

const columnHelper = createColumnHelper<DataTableFeatures, DensityRow>();

export const formatShare = (share: number): string =>
  `${formatMeasureFixed(share * 100)}%`;

function RowText({ text }: { text: string }) {
  const { tracked } = use(DensityMarksContext);
  return (
    <span className="flex min-w-28 flex-wrap items-center gap-x-2 gap-y-1">
      <bdi className="whitespace-normal wrap-anywhere">{text}</bdi>
      {isTrackedRow(text, tracked) ? (
        <Badge variant="secondary">Tracked</Badge>
      ) : null}
    </span>
  );
}

function ShowInText({ text }: { text: string }) {
  const { marked, onMark } = use(DensityMarksContext);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={marked === text}
      onClick={() => onMark(text)}
    >
      <span>Show in text</span>
      <span className="sr-only">{` for ${text}`}</span>
    </Button>
  );
}

export function densityColumns(noun: string) {
  return columnHelper.columns([
    columnHelper.accessor("text", {
      id: "text",
      header: noun,
      cell: ({ row }) => <RowText text={row.original.text} />,
    }),
    columnHelper.accessor("count", {
      id: "count",
      header: "Count",
      meta: { numeric: true },
      cell: ({ row }) => <span>{formatNumber(row.original.count)}</span>,
    }),
    columnHelper.accessor("share", {
      id: "share",
      header: "Share",
      meta: { numeric: true },
      cell: ({ row }) => <span>{formatShare(row.original.share)}</span>,
    }),
    columnHelper.display({
      id: "show",
      header: () => <span className="sr-only">Show in text</span>,
      cell: ({ row }) => <ShowInText text={row.original.text} />,
    }),
  ]);
}
