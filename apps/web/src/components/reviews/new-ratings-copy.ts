import { formatRating } from "@/lib/format";

export type NewRatingsParts = [string, number, string, number];

const shown = (value: number): number => Number(formatRating(value));

function comparedWith(value: number, overall: number): string {
  if (shown(value) > shown(overall)) return "above";
  return shown(value) < shown(overall) ? "below" : "level with";
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
