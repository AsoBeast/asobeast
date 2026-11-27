"use client";

import { useQueryState } from "nuqs";
import {
  type AppStoreLocalization,
  defaultLocalizationIn,
} from "@asobeast/shared";
import { resolveLocalization } from "@/lib/market";
import { localizationParser } from "@/lib/search-params";
import { useMarket } from "./use-market";

export interface SelectedLocalization {
  market: string;
  defaultTag: AppStoreLocalization;
  captured: string[];
  localization: string | null;
  select: (next: AppStoreLocalization | null) => void;
}

export function useLocalization(id: string): SelectedLocalization {
  const { market, home, defaultLocalization, markets } = useMarket(id);
  const defaultTag = defaultLocalizationIn(
    { country: home, defaultLocalization },
    market,
  );
  const [requested, setRequested] = useQueryState(
    "localization",
    localizationParser,
  );
  return {
    market,
    defaultTag,
    captured: (
      markets.find((entry) => entry.country === market)?.localizations ?? []
    ).filter((tag) => tag !== defaultTag),
    localization: resolveLocalization(requested, markets, market),
    select: (next) => void setRequested(next),
  };
}
