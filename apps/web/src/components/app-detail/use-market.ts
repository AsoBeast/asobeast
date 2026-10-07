"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ListingMarket } from "@asobeast/shared";
import { queryMarket, resolveMarket } from "@/lib/market";
import { appDetailOptions, listingMarketsOptions } from "@/lib/queries";
import { marketParser } from "@/lib/search-params";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

export interface SelectedMarket {
  market: string;
  home: string;
  markets: ListingMarket[];
  select: (market: string) => void;
}

export function useMarket(id: string): SelectedMarket {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { data: markets } = useSuspenseQuery(listingMarketsOptions(id));
  const [requested, setRequested] = useQueryState("market", marketParser);
  return {
    market: resolveMarket(requested, markets, app.country),
    home: app.country,
    markets,
    select: (next) => void setRequested(next === app.country ? null : next),
  };
}

export function useCachedMarket(id: string): string | undefined {
  const app = useCachedQueryData(appDetailOptions(id).queryKey);
  const markets = useCachedQueryData(listingMarketsOptions(id).queryKey);
  const [requested] = useQueryState("market", marketParser);
  if (app === undefined || markets === undefined) return undefined;
  return queryMarket(
    resolveMarket(requested, markets, app.country),
    app.country,
  );
}
