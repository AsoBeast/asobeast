import { REVIEW_THEMES_BASELINE, type ReviewSort } from "@asobeast/shared";
import { formatNumber, pluralize } from "@/lib/format";

const COUNTED_REVIEW: Record<ReviewSort, string> = {
  newest: "newest review",
  lowest: "lowest rated review",
};

export function themesSummary({
  negativeScoreMax,
  reviews,
  sort,
}: {
  negativeScoreMax: number;
  reviews: number;
  sort: ReviewSort;
}): string {
  return `Complaints come up mostly in reviews at ${pluralize(negativeScoreMax, "star")} or less, praise mostly in the others, compared with the newest ${formatNumber(REVIEW_THEMES_BASELINE)} reviews of the version and period. Counts cover the ${pluralize(reviews, COUNTED_REVIEW[sort])} matching the filters. Pick one to list the reviews it counts.`;
}
