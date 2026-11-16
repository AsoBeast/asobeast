"use client";

import { useRef } from "react";
import { armFocusHandoff } from "@/lib/focus-handoff";

export function useAnswerFocus(key: string) {
  const origin = useRef<Element | null>(null);
  return {
    hold: () => {
      origin.current = document.activeElement;
    },
    hand: () => {
      if (document.activeElement === origin.current) armFocusHandoff(key);
      origin.current = null;
    },
  };
}
