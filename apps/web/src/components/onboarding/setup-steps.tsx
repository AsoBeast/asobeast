"use client";

import { Suspense, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  SETUP_KEYWORD_TARGET,
  type CompetitorItem,
  type MarketSuggestionsResult,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { CountrySelect } from "@/components/CountrySelect";
import { AddCompetitorForm } from "@/components/competitors/AddCompetitorForm";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { COUNTRY_OPTIONS, marketError } from "@/lib/countries";
import { formatCountry, formatList } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoveredApps } from "./DiscoveredApps";
import { KeywordPicker } from "./KeywordPicker";
import { FirstDiscoveries } from "./FirstDiscoveries";
import {
  SelectedCountries,
  type MarketKeywordCount,
} from "./SelectedCountries";
import { activeKeywordCount, keywordsStepDescription } from "./setup-progress";
import { StepPanel, type StepProps } from "./StepPanel";
import { MarketCostTip, SuggestedMarkets } from "./SuggestedMarkets";

const COUNT_LINE = "numeric text-caption text-muted-foreground";

const competitorName = (competitor: CompetitorItem): string =>
  competitor.name ?? competitor.latestSnapshot?.title ?? "Unnamed app";

function competitorsLine(
  competitors: CompetitorItem[] | null,
  error: boolean,
): string {
  if (error) return "Competitor count is temporarily unavailable.";
  if (competitors === null) return "Loading competitors…";
  if (competitors.length === 0) return "No competitor yet";
  return `${competitors.length} tracked: ${formatList(competitors.map(competitorName))}`;
}

export function CompetitorsStep({
  appId,
  competitors,
  error,
  collecting,
  ...step
}: StepProps & {
  appId: string;
  competitors: CompetitorItem[] | null;
  error: boolean;
  collecting: boolean;
}) {
  return (
    <StepPanel
      step="competitors"
      description="Track at least one app you compete with, so every keyword search compares you against it. Two or three is typical."
      footer={
        <>
          <span>A new competitor gets positions on the next keyword check</span>
          <Link href={`/apps/${appId}/competitors`} className={FOOTER_LINK}>
            Manage competitors
          </Link>
        </>
      }
      {...step}
    >
      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <AddCompetitorForm id={appId} submitVariant="outline" />
      </Suspense>
      <p className={COUNT_LINE}>{competitorsLine(competitors, error)}</p>
      <DiscoveredApps appId={appId} collecting={collecting} />
    </StepPanel>
  );
}

function homeKeywordsLine(
  tracked: TrackedKeywordItem[] | null,
  error: boolean,
  homeMarket: string,
): string {
  if (error) return "Keywords are temporarily unavailable.";
  if (tracked === null) return "Loading keywords…";
  const active = activeKeywordCount(tracked);
  const market = formatCountry(homeMarket);
  return active > SETUP_KEYWORD_TARGET
    ? `${active} tracked in ${market}`
    : `${active} of ${SETUP_KEYWORD_TARGET} tracked in ${market}`;
}

export function KeywordsStep({
  appId,
  store,
  homeMarket,
  tracked,
  error,
  ...step
}: StepProps & {
  appId: string;
  store: Store;
  homeMarket: string;
  tracked: TrackedKeywordItem[] | null;
  error: boolean;
}) {
  return (
    <StepPanel
      step="keywords"
      description={keywordsStepDescription(store)}
      footer={
        <>
          <span>A tracked keyword is checked on every daily run</span>
          <Link
            href={`/apps/${appId}/keywords?country=${homeMarket}`}
            className={FOOTER_LINK}
          >
            Review keywords
          </Link>
        </>
      }
      {...step}
    >
      <p className={COUNT_LINE}>
        {homeKeywordsLine(tracked, error, homeMarket)}
      </p>
      <FirstDiscoveries id={appId} country={homeMarket} />
      {tracked ? (
        <KeywordPicker appId={appId} country={homeMarket} tracked={tracked} />
      ) : null}
    </StepPanel>
  );
}

const nextCountry = (markets: readonly string[]): string =>
  COUNTRY_OPTIONS.find((code) => !markets.includes(code)) ?? "";

export function CountriesStep({
  appId,
  store,
  homeMarket,
  counts,
  suggestions,
  onSelect,
  onReviewed,
  ...step
}: StepProps & {
  appId: string;
  store: Store;
  homeMarket: string;
  counts: MarketKeywordCount[];
  suggestions: MarketSuggestionsResult | null;
  onSelect: (market: string, selected: boolean) => void;
  onReviewed: () => void;
}) {
  const markets = counts.map((count) => count.market);
  const suggested =
    suggestions !== null && suggestions.suggestions.length > 0
      ? suggestions
      : null;
  const [picked, setPicked] = useState(() => nextCountry(markets));
  const value = markets.includes(picked) ? nextCountry(markets) : picked;
  const addable = value !== "" && marketError(store, value) === null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!addable) return;
    onSelect(value, true);
    setPicked(nextCountry([...markets, value]));
  };

  return (
    <StepPanel
      step="countries"
      description="Your home country is selected. Add the countries you sell in."
      footer={
        <span className="flex items-center gap-1">
          <span>Each country adds requests a day to the daily run</span>
          <MarketCostTip store={store} />
        </span>
      }
      {...step}
    >
      {suggested ? (
        <SuggestedMarkets
          appId={appId}
          result={suggested}
          selected={markets}
          onSelect={onSelect}
        />
      ) : null}
      <SelectedCountries
        appId={appId}
        homeMarket={homeMarket}
        counts={counts}
        onRemove={(market) => onSelect(market, false)}
      />
      <form onSubmit={submit} className="flex flex-col gap-1">
        <Label htmlFor="setup-country">
          {suggested ? "Add another country" : "Add a country"}
        </Label>
        <div className="flex flex-wrap items-start gap-2">
          <CountrySelect
            id="setup-country"
            store={store}
            value={value}
            onChange={setPicked}
            ariaLabel="Country to add"
          />
          <Button type="submit" variant="outline" disabled={!addable}>
            <Plus />
            Add
          </Button>
        </div>
      </form>
      {step.state === "open" ? (
        <Button variant="outline" className="w-fit" onClick={onReviewed}>
          Countries reviewed
        </Button>
      ) : null}
    </StepPanel>
  );
}
