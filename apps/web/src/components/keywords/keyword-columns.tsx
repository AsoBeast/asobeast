"use client";

import type { FilterFn } from "@tanstack/react-table";
import type { MessageTranslator } from "@/i18n/translator";
import type {
  KeywordBucket,
  KeywordClass,
  Store,
  TrackedKeywordItem,
} from "@asobeast/shared";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import {
  dayChange,
  dayChangeRank,
  matchesMoveFilter,
  type KeywordMoveFilter,
} from "@/lib/keyword-day-change";
import { tagsIn } from "@/lib/keyword-tags";
import { DayChangeCell } from "./DayChangeCell";
import { attributeColumns } from "./keyword-attribute-columns";
import { keywordZoneFilter } from "./keyword-filters";
import { KeywordRowActions } from "./KeywordRowActions";
import { PlayInstallsTip } from "./PlayInstallsTip";
import type { PositionHistoryContext } from "./PositionHistoryPopover";
import {
  KeywordCell,
  PlayAcquisitionsCell,
  PositionCell,
  TrendCell,
  TrendHeading,
} from "./keyword-cells";
import {
  keywordColumnHelper as columnHelper,
  SORTABLE,
} from "./keyword-column-helper";
import {
  addedColumn,
  competitorsColumn,
  revealColumn,
  topAppsColumn,
  insightsColumn,
  volatilityColumn,
} from "./keyword-fact-columns";
import {
  dayChangeFooter,
  difficultyFooter,
  keywordCountFooter,
  movedFooter,
  opportunityFooter,
  popularityFooter,
  positionFooter,
} from "./KeywordTotalsFooters";
import {
  TREND_WINDOW_DAYS,
  DEFAULT_TREND_WINDOW,
  trendDelta,
  type TrendSeries,
  type TrendState,
  type TrendWindow,
} from "@/lib/trend-window";
import { DerivedScoreCell, ScoreCell } from "./score-cells";
import { scoreValue, shownScore } from "@/lib/keyword-scores";
import {
  difficultyEvidence,
  opportunityEvidence,
  popularityEvidence,
} from "./score-evidence";
import type { Grade, GradeMetric } from "@/lib/grade";
import {
  gradeIn,
  oneOf,
  positionBandIn,
  statusFilter,
  type ActivityStatus,
  type PositionBand,
} from "@/lib/table/facets";
import { nullsLast } from "@/lib/table/sorting";

export interface TrendView {
  window: TrendWindow;
  series: TrendSeries | undefined;
  state?: TrendState;
}

export const HIDDEN_KEYWORD_COLUMNS = {
  bucket: false,
  status: false,
  type: false,
  zone: false,
};

function gradeFilter(
  metric: GradeMetric,
): FilterFn<KeywordTableFeatures, TrackedKeywordItem> {
  return (row, id, selected: Grade[]) =>
    gradeIn(
      metric,
      shownScore(row.getValue<number | undefined>(id) ?? null),
      selected,
    );
}

export function keywordColumns({
  appId,
  store,
  homeCountry,
  multiMarket,
  today,
  trend,
  onOpenSerp,
  translator: t,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  multiMarket: boolean;
  today: string;
  trend: TrendView;
  onOpenSerp: (keywordId: string) => void;
  translator: MessageTranslator;
}) {
  return columnHelper.columns([
    ...identityColumns(t),
    positionColumn(today, t),
    changeColumn(today, t),
    deltaColumn(today, trend, { appId, store, homeCountry, multiMarket }, t),
    ...scoreColumns(t),
    insightsColumn(today, multiMarket, t),
    ...(store === "GOOGLE_PLAY" ? [acquisitionsColumn(t)] : []),
    topAppsColumn(onOpenSerp, t),
    ...attributeColumns(t),
    volatilityColumn(t),
    addedColumn(t),
    competitorsColumn(t),
    revealColumn(t),
    actionsColumn({ appId, onOpenSerp }, t),
    ...filterColumns(),
  ]);
}

function identityColumns(t: MessageTranslator) {
  return [
    columnHelper.display({
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getFilteredSelectedRowModel().rows.length > 0
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
          aria-label={t("table.selectAll")}
          data-select-all-keywords
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("table.selectOne", { keyword: row.original.text })}
        />
      ),
    }),
    columnHelper.accessor("text", {
      id: "keyword",
      enableHiding: false,
      sortFn: "text",
      sortDescFirst: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.keyword")} />
      ),
      footer: ({ table }) => keywordCountFooter({ table }, t),
      cell: ({ row }) => <KeywordCell keyword={row.original} />,
    }),
  ];
}

function filterColumns() {
  return [
    columnHelper.accessor((row) => row.bucket ?? undefined, {
      id: "bucket",
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, id, selected: KeywordBucket[]) =>
        oneOf(row.getValue<KeywordBucket | undefined>(id), selected),
    }),
    columnHelper.accessor("active", {
      id: "status",
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, _id, status: ActivityStatus) =>
        statusFilter(row.original, status),
    }),
    columnHelper.accessor((row) => row.keywordClass, {
      id: "type",
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, id, selected: KeywordClass[]) =>
        oneOf(row.getValue<KeywordClass | undefined>(id), selected),
    }),
    columnHelper.accessor("keywordId", {
      id: "zone",
      enableHiding: false,
      enableSorting: false,
      filterFn: keywordZoneFilter,
    }),
  ];
}

function positionColumn(today: string, t: MessageTranslator) {
  return columnHelper.accessor((row) => nullsLast(row.latestPosition), {
    id: "position",
    meta: { label: t("table.position"), phone: true },
    ...SORTABLE,
    sortDescFirst: false,
    filterFn: (row, _id, selected: PositionBand[]) =>
      positionBandIn(
        row.original.latestPosition,
        row.original.latestDepth,
        selected,
      ),
    header: ({ column }) => (
      <SortableHeader column={column} label={t("table.position")} />
    ),
    footer: ({ table }) => positionFooter({ table }, t),
    cell: ({ row }) => <PositionCell keyword={row.original} today={today} />,
  });
}

function changeColumn(today: string, t: MessageTranslator) {
  return columnHelper.accessor(
    (row) => nullsLast(dayChangeRank(dayChange(row, today))),
    {
      id: "change",
      meta: { label: t("table.change"), phone: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: (row, _id, filter: KeywordMoveFilter) =>
        matchesMoveFilter(row.original, today, filter),
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.change")} />
      ),
      footer: ({ table }) => dayChangeFooter({ table }, today, t),
      cell: ({ row }) => (
        <DayChangeCell
          change={dayChange(row.original, today)}
          muted={!row.original.active}
        />
      ),
    },
  );
}

function deltaColumn(
  today: string,
  { window: trendWindow, series, state = "ready" }: TrendView,
  history: PositionHistoryContext,
  t: MessageTranslator,
) {
  const label = t("table.lastDays", {
    days: TREND_WINDOW_DAYS[trendWindow],
  });
  const deltaOf = (row: TrackedKeywordItem) =>
    trendDelta(row, trendWindow, series);
  return columnHelper.accessor(
    (row) => {
      const delta = deltaOf(row);
      return delta === null ? undefined : -delta;
    },
    {
      id: "delta7d",
      meta: { label },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <SortableHeader
          column={column}
          aria-label={label}
          label={<TrendHeading trendWindow={trendWindow} t={t} />}
        />
      ),
      footer: ({ table }) =>
        movedFooter(
          { table },
          trendWindow === DEFAULT_TREND_WINDOW ? undefined : { deltaOf, state },
          t,
        ),
      cell: ({ row }) => (
        <TrendCell
          keyword={row.original}
          today={today}
          history={history}
          trendWindow={trendWindow}
          series={series}
          state={state}
        />
      ),
    },
  );
}

function scoreColumns(t: MessageTranslator) {
  return [
    columnHelper.accessor((row) => nullsLast(row.opportunity), {
      id: "opportunity",
      meta: { label: t("table.opportunity"), numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("opportunity"),
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.opportunity")} />
      ),
      footer: ({ table }) => opportunityFooter({ table }, t),
      cell: ({ row }) => (
        <DerivedScoreCell {...opportunityEvidence(row.original, t)} />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "traffic")), {
      id: "traffic",
      meta: { label: t("table.popularity"), numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("popularity"),
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label={t("table.popularity")} />
          <InfoTip
            label={t("table.aboutPopularity")}
            title={t("table.popularity")}
            summary={`${t("scores.comparability")}.`}
          />
        </span>
      ),
      footer: ({ table }) => popularityFooter({ table }, t),
      cell: ({ row }) => <ScoreCell {...popularityEvidence(row.original, t)} />,
    }),
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "difficulty")), {
      id: "difficulty",
      meta: { label: t("table.difficulty"), numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("difficulty"),
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.difficulty")} />
      ),
      footer: ({ table }) => difficultyFooter({ table }, t),
      cell: ({ row }) => <ScoreCell {...difficultyEvidence(row.original, t)} />,
    }),
  ];
}

function acquisitionsColumn(t: MessageTranslator) {
  return columnHelper.accessor(
    (row) => nullsLast(row.playAcquisitions?.acquisitions ?? null),
    {
      id: "acquisitions",
      meta: { label: t("table.playInstalls"), numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label={t("table.installs")} />
          <PlayInstallsTip />
        </span>
      ),
      cell: ({ row }) => (
        <PlayAcquisitionsCell value={row.original.playAcquisitions ?? null} />
      ),
    },
  );
}

function actionsColumn(
  {
    appId,
    onOpenSerp,
  }: {
    appId: string;
    onOpenSerp: (keywordId: string) => void;
  },
  t: MessageTranslator,
) {
  return columnHelper.display({
    id: "actions",
    enableHiding: false,
    header: () => <span className="sr-only">{t("table.actions")}</span>,
    cell: ({ row, table }) => (
      <KeywordRowActions
        appId={appId}
        keyword={row.original}
        marketTags={() =>
          tagsIn(table.getCoreRowModel().rows.map((entry) => entry.original))
        }
        onOpenSerp={() => onOpenSerp(row.original.keywordId)}
      />
    ),
  });
}
