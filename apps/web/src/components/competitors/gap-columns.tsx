"use client";

import type { MouseEvent } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { createTranslator } from "next-intl";
import { useTranslations } from "next-intl";
import { isCheckFresh, type CompetitorGapKeyword } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { GradedNumber } from "@/components/ui/graded";
import {
  formatCountryInLocale,
  formatDayMonth,
  formatDayMonthInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import enCompetitors from "../../../messages/en/competitors.json";
import { grade, type GradeMetric } from "@/lib/grade";
import { nullsLast } from "@/lib/table/sorting";
import { PositionCell } from "./comparison-cells";
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

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

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
  t: MessageTranslator = english,
): string {
  if (row.threat === "overtook" && row.overtookOn) {
    return t("gaps.threatOvertook", { date: formatDay(row.overtookOn) });
  }
  return row.competitorDelta === null || row.competitorDelta === undefined
    ? t("gaps.threatClosingNew")
    : t("gaps.threatClosing", { count: row.competitorDelta });
}

export function leadText(
  row: CompetitorGapKeyword,
  t: MessageTranslator = english,
): string {
  return row.gap === null
    ? t("gaps.noCompetitor")
    : t("gaps.ahead", { count: row.gap });
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
  const t = useTranslations("competitors");
  if (value === null) {
    return <Dash label={t("gaps.noScore", { metric: label })} />;
  }
  return (
    <GradedNumber
      value={String(value)}
      grade={grade(metric, value)}
      label={label}
      aligned
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
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const country = row.country;
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        title={row.text}
        aria-label={t("comparison.whyRank", { keyword: row.text })}
        data-breakdown-keyword={row.keywordId}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          onOpen(row.keywordId, event.currentTarget)
        }
        className="max-w-40 truncate rounded-sm text-left font-medium underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:decoration-foreground md:max-w-64"
      >
        {row.text}
      </button>
      {multiMarket && country ? (
        <span
          title={formatCountryInLocale(country, locale)}
          className="text-tick text-faint-foreground"
        >
          <span aria-hidden>{country.toUpperCase()}</span>
          <span className="sr-only">
            {formatCountryInLocale(country, locale)}
          </span>
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
  const t = useTranslations("competitors");
  if (row.bestCompetitorId === null) {
    return <Dash label={t("gaps.noCompetitor")} />;
  }
  const competitor = competitors.get(row.bestCompetitorId);
  const name = competitor?.name ?? t("unnamed");
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden>
        <AppIcon src={competitor?.iconUrl ?? null} size={16} />
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
    <span className="inline-flex items-center justify-end gap-1.5">
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
    meta: { label, numeric: true },
    header: ({ column }) => <SortableHeader column={column} label={label} />,
    cell: ({ row }) => (
      <ScoreCell metric={id} label={label} value={value(row.original)} />
    ),
  });
}

export function gapColumns(
  scope: GapColumnScope,
  copy: { t: MessageTranslator; locale: Locale },
) {
  const { t, locale } = copy;
  return columnHelper.columns([
    columnHelper.accessor("text", {
      id: "keyword",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("comparison.keyword")} />
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
          : (scope.competitors.get(row.bestCompetitorId)?.name ?? t("unnamed")),
      {
        id: "competitor",
        sortFn: "text",
        sortUndefined: "last",
        sortDescFirst: false,
        meta: { label: t("gaps.bestCompetitor") },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("gaps.bestCompetitor")} />
        ),
        cell: ({ row }) => (
          <CompetitorCell row={row.original} competitors={scope.competitors} />
        ),
      },
    ),
    columnHelper.accessor((row) => gapSortValue("theirs", row), {
      id: "theirs",
      ...POSITION_SORT,
      meta: { label: t("gaps.theirPosition"), numeric: true, phone: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("gaps.theirPosition")} />
      ),
      cell: ({ row }) =>
        row.original.bestCompetitorPosition === null ? (
          <Dash label={t("gaps.noCompetitor")} />
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
      meta: { numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("gaps.yourPosition")} />
      ),
      cell: ({ row }) => <YoursCell row={row.original} today={scope.today} />,
    }),
    scoreColumn("popularity", t("comparison.popularity"), (row) => row.volume),
    scoreColumn(
      "difficulty",
      t("comparison.difficulty"),
      (row) => row.difficulty,
    ),
    scoreColumn("opportunity", t("gaps.opportunity"), (row) => row.opportunity),
    columnHelper.accessor((row) => gapSortValue("reason", row), {
      id: "reason",
      sortFn: "basic",
      sortUndefined: "last",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("gaps.why")} />
      ),
      cell: ({ row }) => (
        <span>
          {threatText(
            row.original,
            (day) => formatDayMonthInLocale(day, locale),
            t,
          )}
        </span>
      ),
    }),
    columnHelper.accessor((row) => gapSortValue("margin", row), {
      id: "margin",
      ...SCORE_SORT,
      enableHiding: false,
      meta: { numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("gaps.margin")} />
      ),
      cell: ({ row }) =>
        row.original.gap === null ? (
          <Dash label={t("gaps.noCompetitor")} />
        ) : (
          <span className="numeric">{leadText(row.original, t)}</span>
        ),
    }),
  ]);
}
