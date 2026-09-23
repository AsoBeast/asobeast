"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { ListOrdered } from "lucide-react";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
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
import { KeywordRowActions } from "./KeywordRowActions";
import {
  DerivedScoreCell,
  PositionCell,
  ScoreCell,
  SortHeader,
  VolatilityCell,
} from "./keyword-cells";
import { isScoreOutdated, scoreValue } from "./keyword-scores";
import { difficultySignalLines, popularitySignalLines } from "./score-signals";
import { SourceBadge } from "./SourceBadge";
import { nullsLast, type SortDefaults } from "@/lib/table/sorting";

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  TrackedKeywordItem
>();

export const KEYWORD_SORT_DEFAULTS: SortDefaults = {
  descFirst: new Set(["traffic", "difficulty", "opportunity", "volatility"]),
};

const SORTABLE = { sortUndefined: "last", sortFn: "basic" } as const;

interface SortState {
  sort: KeywordSort | null;
  onSort: (column: KeywordSort) => void;
}

export function keywordColumns({
  appId,
  sort,
  onSort,
  onOpenSerp,
}: SortState & {
  appId: string;
  onOpenSerp: (keywordId: string) => void;
}) {
  return columnHelper.columns([
    ...identityColumns(),
    positionColumn({ sort, onSort }),
    ...scoreColumns({ sort, onSort }),
    deltaColumn(),
    volatilityColumn({ sort, onSort }),
    actionsColumn({ appId, onOpenSerp }),
  ]);
}

function identityColumns() {
  return [
    columnHelper.display({
      id: "select",
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
      enableSorting: false,
      header: "Keyword",
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
      enableSorting: false,
      header: "Source",
      cell: ({ row }) => <SourceBadge source={row.original.source} />,
    }),
  ];
}

function positionColumn({ sort, onSort }: SortState) {
  return columnHelper.accessor((row) => nullsLast(row.latestPosition), {
    id: "position",
    ...SORTABLE,
    sortDescFirst: false,
    header: () => (
      <SortHeader
        column="position"
        label="Position"
        active={sort === "position"}
        onSort={onSort}
      />
    ),
    cell: ({ row }) => <PositionCell keyword={row.original} />,
  });
}

function deltaColumn() {
  return columnHelper.accessor("positionDelta7d", {
    enableSorting: false,
    header: "Δ7d",
    cell: ({ row }) => (
      <DeltaChip value={row.original.positionDelta7d} period="over 7 days" />
    ),
  });
}

function scoreColumns({ sort, onSort }: SortState) {
  return [
    columnHelper.accessor((row) => nullsLast(scoreValue(row, "traffic")), {
      id: "traffic",
      ...SORTABLE,
      sortDescFirst: true,
      header: () => (
        <SortHeader
          column="traffic"
          label="Popularity"
          active={sort === "traffic"}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <ScoreCell
          value={scoreValue(row.original, "traffic")}
          label="Popularity"
          tone="none"
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
      ...SORTABLE,
      sortDescFirst: true,
      header: () => (
        <SortHeader
          column="difficulty"
          label="Difficulty"
          active={sort === "difficulty"}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <ScoreCell
          value={scoreValue(row.original, "difficulty")}
          label="Difficulty"
          provenance={row.original.scoreProvenance}
          details={difficultySignalLines(row.original.scoreSignals ?? null)}
          outdated={isScoreOutdated(row.original)}
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(row.opportunity), {
      id: "opportunity",
      ...SORTABLE,
      sortDescFirst: true,
      header: () => (
        <SortHeader
          column="opportunity"
          label="Opportunity"
          active={sort === "opportunity"}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <DerivedScoreCell
          value={scoreValue(row.original, "opportunity")}
          label="Opportunity"
          emphasize
        />
      ),
    }),
  ];
}

function volatilityColumn({ sort, onSort }: SortState) {
  return columnHelper.accessor((row) => nullsLast(row.serpVolatility7d), {
    id: "volatility",
    ...SORTABLE,
    sortDescFirst: true,
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <SortHeader
            column="volatility"
            label="Volatility"
            active={sort === "volatility"}
            onSort={onSort}
          />
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
