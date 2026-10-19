"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { GradedNumber, gradeWash } from "@/components/ui/graded";
import { formatCountry } from "@/lib/format";
import { grade } from "@/lib/grade";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { versusOf, type Versus } from "@/lib/table/facets";
import { nullsLast } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import {
  comparisonScore,
  UNNAMED_COMPETITOR,
  type ComparisonScore,
} from "./comparison-scores";

interface MatrixCompetitor {
  id: string;
  name: string | null;
  iconUrl: string | null;
}

export const HIDDEN_COMPARISON_COLUMNS = { versus: false };

export interface MatrixScope {
  multiMarket: boolean;
}

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
  DataTableFeatures,
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

export function PositionCell({
  value,
  best,
}: {
  value: number | null;
  best: boolean;
}) {
  const graded = grade("position", value);
  const pill = cn(
    "inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5",
    best && "font-semibold underline decoration-2 underline-offset-4",
  );
  if (graded === null) {
    return (
      <span
        title="Not ranking"
        className={cn(pill, "numeric font-mono text-muted-foreground")}
      >
        <span aria-hidden>{formatRankPosition(value)}</span>
        <span className="sr-only">Not ranking</span>
      </span>
    );
  }
  return (
    <GradedNumber
      value={formatRankPosition(value)}
      grade={graded}
      label="Position"
      className={cn(pill, "text-foreground", gradeWash(graded))}
    />
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

const SCORES: readonly ComparisonScore[] = ["traffic", "difficulty"];

const SCORE_ABBR: Record<ComparisonScore, string> = {
  traffic: "P",
  difficulty: "D",
};

function KeywordCell({
  row,
  scores,
  market,
  onOpenBreakdown,
}: {
  row: KeywordComparisonRow;
  scores: readonly ComparisonScore[];
  market: string | null;
  onOpenBreakdown: (keywordId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-2 font-medium">
        <button
          type="button"
          title={row.text}
          aria-label={`${row.text}, why apps rank`}
          data-breakdown-keyword={row.keywordId}
          onClick={() => onOpenBreakdown(row.keywordId)}
          className="max-w-32 truncate rounded-sm text-left font-medium underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:decoration-primary md:max-w-64"
        >
          {row.text}
        </button>
        {row.gap ? (
          <Badge variant="outline" className="border-warning/40 text-warning">
            Gap
          </Badge>
        ) : null}
      </span>
      {market !== null || scores.length > 0 ? (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {market === null ? null : <MarketCell country={market} />}
          {scores.map((score) => (
            <span key={score}>
              <abbr aria-hidden title={SCORE_LABEL[score]}>
                {SCORE_ABBR[score]}
              </abbr>{" "}
              <ScoreCell row={row} score={score} />
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function MarketCell({ country }: { country: string }) {
  const name = formatCountry(country);
  return (
    <span title={name} className="font-mono text-xs text-muted-foreground">
      <span aria-hidden>{country.toUpperCase()}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

function CompetitorHeading({ competitor }: { competitor: MatrixCompetitor }) {
  return (
    <span className="flex flex-col items-center gap-1 md:w-24">
      <span aria-hidden>
        <AppIcon src={competitor.iconUrl} name={competitor.name} size={20} />
      </span>
      <span className="sr-only md:not-sr-only">
        <span className="line-clamp-2 text-center break-words whitespace-normal">
          {competitor.name ?? UNNAMED_COMPETITOR}
        </span>
      </span>
    </span>
  );
}

export function comparisonColumns(
  competitors: readonly MatrixCompetitor[],
  onOpenBreakdown: (keywordId: string) => void,
  scope: MatrixScope,
) {
  const competitorIds = competitors.map((competitor) => competitor.id);
  const isBest = (row: KeywordComparisonRow, value: number | null) =>
    value !== null && value === bestPosition(row, competitorIds);

  return columnHelper.columns([
    columnHelper.accessor("country", {
      id: "market",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: "Market" },
      header: ({ column }) => <SortableHeader column={column} label="Market" />,
      cell: ({ row }) => <MarketCell country={row.original.country} />,
      filterFn: (row, id, country: string) =>
        row.getValue<string>(id) === country,
    }),
    columnHelper.accessor("text", {
      id: "keyword",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label="Keyword" />
      ),
      cell: ({ row, table }) => (
        <KeywordCell
          row={row.original}
          onOpenBreakdown={onOpenBreakdown}
          market={
            scope.multiMarket && !table.getColumn("market")?.getIsVisible()
              ? row.original.country
              : null
          }
          scores={SCORES.filter(
            (score) => !table.getColumn(score)?.getIsVisible(),
          )}
        />
      ),
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
              title={competitor.name ?? UNNAMED_COMPETITOR}
              label={<CompetitorHeading competitor={competitor} />}
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
