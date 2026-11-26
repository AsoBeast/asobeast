"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import type { MessageTranslator } from "@/i18n/translator";
import { versusOf, type Versus } from "@/lib/table/facets";
import { nullsLast } from "@/lib/table/sorting";
import { isChecked } from "./comparison-checks";
import {
  COMPARISON_SCORES,
  CompetitorHeading,
  HeadToHeadTotal,
  INLINE_HEADING_LIMIT,
  KeywordCell,
  MarketCell,
  PositionCell,
  ScoreCell,
  TopTenTotal,
  type MatrixCompetitor,
} from "./comparison-cells";
import { headToHead, keywordCountText, topTenCount } from "./comparison-totals";

export const HIDDEN_COMPARISON_COLUMNS = { versus: false };

export interface MatrixScope {
  appId: string;
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

const shownRows = (
  rows: readonly { original: KeywordComparisonRow }[],
): KeywordComparisonRow[] => rows.map((row) => row.original);

export function comparisonColumns(
  competitors: readonly MatrixCompetitor[],
  onOpenBreakdown: (keywordId: string, opener: HTMLElement) => void,
  scope: MatrixScope,
  copy: { t: MessageTranslator },
) {
  const { t } = copy;
  const competitorIds = competitors.map((competitor) => competitor.id);
  const isBest = (row: KeywordComparisonRow, value: number | null) =>
    value !== null && value === bestPosition(row, competitorIds);

  return columnHelper.columns([
    columnHelper.accessor("country", {
      id: "market",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: t("comparison.market") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("comparison.market")} />
      ),
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
        <SortableHeader column={column} label={t("comparison.keyword")} />
      ),
      footer: ({ table }) => (
        <span>{keywordCountText(table.getRowModel().rows.length, t)}</span>
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
          scores={COMPARISON_SCORES.filter(
            (score) => !table.getColumn(score)?.getIsVisible(),
          )}
        />
      ),
    }),
    columnHelper.accessor((row) => nullsLast(row.traffic), {
      id: "traffic",
      ...SCORE_SORT,
      meta: { label: t("comparison.popularity"), numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("comparison.popularity")} />
      ),
      cell: ({ row }) => <ScoreCell row={row.original} score="traffic" />,
    }),
    columnHelper.accessor((row) => nullsLast(row.difficulty), {
      id: "difficulty",
      ...SCORE_SORT,
      meta: { label: t("comparison.difficulty"), numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("comparison.difficulty")} />
      ),
      cell: ({ row }) => <ScoreCell row={row.original} score="difficulty" />,
    }),
    columnHelper.accessor((row) => nullsLast(row.you), {
      id: "you",
      ...POSITION_SORT,
      enableHiding: false,
      meta: { numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("comparison.you")} />
      ),
      footer: ({ table }) => (
        <TopTenTotal
          count={topTenCount(shownRows(table.getRowModel().rows), scope.appId)}
        />
      ),
      cell: ({ row }) => (
        <PositionCell
          value={row.original.you}
          best={isBest(row.original, row.original.you)}
          checked={isChecked(row.original, scope.appId)}
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
          meta: { numeric: true },
          footer: ({ table }) => (
            <HeadToHeadTotal
              totals={headToHead(
                shownRows(table.getRowModel().rows),
                scope.appId,
                competitor.id,
              )}
            />
          ),
          header: ({ column }) => (
            <SortableHeader
              column={column}
              title={competitor.name ?? t("unnamed")}
              label={
                <CompetitorHeading
                  competitor={competitor}
                  stacked={competitors.length > INLINE_HEADING_LIMIT}
                />
              }
            />
          ),
          cell: ({ row }) => {
            const value = row.original.positions[competitor.id] ?? null;
            return (
              <PositionCell
                value={value}
                best={isBest(row.original, value)}
                checked={isChecked(row.original, competitor.id)}
              />
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
