import { useCallback, useState } from "react";

const rootFontSize = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

export function useNarrowerThan(
  rem: number,
): [
  measure: (element: HTMLElement | null) => (() => void) | undefined,
  narrow: boolean,
] {
  const [narrow, setNarrow] = useState(false);
  const measure = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return undefined;
      const observer = new ResizeObserver(([entry]) =>
        setNarrow(entry.borderBoxSize[0].inlineSize < rem * rootFontSize()),
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [rem],
  );
  return [measure, narrow];
}
