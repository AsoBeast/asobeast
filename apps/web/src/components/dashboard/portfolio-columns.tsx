"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type {
  PortfolioApp,
  PortfolioAppHistory,
  PortfolioAppInsight,
} from "@asobeast/shared";
import { RankBandBar } from "@/components/charts/RankBandBar";
import { DeleteAppMenu } from "@/components/apps/DeleteAppMenu";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { TrendChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import {
  formatDateInLocale,
  formatNumberInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import { grade } from "@/lib/grade";
import type { Locale } from "@/lib/locale";
import { nullsLast } from "@/lib/table/sorting";
import { MovementValue } from "./MovementValue";
import {
  AppCell,
  ChangeHeader,
  RangeLabel,
  VisibilityTrend,
} from "./portfolio-cells";

export interface PortfolioTableRow {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
  range: PortfolioAppHistory | undefined;
  days: number;
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

function primaryPortfolioColumns(t: MessageTranslator, locale: Locale) {
  const rangeUnit = (days: number): string => t("table.rangeUnit", { days });

  return columnHelper.columns([
    columnHelper.accessor((row) => row.app.name ?? "", {
      id: "name",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.app")} />
      ),
      cell: ({ row }) => <AppCell app={row.original.app} />,
    }),
    columnHelper.display({
      id: "trend",
      meta: { label: t("table.trend"), wideOnly: true },
      header: () => <RangeLabel kind="trend" />,
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
      meta: { label: t("table.visibility"), phone: true, numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.visibility")} />
      ),
      cell: ({ row }) =>
        row.original.app.lastCapturedAt === null ? (
          EMPTY
        ) : (
          <span className="numeric font-medium">
            {formatNumberInLocale(
              Math.round(row.original.app.visibility.current),
              locale,
            )}
          </span>
        ),
    }),
    columnHelper.accessor(
      (row) => nullsLast(row.range?.change.visibilityDelta ?? null),
      {
        id: "change",
        ...NUMBER_SORT,
        meta: { label: t("table.change"), phone: true, numeric: true },
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
        meta: { label: t("table.top10"), numeric: true },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("table.top10")} />
        ),
        cell: ({ row }) => {
          const insight = captured(row.original);
          return insight ? (
            <span className="inline-flex items-center justify-end gap-2.5">
              <span className="numeric">
                {formatNumberInLocale(insight.rankDistribution.top10, locale)}
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
      meta: { label: t("table.moved"), numeric: true, wideOnly: true },
      header: () => <RangeLabel kind="moved" />,
      cell: ({ row }) =>
        row.original.range === undefined ? (
          EMPTY
        ) : (
          <span className="numeric whitespace-nowrap">
            <MovementValue movement={row.original.range.change.movement} />
          </span>
        ),
    }),
  ]);
}

function secondaryPortfolioColumns(t: MessageTranslator, locale: Locale) {
  return columnHelper.columns([
    columnHelper.accessor(
      (row) => nullsLast(captured(row)?.rating.average ?? null),
      {
        id: "rating",
        ...NUMBER_SORT,
        meta: { label: t("table.rating"), numeric: true, wideOnly: true },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("table.rating")} />
        ),
        cell: ({ row }) => {
          const average = captured(row.original)?.rating.average ?? null;
          return average === null ? (
            EMPTY
          ) : (
            <GradedNumber
              value={formatRatingInLocale(average, locale)}
              grade={grade("rating", average)}
              label={t("table.rating")}
            />
          );
        },
      },
    ),
    columnHelper.display({
      id: "audit",
      meta: { label: t("table.audit"), numeric: true, hiddenByDefault: true },
      header: () => t("table.audit"),
      cell: ({ row }) => {
        const score = captured(row.original)?.audit?.current ?? null;
        return score === null ? (
          EMPTY
        ) : (
          <GradedNumber
            value={formatNumberInLocale(score, locale)}
            grade={grade("audit", score)}
            label={t("table.audit")}
          />
        );
      },
    }),
    columnHelper.accessor(
      (row) => nullsLast(captured(row)?.actions?.open ?? null),
      {
        id: "actions",
        ...NUMBER_SORT,
        meta: { label: t("table.actions"), phone: true, numeric: true },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("table.actions")} />
        ),
        cell: ({ row }) => {
          const actions = captured(row.original)?.actions ?? null;
          if (actions === null) return EMPTY;
          return (
            <span className="numeric whitespace-nowrap">
              <span>{formatNumberInLocale(actions.open, locale)}</span>
              {actions.critical > 0 ? (
                <span className="text-priority-critical">
                  {` · ${t("table.critical", { count: actions.critical })}`}
                </span>
              ) : null}
            </span>
          );
        },
      },
    ),
    columnHelper.display({
      id: "changes",
      meta: { label: t("table.changes"), numeric: true, hiddenByDefault: true },
      header: () => t("table.changes"),
      cell: ({ row }) => {
        const changes = captured(row.original)?.changes7d;
        return changes ? (
          <span className="numeric">
            {formatNumberInLocale(changes.own + changes.competitors, locale)}
          </span>
        ) : (
          EMPTY
        );
      },
    }),
    columnHelper.accessor((row) => nullsLast(row.app.lastCapturedAt), {
      id: "updated",
      ...NUMBER_SORT,
      meta: { label: t("table.updated"), hiddenByDefault: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.updated")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateInLocale(row.original.app.lastCapturedAt, locale)}
        </span>
      ),
    }),
    columnHelper.display({
      id: "menu",
      enableHiding: false,
      header: () => <span className="sr-only">{t("table.more")}</span>,
      cell: ({ row }) => (
        <DeleteAppMenu
          id={row.original.app.id}
          name={row.original.app.name ?? t("table.untitled")}
        />
      ),
    }),
  ]);
}

export function createPortfolioColumns(t: MessageTranslator, locale: Locale) {
  return [
    ...primaryPortfolioColumns(t, locale),
    ...secondaryPortfolioColumns(t, locale),
  ];
}
