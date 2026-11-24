"use client";

import { useEffect, useRef } from "react";
import { useQueryState } from "nuqs";
import { pendingFocusStep } from "@/lib/focus-handoff";
import { ideasSeedParser } from "@/lib/search-params";
import { firstKeywordMenu, releaseIdeasOpener } from "./ideas-opener";

interface Return {
  target: HTMLElement;
  leaving: HTMLElement | null;
}

let pending: Return | null = null;

export function useIdeasReturn(): string {
  const [seed] = useQueryState("ideas", ideasSeedParser);
  const previous = useRef(seed);
  useEffect(() => {
    const cleared = previous.current !== "" && seed === "";
    previous.current = seed;
    if (cleared && pending === null) {
      const target = releaseIdeasOpener() ?? firstKeywordMenu();
      const active = document.activeElement;
      if (target) {
        pending = {
          target,
          leaving: active instanceof HTMLElement ? active : null,
        };
      }
    }
    if (pending === null || seed !== "") return;
    const step = pendingFocusStep(pending.target, pending.leaving);
    if (step === "wait") return;
    const { target } = pending;
    pending = null;
    if (step === "focus") target.focus();
  });
  return seed;
}

export function useIdeasSeed() {
  const [seed, setSeed] = useQueryState("ideas", ideasSeedParser);
  const sectionToggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    const active = document.activeElement;
    const target =
      releaseIdeasOpener() ?? firstKeywordMenu() ?? sectionToggle.current;
    pending = target
      ? { target, leaving: active instanceof HTMLElement ? active : null }
      : null;
    void setSeed(null);
  };
  return { seed, seeded: seed.length > 0, sectionToggle, close };
}
