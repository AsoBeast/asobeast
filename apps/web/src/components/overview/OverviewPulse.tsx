"use client";

import { Suspense, useDeferredValue } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  MetricStrip,
  StatTile,
  StatTileSkeleton,
} from "@/components/ui/stat-tile";
import type { TranslationContext } from "@/i18n/translator";
import { formatNumberInLocale, formatRatingInLocale } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions, ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { useAppLocale } from "@/lib/use-app-locale";
import type { VisibilityView } from "@/lib/search-params";
import { OverviewChart } from "./OverviewChart";
import {
  RATING_CHANGE_DAYS,
  RATING_CHANGE_RANGE,
  ratingChange,
} from "./rating-trend";
import { useOverviewView } from "./use-overview-view";
import {
  competitorsCaption,
  formatShare,
  shareLine,
} from "./share-of-voice-text";

function shareNote(
  share: ShareOfVoice,
  nonBranded: ShareOfVoice | undefined,
  context: TranslationContext,
): string {
  if (share.current === null) return shareLine(share, context);
  const versus = competitorsCaption(share.competitors, context.translator);
  return nonBranded?.current == null
    ? versus
    : `${versus} · ${context.translator("metrics.nonBranded", {
        value: formatShare(nonBranded.current, context.locale),
      })}`;
}

const RATING_CHANGE_DIGITS = 2;

interface TileSelection {
  selected: boolean;
  onSelect: () => void;
}

function RatingChange({
  id,
  translator,
}: {
  id: string;
  translator: TranslationContext["translator"];
}) {
  const { data } = useQuery(
    ratingsHistoryOptions(id, presetToRange(RATING_CHANGE_RANGE)),
  );
  const change = data ? ratingChange(data.points, RATING_CHANGE_DAYS) : null;
  return change === null ? null : (
    <TrendChip
      label={translator("charts.daysShort", { count: RATING_CHANGE_DAYS })}
      value={change}
      digits={RATING_CHANGE_DIGITS}
      form="pill"
    />
  );
}

function RatingTile({
  id,
  selection,
  context,
}: {
  id: string;
  selection: TileSelection;
  context: TranslationContext;
}) {
  const { market, home } = useMarket(id);
  const country = useDeferredValue(queryMarket(market, home));
  const { data: listing } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = listing.latestSnapshot;
  const average = snapshot?.ratingAvg ?? null;
  return (
    <StatTile
      {...selection}
      label={context.translator("metrics.rating")}
      value={
        average === null ? "—" : formatRatingInLocale(average, context.locale)
      }
      delta={
        country === undefined && average !== null ? (
          <RatingChange id={id} translator={context.translator} />
        ) : null
      }
      note={ratingNote(average, snapshot?.ratingCount ?? null, context)}
    />
  );
}

function ratingNote(
  average: number | null,
  count: number | null,
  context: TranslationContext,
): string {
  if (count !== null)
    return context.translator("metrics.ratingCount", { count });
  return average === null ? context.translator("metrics.noRating") : "";
}

const top10Note = (summary: AppSummary, context: TranslationContext): string =>
  context.translator("metrics.tracked", { count: summary.trackedKeywords });

export function OverviewPulse({ id }: { id: string }) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const context = { translator: t, locale };
  const { summary, share, view: shown, select } = useOverviewView(id);
  const { visibility } = summary;
  const tab = (value: VisibilityView): TileSelection => ({
    selected: shown === value,
    onSelect: () => select(value),
  });

  return (
    <Card className="gap-0 py-0">
      <MetricStrip columns={4} framed={false}>
        <StatTile
          {...tab("visibility")}
          label={t("metrics.visibility")}
          value={formatNumberInLocale(Math.round(visibility.current), locale)}
          delta={
            <TrendChip
              label={t("charts.daysShort", { count: 7 })}
              value={visibility.delta7d}
              form="pill"
            />
          }
          note={
            <TrendChip
              label={t("charts.daysShort", { count: 30 })}
              value={visibility.delta30d}
            />
          }
        />
        <StatTile
          {...tab("share")}
          label={t("metrics.shareOfVoice")}
          value={
            share.current === null ? "—" : formatShare(share.current, locale)
          }
          delta={
            share.current === null ? null : (
              <TrendChip
                label={t("charts.daysShort", { count: 7 })}
                value={share.delta7d}
                digits={1}
                form="pill"
              />
            )
          }
          note={shareNote(share, summary.nonBrandedShareOfVoice, context)}
        />
        <StatTile
          {...tab("top10")}
          label={t("metrics.top10")}
          value={formatNumberInLocale(summary.rankDistribution.top10, locale)}
          note={top10Note(summary, context)}
        />
        <Suspense fallback={<StatTileSkeleton />}>
          <RatingTile id={id} selection={tab("rating")} context={context} />
        </Suspense>
      </MetricStrip>
      <OverviewChart id={id} view={shown} />
    </Card>
  );
}
