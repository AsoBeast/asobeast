"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import Link from "next/link";
import type { CompetitorItem, MarketSuggestionsResult } from "@asobeast/shared";
import { AddCompetitorForm } from "@/components/competitors/AddCompetitorForm";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoveredApps } from "./DiscoveredApps";
import { SuggestedMarkets } from "./SuggestedMarkets";

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
  title,
  description,
  onSkip,
  children,
}: StepProps & {
  step: SetupStep;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{stepLabel(step)}</CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle asChild>
            <h3>{title}</h3>
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
      title="Pick competitors"
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
      <DiscoveredApps
        appId={appId}
        competitors={competitors ?? []}
        collecting={collecting}
      />
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

export function KeywordsStep({
  appId,
  homeMarket,
  homeCount,
  counts,
  ...step
}: StepProps & {
  appId: string;
  homeMarket: string;
  homeCount: number | null;
  counts: MarketKeywordCount[];
}) {
  return (
    <StepCard
      step="keywords"
      title="Track keywords"
      description={`Track at least ${SETUP_KEYWORD_TARGET} keywords in your home storefront. The import already tracked the phrases of your title and subtitle.`}
      {...step}
    >
      <p className="text-sm text-muted-foreground">
        {homeCount === null
          ? "Loading keywords…"
          : `${homeCount} of ${SETUP_KEYWORD_TARGET} tracked`}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {counts.map(({ market, active, error }) => (
          <li
            key={market}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <span>{formatCountry(market)}</span>
            <span className="text-muted-foreground">
              {error
                ? "Unavailable"
                : active === null
                  ? "Loading…"
                  : `${active} active`}
            </span>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="w-fit">
        <Link href={`/apps/${appId}/keywords?country=${homeMarket}`}>
          Review keywords
          <ExternalLink />
        </Link>
      </Button>
    </StepCard>
  );
}

export function CountriesStep({
  appId,
  homeMarket,
  markets,
  suggestions,
  onSelect,
  onReviewed,
  ...step
}: StepProps & {
  appId: string;
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
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const market = value.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(market)) {
      setError("Enter a two-letter country code.");
      return;
    }
    onSelect(market, true);
    setValue("");
    setError(null);
  };

  return (
    <StepCard
      step="countries"
      title="Add countries"
      description="Add the storefronts you sell in. Your home storefront is selected."
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
      <ul aria-label="Selected markets" className="flex flex-wrap gap-2">
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
      <form onSubmit={submit} className="flex max-w-sm items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="setup-market">
            {suggested
              ? "Another storefront? Add a country code"
              : "Add a country code"}
          </Label>
          <Input
            id="setup-market"
            value={value}
            maxLength={2}
            placeholder="gb"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "setup-market-error" : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          {error ? (
            <span id="setup-market-error" className="text-xs text-destructive">
              {error}
            </span>
          ) : null}
        </div>
        <Button type="submit" variant="outline" className="mt-4">
          <Plus />
          Add
        </Button>
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
