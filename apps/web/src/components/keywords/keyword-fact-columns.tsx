"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { nullsLast } from "@/lib/table/sorting";
import { insightsOf } from "@/lib/keyword-insights";
import { InsightsCell } from "./InsightsCell";
import { InsightsTip } from "./InsightsTip";
import {
  AddedCell,
  CompetitorsInTop10Cell,
  RevealCell,
  VolatilityCell,
} from "./keyword-cells";
import { REVEAL_WORDS, revealLabel, revealRank } from "./score-signals";
import { TopAppsCell } from "./TopAppsCell";
import {
  keywordColumnHelper as columnHelper,
  SORTABLE,
} from "./keyword-column-helper";

export function addedColumn() {
  return columnHelper.accessor((row) => nullsLast(row.trackedAt ?? null), {
    id: "added",
    meta: { label: "Added", hiddenByDefault: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => <SortableHeader column={column} label="Added" />,
    cell: ({ row }) => <AddedCell trackedAt={row.original.trackedAt ?? null} />,
  });
}

export function revealColumn() {
  return columnHelper.accessor(
    (row) => nullsLast(revealRank(row.scoreSignals ?? null)),
    {
      id: "reveal",
      meta: { label: "Reveal", hiddenByDefault: true },
      ...SORTABLE,
      sortDescFirst: false,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label="Reveal" />
          <InfoTip
            label="About the reveal"
            title="When the store suggests the keyword"
            summary={`How many letters a shopper types before the store suggests this keyword, and at which position of the suggestions. ${REVEAL_WORDS.full} means the store only suggests it once the whole phrase is typed, and ${REVEAL_WORDS.absent} means it never does. ${REVEAL_WORDS.dash} means the store could not answer, or the keyword has no stored score yet.`}
          />
        </span>
      ),
      cell: ({ row }) => (
        <RevealCell label={revealLabel(row.original.scoreSignals ?? null)} />
      ),
    },
  );
}

export function competitorsColumn() {
  return columnHelper.accessor(
    (row) => nullsLast(row.competitorsInTop10 ?? null),
    {
      id: "competitors",
      meta: {
        label: "Competitors in top 10",
        hiddenByDefault: true,
        numeric: true,
      },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label="Competitors in top 10" />
          <InfoTip
            label="About competitors in the top 10"
            title="Competitors in the top 10"
            summary="How many of your competitors rank in the top 10 of this keyword's newest stored search results. A dash means you track no competitors, or the keyword has no snapshot from today or yesterday."
          />
        </span>
      ),
      cell: ({ row }) => (
        <CompetitorsInTop10Cell
          value={row.original.competitorsInTop10 ?? null}
        />
      ),
    },
  );
}

export function insightsColumn(today: string, multiMarket: boolean) {
  return columnHelper.accessor((row) => insightsOf(row, today).length, {
    id: "insights",
    meta: { label: "Insights" },
    enableSorting: false,
    header: () => (
      <span className="inline-flex items-center gap-1">
        <span>Insights</span>
        <InsightsTip />
      </span>
    ),
    cell: ({ row }) => (
      <InsightsCell
        keyword={row.original}
        today={today}
        multiMarket={multiMarket}
      />
    ),
  });
}

export function volatilityColumn() {
  return columnHelper.accessor((row) => nullsLast(row.serpVolatility7d), {
    id: "volatility",
    meta: { label: "Volatility", numeric: true, hiddenByDefault: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <span className="inline-flex items-center gap-1">
        <SortableHeader column={column} label="Volatility" />
        <InfoTip
          label="About volatility"
          title="Volatility"
          summary="How much the top 10 changed day to day over the last week. High churn means rankings here are unstable."
        />
      </span>
    ),
    cell: ({ row }) => <VolatilityCell value={row.original.serpVolatility7d} />,
  });
}

export function topAppsColumn() {
  return columnHelper.accessor((row) => row.topApps ?? null, {
    id: "topApps",
    meta: { label: "Top apps" },
    enableSorting: false,
    header: "Top apps",
    cell: ({ row }) => <TopAppsCell apps={row.original.topApps} />,
  });
}
