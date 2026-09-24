"use client";

import { useCallback, useMemo } from "react";
import {
  functionalUpdate,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  sortDefaultsOf,
  sortingFromUrl,
  urlFromSorting,
  type SortDirection,
} from "@/lib/table/sorting";

export interface UrlSort {
  sort: string | null;
  dir: SortDirection | null;
}

export function useUrlSorting(
  { sort, dir }: UrlSort,
  columns: Parameters<typeof sortDefaultsOf>[0],
  onChange: (next: UrlSort) => void,
) {
  const defaults = useMemo(() => sortDefaultsOf(columns), [columns]);
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
