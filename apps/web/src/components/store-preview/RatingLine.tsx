import { formatCompact, formatRating } from "@/lib/format";
import type { PreviewRating } from "@/lib/store-preview/preview-listing";

const STARS = 5;

const starsOf = (average: number): string => {
  const filled = Math.min(STARS, Math.max(0, Math.round(average)));
  return `${"★".repeat(filled)}${"☆".repeat(STARS - filled)}`;
};

export function RatingLine({ rating }: { rating: PreviewRating | null }) {
  if (rating === null) {
    return (
      <span className="text-tick text-muted-foreground">No ratings yet</span>
    );
  }
  return (
    <span className="numeric flex items-center gap-1 text-tick text-muted-foreground">
      <span className="text-foreground">{starsOf(rating.average)}</span>
      <span>{formatRating(rating.average)}</span>
      <span>{formatCompact(rating.count)}</span>
    </span>
  );
}
