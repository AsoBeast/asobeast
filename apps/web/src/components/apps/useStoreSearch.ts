"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Store, StoreSearchResult } from "@asobeast/shared";
import { marketError } from "@/lib/countries";
import { storeSearchOptions } from "@/lib/queries";
import {
  classifyInput,
  enterAction,
  isSearchable,
  STORE_SEARCH_DEBOUNCE_MS,
  STORE_SEARCH_MIN_CHARS,
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
  firstResultRef: RefObject<HTMLButtonElement | null>;
  enterName: (pick: (result: StoreSearchResult) => void) => string | null;
}

const SHORT_NAME = `Type at least ${STORE_SEARCH_MIN_CHARS} characters to search.`;

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
    enabled: q !== "" && term === q,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === store &&
      previousQuery.queryKey[2] === country
        ? previous
        : undefined,
  });

  const current = q !== "" && term === q;
  const settled = current && query.isSuccess && !query.isPlaceholderData;
  const results = q === "" ? undefined : query.data;

  function enterName(pick: (result: StoreSearchResult) => void) {
    if (input.kind !== "name") return null;
    if (!isSearchable(input)) return SHORT_NAME;
    const enter = enterAction(results, settled);
    if (enter.kind === "pick") pick(enter.result);
    if (enter.kind === "focus") firstResultRef.current?.focus();
    if (enter.kind === "none") setTerm(q);
    return null;
  }

  return {
    input,
    q,
    results,
    pending: q !== "" && !settled && !(current && query.isError),
    settled,
    error: current ? query.error : null,
    retry: () => {
      if (current) void query.refetch();
    },
    firstResultRef,
    enterName,
  };
}
