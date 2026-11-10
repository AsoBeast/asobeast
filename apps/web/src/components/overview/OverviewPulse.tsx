"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import { useKeywordScope, useMarket } from "@/components/app-detail/use-market";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  StatTile,
  StatTileGroup,
  StatTileSkeleton,
} from "@/components/ui/stat-tile";
import { formatNumber, formatRating, pluralize } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions, appSummaryOptions } from "@/lib/queries";
import { visibilityViewParser, type VisibilityView } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { PULSE_COLUMNS, PULSE_STRIP } from "./layout-classes";
import { OverviewChart } from "./OverviewChart";
import {
  competitorsCaption,
  formatShare,
  shareLine,
} from "./share-of-voice-text";

function Figure({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{value}</span>
      {children}
    </span>
  );
}

function shareNote(share: ShareOfVoice, nonBranded?: ShareOfVoice): string {
  if (share.current === null) return shareLine(share);
  const versus = competitorsCaption(share.competitors);
  return nonBranded?.current == null
    ? versus
    : `${versus} · ${formatShare(nonBranded.current)} non branded`;
}

function RatingTile({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  const country = useDeferredValue(queryMarket(market, home));
  const { data: listing } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = listing.latestSnapshot;
  const rated = snapshot?.ratingAvg != null;
  return (
    <StatTile
      label="Rating"
      value={rated ? formatRating(snapshot.ratingAvg ?? 0) : "—"}
      note={
        snapshot?.ratingCount != null
          ? pluralize(snapshot.ratingCount, "rating")
          : "No rating captured yet"
      }
    />
  );
}

const top10Note = (summary: AppSummary): string =>
  `of ${formatNumber(summary.trackedKeywords)} tracked`;

export function OverviewPulse({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const [view, setView] = useQueryState("visView", visibilityViewParser);
  const { visibility, shareOfVoice: share } = summary;
  const shown: VisibilityView =
    view === "share" && !share ? "visibility" : view;
  const tab = (value: VisibilityView) => ({
    selected: shown === value,
    onSelect: () => void setView(value),
  });

  return (
    <Card className="gap-0 py-0">
      <StatTileGroup className={cn(PULSE_STRIP, PULSE_COLUMNS[share ? 4 : 3])}>
        <StatTile
          {...tab("visibility")}
          label="Visibility"
          value={
            <Figure value={formatNumber(Math.round(visibility.current))}>
              <TrendChip label="7d" value={visibility.delta7d} form="pill" />
            </Figure>
          }
          note={<TrendChip label="30d" value={visibility.delta30d} />}
        />
        {share ? (
          <StatTile
            {...tab("share")}
            label="Share of voice"
            value={
              share.current === null ? (
                <Figure value="—" />
              ) : (
                <Figure value={formatShare(share.current)}>
                  <TrendChip
                    label="7d"
                    value={share.delta7d}
                    digits={1}
                    form="pill"
                  />
                </Figure>
              )
            }
            note={shareNote(share, summary.nonBrandedShareOfVoice)}
          />
        ) : null}
        <StatTile
          {...tab("top10")}
          label="Keywords in top 10"
          value={
            <Figure value={formatNumber(summary.rankDistribution.top10)} />
          }
          note={top10Note(summary)}
        />
        <Suspense fallback={<StatTileSkeleton />}>
          <RatingTile id={id} />
        </Suspense>
      </StatTileGroup>
      <OverviewChart id={id} view={shown} />
    </Card>
  );
}
