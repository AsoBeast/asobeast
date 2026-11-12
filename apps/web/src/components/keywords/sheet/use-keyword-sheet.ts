import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import { keywordSheetParser } from "@/lib/search-params";
import { sheetHistory } from "./sheet-history";

export const KEYWORD_SHEET_KEY = "keyword";

export function useKeywordSheet() {
  const [keywordId, setKeywordId] = useQueryState(
    KEYWORD_SHEET_KEY,
    keywordSheetParser,
  );
  const [history] = useState(sheetHistory);
  useEffect(() => {
    if (keywordId === "") history.cleared();
  }, [keywordId, history]);

  const open = useCallback(
    (next: string) => history.opened(setKeywordId(next, { history: "push" })),
    [history, setKeywordId],
  );

  const step = useCallback(
    (next: string) => void setKeywordId(next),
    [setKeywordId],
  );

  const close = useCallback(() => {
    if (history.closing() === "back") window.history.back();
    else void setKeywordId("");
  }, [history, setKeywordId]);

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
