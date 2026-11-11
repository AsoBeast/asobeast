"use client";

import type { FilterFn } from "@tanstack/react-table";
import type {
  KeywordBucket,
  KeywordClass,
  Store,
  TrackedKeywordItem,
} from "@asobeast/shared";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { DeltaChip } from "@/components/ui/delta-chip";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { tagsIn } from "@/lib/keyword-tags";
import { attributeColumns } from "./keyword-attribute-columns";
import { SCORE_COMPARABILITY } from "./keyword-csv";
import { keywordZoneFilter } from "./keyword-filters";
import { KeywordRowActions } from "./KeywordRowActions";
import { PlayInstallsTip } from "./PlayInstallsTip";
import { PositionTrend } from "./PositionTrend";
import type { PositionHistoryContext } from "./PositionHistoryPopover";
import {
  KeywordCell,
  PlayAcquisitionsCell,
  PositionCell,
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
  difficultyFooter,
  keywordCountFooter,
  movedFooter,
  popularityFooter,
  positionFooter,
} from "./KeywordTotalsFooters";
import { DerivedScoreCell, ScoreCell } from "./score-cells";
import {
  hasFloorAnswer,
  isScoreOutdated,
  scoreValue,
  shownScore,
} from "@/lib/keyword-scores";
import {
  difficultySignalLines,
  lowerConfidenceLines,
  popularitySignalLines,
} from "./score-signals";
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

export const SELECT_ALL_KEYWORDS = "Select all keywords";

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
  onOpenSerp,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  multiMarket: boolean;
  today: string;
  onOpenSerp: (keywordId: string) => void;
}) {
  return columnHelper.columns([
    ...identityColumns(),
    positionColumn(today, { appId, store, homeCountry, multiMarket }),
    deltaColumn(),
    ...scoreColumns(),
    insightsColumn(today, multiMarket),
    ...(store === "GOOGLE_PLAY" ? [acquisitionsColumn()] : []),
    topAppsColumn(onOpenSerp),
    ...attributeColumns(),
    volatilityColumn(),
    addedColumn(),
    competitorsColumn(),
    revealColumn(),
    actionsColumn({ appId, onOpenSerp }),
    ...filterColumns(),
  ]);
}

function identityColumns() {
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
          aria-label={SELECT_ALL_KEYWORDS}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.text}`}
        />
      ),
    }),
    columnHelper.accessor("text", {
      id: "keyword",
      enableHiding: false,
      sortFn: "text",
      sortDescFirst: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Keyword" />
      ),
      footer: keywordCountFooter,
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

function positionColumn(today: string, history: PositionHistoryContext) {
  return columnHelper.accessor((row) => nullsLast(row.latestPosition), {
    id: "position",
    meta: { label: "Position", phone: true },
    ...SORTABLE,
    sortDescFirst: false,
    filterFn: (row, _id, selected: PositionBand[]) =>
      positionBandIn(
        row.original.latestPosition,
        row.original.latestDepth,
        selected,
      ),
    header: ({ column }) => <SortableHeader column={column} label="Position" />,
    footer: positionFooter,
    cell: ({ row }) => (
      <PositionCell keyword={row.original} today={today} history={history} />
    ),
  });
}

function deltaColumn() {
  return columnHelper.accessor(
    (row) => (row.positionDelta7d === null ? undefined : -row.positionDelta7d),
    {
      id: "delta7d",
      meta: { label: "Last 7 days" },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <SortableHeader column={column} label="Last 7 days" />
      ),
      footer: movedFooter,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <PositionTrend checks={row.original.recentPositions} />
          <DeltaChip
            value={row.original.positionDelta7d}
            period="over 7 days"
          />
        </span>
      ),
    },
  );
}

function scoreColumns() {
  return [
    columnHelper.accessor((row) => nullsLast(row.opportunity), {
      id: "opportunity",
      meta: { label: "Opportunity", phone: true, numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("opportunity"),
      header: ({ column }) => (
        <SortableHeader column={column} label="Opportunity" />
      ),
      cell: ({ row }) => (
        <DerivedScoreCell
          value={scoreValue(row.original, "opportunity")}
          label="Opportunity"
          metric="opportunity"
          emphasize
          lowerConfidence={hasFloorAnswer(row.original)}
          details={lowerConfidenceLines(
            "opportunity",
            row.original.scoreSignals ?? null,
          )}
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "traffic")), {
      id: "traffic",
      meta: { label: "Popularity", numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("popularity"),
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label="Popularity" />
          <InfoTip
            label="About popularity"
            title="Popularity"
            summary={`${SCORE_COMPARABILITY}.`}
          />
        </span>
      ),
      footer: popularityFooter,
      cell: ({ row }) => (
        <ScoreCell
          value={scoreValue(row.original, "traffic")}
          label="Popularity"
          metric="popularity"
          provenance={row.original.scoreProvenance}
          details={popularitySignalLines(
            row.original.scoreSignals ?? null,
            row.original.scoreProvenance?.source,
            scoreValue(row.original, "traffic"),
          )}
          outdated={isScoreOutdated(row.original)}
          floorAnswer={hasFloorAnswer(row.original)}
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "difficulty")), {
      id: "difficulty",
      meta: { label: "Difficulty", numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("difficulty"),
      header: ({ column }) => (
        <SortableHeader column={column} label="Difficulty" />
      ),
      footer: difficultyFooter,
      cell: ({ row }) => (
        <ScoreCell
          value={scoreValue(row.original, "difficulty")}
          label="Difficulty"
          metric="difficulty"
          provenance={row.original.scoreProvenance}
          details={difficultySignalLines(row.original.scoreSignals ?? null)}
          outdated={isScoreOutdated(row.original)}
        />
      ),
    }),
  ];
}

function acquisitionsColumn() {
  return columnHelper.accessor(
    (row) => nullsLast(row.playAcquisitions?.acquisitions ?? null),
    {
      id: "acquisitions",
      meta: { label: "Play installs", numeric: true },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label="Play installs" />
          <PlayInstallsTip />
        </span>
      ),
      cell: ({ row }) => (
        <PlayAcquisitionsCell value={row.original.playAcquisitions ?? null} />
      ),
    },
  );
}

function actionsColumn({
  appId,
  onOpenSerp,
}: {
  appId: string;
  onOpenSerp: (keywordId: string) => void;
}) {
  return columnHelper.display({
    id: "actions",
    enableHiding: false,
    header: () => <span className="sr-only">Actions</span>,
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
