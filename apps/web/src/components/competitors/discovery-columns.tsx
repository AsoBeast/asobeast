"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { CompetitorDiscoveryItem } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { GradedNumber } from "@/components/ui/graded";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber, formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import { nullsLast } from "@/lib/table/sorting";
import { TrackButton } from "./TrackButton";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  CompetitorDiscoveryItem
>();

const NUMBER_SORT = { sortFn: "basic", sortUndefined: "last" } as const;

export function discoveryColumns(appId: string) {
  return columnHelper.columns([
    columnHelper.accessor("title", {
      id: "app",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => <SortableHeader column={column} label="App" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          {row.original.developer ? (
            <span className="text-xs text-muted-foreground">
              {row.original.developer}
            </span>
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor("appearances", {
      id: "appearances",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Appearances", phone: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="Appearances" />
      ),
      cell: ({ row }) => (
        <span className="numeric font-mono">{row.original.appearances}</span>
      ),
    }),
    columnHelper.accessor("keywordCount", {
      id: "keywords",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Keywords" },
      header: ({ column }) => (
        <SortableHeader column={column} label="Keywords" />
      ),
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="numeric font-mono underline decoration-dotted underline-offset-4">
              {row.original.keywordCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>{row.original.keywords.join(", ")}</TooltipContent>
        </Tooltip>
      ),
    }),
    columnHelper.accessor("bestPosition", {
      id: "best",
      ...NUMBER_SORT,
      sortDescFirst: false,
      meta: { label: "Best", phone: true },
      header: ({ column }) => <SortableHeader column={column} label="Best" />,
      cell: ({ row }) => (
        <GradedNumber
          value={String(row.original.bestPosition)}
          grade={grade("position", row.original.bestPosition)}
          label="Best position"
        />
      ),
    }),
    columnHelper.accessor("avgPosition", {
      id: "avg",
      ...NUMBER_SORT,
      sortDescFirst: false,
      meta: { label: "Avg" },
      header: ({ column }) => <SortableHeader column={column} label="Avg" />,
      cell: ({ row }) => (
        <GradedNumber
          value={String(row.original.avgPosition)}
          grade={grade("position", row.original.avgPosition)}
          label="Average position"
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(row.ratingAvg), {
      id: "rating",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Rating", phone: true },
      header: ({ column }) => <SortableHeader column={column} label="Rating" />,
      cell: ({ row }) => <RatingCell item={row.original} />,
    }),
    columnHelper.display({
      id: "track",
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <TrackButton
            id={appId}
            storeAppId={row.original.storeAppId}
            title={row.original.title}
          />
        </div>
      ),
    }),
  ]);
}

function RatingCell({ item }: { item: CompetitorDiscoveryItem }) {
  if (item.ratingAvg === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <GradedNumber
        value={formatRating(item.ratingAvg)}
        grade={grade("rating", item.ratingAvg)}
        label="Rating"
      />
      {item.ratingCount !== null ? (
        <span className="numeric font-mono text-muted-foreground">
          {` · ${formatNumber(item.ratingCount)}`}
        </span>
      ) : null}
    </span>
  );
}
