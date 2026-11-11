"use client";

import { Suspense, type ReactNode } from "react";
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
import { formatList, formatNumber, pluralize } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
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
  return (
    <CollapsibleCard
      section={KEYWORD_SECTION.reads}
      title={`What ${market.toUpperCase()} search reads`}
      actions={aside}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </CollapsibleCard>
  );
}

function ReadRow({ id, read }: { id: string; read: MarketLocalizationRead }) {
  const name = localizationName(read.localization);
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
            ? "Keyword field empty"
            : `Keyword field ${read.charactersUsed}/${read.charactersLimit}`}
        </span>
      </span>
      <Link
        href={editLocalizationHref(id, read.localization)}
        aria-label={`Edit the ${name} keyword field`}
        className={FOOTER_LINK}
      >
        Edit
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
  if (reads.length === 0) return null;
  return (
    <details
      open={open}
      className="group/unshipped border-t border-border-subtle pt-3"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-body outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>
          {`${market.toUpperCase()} also reads ${pluralize(reads.length, "localization")} you don't ship · up to ${formatNumber(reads.length * KEYWORD_FIELD_CHAR_LIMIT)} more characters`}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(SECTION_CHEVRON, "group-open/unshipped:rotate-180")}
        />
      </summary>
      <p className="mt-3 max-w-prose text-dense text-muted-foreground">
        {formatList(reads.map((read) => localizationName(read.localization)))}
      </p>
      <Link
        href={localizationsSectionHref(id)}
        className={cn(FOOTER_LINK, "mt-2")}
      >
        Add one on the metadata page
      </Link>
    </details>
  );
}

function MarketReads({ id, market }: { id: string; market: string }) {
  const { data } = useSuspenseQuery(marketKeywordFieldsOptions(id, market));
  const shipped = data.localizations.filter((read) => read.shipped);

  return (
    <ReadsCard
      market={market}
      aside={
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>
            {`${pluralize(uniqueWordCount(data.localizations), "unique word")} · ${pluralize(shipped.length, "localization")}`}
          </span>
          <InfoTip
            label="About market keyword fields"
            title="What a market reads"
            summary="Search in a storefront reads the keyword field of every localization on its list. Words combine only within one localization."
          />
        </span>
      }
    >
      {shipped.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {`${market.toUpperCase()} reads none of the localizations this app ships.`}
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
  if (!hasMarketReads(homeCountry, market)) {
    return (
      <ReadsCard market={market}>
        <p className="text-body text-muted-foreground">
          {`${market.toUpperCase()} is not an App Store storefront, so it has no keyword field.`}
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
