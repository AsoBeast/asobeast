"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQueryState } from "nuqs";
import { breakdownParser } from "@/lib/search-params";

export interface BreakdownOpener {
  remember: (element: HTMLElement) => void;
  openerOf: (keywordId: string) => HTMLElement | null;
}

export const openerFor = (
  element: HTMLElement | null,
  keywordId: string,
): HTMLElement | null =>
  element?.isConnected && element.dataset.breakdownKeyword === keywordId
    ? element
    : null;

const BreakdownOpenerContext = createContext<BreakdownOpener | null>(null);

export function BreakdownOpenerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  const opener = useMemo<BreakdownOpener>(
    () => ({
      remember: (element) => {
        ref.current = element;
      },
      openerOf: (keywordId) => openerFor(ref.current, keywordId),
    }),
    [],
  );
  return (
    <BreakdownOpenerContext value={opener}>{children}</BreakdownOpenerContext>
  );
}

export function useBreakdownOpener(): BreakdownOpener {
  const opener = useContext(BreakdownOpenerContext);
  if (opener === null) {
    throw new Error("useBreakdownOpener needs a BreakdownOpenerProvider");
  }
  return opener;
}

export function useOpenBreakdown(): (
  keywordId: string,
  element: HTMLElement,
) => void {
  const opener = useBreakdownOpener();
  const [, setKeyword] = useQueryState("keyword", breakdownParser);
  return useCallback(
    (keywordId, element) => {
      opener.remember(element);
      void setKeyword(keywordId);
    },
    [opener, setKeyword],
  );
}
