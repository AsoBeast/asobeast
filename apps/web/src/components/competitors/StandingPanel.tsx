"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type {
  CompetitorAnalysis,
  CompetitorMetadataRow,
  PositionMapPoint,
  Store,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { FOOTER_LINK, LIST_HEAD } from "@/components/layout/panel-classes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { GradedNumber } from "@/components/ui/graded";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import {
  appDetailOptions,
  competitorAnalysisOptions,
  competitorsOptions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { UNNAMED_COMPETITOR } from "./comparison-scores";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { SECTION_EMPTY, SECTION_FOOTER, SECTION_SHEET } from "./section-layout";
import { StandingSkeleton } from "./skeletons";
import {
  barShare,
  hasRival,
  listingLines,
  STANDING_VIEW_LABELS,
  STANDING_VIEWS,
  standingRows,
  type StandingView,
} from "./standing";

const VISIBILITY_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_3.5rem_4rem] items-center gap-3 px-2";

type Icons = ReadonlyMap<string, string | null>;

function AppName({
  appId,
  name,
  isYou,
  icons,
  size,
}: {
  appId: string;
  name: string | null;
  isYou: boolean;
  icons: Icons;
  size: number;
}) {
  return (
    <span className="relative flex min-w-0 items-center gap-2">
      <span aria-hidden className="shrink-0">
        <AppIcon src={icons.get(appId) ?? null} size={size} />
      </span>
      <bdi className="line-clamp-2 font-medium wrap-anywhere">
        {name ?? UNNAMED_COMPETITOR}
      </bdi>
      {isYou ? <Badge variant="brand">You</Badge> : null}
    </span>
  );
}

function VisibilityList({
  points,
  icons,
}: {
  points: readonly PositionMapPoint[];
  icons: Icons;
}) {
  return (
    <div className="px-2 pb-3">
      <div aria-hidden className={cn(VISIBILITY_COLUMNS, LIST_HEAD, "pb-2")}>
        <span>App</span>
        <span className="text-right">Rating</span>
        <span className="text-right">Visibility</span>
      </div>
      <ul aria-label="Visibility by app">
        {standingRows(points).map((point) => (
          <li
            key={point.appId}
            className={cn(
              VISIBILITY_COLUMNS,
              "min-h-10 py-1 text-dense leading-tight sm:min-h-9",
            )}
          >
            <span className="relative flex h-full min-w-0 items-center">
              <span
                aria-hidden
                className="absolute inset-y-1 -left-2 rounded-md bg-chart-tint"
                style={{ width: `${barShare(point.visibility)}%` }}
              />
              <AppName {...point} icons={icons} size={16} />
            </span>
            <span className="relative flex justify-end text-muted-foreground">
              {point.ratingAvg === null ? (
                <span>
                  <span aria-hidden>—</span>
                  <span className="sr-only">No rating</span>
                </span>
              ) : (
                <GradedNumber
                  value={formatRating(point.ratingAvg)}
                  grade={grade("rating", point.ratingAvg)}
                  label="Rating"
                  marker={false}
                />
              )}
            </span>
            <span className="numeric relative text-right font-medium">
              <span aria-hidden>{point.visibility.toFixed(1)}</span>
              <span className="sr-only">{`Visibility ${point.visibility.toFixed(1)}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListingText({
  rows,
  store,
  icons,
}: {
  rows: readonly CompetitorMetadataRow[];
  store: Store;
  icons: Icons;
}) {
  return (
    <ul aria-label="Listing text by app">
      {rows.map((row) => (
        <li
          key={row.appId}
          className="flex flex-col gap-1 border-b border-border-subtle px-(--card-spacing) py-3 text-dense last:border-b-0"
        >
          <AppName {...row} icons={icons} size={24} />
          <dl className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 pl-8">
            {listingLines(row, store).map((line) => (
              <div key={line.label} className="contents">
                <dt className="text-caption text-faint-foreground">
                  {line.label}
                </dt>
                <dd
                  dir="auto"
                  className={cn(
                    "wrap-anywhere",
                    line.text === null && "text-muted-foreground",
                  )}
                >
                  {line.text ?? `No ${line.label.toLowerCase()}`}
                </dd>
                <dd
                  className={cn(
                    "numeric text-right text-caption",
                    line.over ? "text-destructive" : "text-faint-foreground",
                  )}
                >
                  <span aria-hidden>{line.count}</span>
                  <span className="sr-only">{`${line.count.replace("/", " of ")} characters`}</span>
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function StandingContent({
  id,
  view,
  analysis,
  store,
  icons,
}: {
  id: string;
  view: StandingView;
  analysis: CompetitorAnalysis;
  store: Store;
  icons: Icons;
}) {
  const listings = [...analysis.metadataComparison].sort(
    (a, b) => Number(b.isYou) - Number(a.isYou),
  );
  const compared = view === "visibility" ? analysis.positionMap : listings;
  if (!hasRival(compared)) {
    return (
      <EmptyState
        className={SECTION_EMPTY}
        title="Nothing to compare yet"
        body="Add a competitor to see its visibility and listing text beside yours."
      />
    );
  }
  if (view === "text") {
    return (
      <div className={cn(SECTION_SHEET, "border-t-0")}>
        <ListingText rows={listings} store={store} icons={icons} />
        <p className={SECTION_FOOTER}>
          Home storefront listing, from each app’s latest snapshot
        </p>
      </div>
    );
  }
  return (
    <div className={cn(SECTION_SHEET, "border-t-0")}>
      <VisibilityList points={analysis.positionMap} icons={icons} />
      <p className={SECTION_FOOTER}>
        <span>
          Visibility over the keywords you track, from the latest checks
        </span>
        <Link href={`/apps/${id}?visView=share`} className={FOOTER_LINK}>
          Share of voice trend
        </Link>
      </p>
    </div>
  );
}

function StandingBody({ id, view }: { id: string; view: StandingView }) {
  const read = useQuery(competitorAnalysisOptions(id));
  const { data: app } = useQuery(appDetailOptions(id));
  const { data: competitors } = useQuery(competitorsOptions(id));
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="The comparison could not be loaded."
        read={read}
      />
    );
  }
  if (read.data === undefined || app === undefined) {
    return <StandingSkeleton />;
  }
  const icons = new Map<string, string | null>([
    [app.id, app.iconUrl],
    ...(competitors ?? []).map(
      (item) => [item.id, item.iconUrl] as [string, string | null],
    ),
  ]);
  return (
    <StandingContent
      id={id}
      view={view}
      analysis={read.data}
      store={app.store}
      icons={icons}
    />
  );
}

export function StandingPanel({ id }: { id: string }) {
  const [view, setView] = useState<StandingView>("visibility");
  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.standing}
      title="How you compare"
      actions={
        <Tabs
          value={view}
          onValueChange={(next) => setView(next as StandingView)}
        >
          <TabsList aria-label="Comparison">
            {STANDING_VIEWS.map((value) => (
              <TabsOption key={value} value={value}>
                {STANDING_VIEW_LABELS[value]}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <StandingBody id={id} view={view} />
    </CollapsibleCard>
  );
}
