"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Store, StoreSearchResult } from "@asobeast/shared";
import { marketError } from "@/lib/countries";
import { storeSearchOptions } from "@/lib/queries";
import {
  classifyInput,
  enterAction,
  isSearchable,
  STORE_SEARCH_DEBOUNCE_MS,
  type EnterAction,
  type StoreInput,
} from "./store-search";

export interface StoreSearch {
  input: StoreInput;
  q: string;
  results: StoreSearchResult[] | undefined;
  pending: boolean;
  settled: boolean;
  error: unknown;
  retry: () => void;
  enter: EnterAction;
  firstResultRef: RefObject<HTMLButtonElement | null>;
}

export function useStoreSearch(
  store: Store,
  country: string,
  value: string,
): StoreSearch {
  const input = classifyInput(value);
  const q =
    isSearchable(input) && marketError(store, country) === null ? input.q : "";
  const [term, setTerm] = useState(q);
  const firstResultRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(q), STORE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const query = useQuery({
    ...storeSearchOptions(store, country, term),
    enabled: term !== "",
    placeholderData: keepPreviousData,
  });

  const current = q !== "" && term === q;
  const settled = current && query.isSuccess && !query.isPlaceholderData;
  const results = q === "" ? undefined : query.data;

  return {
    input,
    q,
    results,
    pending: q !== "" && !settled && !query.isError,
    settled,
    error: current ? query.error : null,
    retry: () => void query.refetch(),
    enter: enterAction(results, settled),
    firstResultRef,
  };
}
