"use client";

import { Suspense, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  type MarketLocalizationRead,
} from "@asobeast/shared";
import { ReadRoleBadge } from "@/components/localizations/ReadRoleBadge";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { InfoTip } from "@/components/ui/info-tip";
import { Meter } from "@/components/ui/meter";
import {
  editLocalizationHref,
  hasMarketReads,
  localizationsSectionHref,
  uniqueWordCount,
  unshippedReads,
} from "@/lib/app-localizations";
import { formatListInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { localizationNameInLocale } from "@/lib/localizations";
import { marketKeywordFieldsOptions } from "@/lib/queries";
import {
  FOOTER_LINK,
  SECTION_CHEVRON,
} from "@/components/layout/panel-classes";
import { KEYWORD_SECTION } from "./keyword-sections";
import { cn } from "@/lib/utils";
import { MarketWastedWords } from "./MarketWastedWords";
import { MarketSearchReadsSkeleton } from "./skeletons";

function ReadsCard({
  market,
  aside,
  children,
}: {
  market: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("keywords");
  return (
    <CollapsibleCard
      section={KEYWORD_SECTION.reads}
      title={t("reads.title", { market: market.toUpperCase() })}
      actions={aside}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </CollapsibleCard>
  );
}

function ReadRow({ id, read }: { id: string; read: MarketLocalizationRead }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const name = localizationNameInLocale(read.localization, locale);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex min-w-44 items-center gap-2">
        <span className="font-medium">{name}</span>
        <ReadRoleBadge role={read.role} />
      </span>
      <span className="flex min-w-32 flex-1 items-center gap-2">
        <Meter
          value={Math.min(read.charactersUsed, read.charactersLimit)}
          max={read.charactersLimit}
          tone="neutral"
        />
        <span className="numeric shrink-0 text-caption text-muted-foreground">
          {read.phrases.length === 0
            ? t("reads.fieldEmpty")
            : t("reads.fieldUsed", {
                used: read.charactersUsed,
                limit: read.charactersLimit,
              })}
        </span>
      </span>
      <Link
        href={editLocalizationHref(id, read.localization)}
        aria-label={t("reads.editLabel", { name })}
        className={FOOTER_LINK}
      >
        {t("reads.edit")}
      </Link>
    </li>
  );
}

function UnshippedReads({
  id,
  market,
  reads,
  open,
}: {
  id: string;
  market: string;
  reads: readonly MarketLocalizationRead[];
  open: boolean;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (reads.length === 0) return null;
  return (
    <details
      open={open}
      className="group/unshipped border-t border-border-subtle pt-3"
    >
      <summary className="flex list-none items-center gap-2 rounded-sm text-body outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>
          {t("reads.alsoReads", {
            market: market.toUpperCase(),
            count: reads.length,
            characters: reads.length * KEYWORD_FIELD_CHAR_LIMIT,
          })}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(SECTION_CHEVRON, "group-open/unshipped:rotate-180")}
        />
      </summary>
      <p className="mt-3 max-w-prose text-dense text-muted-foreground">
        {formatListInLocale(
          reads.map((read) =>
            localizationNameInLocale(read.localization, locale),
          ),
          locale,
        )}
      </p>
      <Link
        href={localizationsSectionHref(id)}
        className={cn(FOOTER_LINK, "mt-2")}
      >
        {t("reads.addMetadata")}
      </Link>
    </details>
  );
}

function MarketReads({ id, market }: { id: string; market: string }) {
  const t = useTranslations("keywords");
  const { data } = useSuspenseQuery(marketKeywordFieldsOptions(id, market));
  const shipped = data.localizations.filter((read) => read.shipped);

  return (
    <ReadsCard
      market={market}
      aside={
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>
            {`${t("reads.uniqueWords", {
              count: uniqueWordCount(data.localizations),
            })} · ${t("reads.localizations", {
              count: shipped.length,
            })}`}
          </span>
          <InfoTip
            label={t("reads.about")}
            title={t("reads.aboutTitle")}
            summary={t("reads.aboutSummary")}
          />
        </span>
      }
    >
      {shipped.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {t("reads.none", { market: market.toUpperCase() })}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shipped.map((read) => (
            <ReadRow key={read.localization} id={id} read={read} />
          ))}
        </ul>
      )}
      <MarketWastedWords
        country={data.country}
        wastedWords={data.wastedWords}
        splitPhrases={data.splitPhrases}
      />
      <UnshippedReads
        id={id}
        market={market}
        reads={unshippedReads(data.localizations)}
        open={shipped.length === 0}
      />
    </ReadsCard>
  );
}

export function MarketSearchReadsCard({
  id,
  homeCountry,
  market,
}: {
  id: string;
  homeCountry: string;
  market: string;
}) {
  const t = useTranslations("keywords");
  if (!hasMarketReads(homeCountry, market)) {
    return (
      <ReadsCard market={market}>
        <p className="text-body text-muted-foreground">
          {t("reads.notStorefront", { market: market.toUpperCase() })}
        </p>
      </ReadsCard>
    );
  }
  return (
    <Suspense fallback={<MarketSearchReadsSkeleton />}>
      <MarketReads id={id} market={market} />
    </Suspense>
  );
}
