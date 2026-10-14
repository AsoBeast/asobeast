"use client";

import { Suspense, useId, type ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  type MarketLocalizationRead,
} from "@asobeast/shared";
import { ReadRoleBadge } from "@/components/localizations/ReadRoleBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Meter } from "@/components/ui/meter";
import {
  editLocalizationHref,
  hasMarketReads,
  localizationsSectionHref,
  uniqueWordCount,
  unshippedReads,
} from "@/lib/app-localizations";
import { formatNumber, pluralize } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import { marketKeywordFieldsOptions } from "@/lib/queries";
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
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0">
      <CardHeader>
        <CardTitle id={titleId}>
          {`What ${market.toUpperCase()} search reads`}
        </CardTitle>
        {aside ? <CardAction>{aside}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
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
          tone="health"
        />
        <span className="numeric shrink-0 font-mono text-caption text-muted-foreground">
          {read.phrases.length === 0
            ? "Empty"
            : `${read.charactersUsed}/${read.charactersLimit}`}
        </span>
      </span>
      <Button asChild variant="link" size="sm" className="h-auto p-0">
        <Link
          href={editLocalizationHref(id, read.localization)}
          aria-label={`Edit the ${name} keyword field`}
        >
          Edit
        </Link>
      </Button>
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
    <details open={open} className="rounded-lg border border-border px-3 py-2">
      <summary className="cursor-pointer text-body">
        {market.toUpperCase()} also reads{" "}
        {pluralize(reads.length, "localization")} you don&apos;t ship · up to{" "}
        {formatNumber(reads.length * KEYWORD_FIELD_CHAR_LIMIT)} more characters
      </summary>
      <ul className="mt-3 flex flex-wrap gap-2">
        {reads.map((read) => (
          <li key={read.localization}>
            <Badge variant="secondary">
              {localizationName(read.localization)}
            </Badge>
          </li>
        ))}
      </ul>
      <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
        <Link href={localizationsSectionHref(id)}>
          Add one on the metadata page
        </Link>
      </Button>
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
          {pluralize(uniqueWordCount(data.localizations), "unique word")} ·{" "}
          {pluralize(shipped.length, "localization")}
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
          {market.toUpperCase()} reads none of the localizations this app ships.
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
          {market.toUpperCase()} is not an App Store storefront, so it has no
          keyword field.
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
