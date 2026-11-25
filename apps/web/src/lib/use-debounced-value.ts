"use client";

import { useCallback, useEffect, useState } from "react";

export interface Debounced<T> {
  push(value: T): void;
  cancel(): void;
}

export function debounce<T>(
  delayMs: number,
  apply: (value: T) => void,
): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => clearTimeout(timer);
  return {
    push(value) {
      cancel();
      timer = setTimeout(() => apply(value), delayMs);
    },
    cancel,
  };
}

export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
): readonly [T, () => void] {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const scheduler = debounce(delayMs, setSettled);
    scheduler.push(value);
    return scheduler.cancel;
  }, [value, delayMs]);
  const settle = useCallback(() => setSettled(value), [value]);
  return [settled, settle] as const;
}
