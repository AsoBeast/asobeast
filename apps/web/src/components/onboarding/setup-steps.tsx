"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import Link from "next/link";
import type {
  CompetitorItem,
  MarketSuggestionsResult,
  Store,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { CountrySelect } from "@/components/CountrySelect";
import { AddCompetitorForm } from "@/components/competitors/AddCompetitorForm";
import { COUNTRY_OPTIONS, marketError } from "@/lib/countries";
import { formatCountry, formatList } from "@/lib/format";
import {
  SETUP_KEYWORD_TARGET,
  stepLabel,
  type SetupStep,
  type StepState,
} from "@/lib/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoveredApps } from "./DiscoveredApps";
import { KeywordPicker } from "./KeywordPicker";
import { STEP_TITLES } from "./setup-progress";
import { MarketCostTip, SuggestedMarkets } from "./SuggestedMarkets";

const SKIP_REASON: Record<SetupStep, string> = {
  competitors:
    "Positions are compared against nobody until a competitor is added.",
  keywords: "Only the phrases from your listing are tracked.",
  countries: "Keywords are tracked in your home storefront only.",
};

export interface StepProps {
  state: StepState;
  onSkip: (skipped: boolean) => void;
}

function StepCard({
  step,
  state,
  description,
  onSkip,
  children,
}: StepProps & {
  step: SetupStep;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={`setup-${step}`} className="scroll-mt-20">
      <CardHeader>
        <CardDescription>{stepLabel(step)}</CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle asChild>
            <h3>{STEP_TITLES[step]}</h3>
          </CardTitle>
          <StepBadge state={state} />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        <SkipAction step={step} state={state} onSkip={onSkip} />
      </CardContent>
    </Card>
  );
}

function StepBadge({ state }: { state: StepState }) {
  if (state === "done") return <Badge variant="success">Done</Badge>;
  if (state === "skipped") return <Badge variant="outline">Skipped</Badge>;
  return null;
}

function SkipAction({ step, state, onSkip }: StepProps & { step: SetupStep }) {
  if (state === "skipped") {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        Skipped. {SKIP_REASON[step]}
        <Button
          variant="link"
          className="h-auto px-0"
          onClick={() => onSkip(false)}
        >
          Undo skip
        </Button>
      </p>
    );
  }
  if (state !== "open") return null;
  return (
    <Button
      variant="link"
      className="h-auto w-fit px-0"
      onClick={() => onSkip(true)}
    >
      Skip this step
    </Button>
  );
}

const competitorName = (competitor: CompetitorItem): string =>
  competitor.name ?? competitor.latestSnapshot?.title ?? "Unnamed app";

function trackedCompetitorsLine(competitors: CompetitorItem[]): string {
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
    <StepCard
      step="competitors"
      description="Track at least one app you compete with, so every keyword search compares you against it. Two or three is typical."
      {...step}
    >
      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <AddCompetitorForm id={appId} />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        {error
          ? "Competitor count is temporarily unavailable."
          : competitors === null
            ? "Loading competitors…"
            : trackedCompetitorsLine(competitors)}
      </p>
      <DiscoveredApps appId={appId} collecting={collecting} />
      <Button asChild variant="link" className="h-auto w-fit px-0">
        <Link href={`/apps/${appId}/competitors`}>Manage competitors</Link>
      </Button>
    </StepCard>
  );
}

export interface MarketKeywordCount {
  market: string;
  active: number | null;
  error: boolean;
}

function homeKeywordsLine(
  tracked: TrackedKeywordItem[] | null,
  error: boolean,
  homeMarket: string,
): string {
  if (error) return "Keywords are temporarily unavailable.";
  if (tracked === null) return "Loading keywords…";
  const active = tracked.filter((keyword) => keyword.active).length;
  const market = formatCountry(homeMarket);
  return active > SETUP_KEYWORD_TARGET
    ? `${active} tracked in ${market}`
    : `${active} of ${SETUP_KEYWORD_TARGET} tracked in ${market}`;
}

export function KeywordsStep({
  appId,
  homeMarket,
  tracked,
  error,
  counts,
  ...step
}: StepProps & {
  appId: string;
  homeMarket: string;
  tracked: TrackedKeywordItem[] | null;
  error: boolean;
  counts: MarketKeywordCount[];
}) {
  return (
    <StepCard
      step="keywords"
      description={`Track at least ${SETUP_KEYWORD_TARGET} keywords in your home storefront. The import already tracked the phrases of your title and subtitle.`}
      {...step}
    >
      <p className="text-sm text-muted-foreground">
        {homeKeywordsLine(tracked, error, homeMarket)}
      </p>
      {tracked ? (
        <KeywordPicker appId={appId} country={homeMarket} tracked={tracked} />
      ) : null}
      {counts.length > 1 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {counts.map(({ market, active, error: failed }) => (
            <li
              key={market}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span>{formatCountry(market)}</span>
              <span className="text-muted-foreground">
                {failed
                  ? "Unavailable"
                  : active === null
                    ? "Loading…"
                    : `${active} active`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Button asChild variant="link" className="h-auto w-fit px-0">
        <Link href={`/apps/${appId}/keywords?country=${homeMarket}`}>
          Review keywords
        </Link>
      </Button>
    </StepCard>
  );
}

const nextCountry = (markets: readonly string[]): string =>
  COUNTRY_OPTIONS.find((code) => !markets.includes(code)) ?? "";

export function CountriesStep({
  appId,
  store,
  homeMarket,
  markets,
  suggestions,
  onSelect,
  onReviewed,
  ...step
}: StepProps & {
  appId: string;
  store: Store;
  homeMarket: string;
  markets: string[];
  suggestions: MarketSuggestionsResult | null;
  onSelect: (market: string, selected: boolean) => void;
  onReviewed: () => void;
}) {
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
    <StepCard
      step="countries"
      description={
        <>
          Your home country is selected. Add the countries you sell in; each one
          adds daily requests. {suggested ? null : <MarketCostTip />}
        </>
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
      <ul aria-label="Selected countries" className="flex flex-wrap gap-2">
        {markets.map((market) => (
          <li key={market}>
            <Badge variant="secondary" className="h-7 gap-1 pl-2.5">
              {formatCountry(market)} ({market.toUpperCase()})
              {market !== homeMarket && markets.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove ${formatCountry(market)}`}
                  onClick={() => onSelect(market, false)}
                  className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X />
                </button>
              ) : null}
            </Badge>
          </li>
        ))}
      </ul>
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
      <div className="flex flex-wrap gap-2">
        {markets.map((market) => (
          <Button key={market} asChild variant="outline" size="sm">
            <Link href={`/apps/${appId}/keywords?country=${market}`}>
              Review {market.toUpperCase()} keywords
              <ExternalLink />
            </Link>
          </Button>
        ))}
      </div>
      {step.state === "open" ? (
        <Button variant="outline" className="w-fit" onClick={onReviewed}>
          Countries reviewed
        </Button>
      ) : null}
    </StepCard>
  );
}
