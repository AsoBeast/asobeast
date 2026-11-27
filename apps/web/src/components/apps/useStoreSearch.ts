"use client";

import { useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Store, StoreSearchResult } from "@asobeast/shared";
import { marketError } from "@/lib/countries";
import { storeSearchOptions } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  classifyInput,
  enterAction,
  isSearchable,
  nameTooLongText,
  STORE_SEARCH_DEBOUNCE_MS,
  STORE_SEARCH_MIN_CHARS,
  type StoreInput,
} from "./store-search";

export interface StoreSearch {
  input: StoreInput;
  problem: string | null;
  q: string;
  results: StoreSearchResult[] | undefined;
  pending: boolean;
  settled: boolean;
  error: unknown;
  retry: () => void;
  firstResultRef: RefObject<HTMLButtonElement | null>;
  enterName: (pick: (result: StoreSearchResult) => void) => string | null;
}

export function useStoreSearch(
  store: Store,
  country: string,
  value: string,
): StoreSearch {
  const t = useTranslations("apps");
  const validationT = useTranslations("validation");
  const input = classifyInput(value, t);
  const problem = nameTooLongText(input, t);
  const q =
    isSearchable(input) && marketError(store, country, validationT) === null
      ? input.q
      : "";
  const [term, settleTerm] = useDebouncedValue(q, STORE_SEARCH_DEBOUNCE_MS);
  const firstResultRef = useRef<HTMLButtonElement>(null);

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
    if (problem) return problem;
    if (!isSearchable(input)) {
      return t("import.shortName", { count: STORE_SEARCH_MIN_CHARS });
    }
    const enter = enterAction(results, settled);
    if (enter.kind === "pick") pick(enter.result);
    if (enter.kind === "focus") firstResultRef.current?.focus();
    if (enter.kind === "none") settleTerm();
    return null;
  }

  return {
    input,
    problem,
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
