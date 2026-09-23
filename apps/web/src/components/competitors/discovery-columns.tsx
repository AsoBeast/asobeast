"use client";

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { CompetitorDiscoveryItem } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { GradedNumber } from "@/components/ui/graded";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber, formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import type { TableColumnMeta } from "@/lib/table/column-visibility";
import { nullsLast, type SortDefaults } from "@/lib/table/sorting";
import { TrackButton } from "./TrackButton";

export const discoveryTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<TableColumnMeta>(),
});

export const DISCOVERY_SORT_DEFAULTS: SortDefaults = {
  descFirst: new Set(["appearances", "keywords", "rating"]),
};

const columnHelper = createColumnHelper<
  typeof discoveryTableFeatures,
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
