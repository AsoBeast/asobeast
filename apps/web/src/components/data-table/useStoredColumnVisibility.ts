"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  functionalUpdate,
  type ColumnVisibilityState,
  type Updater,
} from "@tanstack/react-table";
import {
  columnChoices,
  parseColumnVisibility,
  readStoredColumns,
  writeColumnVisibility,
} from "@/lib/table/column-visibility";

const listeners = new Set<() => void>();
const unsaved = new Map<string, string>();
const localStorage = () => window.localStorage;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useStoredColumnVisibility(
  table: string,
  fallback: ColumnVisibilityState,
) {
  const raw = useSyncExternalStore(
    subscribe,
    () => unsaved.get(table) ?? readStoredColumns(localStorage, table),
    () => null,
  );
  const stored = useMemo(() => parseColumnVisibility(raw), [raw]);
  const visibility = useMemo(
    () => ({ ...fallback, ...stored }),
    [fallback, stored],
  );

  const setVisibility = useCallback(
    (updater: Updater<ColumnVisibilityState>) => {
      const choices = columnChoices(
        functionalUpdate(updater, visibility),
        fallback,
      );
      if (writeColumnVisibility(localStorage, table, choices)) {
        unsaved.delete(table);
      } else {
        unsaved.set(table, JSON.stringify(choices));
      }
      listeners.forEach((listener) => listener());
    },
    [table, visibility, fallback],
  );

  return [visibility, setVisibility] as const;
}
