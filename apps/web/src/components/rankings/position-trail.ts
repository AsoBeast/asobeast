import type { RankingPoint } from "@asobeast/shared";

export function positionTrail(points: readonly RankingPoint[]): number[] {
  return points.map((point) => -(point.position ?? point.depth + 1));
}
