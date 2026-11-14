"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  type MarketSuggestion,
  type MarketSuggestionsResult,
  type Store,
} from "@asobeast/shared";
import { ReadRoleBadge } from "@/components/localizations/ReadRoleBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/label";
import { formatCountry, formatList } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  seedChosen,
  seedStatusText,
  seedButtonLabel,
  seedPlan,
  type SeedOutcome,
} from "./market-seeding";
import {
  groupSuggestions,
  languageNames,
  MARKET_COST_GUIDE,
  marketCostSummary,
  marketCostText,
} from "./market-suggestions";
import { useMarketSeeding } from "./useMarketSeeding";

const toggled = (
  set: ReadonlySet<string>,
  market: string,
  on: boolean,
): Set<string> => {
  const next = new Set(set);
  if (on) next.add(market);
  else next.delete(market);
  return next;
};

export function SuggestedMarkets({
  appId,
  result,
  selected,
  onSelect,
}: {
  appId: string;
  result: MarketSuggestionsResult;
  selected: readonly string[];
  onSelect: (market: string, selected: boolean) => void;
}) {
  const languages = languageNames(result);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [seedChoices, setSeedChoices] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );
  const { outcomes, run, seeding } = useMarketSeeding(appId, onSelect);
  const pending = result.suggestions
    .map((suggestion) => suggestion.country)
    .filter((country) => ticked.has(country));
  const plan = seedPlan(
    pending,
    new Set(
      result.suggestions
        .filter((suggestion) => seedChosen(suggestion, seedChoices))
        .map((suggestion) => suggestion.country),
    ),
  );
  const pick = (market: MarketSuggestion, on: boolean) => {
    if (selected.includes(market.country)) {
      if (!on) onSelect(market.country, false);
      return;
    }
    setTicked((current) => toggled(current, market.country, on));
  };
  const inert = pending.length === 0 || seeding.length > 0;
  const add = () => {
    if (inert) return;
    for (const market of plan.select) onSelect(market, true);
    setTicked(new Set());
    run(plan);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-dense">
        {`Your listing ships ${formatList(languages)}.`}
      </p>
      {groupSuggestions(result).map((group) => (
        <fieldset key={group.localization} className="flex flex-col">
          <legend className="text-label text-faint-foreground">
            {group.name}
          </legend>
          {group.markets.map((market) => (
            <SuggestedMarket
              key={market.country}
              market={market}
              selected={selected.includes(market.country)}
              ticked={ticked.has(market.country)}
              seed={seedChosen(market, seedChoices)}
              seeding={seeding.includes(market.country)}
              outcome={outcomes[market.country]}
              onPick={(on) => pick(market, on)}
              onSeed={(on) =>
                setSeedChoices((current) =>
                  new Map(current).set(market.country, on),
                )
              }
            />
          ))}
        </fieldset>
      ))}
      <Button
        variant="outline"
        className="w-fit"
        aria-disabled={inert || undefined}
        onClick={add}
      >
        {seeding.length > 0 ? <Loader2 className="animate-spin" /> : null}
        {seedButtonLabel(pending.length, plan.seed.length)}
      </Button>
    </div>
  );
}

export function MarketCostTip({ store }: { store: Store }) {
  return (
    <InfoTip
      label="About market costs"
      title="What a market costs"
      summary={marketCostSummary(store)}
    >
      <a
        href={MARKET_COST_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read what a market costs
      </a>
    </InfoTip>
  );
}

function SuggestedMarket({
  market,
  selected,
  ticked,
  seed,
  seeding,
  outcome,
  onPick,
  onSeed,
}: {
  market: MarketSuggestion;
  selected: boolean;
  ticked: boolean;
  seed: boolean;
  seeding: boolean;
  outcome: SeedOutcome | undefined;
  onPick: (on: boolean) => void;
  onSeed: (on: boolean) => void;
}) {
  const id = `setup-suggested-${market.country}`;
  const seedId = `setup-seed-${market.country}`;
  const name = formatCountry(market.country);
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dense">
        <Checkbox
          id={id}
          checked={market.tracked || selected || ticked}
          disabled={market.tracked || seeding}
          onCheckedChange={(value) => onPick(value === true)}
        />
        <Label htmlFor={id} className="min-w-0">
          {name} ({market.country.toUpperCase()})
        </Label>
        <ReadRoleBadge role={market.role} />
        {market.tracked ? (
          <span className="text-caption text-faint-foreground">Tracked</span>
        ) : null}
        <span className="numeric text-caption text-muted-foreground sm:ml-auto">
          {marketCostText(market)}
        </span>
      </div>
      {ticked ? (
        <div className="flex items-center gap-2 pl-6">
          <Checkbox
            id={seedId}
            checked={seed}
            onCheckedChange={(value) => onSeed(value === true)}
          />
          <Label
            htmlFor={seedId}
            className="text-caption font-normal text-muted-foreground"
          >
            Seed with its listing
            <span className="sr-only"> for {name}</span>
          </Label>
        </div>
      ) : null}
      <p
        role="status"
        className={cn(
          "pl-6 text-caption empty:hidden",
          outcome?.kind === "failed"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {seedStatusText(seeding, outcome)}
      </p>
    </div>
  );
}
