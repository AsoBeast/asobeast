import type { AuditScorePoint } from "@asobeast/shared";

type RubricLabelPosition = "insideLeft" | "insideRight";

export interface RubricChange {
  date: string;
  version: string;
  labelPosition: RubricLabelPosition | null;
}

const LABEL_EDGE_SHARE = 0.1;

export const labelPosition = (
  index: number,
  total: number,
): RubricLabelPosition | null => {
  const ratio = total > 1 ? index / (total - 1) : 1;
  if (ratio >= 1 - LABEL_EDGE_SHARE) return "insideRight";
  if (ratio <= LABEL_EDGE_SHARE) return "insideLeft";
  return null;
};

export function rubricChanges(points: AuditScorePoint[]): RubricChange[] {
  const changes: RubricChange[] = [];
  let previous: string | null = null;
  points.forEach((point, index) => {
    const version = point.rubricVersion;
    if (version === undefined) return;
    if (previous !== null && version !== previous) {
      changes.push({
        date: point.date,
        version,
        labelPosition: labelPosition(index, points.length),
      });
    }
    previous = version;
  });
  return changes;
}
