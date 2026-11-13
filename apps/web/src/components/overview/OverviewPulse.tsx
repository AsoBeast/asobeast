"use client";

import { Suspense, useDeferredValue } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  MetricStrip,
  StatTile,
  StatTileSkeleton,
} from "@/components/ui/stat-tile";
import { formatNumber, formatRating, pluralize } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions, ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
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

function shareNote(share: ShareOfVoice, nonBranded?: ShareOfVoice): string {
  if (share.current === null) return shareLine(share);
  const versus = competitorsCaption(share.competitors);
  return nonBranded?.current == null
    ? versus
    : `${versus} · ${formatShare(nonBranded.current)} non branded`;
}

const RATING_CHANGE_DIGITS = 2;

interface TileSelection {
  selected: boolean;
  onSelect: () => void;
}

function RatingChange({ id }: { id: string }) {
  const { data } = useQuery(
    ratingsHistoryOptions(id, presetToRange(RATING_CHANGE_RANGE)),
  );
  const change = data ? ratingChange(data.points, RATING_CHANGE_DAYS) : null;
  return change === null ? null : (
    <TrendChip
      label={`${RATING_CHANGE_DAYS}d`}
      value={change}
      digits={RATING_CHANGE_DIGITS}
      form="pill"
    />
  );
}

function RatingTile({
  id,
  selection,
}: {
  id: string;
  selection: TileSelection;
}) {
  const { market, home } = useMarket(id);
  const country = useDeferredValue(queryMarket(market, home));
  const { data: listing } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = listing.latestSnapshot;
  const average = snapshot?.ratingAvg ?? null;
  return (
    <StatTile
      {...selection}
      label="Rating"
      value={average === null ? "—" : formatRating(average)}
      delta={
        country === undefined && average !== null ? (
          <RatingChange id={id} />
        ) : null
      }
      note={ratingNote(average, snapshot?.ratingCount ?? null)}
    />
  );
}

function ratingNote(average: number | null, count: number | null): string {
  if (count !== null) return pluralize(count, "rating");
  return average === null ? "No rating captured yet" : "";
}

const top10Note = (summary: AppSummary): string =>
  `of ${formatNumber(summary.trackedKeywords)} tracked`;

export function OverviewPulse({ id }: { id: string }) {
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
          label="Visibility"
          value={formatNumber(Math.round(visibility.current))}
          delta={
            <TrendChip label="7d" value={visibility.delta7d} form="pill" />
          }
          note={<TrendChip label="30d" value={visibility.delta30d} />}
        />
        <StatTile
          {...tab("share")}
          label="Share of voice"
          value={share.current === null ? "—" : formatShare(share.current)}
          delta={
            share.current === null ? null : (
              <TrendChip
                label="7d"
                value={share.delta7d}
                digits={1}
                form="pill"
              />
            )
          }
          note={shareNote(share, summary.nonBrandedShareOfVoice)}
        />
        <StatTile
          {...tab("top10")}
          label="Keywords in top 10"
          value={formatNumber(summary.rankDistribution.top10)}
          note={top10Note(summary)}
        />
        <Suspense fallback={<StatTileSkeleton />}>
          <RatingTile id={id} selection={tab("rating")} />
        </Suspense>
      </MetricStrip>
      <OverviewChart id={id} view={shown} />
    </Card>
  );
}
