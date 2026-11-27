"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useQueryState } from "nuqs";
import { pendingFocusStep } from "@/lib/focus-handoff";
import { ideasSeedParser } from "@/lib/search-params";
import { createIdeasHistory } from "./ideas-history";
import { ideasCloseTarget } from "./ideas-opener";

const ideasHistory = createIdeasHistory();
let closedFrom: HTMLElement | null = null;

const currentSearch = () => new URLSearchParams(window.location.search);

function forgetIdeasClose(): void {
  ideasHistory.cleared();
  closedFrom = null;
}

export function useIdeasReturn(
  fallback: RefObject<HTMLElement | null>,
): string {
  const [seed] = useQueryState("ideas", ideasSeedParser);
  const previous = useRef(seed);
  useEffect(() => forgetIdeasClose, []);
  useEffect(() => {
    const cleared = previous.current !== "" && seed === "";
    previous.current = seed;
    if (!cleared) return;
    const leaving = closedFrom;
    forgetIdeasClose();
    const target = ideasCloseTarget() ?? fallback.current;
    if (target && pendingFocusStep(target, leaving) !== "drop") target.focus();
  }, [seed, fallback]);
  return seed;
}

export function useOpenIdeas(): (seed: string) => void {
  const [seed, setSeed] = useQueryState("ideas", ideasSeedParser);
  const shown = seed !== "";
  return useCallback(
    (next: string) => {
      if (shown) ideasHistory.switched(currentSearch(), setSeed(next));
      else ideasHistory.opened(setSeed(next, { history: "push" }));
    },
    [shown, setSeed],
  );
}

export function useIdeasSeed() {
  const [seed, setSeed] = useQueryState("ideas", ideasSeedParser);
  const close = () => {
    const active = document.activeElement;
    closedFrom = active instanceof HTMLElement ? active : null;
    if (ideasHistory.closing(currentSearch()) === "back") window.history.back();
    else void setSeed(null);
  };
  return { seed, seeded: seed !== "", close };
}
