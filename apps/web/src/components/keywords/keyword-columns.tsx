"use client";

import { createColumnHelper, type FilterFn } from "@tanstack/react-table";
import { ListOrdered } from "lucide-react";
import type {
  KeywordBucket,
  KeywordSource,
  TrackedKeywordItem,
} from "@asobeast/shared";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeltaChip } from "@/components/ui/delta-chip";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { KeywordRowActions } from "./KeywordRowActions";
import {
  DerivedScoreCell,
  PositionCell,
  ScoreCell,
  VolatilityCell,
} from "./keyword-cells";
import { isScoreOutdated, scoreValue, shownScore } from "./keyword-scores";
import { difficultySignalLines, popularitySignalLines } from "./score-signals";
import { SOURCE_LABELS, SourceBadge } from "./SourceBadge";
import type { Grade, GradeMetric } from "@/lib/grade";
import {
  gradeIn,
  oneOf,
  positionBandIn,
  statusFilter,
  type ActivityStatus,
  type PositionBand,
} from "@/lib/table/facets";
import { nullsLast, type SortDefaults } from "@/lib/table/sorting";

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  TrackedKeywordItem
>();

export const KEYWORD_SORT_DEFAULTS: SortDefaults = {
  descFirst: new Set([
    "traffic",
    "difficulty",
    "opportunity",
    "volatility",
    "delta7d",
  ]),
};

const SORTABLE = { sortUndefined: "last", sortFn: "basic" } as const;

export const HIDDEN_KEYWORD_COLUMNS = { bucket: false, status: false };

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
  onOpenSerp,
}: {
  appId: string;
  onOpenSerp: (keywordId: string) => void;
}) {
  return columnHelper.columns([
    ...identityColumns(),
    positionColumn(),
    ...scoreColumns(),
    deltaColumn(),
    volatilityColumn(),
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
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
          aria-label="Select all keywords"
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
      cell: ({ row }) => (
        <span className="flex max-w-64 items-center gap-2 font-medium">
          <span title={row.original.text} className="truncate">
            {row.original.text}
          </span>
          {!row.original.active ? (
            <Badge variant="secondary" className="shrink-0">
              Paused
            </Badge>
          ) : null}
        </span>
      ),
    }),
    columnHelper.accessor("source", {
      meta: { label: "Source" },
      sortFn: (a, b, id) =>
        SOURCE_LABELS[a.getValue<KeywordSource>(id)].localeCompare(
          SOURCE_LABELS[b.getValue<KeywordSource>(id)],
        ),
      sortDescFirst: false,
      filterFn: (row, id, selected: KeywordSource[]) =>
        oneOf(row.getValue<KeywordSource>(id), selected),
      header: ({ column }) => <SortableHeader column={column} label="Source" />,
      cell: ({ row }) => <SourceBadge source={row.original.source} />,
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
  ];
}

function positionColumn() {
  return columnHelper.accessor((row) => nullsLast(row.latestPosition), {
    id: "position",
    meta: { label: "Position" },
    ...SORTABLE,
    sortDescFirst: false,
    filterFn: (row, _id, selected: PositionBand[]) =>
      positionBandIn(
        row.original.latestPosition,
        row.original.latestDepth,
        selected,
      ),
    header: ({ column }) => <SortableHeader column={column} label="Position" />,
    cell: ({ row }) => <PositionCell keyword={row.original} />,
  });
}

function deltaColumn() {
  return columnHelper.accessor(
    (row) => (row.positionDelta7d === null ? undefined : -row.positionDelta7d),
    {
      id: "delta7d",
      meta: { label: "Δ7d" },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => <SortableHeader column={column} label="Δ7d" />,
      cell: ({ row }) => (
        <DeltaChip value={row.original.positionDelta7d} period="over 7 days" />
      ),
    },
  );
}

function scoreColumns() {
  return [
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "traffic")), {
      id: "traffic",
      meta: { label: "Popularity" },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("popularity"),
      header: ({ column }) => (
        <SortableHeader column={column} label="Popularity" />
      ),
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
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "difficulty")), {
      id: "difficulty",
      meta: { label: "Difficulty" },
      ...SORTABLE,
      sortDescFirst: true,
      filterFn: gradeFilter("difficulty"),
      header: ({ column }) => (
        <SortableHeader column={column} label="Difficulty" />
      ),
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
    columnHelper.accessor((row) => nullsLast(row.opportunity), {
      id: "opportunity",
      meta: { label: "Opportunity" },
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
        />
      ),
    }),
  ];
}

function volatilityColumn() {
  return columnHelper.accessor((row) => nullsLast(row.serpVolatility7d), {
    id: "volatility",
    meta: { label: "Volatility" },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <SortableHeader column={column} label="Volatility" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          How much the top 10 changed day to day over the last week. High churn
          means rankings here are unstable.
        </TooltipContent>
      </Tooltip>
    ),
    cell: ({ row }) => <VolatilityCell value={row.original.serpVolatility7d} />,
  });
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
    header: () => null,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-data-[state=open]:opacity-100 pointer-fine:opacity-0">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`View top 10 for ${row.original.text}`}
          onClick={() => onOpenSerp(row.original.keywordId)}
        >
          <ListOrdered />
        </Button>
        <KeywordRowActions appId={appId} keyword={row.original} />
      </div>
    ),
  });
}
