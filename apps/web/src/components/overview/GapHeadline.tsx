"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { InfoTip } from "@/components/ui/info-tip";
import {
  gapHeadline,
  headlineLink,
  type GapHeadline as Headline,
} from "@/lib/gap-headline";
import { competitorAnalysisOptions, competitorsOptions } from "@/lib/queries";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { GapHeadlineSkeleton } from "./skeletons";

function GapHeadlineSentence({ headline }: { headline: Headline }) {
  const t = useTranslations("overview");
  if (headline.kind === "quiet") return <>{t("gaps.quiet")}</>;
  if (headline.kind !== "summary") {
    return <>{t(`gaps.${headline.kind}`)}</>;
  }
  const winnable =
    headline.winnable === 0
      ? t("gaps.noWinnable")
      : t("gaps.winnable", { count: headline.winnable });
  const threats =
    headline.threats === 0
      ? null
      : t("gaps.threats", { count: headline.threats });
  if (headline.biggest === null) {
    return <>{[winnable, threats].filter(Boolean).join(" ")}</>;
  }
  const biggest = headline.biggest;
  const position =
    biggest.theirs === null
      ? ""
      : t("gaps.competitorRanks", { position: biggest.theirs });
  const yours =
    biggest.yours === null
      ? t("gaps.notRanked")
      : t("gaps.yourRank", { position: biggest.yours });
  const protectedKeyword = (chunks: ReactNode) => (
    <span translate="no">{chunks}</span>
  );
  const copy =
    biggest.competitor === null
      ? t.rich("gaps.biggestGeneric", {
          text: biggest.text,
          keyword: protectedKeyword,
          genericCompetitor: t("gaps.genericCompetitor"),
          position,
          yours,
        })
      : t.rich("gaps.biggest", {
          text: biggest.text,
          keyword: protectedKeyword,
          rival: biggest.competitor,
          competitor: (chunks) => <span translate="no">{chunks}</span>,
          position,
          yours,
        });
  return (
    <>
      {winnable} {copy}
      {threats === null ? null : <> {threats}</>}
    </>
  );
}

function GapHeadlineBody({ id, home }: { id: string; home: string }) {
  const t = useTranslations("overview");
  const { country } = useKeywordScope(id);
  const read = useQuery(competitorAnalysisOptions(id));
  const { data: competitors } = useQuery(competitorsOptions(id));
  if (failedRead(read)) {
    return <InlineQueryError message={t("gaps.loadError")} read={read} />;
  }
  if (read.data === undefined) return <GapHeadlineSkeleton />;
  const market = country ?? "";
  const headline = gapHeadline(read.data.gaps, {
    competitors: competitors ?? [],
    country: market,
    home,
  });
  const link = headlineLink(id, headline, market);
  const label =
    link === null
      ? null
      : headline.kind === "noCompetitors"
        ? t("gaps.addCompetitor")
        : headline.kind === "summary"
          ? headline.biggest === null
            ? t("gaps.seeThreats")
            : t("gaps.seeWinnable")
          : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <p className="min-w-0 flex-1 wrap-anywhere">
        <GapHeadlineSentence headline={headline} />
      </p>
      {link && label ? (
        <Link href={link.href} className={FOOTER_LINK}>
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export function GapHeadline({ id, home }: { id: string; home: string }) {
  const t = useTranslations("overview");
  return (
    <section
      aria-label={t("gaps.aria")}
      className="flex min-h-6 w-full items-center gap-2"
    >
      <div className="min-w-0 flex-1">
        <GapHeadlineBody id={id} home={home} />
      </div>
      <InfoTip
        label={t("gaps.about")}
        title={t("gaps.title")}
        summary={t("gaps.summary")}
      >
        <a
          href="https://docs.asobeast.com/guides/competitors#gap-analysis"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground link-underline"
        >
          {t("gaps.readLists")}
        </a>
      </InfoTip>
    </section>
  );
}
