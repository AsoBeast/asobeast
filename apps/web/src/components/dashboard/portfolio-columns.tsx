"use client";

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import type { PortfolioApp, PortfolioAppInsight } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { TrendChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import {
  formatDate,
  formatNumber,
  formatRating,
  storeLabel,
} from "@/lib/format";
import { grade } from "@/lib/grade";
import { nullsLast } from "@/lib/table/sorting";
import { MovementValue } from "./MovementValue";

export interface PortfolioTableRow {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
}

const columnHelper = createColumnHelper<DataTableFeatures, PortfolioTableRow>();

const NUMBER_SORT = {
  sortFn: "basic",
  sortUndefined: "last",
  sortDescFirst: true,
} as const;

const EMPTY = <span className="text-muted-foreground">—</span>;

const captured = (row: PortfolioTableRow): PortfolioAppInsight | undefined =>
  row.app.lastCapturedAt === null ? undefined : row.insight;

function AppCell({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AppIcon src={app.iconUrl} name={app.name} size={32} />
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/apps/${app.id}`}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
        <span className="truncate text-caption text-muted-foreground">
          {storeLabel(app.store)} · {app.country.toUpperCase()}
          {app.groupName ? ` · ${app.groupName}` : null}
        </span>
      </div>
    </div>
  );
}

export const portfolioColumns = columnHelper.columns([
  columnHelper.accessor((row) => row.app.name ?? "", {
    id: "name",
    sortFn: "text",
    sortDescFirst: false,
    enableHiding: false,
    header: ({ column }) => <SortableHeader column={column} label="App" />,
    cell: ({ row }) => <AppCell app={row.original.app} />,
  }),
  columnHelper.accessor((row) => row.app.visibility.current, {
    id: "visibility",
    ...NUMBER_SORT,
    meta: { label: "Visibility", phone: true },
    header: ({ column }) => (
      <SortableHeader column={column} label="Visibility" />
    ),
    cell: ({ row }) =>
      row.original.app.lastCapturedAt === null ? (
        EMPTY
      ) : (
        <span className="numeric font-mono">
          {Math.round(row.original.app.visibility.current)}
        </span>
      ),
  }),
  columnHelper.accessor((row) => nullsLast(row.app.visibility.delta7d), {
    id: "change",
    ...NUMBER_SORT,
    meta: { label: "7d", phone: true },
    header: ({ column }) => <SortableHeader column={column} label="7d" />,
    cell: ({ row }) =>
      row.original.app.lastCapturedAt === null ? (
        EMPTY
      ) : (
        <TrendChip label="7d" value={row.original.app.visibility.delta7d} />
      ),
  }),
  columnHelper.accessor(
    (row) => nullsLast(row.insight?.rankDistribution.top10 ?? null),
    {
      id: "top10",
      ...NUMBER_SORT,
      meta: { label: "In top 10" },
      header: ({ column }) => (
        <SortableHeader column={column} label="In top 10" />
      ),
      cell: ({ row }) => {
        const insight = captured(row.original);
        return insight ? (
          <span className="numeric font-mono">
            {formatNumber(insight.rankDistribution.top10)}
          </span>
        ) : (
          EMPTY
        );
      },
    },
  ),
  columnHelper.display({
    id: "movement",
    meta: { label: "Movement" },
    header: () => "Movement",
    cell: ({ row }) => {
      const insight = captured(row.original);
      return insight ? (
        <span className="numeric font-mono whitespace-nowrap">
          <MovementValue movement={insight.movement} />
        </span>
      ) : (
        EMPTY
      );
    },
  }),
  columnHelper.accessor(
    (row) => nullsLast(row.insight?.rating.average ?? null),
    {
      id: "rating",
      ...NUMBER_SORT,
      meta: { label: "Rating" },
      header: ({ column }) => <SortableHeader column={column} label="Rating" />,
      cell: ({ row }) => {
        const average = captured(row.original)?.rating.average ?? null;
        return average === null ? (
          EMPTY
        ) : (
          <GradedNumber
            value={formatRating(average)}
            grade={grade("rating", average)}
            label="Rating"
          />
        );
      },
    },
  ),
  columnHelper.display({
    id: "audit",
    meta: { label: "Audit" },
    header: () => "Audit",
    cell: ({ row }) => {
      const score = captured(row.original)?.audit?.current ?? null;
      return score === null ? (
        EMPTY
      ) : (
        <GradedNumber
          value={String(score)}
          grade={grade("audit", score)}
          label="Audit"
        />
      );
    },
  }),
  columnHelper.accessor(
    (row) => nullsLast(row.insight?.actions?.open ?? null),
    {
      id: "actions",
      ...NUMBER_SORT,
      meta: { label: "Open actions", phone: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="Open actions" />
      ),
      cell: ({ row }) => {
        const actions = captured(row.original)?.actions ?? null;
        return actions === null ? (
          EMPTY
        ) : (
          <span className="numeric font-mono">
            {formatNumber(actions.open)}
          </span>
        );
      },
    },
  ),
  columnHelper.display({
    id: "changes",
    meta: { label: "Changes 7d" },
    header: () => "Changes 7d",
    cell: ({ row }) => {
      const changes = captured(row.original)?.changes7d;
      return changes ? (
        <span className="numeric font-mono">
          {formatNumber(changes.own + changes.competitors)}
        </span>
      ) : (
        EMPTY
      );
    },
  }),
  columnHelper.accessor((row) => nullsLast(row.app.lastCapturedAt), {
    id: "updated",
    ...NUMBER_SORT,
    meta: { label: "Last collected" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Last collected" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.app.lastCapturedAt)}
      </span>
    ),
  }),
]);
