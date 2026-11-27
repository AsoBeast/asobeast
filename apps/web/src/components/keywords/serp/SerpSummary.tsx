"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { type Store } from "@asobeast/shared";
import { MovementCell } from "@/components/movement/MovementCell";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatCompactInLocale,
  formatDayMonthInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
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
  const t = useTranslations("keywordInspector");
  const label =
    text === "__OUTLIERS__"
      ? t("serp.summary.outliers")
      : text === "__GUIDE__"
        ? t("serp.summary.guide")
        : text === "__NO_PLAY__"
          ? t("serp.summary.noPlaySubtitle")
          : text;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link-underline">
      {label}
    </a>
  );
}

const SEARCH_RESULTS_LINK = {
  href: SEARCH_RESULTS_GUIDE,
  text: "Read about search results",
};

const OUTLIERS_LINK = { href: OUTLIERS_GUIDE, text: "__OUTLIERS__" };

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
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  switch (position.kind) {
    case "listed":
      return (
        <>
          <Button
            variant="link"
            className="h-auto p-0 numeric text-body font-medium"
            aria-label={t("serp.summary.jump", { position: position.position })}
            onClick={() => jumpToRow(position.position)}
          >
            #{position.position}
          </Button>
          <span className="text-caption">
            <MovementCell
              entry={position.moved}
              period={
                comparedTo
                  ? t("serp.summary.sinceDate", {
                      date: formatDayMonthInLocale(comparedTo, locale),
                    })
                  : ""
              }
              noneText={t("serp.summary.noneEarlier")}
              compact
            />
          </span>
        </>
      );
    case "deeper":
      return (
        <>
          <Value>{`#${position.position}`}</Value>
          <Note>{t("serp.summary.below", { listed: position.listed })}</Note>
        </>
      );
    case "notFound":
      return (
        <Note>
          {t("serp.summary.notFoundDepth", { depth: position.depth })}
        </Note>
      );
    case "noApps":
      return <Note>{t("serp.summary.noApps")}</Note>;
    default:
      return <Note>{t("serp.summary.absent")}</Note>;
  }
}

const SUBTITLE_LINE_SPACE = "__SPACE__";

const Line = ({ children }: { children: ReactNode }) => (
  <span className="basis-full text-caption text-muted-foreground">
    {children}
  </span>
);

const LineSpace = ({ children }: { children: string }) => (
  <span aria-hidden className="invisible basis-full text-caption">
    {children}
  </span>
);

function SubtitleLine({ placements }: { placements: PlacementSummary }) {
  const t = useTranslations("keywordInspector");
  const { inSubtitle, subtitlesKnown } = placements;
  if (inSubtitle === null || subtitlesKnown === null) {
    return <Line>{t("serp.summary.noPlaySubtitle")}</Line>;
  }
  return subtitlesKnown >= 2 ? (
    <Line>
      {t("serp.summary.inSubtitle", {
        shown: inSubtitle,
        total: subtitlesKnown,
      })}
    </Line>
  ) : (
    <LineSpace>{t("serp.summary.subtitleLineSpace")}</LineSpace>
  );
}

function PlacementsValue({
  placements,
}: {
  placements: PlacementSummary | null;
}) {
  const t = useTranslations("keywordInspector");
  if (!placements) return <Note>{t("serp.summary.notReported")}</Note>;
  return (
    <>
      <Value>
        {t("serp.summary.ratio", {
          shown: placements.inTitle,
          total: placements.of,
        })}
      </Value>
      <Note>{t("serp.summary.inTitle")}</Note>
      <SubtitleLine placements={placements} />
    </>
  );
}

function RatingsValue({ ratings }: { ratings: RatingSummary }) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  if (ratings.kind === "median") {
    return (
      <>
        <Value>{formatCompactInLocale(ratings.value, locale)}</Value>
        <Note>{t("serp.summary.median")}</Note>
      </>
    );
  }
  if (ratings.kind === "average") {
    return (
      <>
        <Value>{formatRatingInLocale(ratings.value, locale)}</Value>
        <Note>{t("serp.summary.average")}</Note>
      </>
    );
  }
  return <Note>{t("serp.summary.noRatings")}</Note>;
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
  const t = useTranslations("keywordInspector");
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
      <Item label={t("serp.summary.yourPosition")}>{position}</Item>
      <Item
        label={t("serp.summary.keywordIn")}
        tip={tip(
          t("serp.summary.keywordInTipLabel"),
          t("serp.summary.keywordInTipTitle"),
          "How many of the top 10 hold every word of the keyword in their title, in any order. AsoBeast knows subtitles only for your apps and competitors, from their captured listings. A competitor in the top 10 without the keyword in either is marked Outlier, though it may still hold the keyword in its private keyword field.",
          OUTLIERS_LINK,
        )}
      >
        {placements}
      </Item>
      <Item
        label={t("serp.summary.top10Ratings")}
        tip={tip(
          t("serp.summary.top10TipLabel"),
          t("serp.summary.top10TipTitle"),
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

const ValueSkeleton = ({ className }: { className?: string }) => {
  const t = useTranslations("keywordInspector");
  return (
    <Skeleton
      className={cn("w-16 text-transparent *:text-transparent", className)}
    >
      <Value>0</Value> <Note>{t("serp.summary.median")}</Note>
    </Skeleton>
  );
};

export function SerpSummarySkeleton({ store }: { store: Store }) {
  const t = useTranslations("keywordInspector");
  const value = <ValueSkeleton className="border border-transparent" />;
  return (
    <SummaryGrid
      tips={false}
      position={value}
      placements={
        <>
          <ValueSkeleton />
          <LineSpace>
            {store === "GOOGLE_PLAY"
              ? t("serp.summary.noPlaySubtitle")
              : t("serp.summary.subtitleLineSpace")}
          </LineSpace>
        </>
      }
      ratings={value}
    />
  );
}
