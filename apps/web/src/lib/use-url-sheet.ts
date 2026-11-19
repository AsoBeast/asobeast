import { useCallback, useEffect, useState } from "react";
import { useQueryState, type UseQueryStateOptions } from "nuqs";
import { sheetHistory } from "./sheet-history";

export type UrlSheetParser = UseQueryStateOptions<string> & {
  defaultValue: string;
};

export function useUrlSheet(key: string, parser: UrlSheetParser) {
  const [shownId, setShownId] = useQueryState(key, parser);
  const [history] = useState(sheetHistory);
  useEffect(() => {
    if (shownId === "") history.cleared();
  }, [shownId, history]);

  const open = useCallback(
    (next: string) => history.opened(setShownId(next, { history: "push" })),
    [history, setShownId],
  );

  const step = useCallback(
    (next: string) => void setShownId(next),
    [setShownId],
  );

  const close = useCallback(() => {
    if (history.closing() === "back") window.history.back();
    else void setShownId("");
  }, [history, setShownId]);

  return { shownId, open, step, close };
}
