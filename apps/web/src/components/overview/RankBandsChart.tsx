"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { bandCounts, topTenOf } from "@/components/charts/rank-bands";
import {
  PLOTTED_BANDS,
  RankBandsPlot,
} from "@/components/charts/RankBandsPlot";
import { CHART_HEIGHT } from "@/components/charts/theme";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { Locale } from "@/lib/locale";
import {
  appSummaryOptions,
  rankDistributionHistoryOptions,
} from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";

const HEIGHT = CHART_HEIGHT.tall;

function BandKey({
  id,
  translator,
  locale,
}: {
  id: string;
  translator: MessageTranslator;
  locale: Locale;
}) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const counts = bandCounts(summary.rankDistribution);
  return (
    <ul
      aria-label={translator("charts.rankBandsAria")}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {PLOTTED_BANDS.map((band) => (
        <li key={band.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: band.color }}
          />
          <span>{band.label}</span>
          <span className="numeric font-medium text-foreground">
            {formatNumberInLocale(counts[band.key], locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RankBandsChart({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { country } = useKeywordScope(id);
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(
    rankDistributionHistoryOptions(id, presetToRange(range), country),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title={t("charts.noRankHistoryTitle")}
        body={t("charts.noRankHistoryBody")}
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={HEIGHT}
        label={t("charts.top10Label")}
        value={formatNumberInLocale(topTenOf(latest), locale)}
        note={t("charts.trendNeedsChecks")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BandKey id={id} translator={t} locale={locale} />
      <RankBandsPlot points={data.points} label={t("charts.rankBandsLabel")} />
    </div>
  );
}
