"use client";

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import type { PortfolioApp, PortfolioAppInsight } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { DelistedBadge } from "@/components/apps/DelistedBadge";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { TrendChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import {
  formatDate,
  formatNumber,
  formatRating,
  pluralize,
  storeLabel,
} from "@/lib/format";
import { grade } from "@/lib/grade";
import { nullsLast } from "@/lib/table/sorting";
import { MovementValue } from "./MovementValue";
import { TrendLine } from "./Sparkline";

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
  const meta = [
    storeLabel(app.store),
    app.country.toUpperCase(),
    pluralize(app.trackedKeywords, "keyword"),
    app.groupName,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <div className="flex max-w-44 min-w-0 items-center gap-3 @xl/dashboard:max-w-72">
      <AppIcon src={app.iconUrl} size={24} />
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/apps/${app.id}`}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
        <span className="truncate text-label text-muted-foreground">
          {meta}
        </span>
        {app.delistedAt ? <DelistedBadge since={app.delistedAt} /> : null}
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
  columnHelper.display({
    id: "trend",
    meta: { label: "Trend" },
    header: () => "Trend",
    cell: ({ row }) =>
      row.original.app.lastCapturedAt === null ? (
        EMPTY
      ) : (
        <TrendLine points={row.original.app.sparkline} />
      ),
  }),
  columnHelper.accessor((row) => row.app.visibility.current, {
    id: "visibility",
    ...NUMBER_SORT,
    meta: { label: "Visibility", phone: true, numeric: true },
    header: ({ column }) => (
      <SortableHeader column={column} label="Visibility" />
    ),
    cell: ({ row }) =>
      row.original.app.lastCapturedAt === null ? (
        EMPTY
      ) : (
        <span className="numeric">
          {Math.round(row.original.app.visibility.current)}
        </span>
      ),
  }),
  columnHelper.accessor((row) => nullsLast(row.app.visibility.delta7d), {
    id: "change",
    ...NUMBER_SORT,
    meta: { label: "7d", phone: true, numeric: true },
    header: ({ column }) => <SortableHeader column={column} label="7d" />,
    cell: ({ row }) =>
      row.original.app.lastCapturedAt === null ? (
        EMPTY
      ) : (
        <TrendChip
          label="7d"
          value={row.original.app.visibility.delta7d}
          form="pill"
        />
      ),
  }),
  columnHelper.accessor(
    (row) => nullsLast(captured(row)?.rankDistribution.top10 ?? null),
    {
      id: "top10",
      ...NUMBER_SORT,
      meta: { label: "In top 10", numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="In top 10" />
      ),
      cell: ({ row }) => {
        const insight = captured(row.original);
        return insight ? (
          <span className="numeric">
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
    meta: { label: "Moved", numeric: true },
    header: () => "Moved",
    cell: ({ row }) => {
      const insight = captured(row.original);
      return insight ? (
        <span className="numeric whitespace-nowrap">
          <MovementValue movement={insight.movement} />
        </span>
      ) : (
        EMPTY
      );
    },
  }),
  columnHelper.accessor(
    (row) => nullsLast(captured(row)?.rating.average ?? null),
    {
      id: "rating",
      ...NUMBER_SORT,
      meta: { label: "Rating", numeric: true },
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
    meta: { label: "Audit", numeric: true, hiddenByDefault: true },
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
    (row) => nullsLast(captured(row)?.actions?.open ?? null),
    {
      id: "actions",
      ...NUMBER_SORT,
      meta: { label: "Open actions", phone: true, numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label="Open actions" />
      ),
      cell: ({ row }) => {
        const actions = captured(row.original)?.actions ?? null;
        if (actions === null) return EMPTY;
        return (
          <span className="numeric whitespace-nowrap">
            {formatNumber(actions.open)}
            {actions.critical > 0 ? (
              <span className="text-priority-critical">{` · ${formatNumber(actions.critical)} critical`}</span>
            ) : null}
          </span>
        );
      },
    },
  ),
  columnHelper.display({
    id: "changes",
    meta: { label: "Changes 7d", numeric: true, hiddenByDefault: true },
    header: () => "Changes 7d",
    cell: ({ row }) => {
      const changes = captured(row.original)?.changes7d;
      return changes ? (
        <span className="numeric">
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
    meta: { label: "Last collected", hiddenByDefault: true },
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
