import type { AppAnnotationItem } from "@asobeast/shared";

export const ANNOTATION_LINE_LABEL_MAX = 32;

export function annotationChartLabel(label: string): string {
  return label.length > ANNOTATION_LINE_LABEL_MAX
    ? `${label.slice(0, ANNOTATION_LINE_LABEL_MAX - 1)}…`
    : label;
}

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
