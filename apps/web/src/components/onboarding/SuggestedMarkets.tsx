"use client";

import type {
  MarketSuggestion,
  MarketSuggestionsResult,
} from "@asobeast/shared";
import { ReadRoleBadge } from "@/components/localizations/ReadRoleBadge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/label";
import { formatCountry, formatList } from "@/lib/format";
import {
  groupSuggestions,
  languageNames,
  MARKET_COST_GUIDE,
  marketCostText,
} from "./market-suggestions";

export function SuggestedMarkets({
  result,
  selected,
  onSelect,
}: {
  result: MarketSuggestionsResult;
  selected: readonly string[];
  onSelect: (market: string, selected: boolean) => void;
}) {
  const languages = languageNames(result);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-body">Your listing ships {formatList(languages)}.</p>
        <div className="flex flex-wrap gap-1.5">
          {languages.map((language) => (
            <Badge key={language} variant="secondary">
              {language}
            </Badge>
          ))}
        </div>
      </div>
      {groupSuggestions(result).map((group) => (
        <fieldset key={group.localization} className="flex flex-col gap-2">
          <legend className="mb-1 text-body font-medium">{group.name}</legend>
          {group.markets.map((market) => (
            <SuggestedMarket
              key={market.country}
              market={market}
              checked={market.tracked || selected.includes(market.country)}
              onSelect={onSelect}
            />
          ))}
        </fieldset>
      ))}
      <p className="flex items-center gap-1 text-caption text-muted-foreground">
        Each market adds requests a day to the daily run.
        <InfoTip
          label="About market costs"
          title="What a market costs"
          summary="A market adds one listing read a day for the app and for every competitor, one more for each localization captured there, and one search a day for every keyword tracked there."
        >
          <a
            href={MARKET_COST_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
          >
            Read what a market costs
          </a>
        </InfoTip>
      </p>
    </div>
  );
}

function SuggestedMarket({
  market,
  checked,
  onSelect,
}: {
  market: MarketSuggestion;
  checked: boolean;
  onSelect: (market: string, selected: boolean) => void;
}) {
  const id = `setup-suggested-${market.country}`;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Checkbox
        id={id}
        checked={checked}
        disabled={market.tracked}
        onCheckedChange={(value) => onSelect(market.country, value === true)}
      />
      <Label htmlFor={id} className="min-w-0">
        {formatCountry(market.country)} ({market.country.toUpperCase()})
      </Label>
      <ReadRoleBadge role={market.role} />
      {market.tracked ? <Badge variant="outline">Tracked</Badge> : null}
      <span className="text-caption text-muted-foreground">
        {marketCostText(market)}
      </span>
    </div>
  );
}
