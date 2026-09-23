"use client";

import { useCallback, useMemo } from "react";
import {
  functionalUpdate,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  sortingFromUrl,
  urlFromSorting,
  type SortDefaults,
  type SortDirection,
} from "@/lib/table/sorting";

export interface UrlSort {
  sort: string | null;
  dir: SortDirection | null;
}

export function useUrlSorting(
  { sort, dir }: UrlSort,
  defaults: SortDefaults,
  onChange: (next: UrlSort) => void,
) {
  const sorting = useMemo(
    () => (sort === null ? [] : sortingFromUrl(sort, dir, defaults)),
    [sort, dir, defaults],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) =>
      onChange(urlFromSorting(functionalUpdate(updater, sorting), defaults)),
    [onChange, sorting, defaults],
  );

  return { sorting, onSortingChange };
}
