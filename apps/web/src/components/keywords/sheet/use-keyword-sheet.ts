import { useCallback, useEffect, useRef } from "react";
import { useQueryState } from "nuqs";
import { keywordSheetParser } from "@/lib/search-params";

export const KEYWORD_SHEET_KEY = "keyword";

export function useKeywordSheet() {
  const [keywordId, setKeywordId] = useQueryState(
    KEYWORD_SHEET_KEY,
    keywordSheetParser,
  );
  const openedHere = useRef(false);
  useEffect(() => {
    if (keywordId === "") openedHere.current = false;
  }, [keywordId]);

  const open = useCallback(
    (next: string) => {
      openedHere.current = true;
      void setKeywordId(next, { history: "push" });
    },
    [setKeywordId],
  );

  const step = useCallback(
    (next: string) => void setKeywordId(next),
    [setKeywordId],
  );

  const close = useCallback(() => {
    if (!openedHere.current) {
      void setKeywordId("");
      return;
    }
    openedHere.current = false;
    window.history.back();
  }, [setKeywordId]);

  return { keywordId, open, step, close };
}
