"use client";

import { useEffect, useRef } from "react";
import { SELECT_ALL_KEYWORDS } from "./keyword-columns";

export function useClearedSelectionFocus(
  selectedCount: number,
  clear: () => void,
) {
  const tableArea = useRef<HTMLDivElement>(null);
  const refocusTable = useRef(false);
  const clearSelection = () => {
    refocusTable.current = true;
    clear();
  };

  useEffect(() => {
    if (!refocusTable.current || selectedCount > 0) return;
    refocusTable.current = false;
    tableArea.current
      ?.querySelector<HTMLElement>(`[aria-label="${SELECT_ALL_KEYWORDS}"]`)
      ?.focus();
  }, [selectedCount]);

  return { tableArea, clearSelection };
}

export function useEmptiedListFocus(isEmpty: boolean) {
  const showedTable = useRef(!isEmpty);
  const addKeywords = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const emptied = isEmpty && showedTable.current;
    showedTable.current = !isEmpty;
    if (emptied && document.activeElement === document.body) {
      addKeywords.current?.focus();
    }
  }, [isEmpty]);
  return addKeywords;
}
