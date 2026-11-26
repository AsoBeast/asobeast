"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCompactInLocale,
  formatDayMonthInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type {
  PositionSummary,
  RatingSummary,
  SerpSummaryFacts,
  TitleSummary,
} from "./serp-summary";
import { serpRowId } from "./SerpRow";
import { SerpMovement } from "./SerpRow";

const SEARCH_RESULTS_GUIDE =
  "https://docs.asobeast.com/guides/read-rankings#search-results";

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

function GuideLink() {
  const t = useTranslations("keywordInspector");
  return (
    <a
      href={SEARCH_RESULTS_GUIDE}
      target="_blank"
      rel="noreferrer"
      className="link-underline"
    >
      {t("serp.summary.guide")}
    </a>
  );
}

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
  const period = comparedTo
    ? t("serp.summary.period", {
        date: formatDayMonthInLocale(comparedTo, locale),
      })
    : "";
  switch (position.kind) {
    case "listed":
      return (
        <>
          <Button
            variant="link"
            className="h-auto p-0 numeric text-body font-medium"
            aria-label={t("serp.summary.jump", {
              position: position.position,
            })}
            onClick={() => jumpToRow(position.position)}
          >
            #{position.position}
          </Button>
          <span className="text-caption">
            <SerpMovement
              entry={position.moved}
              period={period}
              noneText={t("serp.summary.noEarlierPosition")}
            />
          </span>
        </>
      );
    case "deeper":
      return (
        <>
          <Value>{`#${position.position}`}</Value>
          <Note>{t("serp.summary.deeper", { count: position.listed })}</Note>
        </>
      );
    case "notFound":
      return (
        <Note>{t("serp.summary.notFound", { depth: position.depth })}</Note>
      );
    default:
      return <Note>{t("serp.summary.absent")}</Note>;
  }
}

function TitlesValue({ titles }: { titles: TitleSummary | null }) {
  const t = useTranslations("keywordInspector");
  if (!titles) return <Note>{t("serp.summary.notReported")}</Note>;
  return (
    <Value>
      {t("serp.summary.ratio", {
        shown: titles.withKeyword,
        total: titles.of,
      })}
    </Value>
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
  titles,
  ratings,
  tips,
}: {
  position: ReactNode;
  titles: ReactNode;
  ratings: ReactNode;
  tips: boolean;
}) {
  const t = useTranslations("keywordInspector");
  return (
    <dl
      data-slot="serp-summary"
      className="mx-4 mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border"
    >
      <Item label={t("serp.summary.yourPosition")}>{position}</Item>
      <Item
        label={t("serp.summary.titles")}
        tip={
          tips ? (
            <InfoTip
              label={t("serp.summary.titlesTipLabel")}
              title={t("serp.summary.titlesTipTitle")}
              summary={t("serp.summary.titlesTipSummary")}
            >
              <GuideLink />
            </InfoTip>
          ) : (
            <span className="-my-1 size-6" />
          )
        }
      >
        {titles}
      </Item>
      <Item
        label={t("serp.summary.ratings")}
        tip={
          tips ? (
            <InfoTip
              label={t("serp.summary.ratingsTipLabel")}
              title={t("serp.summary.ratingsTipTitle")}
              summary={t("serp.summary.ratingsTipSummary")}
            >
              <GuideLink />
            </InfoTip>
          ) : (
            <span className="-my-1 size-6" />
          )
        }
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
      titles={<TitlesValue titles={facts.titles} />}
      ratings={<RatingsValue ratings={facts.ratings} />}
    />
  );
}

export function SerpSummarySkeleton() {
  const t = useTranslations("keywordInspector");
  const value = (
    <Skeleton className="w-16 border border-transparent text-transparent *:text-transparent">
      <Value>0</Value> <Note>{t("serp.summary.median")}</Note>
    </Skeleton>
  );
  return (
    <SummaryGrid tips={false} position={value} titles={value} ratings={value} />
  );
}
