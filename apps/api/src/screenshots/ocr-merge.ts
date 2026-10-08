import type { OcrLine } from './caption-text';

export const MERGE_OVERLAP_SHARE = 0.5;

const area = (line: OcrLine): number => line.width * line.height;

function overlaps(a: OcrLine, b: OcrLine): boolean {
  const width =
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) return false;
  return width * height >= MERGE_OVERLAP_SHARE * Math.min(area(a), area(b));
}

export function mergeOverlapping(
  passes: readonly (readonly OcrLine[])[],
): OcrLine[] {
  const kept: OcrLine[] = [];
  const byConfidence = passes
    .flat()
    .sort((a, b) => b.confidence - a.confidence);
  for (const line of byConfidence) {
    if (!kept.some((other) => overlaps(line, other))) kept.push(line);
  }
  return kept;
}
