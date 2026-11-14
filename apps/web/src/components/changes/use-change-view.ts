"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import type { ChangeEventItem } from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { queryMarket } from "@/lib/market";
import { changesOptions } from "@/lib/queries";
import type { ChangeWindow } from "@/lib/ranges";
import {
  changeDaysParser,
  changeFieldGroupParser,
  changeOwnerParser,
  countryParser,
} from "@/lib/search-params";
import { changeWindowRange } from "./change-activity";
import { dayOf, type ChangeFilter } from "./change-fields";

const filterParsers = {
  owner: changeOwnerParser,
  field: changeFieldGroupParser,
};

export function useChangeFilter(): {
  filter: ChangeFilter;
  setFilter: (next: Partial<ChangeFilter>) => void;
  clearFilter: () => void;
} {
  const [filter, setFilter] = useQueryStates(filterParsers);
  return {
    filter,
    setFilter: (next) => void setFilter(next),
    clearFilter: () => void setFilter(null),
  };
}

export interface ChangeEvents {
  events: ChangeEventItem[];
  days: ChangeWindow;
  listing: string;
  homeListing: boolean;
  today: string;
}

export function useChangeWindow(): ChangeWindow {
  const [days] = useQueryState("days", changeDaysParser);
  return useDeferredValue(days);
}

export function useChangeEvents(id: string): ChangeEvents {
  const days = useChangeWindow();
  const { market, home } = useMarket(id);
  const listing = useDeferredValue(market);
  const { data, dataUpdatedAt } = useSuspenseQuery(
    changesOptions(id, days, queryMarket(listing, home)),
  );
  const today = new Date(dataUpdatedAt).toISOString().slice(0, 10);
  const { from } = changeWindowRange(today, days);
  return {
    events: data.events.filter((event) => dayOf(event) >= from),
    days,
    listing,
    homeListing: listing === home,
    today,
  };
}

export function useImpactCountry(homeCountry: string): string {
  const [country] = useQueryState("country", countryParser);
  return useDeferredValue(country || homeCountry);
}
