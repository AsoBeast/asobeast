import { displayedTenths } from "@/lib/ratings-goal";

export type NewRatingsParts = [string, number, string, number];

function comparedWith(value: number, overall: number): string {
  const shown = displayedTenths(value);
  const overallShown = displayedTenths(overall);
  if (shown > overallShown) return "above";
  return shown < overallShown ? "below" : "level with";
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
