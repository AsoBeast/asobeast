"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { ListOrdered } from "lucide-react";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
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
  scoreValue,
  SortHeader,
  VolatilityCell,
} from "./keyword-cells";
import { SourceBadge } from "./SourceBadge";

const columnHelper = createColumnHelper<TrackedKeywordItem>();

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
  return [
    ...identityColumns(),
    positionColumn({ sort, onSort }),
    ...scoreColumns({ sort, onSort }),
    deltaColumn(),
    volatilityColumn({ sort, onSort }),
    actionsColumn({ appId, onOpenSerp }),
  ];
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
      header: "Source",
      cell: ({ row }) => <SourceBadge source={row.original.source} />,
    }),
  ];
}

function positionColumn({ sort, onSort }: SortState) {
  return columnHelper.accessor("latestPosition", {
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
    header: "Δ7d",
    cell: ({ row }) => (
      <DeltaChip value={row.original.positionDelta7d} period="over 7 days" />
    ),
  });
}

function scoreColumns({ sort, onSort }: SortState) {
  return [
    columnHelper.display({
      id: "traffic",
      header: () => (
        <SortHeader
          column="traffic"
          label="Traffic"
          active={sort === "traffic"}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <ScoreCell
          value={scoreValue(row.original, "traffic")}
          label="Traffic"
          tone="none"
          provenance={row.original.scoreProvenance}
        />
      ),
    }),
    columnHelper.display({
      id: "difficulty",
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
        />
      ),
    }),
    columnHelper.display({
      id: "opportunity",
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
  return columnHelper.accessor("serpVolatility7d", {
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
