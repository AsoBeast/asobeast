"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  functionalUpdate,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  parseStoredSort,
  readStoredSort,
  removeStoredSort,
  sortDefaultsOf,
  sortingFromUrl,
  urlFromSorting,
  writeStoredSort,
  type SortDirection,
  type StoredSort,
} from "@/lib/table/sorting";

export interface UrlSort {
  sort: string | null;
  dir: SortDirection | null;
}

export interface UrlSortingOptions {
  remember?: string;
  defaultSort?: string;
}

const localStorage = () => window.localStorage;

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function resolveChosenSort(
  { sort, dir }: UrlSort,
  remembered: StoredSort | null,
  defaultSort: string | undefined,
): StoredSort | null {
  if (sort !== null) return { sort, dir };
  if (dir !== null && defaultSort !== undefined)
    return { sort: defaultSort, dir };
  return (
    remembered ??
    (defaultSort === undefined ? null : { sort: defaultSort, dir: null })
  );
}

export function useUrlSorting(
  { sort, dir }: UrlSort,
  columns: Parameters<typeof sortDefaultsOf>[0],
  onChange: (next: UrlSort) => void,
  options: UrlSortingOptions = {},
) {
  const { remember, defaultSort } = options;
  const defaults = useMemo(() => sortDefaultsOf(columns), [columns]);
  const known = useMemo(
    () => new Set(columns.flatMap((column) => (column.id ? [column.id] : []))),
    [columns],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () =>
      remember === undefined ? null : readStoredSort(localStorage, remember),
    () => null,
  );
  const remembered = useMemo(
    () => (remember === undefined ? null : parseStoredSort(raw, known)),
    [remember, raw, known],
  );
  const chosen = useMemo(
    () => resolveChosenSort({ sort, dir }, remembered, defaultSort),
    [sort, dir, remembered, defaultSort],
  );
  const sorting = useMemo(
    () =>
      chosen === null ? [] : sortingFromUrl(chosen.sort, chosen.dir, defaults),
    [chosen, defaults],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const { sort: nextSort, dir: nextDir } = urlFromSorting(
        functionalUpdate(updater, sorting),
        defaults,
      );
      if (remember !== undefined) {
        if (nextSort === null) removeStoredSort(localStorage, remember);
        else
          writeStoredSort(localStorage, remember, {
            sort: nextSort,
            dir: nextDir,
          });
      }
      onChange({ sort: nextSort, dir: nextDir });
    },
    [onChange, sorting, defaults, remember],
  );

  return { sorting, onSortingChange };
}
