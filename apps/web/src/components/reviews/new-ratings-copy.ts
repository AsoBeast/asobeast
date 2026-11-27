import { formatRating } from "@/lib/format";

export const NEW_RATINGS_GUIDE =
  "https://docs.asobeast.com/guides/reviews#new-ratings-average";

export type NewRatingsParts = [string, number, string, number];

export type BenchmarkParts = [string, number, string];

const shown = (value: number): number => Number(formatRating(value));

export function comparedWith(value: number, other: number): string {
  if (shown(value) > shown(other)) return "above";
  return shown(value) < shown(other) ? "below" : "level with";
}

export function newRatingsParts(
  value: number,
  overall: number,
  days: number,
): NewRatingsParts {
  return [
    "New ratings average",
    value,
    `over ${days} days, ${comparedWith(value, overall)} your overall`,
    overall,
  ];
}

export function tooFewNewRatings(days: number): string {
  return `Too few new ratings over ${days} days to work out their average.`;
}

export function benchmarkParts(
  median: number,
  count: number,
  days: number,
  own: number | null,
): BenchmarkParts {
  const span = `over ${days} days (median of ${count})`;
  return [
    "Your tracked competitors' new ratings average",
    median,
    own === null ? span : `${span}, ${comparedWith(median, own)} yours`,
  ];
}

export const tooFewCompetitors =
  "Fewer than three of your tracked competitors have enough new ratings to compare.";
