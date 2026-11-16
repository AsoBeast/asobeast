"use client";

import { useCallback, useRef } from "react";
import { armFocusHandoff } from "@/lib/focus-handoff";

export function useAnswerFocus(key: string) {
  const origin = useRef<Element | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  const watchForm = useCallback((node: HTMLFormElement | null) => {
    form.current = node;
  }, []);

  const hold = useCallback(() => {
    origin.current = document.activeElement;
  }, []);

  const hand = useCallback(() => {
    const focused = document.activeElement;
    if (focused === origin.current || form.current?.contains(focused)) {
      armFocusHandoff(key);
    }
    origin.current = null;
  }, [key]);

  return { watchForm, hold, hand };
}
