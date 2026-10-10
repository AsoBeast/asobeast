"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_MARKETS, marketLabel } from "@/lib/market";
import { useMarket } from "./use-market";

export function MarketSwitcher({
  id,
  allowAll = false,
}: {
  id: string;
  allowAll?: boolean;
}) {
  const { market, scope, markets, select, selectAll } = useMarket(id);
  const all = allowAll && scope === undefined;
  const selected = markets.find((entry) => entry.country === market);
  if (markets.length < 2 || selected === undefined) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Label htmlFor={`market-${id}`}>Listing market</Label>
      <Select
        value={all ? ALL_MARKETS : market}
        onValueChange={(next) =>
          next === ALL_MARKETS ? selectAll() : select(next)
        }
      >
        <SelectTrigger id={`market-${id}`} className="w-[240px]">
          <SelectValue>
            {all ? "All markets" : marketLabel(selected)}
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
