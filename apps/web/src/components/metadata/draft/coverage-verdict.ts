import type { CoveragePreviewResult } from "@asobeast/shared";

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
