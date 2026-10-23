import type { AppAnnotationItem } from "@asobeast/shared";

export function annotationLines(
  annotations: readonly AppAnnotationItem[],
  plotted: readonly string[],
  today: string,
): AppAnnotationItem[] {
  const plottedSet = new Set(plotted);
  return annotations.filter(
    (annotation) =>
      annotation.date !== today && plottedSet.has(annotation.date),
  );
}

export function annotationsOn(
  annotations: readonly AppAnnotationItem[],
  date: string,
): AppAnnotationItem[] {
  return annotations.filter((annotation) => annotation.date === date);
}

export function annotationsInScope(
  annotations: readonly AppAnnotationItem[],
  market: string | undefined,
): AppAnnotationItem[] {
  if (market === undefined) return [...annotations];
  return annotations.filter(
    (annotation) => !annotation.market || annotation.market === market,
  );
}

export function annotationsInMarkets(
  annotations: readonly AppAnnotationItem[],
  markets: readonly string[],
): AppAnnotationItem[] {
  if (markets.length === 0) return [...annotations];
  const set = new Set(markets);
  return annotations.filter(
    (annotation) => !annotation.market || set.has(annotation.market),
  );
}
