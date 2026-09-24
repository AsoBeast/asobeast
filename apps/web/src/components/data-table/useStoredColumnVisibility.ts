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
  phoneColumnVisibility,
  readStoredColumns,
  writeColumnVisibility,
} from "@/lib/table/column-visibility";
import { useIsMobile } from "@/lib/use-is-mobile";

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

const NO_HIDDEN_COLUMNS: ColumnVisibilityState = {};

export function useStoredColumnVisibility(
  table: string,
  columns: Parameters<typeof phoneColumnVisibility>[0],
) {
  const isMobile = useIsMobile();
  const fallback = useMemo(
    () => (isMobile ? phoneColumnVisibility(columns) : NO_HIDDEN_COLUMNS),
    [isMobile, columns],
  );
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
        stored ?? NO_HIDDEN_COLUMNS,
        visibility,
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
    [table, stored, visibility, fallback],
  );

  return [visibility, setVisibility] as const;
}
