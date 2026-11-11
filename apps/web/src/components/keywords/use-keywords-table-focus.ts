"use client";

import { useEffect, useRef, type RefObject } from "react";
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

export function useEmptiedListFocus(
  isEmpty: boolean,
  addKeywords: RefObject<HTMLElement | null>,
) {
  const showedTable = useRef(!isEmpty);
  useEffect(() => {
    const emptied = isEmpty && showedTable.current;
    showedTable.current = !isEmpty;
    if (emptied && document.activeElement === document.body) {
      addKeywords.current?.focus();
    }
  }, [isEmpty, addKeywords]);
}
