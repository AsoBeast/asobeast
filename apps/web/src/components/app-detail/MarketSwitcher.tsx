"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { marketLabel } from "@/lib/market";
import { useMarket } from "./use-market";

const ALL_MARKETS = "all";

export function MarketSwitcher({
  id,
  allowAll = false,
}: {
  id: string;
  allowAll?: boolean;
}) {
  const { market, scope, home, markets, select } = useMarket(id);
  const selected = markets.find((entry) => entry.country === market);
  if (markets.length < 2 || selected === undefined) return null;

  const value = allowAll && scope === undefined ? ALL_MARKETS : market;
  const choose = (next: string) =>
    select(next === ALL_MARKETS || (!allowAll && next === home) ? null : next);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Label htmlFor={`market-${id}`}>
        {allowAll ? "Market" : "Listing market"}
      </Label>
      <Select value={value} onValueChange={choose}>
        <SelectTrigger id={`market-${id}`} className="w-[240px]">
          <SelectValue>
            {value === ALL_MARKETS ? "All markets" : marketLabel(selected)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowAll ? (
            <SelectItem value={ALL_MARKETS}>All markets</SelectItem>
          ) : null}
          {markets.map((entry) => (
            <SelectItem key={entry.country} value={entry.country}>
              {marketLabel(entry)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
