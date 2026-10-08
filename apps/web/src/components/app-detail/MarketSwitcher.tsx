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

export function MarketSwitcher({ id }: { id: string }) {
  const { market, markets, select } = useMarket(id);
  const selected = markets.find((entry) => entry.country === market);
  if (markets.length < 2 || selected === undefined) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Label htmlFor={`market-${id}`}>Listing market</Label>
      <Select value={market} onValueChange={select}>
        <SelectTrigger id={`market-${id}`} className="w-[240px]">
          <SelectValue>{marketLabel(selected)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
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
