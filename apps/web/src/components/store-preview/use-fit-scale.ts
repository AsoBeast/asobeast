"use client";

import { useCallback, useState } from "react";

export function useFitScale(
  width: number,
): [
  measure: (element: HTMLElement | null) => (() => void) | undefined,
  scale: number,
] {
  const [scale, setScale] = useState(1);
  const measure = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return undefined;
      const observer = new ResizeObserver(([entry]) => {
        const room = entry?.contentBoxSize[0]?.inlineSize ?? 0;
        if (room > 0) setScale(Math.min(1, room / width));
      });
      observer.observe(element);
      return () => observer.disconnect();
    },
    [width],
  );
  return [measure, scale];
}
