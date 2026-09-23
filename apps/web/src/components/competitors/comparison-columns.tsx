"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { nullsLast } from "@/lib/table/sorting";
import { cn } from "@/lib/utils";
import type { ComparisonTableFeatures } from "./comparison-table-features";
import { comparisonScoreLabel } from "./comparison-scores";
import { positionBand } from "./position-band";

export interface MatrixCompetitor {
  id: string;
  name: string | null;
  iconUrl: string | null;
}

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
  const band = positionBand(value);
  return (
    <span
      title={band ? `Position ${value} — ${band.label}` : "Not ranking"}
      style={
        band
          ? {
              backgroundColor: `color-mix(in oklch, ${band.token} 22%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "numeric font-mono inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5",
        value === null && "text-muted-foreground",
        best && "font-semibold underline decoration-2 underline-offset-4",
      )}
    >
      {formatRankPosition(value)}
    </span>
  );
}

function KeywordCell({ row }: { row: KeywordComparisonRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-2 font-medium">
        {row.text}
        {row.gap ? (
          <Badge variant="outline" className="border-warning/40 text-warning">
            Gap
          </Badge>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground numeric font-mono">
        <abbr title="Popularity">P</abbr> {comparisonScoreLabel(row, "traffic")}{" "}
        · <abbr title="Difficulty">D</abbr>{" "}
        {comparisonScoreLabel(row, "difficulty")}
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
      header: "Keyword",
      cell: ({ row }) => <KeywordCell row={row.original} />,
    }),
    columnHelper.accessor((row) => nullsLast(row.you), {
      id: "you",
      header: "You",
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
          header: () => (
            <span className="inline-flex items-center gap-1.5">
              <AppIcon
                src={competitor.iconUrl}
                name={competitor.name}
                size={20}
              />
              <span className="max-w-32 truncate">
                {competitor.name ?? "Competitor"}
              </span>
            </span>
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
  ]);
}
