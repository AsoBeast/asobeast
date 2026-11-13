import type { ReviewItem } from "@asobeast/shared";

export interface VersionRating {
  version: string;
  reviews: number;
  average: number;
}

export function versionRatings(
  reviews: readonly Pick<ReviewItem, "version" | "score">[],
  order: readonly string[],
): VersionRating[] {
  const scores = new Map<string, number[]>();
  for (const review of reviews) {
    if (!review.version) continue;
    const known = scores.get(review.version);
    if (known) known.push(review.score);
    else scores.set(review.version, [review.score]);
  }
  const place = (version: string) => {
    const index = order.indexOf(version);
    return index === -1 ? order.length : index;
  };
  return [...scores.entries()]
    .map(([version, values]) => ({
      version,
      reviews: values.length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => place(a.version) - place(b.version));
}
