"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { CompetitorDiscoveryItem } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { GradedNumber } from "@/components/ui/graded";
import { AppIcon } from "@/components/AppIcon";
import { positionChipClass } from "@/components/keywords/PositionReadout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="hidden shrink-0 sm:block">
            <AppIcon src={row.original.iconUrl ?? null} size={24} />
          </span>
          <div className="flex min-w-0 flex-col">
            <bdi className="font-medium wrap-anywhere whitespace-normal">
              {row.original.title}
            </bdi>
            {row.original.developer ? (
              <bdi className="max-w-40 truncate text-tick text-faint-foreground sm:max-w-none">
                {row.original.developer}
              </bdi>
            ) : null}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("appearances", {
      id: "appearances",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Appearances", phone: true, numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="Appearances" />
      ),
      cell: ({ row }) => (
        <span className="numeric">{row.original.appearances}</span>
      ),
    }),
    columnHelper.accessor("keywordCount", {
      id: "keywords",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Keywords", numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="Keywords" />
      ),
      cell: ({ row }) => <KeywordsPopover item={row.original} />,
    }),
    columnHelper.accessor("bestPosition", {
      id: "best",
      ...NUMBER_SORT,
      sortDescFirst: false,
      meta: { label: "Best", phone: true, numeric: true },
      header: ({ column }) => <SortableHeader column={column} label="Best" />,
      cell: ({ row }) => (
        <GradedNumber
          value={String(row.original.bestPosition)}
          grade={grade("position", row.original.bestPosition)}
          label="Best position"
          marker={false}
          className={positionChipClass(
            grade("position", row.original.bestPosition),
          )}
        />
      ),
    }),
    columnHelper.accessor("avgPosition", {
      id: "avg",
      ...NUMBER_SORT,
      sortDescFirst: false,
      meta: { label: "Avg", numeric: true },
      header: ({ column }) => <SortableHeader column={column} label="Avg" />,
      cell: ({ row }) => (
        <GradedNumber
          value={String(row.original.avgPosition)}
          grade={grade("position", row.original.avgPosition)}
          label="Average position"
          aligned
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(row.ratingAvg), {
      id: "rating",
      ...NUMBER_SORT,
      sortDescFirst: true,
      meta: { label: "Rating", phone: true, numeric: true },
      header: ({ column }) => <SortableHeader column={column} label="Rating" />,
      cell: ({ row }) => <RatingCell item={row.original} />,
    }),
    columnHelper.display({
      id: "track",
      enableHiding: false,
      header: () => <span className="sr-only">Track</span>,
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

function KeywordsPopover({ item }: { item: CompetitorDiscoveryItem }) {
  const title = `${item.keywordCount} ${
    item.keywordCount === 1 ? "keyword" : "keywords"
  } where ${item.title} appears`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className="numeric rounded-sm underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:decoration-foreground"
        >
          <span>{item.keywordCount}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={title} className="w-64">
        <p className="text-label text-faint-foreground">{title}</p>
        <ul className="mt-2 flex flex-col gap-1 text-dense">
          {item.keywords.map((keyword) => (
            <li key={keyword} dir="auto" className="wrap-anywhere">
              {keyword}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function RatingCell({ item }: { item: CompetitorDiscoveryItem }) {
  if (item.ratingAvg === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
      <GradedNumber
        value={formatRating(item.ratingAvg)}
        grade={grade("rating", item.ratingAvg)}
        label="Rating"
        aligned
      />
      {item.ratingCount !== null ? (
        <span className="numeric hidden min-w-12 text-right text-muted-foreground sm:inline">
          {formatNumber(item.ratingCount)}
        </span>
      ) : null}
    </span>
  );
}
