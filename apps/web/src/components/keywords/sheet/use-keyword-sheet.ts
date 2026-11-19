import { useEffect, useRef } from "react";
import { keywordSheetParser } from "@/lib/search-params";
import { useUrlSheet } from "@/lib/use-url-sheet";

export const KEYWORD_SHEET_KEY = "keyword";

export function useKeywordSheet() {
  const {
    shownId: keywordId,
    open,
    step,
    close,
  } = useUrlSheet(KEYWORD_SHEET_KEY, keywordSheetParser);
  return { keywordId, open, step, close };
}

export function useCloseWhenShownKeywordLeaves(
  keywordId: string,
  shown: boolean,
  close: () => void,
) {
  const lastShown = useRef("");
  useEffect(() => {
    if (shown) {
      lastShown.current = keywordId;
      return;
    }
    const left = keywordId !== "" && lastShown.current === keywordId;
    lastShown.current = "";
    if (left) close();
  }, [keywordId, shown, close]);
}
