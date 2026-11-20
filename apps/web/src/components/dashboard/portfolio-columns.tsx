"use client";

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import type {
  PortfolioApp,
  PortfolioAppHistory,
  PortfolioAppInsight,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { RankBandBar } from "@/components/charts/RankBandBar";
import { TrendLine } from "@/components/charts/Sparkline";
import { DeleteAppMenu } from "@/components/apps/DeleteAppMenu";
import { DelistedBadge } from "@/components/apps/DelistedBadge";
import {
  SortableHeader,
  type SortableColumn,
} from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { TrendChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { Separated } from "@/components/ui/separated";
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
import { setupChipText } from "./setup-chip";
import { useDashboardRange } from "./use-range-history";

export interface PortfolioTableRow {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
  range: PortfolioAppHistory | undefined;
  days: number;
}

const rangeUnit = (days: number): string => `${days}d`;

function VisibilityTrend({
  points,
  days,
}: {
  points: PortfolioAppHistory["points"];
  days: number;
}) {
  const values = points.map((point) => point.visibility);
  return (
    <TrendLine
      values={values}
      label={`visibility, last ${days} days`}
      now={String(Math.round(values.at(-1) ?? 0))}
    />
  );
}

function RangeLabel({ prefix }: { prefix: string }) {
  const { days } = useDashboardRange();
  return <span>{`${prefix}${rangeUnit(days)}`}</span>;
}

function ChangeHeader({ column }: { column: SortableColumn }) {
  return <SortableHeader column={column} label={<RangeLabel prefix="" />} />;
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
  const setup = setupChipText(app.setup);
  const meta = [
    storeLabel(app.store),
    app.country.toUpperCase(),
    pluralize(app.trackedKeywords, "keyword"),
    app.groupName,
  ].filter((part) => part !== null);
  return (
    <div className="flex max-w-44 min-w-0 items-center gap-3 @xl/dashboard:max-w-72">
      <AppIcon src={app.iconUrl} size={24} />
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/apps/${app.id}`}
          className="-my-[3px] flex min-h-6 min-w-0 items-center font-medium underline-offset-4 hover:underline"
        >
          <span className="truncate">{name}</span>
        </Link>
        <span className="truncate text-label text-muted-foreground">
          <Separated parts={meta} />
        </span>
        {app.delistedAt ? <DelistedBadge since={app.delistedAt} /> : null}
        {setup ? (
          <Badge variant="info" asChild className="mt-0.5 min-h-6">
            <Link href={`/apps/${app.id}/setup`}>{setup}</Link>
          </Badge>
        ) : null}
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
    meta: { label: "Trend", wideOnly: true },
    header: () => <RangeLabel prefix="Trend " />,
    cell: ({ row }) =>
      row.original.range === undefined ? (
        EMPTY
      ) : (
        <VisibilityTrend
          points={row.original.range.points}
          days={row.original.days}
        />
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
        <span className="numeric font-medium">
          {Math.round(row.original.app.visibility.current)}
        </span>
      ),
  }),
  columnHelper.accessor(
    (row) => nullsLast(row.range?.change.visibilityDelta ?? null),
    {
      id: "change",
      ...NUMBER_SORT,
      meta: { label: "Change", phone: true, numeric: true },
      header: ({ column }) => <ChangeHeader column={column} />,
      cell: ({ row }) =>
        row.original.range === undefined ? (
          EMPTY
        ) : (
          <TrendChip
            label={rangeUnit(row.original.days)}
            value={row.original.range.change.visibilityDelta}
            form="pill"
            labelled={false}
          />
        ),
    },
  ),
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
          <span className="inline-flex items-center justify-end gap-2.5">
            <span className="numeric">
              {formatNumber(insight.rankDistribution.top10)}
            </span>
            <span className="w-14 @max-5xl/dashboard:hidden">
              <RankBandBar distribution={insight.rankDistribution} />
            </span>
          </span>
        ) : (
          EMPTY
        );
      },
    },
  ),
  columnHelper.display({
    id: "movement",
    meta: { label: "Moved", numeric: true, wideOnly: true },
    header: () => <RangeLabel prefix="Moved " />,
    cell: ({ row }) =>
      row.original.range === undefined ? (
        EMPTY
      ) : (
        <span className="numeric whitespace-nowrap">
          <MovementValue movement={row.original.range.change.movement} />
        </span>
      ),
  }),
  columnHelper.accessor(
    (row) => nullsLast(captured(row)?.rating.average ?? null),
    {
      id: "rating",
      ...NUMBER_SORT,
      meta: { label: "Rating", numeric: true, wideOnly: true },
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
            <span>{formatNumber(actions.open)}</span>
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
  columnHelper.display({
    id: "menu",
    enableHiding: false,
    header: () => <span className="sr-only">More</span>,
    cell: ({ row }) => (
      <DeleteAppMenu
        id={row.original.app.id}
        name={row.original.app.name ?? "Untitled app"}
      />
    ),
  }),
]);
