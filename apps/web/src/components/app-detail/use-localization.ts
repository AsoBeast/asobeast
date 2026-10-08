"use client";

import { useQueryState } from "nuqs";
import { type AppStoreLocalization } from "@asobeast/shared";
import { resolveLocalization } from "@/lib/market";
import { localizationParser } from "@/lib/search-params";
import { useMarket } from "./use-market";

export interface SelectedLocalization {
  market: string;
  captured: string[];
  localization: string | null;
  select: (next: AppStoreLocalization | null) => void;
}

export function useLocalization(id: string): SelectedLocalization {
  const { market, markets } = useMarket(id);
  const [requested, setRequested] = useQueryState(
    "localization",
    localizationParser,
  );
  return {
    market,
    captured:
      markets.find((entry) => entry.country === market)?.localizations ?? [],
    localization: resolveLocalization(requested, markets, market),
    select: (next) => void setRequested(next),
  };
}
