"use client";

import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
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
import { revealLabel, revealRank, revealWords } from "./score-signals";
import { TopAppsCell } from "./TopAppsCell";
import {
  keywordColumnHelper as columnHelper,
  SORTABLE,
} from "./keyword-column-helper";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export function addedColumn(t: MessageTranslator = english) {
  return columnHelper.accessor((row) => nullsLast(row.trackedAt ?? null), {
    id: "added",
    meta: { label: t("table.added"), hiddenByDefault: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <SortableHeader column={column} label={t("table.added")} />
    ),
    cell: ({ row }) => <AddedCell trackedAt={row.original.trackedAt ?? null} />,
  });
}

export function revealColumn(t: MessageTranslator = english) {
  const words = revealWords(t);
  return columnHelper.accessor(
    (row) => nullsLast(revealRank(row.scoreSignals ?? null)),
    {
      id: "reveal",
      meta: { label: t("table.reveal"), hiddenByDefault: true },
      ...SORTABLE,
      sortDescFirst: false,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label={t("table.reveal")} />
          <InfoTip
            label={t("table.aboutReveal")}
            title={t("table.revealTitle")}
            summary={t("table.revealSummary", {
              full: words.full,
              absent: words.absent,
              dash: words.dash,
            })}
          />
        </span>
      ),
      cell: ({ row }) => (
        <RevealCell
          label={revealLabel(row.original.scoreSignals ?? null, t)}
          t={t}
        />
      ),
    },
  );
}

export function competitorsColumn(t: MessageTranslator = english) {
  return columnHelper.accessor(
    (row) => nullsLast(row.competitorsInTop10 ?? null),
    {
      id: "competitors",
      meta: {
        label: t("table.competitorsTop10"),
        hiddenByDefault: true,
        numeric: true,
      },
      ...SORTABLE,
      sortDescFirst: true,
      header: ({ column }) => (
        <span className="inline-flex items-center gap-1">
          <SortableHeader column={column} label={t("table.competitorsTop10")} />
          <InfoTip
            label={t("table.aboutCompetitorsTop10")}
            title={t("table.competitorsTop10Title")}
            summary={t("table.competitorsTop10Summary")}
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

export function insightsColumn(
  today: string,
  multiMarket: boolean,
  t: MessageTranslator = english,
) {
  return columnHelper.accessor((row) => insightsOf(row, today).length, {
    id: "insights",
    meta: { label: t("table.insights") },
    enableSorting: false,
    header: () => (
      <span className="inline-flex items-center gap-1">
        <span>{t("table.insights")}</span>
        <InsightsTip t={t} />
      </span>
    ),
    cell: ({ row }) => (
      <InsightsCell
        keyword={row.original}
        today={today}
        multiMarket={multiMarket}
        t={t}
      />
    ),
  });
}

export function volatilityColumn(t: MessageTranslator = english) {
  return columnHelper.accessor((row) => nullsLast(row.serpVolatility7d), {
    id: "volatility",
    meta: {
      label: t("table.volatility"),
      numeric: true,
      hiddenByDefault: true,
    },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <span className="inline-flex items-center gap-1">
        <SortableHeader column={column} label={t("table.volatility")} />
        <InfoTip
          label={t("table.aboutVolatility")}
          title={t("table.volatilityTitle")}
          summary={t("table.volatilitySummary")}
        />
      </span>
    ),
    cell: ({ row }) => <VolatilityCell value={row.original.serpVolatility7d} />,
  });
}

export function topAppsColumn(
  onOpenSerp: (keywordId: string) => void,
  t: MessageTranslator = english,
) {
  return columnHelper.accessor((row) => row.topApps ?? null, {
    id: "topApps",
    meta: { label: t("table.topApps") },
    enableSorting: false,
    header: () => <span>{t("table.topApps")}</span>,
    cell: ({ row }) => (
      <TopAppsCell
        keyword={row.original}
        onOpen={() => onOpenSerp(row.original.keywordId)}
        t={t}
      />
    ),
  });
}
