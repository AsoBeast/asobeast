"use client";

import type { ReactNode } from "react";
import { NO_APPS_SENTENCE } from "@asobeast/shared";
import { MovementCell } from "@/components/movement/MovementCell";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompact, formatDayMonth, formatRating } from "@/lib/format";
import type {
  PlacementSummary,
  PositionSummary,
  RatingSummary,
  SerpSummaryFacts,
} from "./serp-summary";
import { serpRowId } from "./SerpRow";

const SEARCH_RESULTS_GUIDE =
  "https://docs.asobeast.com/guides/read-rankings#search-results";

const OUTLIERS_GUIDE =
  "https://docs.asobeast.com/guides/read-rankings#outliers";

function jumpToRow(position: number) {
  const row = document.getElementById(serpRowId(position));
  if (!row) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({
    block: "center",
    behavior: reduced ? "auto" : "smooth",
  });
  row.focus({ preventScroll: true });
}

function GuideLink({ href, text }: { href: string; text: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link-underline">
      {text}
    </a>
  );
}

const SEARCH_RESULTS_LINK = {
  href: SEARCH_RESULTS_GUIDE,
  text: "Read about search results",
};

const OUTLIERS_LINK = { href: OUTLIERS_GUIDE, text: "Read about outliers" };

function Item({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card p-3">
      <dt className="flex items-center gap-1 text-caption text-muted-foreground">
        <span>{label}</span>
        {tip}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        {children}
      </dd>
    </div>
  );
}

const Value = ({ children }: { children: ReactNode }) => (
  <span className="numeric text-body font-medium">{children}</span>
);

const Note = ({ children }: { children: ReactNode }) => (
  <span className="text-caption text-muted-foreground">{children}</span>
);

function PositionValue({
  position,
  comparedTo,
}: {
  position: PositionSummary;
  comparedTo: string | null;
}) {
  switch (position.kind) {
    case "listed":
      return (
        <>
          <Button
            variant="link"
            className="h-auto p-0 numeric text-body font-medium"
            aria-label={`Jump to your row at #${position.position}`}
            onClick={() => jumpToRow(position.position)}
          >
            #{position.position}
          </Button>
          <span className="text-caption">
            <MovementCell
              entry={position.moved}
              period={comparedTo ? `since ${formatDayMonth(comparedTo)}` : ""}
              noneText="No earlier position"
              compact
            />
          </span>
        </>
      );
    case "deeper":
      return (
        <>
          <Value>{`#${position.position}`}</Value>
          <Note>{`below the top ${position.listed}`}</Note>
        </>
      );
    case "notFound":
      return <Note>{`Not in the top ${position.depth}`}</Note>;
    case "noApps":
      return <Note>{NO_APPS_SENTENCE}</Note>;
    default:
      return <Note>Not in this list</Note>;
  }
}

const Line = ({ children }: { children: ReactNode }) => (
  <span className="basis-full text-caption text-muted-foreground">
    {children}
  </span>
);

function SubtitleLine({ placements }: { placements: PlacementSummary }) {
  const { inSubtitle, subtitlesKnown } = placements;
  if (inSubtitle === null || subtitlesKnown === null) {
    return <Line>Google Play has no subtitle</Line>;
  }
  return subtitlesKnown >= 2 ? (
    <Line>{`${inSubtitle} of ${subtitlesKnown} in the subtitle`}</Line>
  ) : null;
}

function PlacementsValue({
  placements,
}: {
  placements: PlacementSummary | null;
}) {
  if (!placements) return <Note>Not reported</Note>;
  return (
    <>
      <Value>{`${placements.inTitle} of ${placements.of}`}</Value>
      <Note>in the title</Note>
      <SubtitleLine placements={placements} />
    </>
  );
}

function RatingsValue({ ratings }: { ratings: RatingSummary }) {
  if (ratings.kind === "median") {
    return (
      <>
        <Value>{formatCompact(ratings.value)}</Value>
        <Note>median</Note>
      </>
    );
  }
  if (ratings.kind === "average") {
    return (
      <>
        <Value>{formatRating(ratings.value)}</Value>
        <Note>average</Note>
      </>
    );
  }
  return <Note>No ratings</Note>;
}

function SummaryGrid({
  position,
  placements,
  ratings,
  tips,
}: {
  position: ReactNode;
  placements: ReactNode;
  ratings: ReactNode;
  tips: boolean;
}) {
  const tip = (
    tipLabel: string,
    title: string,
    summary: string,
    link = SEARCH_RESULTS_LINK,
  ) =>
    tips ? (
      <InfoTip label={tipLabel} title={title} summary={summary}>
        <GuideLink {...link} />
      </InfoTip>
    ) : (
      <span className="-my-1 size-6" />
    );
  return (
    <dl
      data-slot="serp-summary"
      className="mx-4 mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border"
    >
      <Item label="Your position">{position}</Item>
      <Item
        label="Keyword in"
        tip={tip(
          "About where the keyword sits",
          "Where the keyword sits",
          "How many of the top 10 hold every word of the keyword in their title, in any order. AsoBeast knows subtitles only for your apps and competitors, from their captured listings. A competitor in the top 10 without the keyword in either is marked Outlier, though it may still hold the keyword in its private keyword field.",
          OUTLIERS_LINK,
        )}
      >
        {placements}
      </Item>
      <Item
        label="Top 10 ratings"
        tip={tip(
          "About top 10 ratings",
          "Top 10 ratings",
          "The median rating count of the top 10 apps, a rough measure of how established the top-ranked apps are. Google Play reports no counts, so its average rating shows instead.",
        )}
      >
        {ratings}
      </Item>
    </dl>
  );
}

export function SerpSummary({
  facts,
  comparedTo,
}: {
  facts: SerpSummaryFacts;
  comparedTo: string | null;
}) {
  return (
    <SummaryGrid
      tips
      position={
        <PositionValue position={facts.position} comparedTo={comparedTo} />
      }
      placements={<PlacementsValue placements={facts.placements} />}
      ratings={<RatingsValue ratings={facts.ratings} />}
    />
  );
}

export function SerpSummarySkeleton() {
  const value = (
    <Skeleton className="w-16 border border-transparent text-transparent *:text-transparent">
      <Value>0</Value> <Note>median</Note>
    </Skeleton>
  );
  return (
    <SummaryGrid
      tips={false}
      position={value}
      placements={value}
      ratings={value}
    />
  );
}
