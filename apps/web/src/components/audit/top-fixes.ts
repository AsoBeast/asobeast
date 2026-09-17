import type {
  AuditRecommendation,
  AuditRecommendations,
} from "@asobeast/shared";

export const TOP_FIXES_COUNT = 3;

const BUCKET_ORDER = [
  "quickWins",
  "highImpact",
  "strategic",
] as const satisfies readonly (keyof AuditRecommendations)[];

export function topFixes(
  recommendations: AuditRecommendations,
  count = TOP_FIXES_COUNT,
): AuditRecommendation[] {
  return BUCKET_ORDER.flatMap((bucket, order) =>
    recommendations[bucket].map((item) => ({ item, order })),
  )
    .sort(
      (a, b) =>
        (b.item.lift ?? 0) - (a.item.lift ?? 0) ||
        a.order - b.order ||
        a.item.checkId.localeCompare(b.item.checkId),
    )
    .slice(0, count)
    .map((entry) => entry.item);
}
