"use client";

import type { MouseEvent } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { isCheckFresh, type CompetitorGapKeyword } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { GradedNumber } from "@/components/ui/graded";
import { formatCountry, formatDayMonth } from "@/lib/format";
import { grade, type GradeMetric } from "@/lib/grade";
import { nullsLast } from "@/lib/table/sorting";
import { PositionCell } from "./comparison-columns";
import { UNNAMED_COMPETITOR } from "./comparison-scores";
import { StaleClock } from "./StaleClock";

export interface GapCompetitor {
  name: string | null;
  iconUrl: string | null;
}

export interface GapColumnScope {
  competitors: ReadonlyMap<string, GapCompetitor>;
  multiMarket: boolean;
  today: string;
  onOpenBreakdown: (keywordId: string, opener: HTMLElement) => void;
}

const NO_COMPETITOR = "No competitor ranks";

const POSITION_SORT = {
  sortFn: "basic",
  sortUndefined: "last",
  sortDescFirst: false,
} as const;

const SCORE_SORT = {
  sortFn: "basic",
  sortUndefined: "last",
  sortDescFirst: true,
} as const;

const THREAT_ORDER = { overtook: 0, closing: 1 } as const;

export function threatText(
  row: CompetitorGapKeyword,
  formatDay: (day: string) => string = formatDayMonth,
): string {
  if (row.threat === "overtook" && row.overtookOn) {
    return `Overtook you on ${formatDay(row.overtookOn)}`;
  }
  return row.competitorDelta === null || row.competitorDelta === undefined
    ? "Closing in, newly ranked"
    : `Closing in, rose ${row.competitorDelta}`;
}

export function leadText(row: CompetitorGapKeyword): string {
  return row.gap === null ? NO_COMPETITOR : `${row.gap} ahead`;
}

export function gapSortValue(
  columnId: "yours" | "theirs" | "reason" | "margin",
  row: CompetitorGapKeyword,
): number | undefined {
  if (columnId === "yours") return nullsLast(row.yourPosition);
  if (columnId === "theirs") return nullsLast(row.bestCompetitorPosition);
  if (columnId === "margin") return nullsLast(row.gap);
  return row.threat === undefined ? undefined : THREAT_ORDER[row.threat];
}

const columnHelper = createColumnHelper<
  DataTableFeatures,
  CompetitorGapKeyword
>();

function Dash({ label }: { label: string }) {
  return (
    <span title={label} className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ScoreCell({
  metric,
  label,
  value,
}: {
  metric: GradeMetric;
  label: string;
  value: number | null;
}) {
  if (value === null) return <Dash label={`No ${label.toLowerCase()} yet`} />;
  return (
    <GradedNumber
      value={String(value)}
      grade={grade(metric, value)}
      label={label}
    />
  );
}

function KeywordButton({
  row,
  multiMarket,
  onOpen,
}: {
  row: CompetitorGapKeyword;
  multiMarket: boolean;
  onOpen: GapColumnScope["onOpenBreakdown"];
}) {
  const country = row.country;
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        title={row.text}
        aria-label={`${row.text}, why apps rank`}
        data-breakdown-keyword={row.keywordId}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          onOpen(row.keywordId, event.currentTarget)
        }
        className="max-w-40 truncate rounded-sm text-left font-medium underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:decoration-primary md:max-w-64"
      >
        {row.text}
      </button>
      {multiMarket && country ? (
        <span
          title={formatCountry(country)}
          className="font-mono text-xs text-muted-foreground"
        >
          <span aria-hidden>{country.toUpperCase()}</span>
          <span className="sr-only">{formatCountry(country)}</span>
        </span>
      ) : null}
    </div>
  );
}

function CompetitorCell({
  row,
  competitors,
}: {
  row: CompetitorGapKeyword;
  competitors: GapColumnScope["competitors"];
}) {
  if (row.bestCompetitorId === null) return <Dash label={NO_COMPETITOR} />;
  const competitor = competitors.get(row.bestCompetitorId);
  const name = competitor?.name ?? UNNAMED_COMPETITOR;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden>
        <AppIcon src={competitor?.iconUrl ?? null} name={name} size={20} />
      </span>
      <span className="max-w-40 truncate" title={name}>
        {name}
      </span>
    </span>
  );
}

function YoursCell({
  row,
  today,
}: {
  row: CompetitorGapKeyword;
  today: string;
}) {
  const stale =
    typeof row.lastCheckedOn === "string" &&
    !isCheckFresh(row.lastCheckedOn, today)
      ? row.lastCheckedOn
      : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <PositionCell value={row.yourPosition} best={false} />
      {stale === null ? null : <StaleClock day={stale} />}
    </span>
  );
}

function scoreColumn(
  id: "popularity" | "difficulty" | "opportunity",
  label: string,
  value: (row: CompetitorGapKeyword) => number | null,
) {
  return columnHelper.accessor((row) => nullsLast(value(row)), {
    id,
    ...SCORE_SORT,
    meta: { label },
    header: ({ column }) => <SortableHeader column={column} label={label} />,
    cell: ({ row }) => (
      <ScoreCell metric={id} label={label} value={value(row.original)} />
    ),
  });
}

export function gapColumns(scope: GapColumnScope) {
  return columnHelper.columns([
    columnHelper.accessor("text", {
      id: "keyword",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Keyword" />
      ),
      cell: ({ row }) => (
        <KeywordButton
          row={row.original}
          multiMarket={scope.multiMarket}
          onOpen={scope.onOpenBreakdown}
        />
      ),
    }),
    columnHelper.accessor(
      (row) =>
        row.bestCompetitorId === null
          ? undefined
          : (scope.competitors.get(row.bestCompetitorId)?.name ??
            UNNAMED_COMPETITOR),
      {
        id: "competitor",
        sortFn: "text",
        sortUndefined: "last",
        sortDescFirst: false,
        meta: { label: "Best competitor" },
        header: ({ column }) => (
          <SortableHeader column={column} label="Best competitor" />
        ),
        cell: ({ row }) => (
          <CompetitorCell row={row.original} competitors={scope.competitors} />
        ),
      },
    ),
    columnHelper.accessor((row) => gapSortValue("theirs", row), {
      id: "theirs",
      ...POSITION_SORT,
      meta: { label: "Their position" },
      header: ({ column }) => (
        <SortableHeader column={column} label="Their position" />
      ),
      cell: ({ row }) =>
        row.original.bestCompetitorPosition === null ? (
          <Dash label={NO_COMPETITOR} />
        ) : (
          <PositionCell
            value={row.original.bestCompetitorPosition}
            best={false}
          />
        ),
    }),
    columnHelper.accessor((row) => gapSortValue("yours", row), {
      id: "yours",
      ...POSITION_SORT,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Your position" />
      ),
      cell: ({ row }) => <YoursCell row={row.original} today={scope.today} />,
    }),
    scoreColumn("popularity", "Popularity", (row) => row.volume),
    scoreColumn("difficulty", "Difficulty", (row) => row.difficulty),
    scoreColumn("opportunity", "Opportunity", (row) => row.opportunity),
    columnHelper.accessor((row) => gapSortValue("reason", row), {
      id: "reason",
      sortFn: "basic",
      sortUndefined: "last",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => <SortableHeader column={column} label="Why" />,
      cell: ({ row }) => <span>{threatText(row.original)}</span>,
    }),
    columnHelper.accessor((row) => gapSortValue("margin", row), {
      id: "margin",
      ...SCORE_SORT,
      enableHiding: false,
      header: ({ column }) => <SortableHeader column={column} label="Margin" />,
      cell: ({ row }) =>
        row.original.gap === null ? (
          <Dash label={NO_COMPETITOR} />
        ) : (
          <span className="numeric font-mono">{leadText(row.original)}</span>
        ),
    }),
  ]);
}
