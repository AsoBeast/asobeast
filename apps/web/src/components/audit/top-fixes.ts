import type {
  AuditRecommendation,
  AuditRecommendations,
} from "@asobeast/shared";
import { BUCKETS } from "./audit-copy";

export const TOP_FIXES_COUNT = 3;

export function topFixes(
  recommendations: AuditRecommendations,
  count = TOP_FIXES_COUNT,
): AuditRecommendation[] {
  return BUCKETS.flatMap((bucket, order) =>
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
