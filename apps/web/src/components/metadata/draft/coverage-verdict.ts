import type { CoveragePreviewResult } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

export interface CoverageVerdictFigures {
  total: number;
  draft: number;
  live: number;
}

export function coverageVerdict({
  counts,
}: Pick<CoveragePreviewResult, "counts">): CoverageVerdictFigures | null {
  const total = counts.lost + counts.gained + counts.missing + counts.kept;
  if (total === 0) return null;
  return {
    total,
    draft: counts.gained + counts.kept,
    live: counts.lost + counts.kept,
  };
}

export const coverageShare = ({ draft, total }: CoverageVerdictFigures) =>
  (draft / total) * 100;

export function verdictSentence({
  total,
  draft,
  live,
}: CoverageVerdictFigures): string {
  const covers = `The draft covers ${formatNumber(draft)} of ${formatNumber(total)} tracked keywords`;
  const change = draft - live;
  if (change === 0) return `${covers}.`;
  const way = change > 0 ? "more" : "fewer";
  return `${covers}, ${formatNumber(Math.abs(change))} ${way} than the live listing.`;
}
