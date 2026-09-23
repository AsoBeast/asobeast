"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { GradedNumber, gradeWash } from "@/components/ui/graded";
import { grade, gradeLabel } from "@/lib/grade";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { versusOf, type Versus } from "@/lib/table/facets";
import { nullsLast, type SortDefaults } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import type { ComparisonTableFeatures } from "./comparison-table-features";
import { comparisonScore, type ComparisonScore } from "./comparison-scores";

export interface MatrixCompetitor {
  id: string;
  name: string | null;
  iconUrl: string | null;
}

export const COMPARISON_SORT_DEFAULTS: SortDefaults = {
  descFirst: new Set(["traffic", "difficulty"]),
};

export const HIDDEN_COMPARISON_COLUMNS = { versus: false };

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

const columnHelper = createColumnHelper<
  ComparisonTableFeatures,
  KeywordComparisonRow
>();

export function bestPosition(
  row: KeywordComparisonRow,
  competitorIds: readonly string[],
): number | null {
  const values = [
    row.you,
    ...competitorIds.map((cid) => row.positions[cid] ?? null),
  ];
  const found = values.filter((value): value is number => value !== null);
  return found.length > 0 ? Math.min(...found) : null;
}

function PositionCell({
  value,
  best,
}: {
  value: number | null;
  best: boolean;
}) {
  const graded = grade("position", value);
  return (
    <span
      data-grade={graded ?? undefined}
      title={
        graded ? `Position ${value}, ${gradeLabel(graded)}` : "Not ranking"
      }
      className={cn(
        "numeric font-mono inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5",
        graded ? gradeWash(graded) : "text-muted-foreground",
        best && "font-semibold underline decoration-2 underline-offset-4",
      )}
    >
      {formatRankPosition(value)}
    </span>
  );
}

const SCORE_LABEL: Record<ComparisonScore, string> = {
  traffic: "Popularity",
  difficulty: "Difficulty",
};

function ScoreCell({
  row,
  score,
}: {
  row: KeywordComparisonRow;
  score: ComparisonScore;
}) {
  const { label, grade: graded } = comparisonScore(row, score);
  return (
    <GradedNumber value={label} grade={graded} label={SCORE_LABEL[score]} />
  );
}

function KeywordCell({ row }: { row: KeywordComparisonRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-2 font-medium">
        <span title={row.text} className="max-w-32 truncate md:max-w-64">
          {row.text}
        </span>
        {row.gap ? (
          <Badge variant="outline" className="border-warning/40 text-warning">
            Gap
          </Badge>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        <abbr aria-hidden title={SCORE_LABEL.traffic}>
          P
        </abbr>{" "}
        <ScoreCell row={row} score="traffic" /> ·{" "}
        <abbr aria-hidden title={SCORE_LABEL.difficulty}>
          D
        </abbr>{" "}
        <ScoreCell row={row} score="difficulty" />
      </span>
    </div>
  );
}

export function comparisonColumns(competitors: readonly MatrixCompetitor[]) {
  const competitorIds = competitors.map((competitor) => competitor.id);
  const isBest = (row: KeywordComparisonRow, value: number | null) =>
    value !== null && value === bestPosition(row, competitorIds);

  return columnHelper.columns([
    columnHelper.accessor("text", {
      id: "keyword",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Keyword" />
      ),
      cell: ({ row }) => <KeywordCell row={row.original} />,
    }),
    columnHelper.accessor((row) => nullsLast(row.traffic), {
      id: "traffic",
      ...SCORE_SORT,
      meta: { label: "Popularity" },
      header: ({ column }) => (
        <SortableHeader column={column} label="Popularity" />
      ),
      cell: ({ row }) => <ScoreCell row={row.original} score="traffic" />,
    }),
    columnHelper.accessor((row) => nullsLast(row.difficulty), {
      id: "difficulty",
      ...SCORE_SORT,
      meta: { label: "Difficulty" },
      header: ({ column }) => (
        <SortableHeader column={column} label="Difficulty" />
      ),
      cell: ({ row }) => <ScoreCell row={row.original} score="difficulty" />,
    }),
    columnHelper.accessor((row) => nullsLast(row.you), {
      id: "you",
      ...POSITION_SORT,
      enableHiding: false,
      header: ({ column }) => <SortableHeader column={column} label="You" />,
      cell: ({ row }) => (
        <PositionCell
          value={row.original.you}
          best={isBest(row.original, row.original.you)}
        />
      ),
    }),
    ...competitors.map((competitor) =>
      columnHelper.accessor(
        (row) => nullsLast(row.positions[competitor.id] ?? null),
        {
          id: `c:${competitor.id}`,
          ...POSITION_SORT,
          enableHiding: false,
          header: ({ column }) => (
            <SortableHeader
              column={column}
              title={competitor.name ?? "Competitor"}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>
                    <AppIcon
                      src={competitor.iconUrl}
                      name={competitor.name}
                      size={20}
                    />
                  </span>
                  <span className="sr-only max-w-32 truncate md:not-sr-only">
                    {competitor.name ?? "Competitor"}
                  </span>
                </span>
              }
            />
          ),
          cell: ({ row }) => {
            const value = row.original.positions[competitor.id] ?? null;
            return (
              <PositionCell value={value} best={isBest(row.original, value)} />
            );
          },
        },
      ),
    ),
    columnHelper.accessor(
      (row) =>
        versusOf(
          row.you,
          competitorIds.map((cid) => row.positions[cid] ?? null),
        ) ?? undefined,
      {
        id: "versus",
        enableHiding: false,
        enableSorting: false,
        filterFn: (row, id, versus: Versus) =>
          row.getValue<Versus | undefined>(id) === versus,
      },
    ),
  ]);
}
