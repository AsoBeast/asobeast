"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  functionalUpdate,
  type ColumnVisibilityState,
  type Updater,
} from "@tanstack/react-table";
import {
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
    () => readStoredColumns(localStorage, table) ?? unsaved.get(table) ?? null,
    () => null,
  );
  const stored = useMemo(() => parseColumnVisibility(raw), [raw]);
  const visibility = stored ?? fallback;

  const setVisibility = useCallback(
    (updater: Updater<ColumnVisibilityState>) => {
      const next = functionalUpdate(updater, visibility);
      if (!writeColumnVisibility(localStorage, table, next)) {
        unsaved.set(table, JSON.stringify(next));
      }
      listeners.forEach((listener) => listener());
    },
    [table, visibility],
  );

  return [visibility, setVisibility] as const;
}
