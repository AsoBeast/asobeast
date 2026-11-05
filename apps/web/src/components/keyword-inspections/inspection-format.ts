import type {
  KeywordInspectionCompetition,
  KeywordInspectionStatus,
  KeywordInspectionTitleMatch,
} from "@asobeast/shared";
import { formatCompact, formatNumber, formatRating } from "@/lib/format";

export const DEFAULT_INSPECTION_COUNTRY = "us";

export const TITLE_MATCH_LABELS: Record<KeywordInspectionTitleMatch, string> = {
  exact: "Exact phrase",
  allWords: "All words",
  someWords: "Some words",
  none: "No match",
};

export const INSPECTION_STATUS_LABELS: Record<KeywordInspectionStatus, string> =
  {
    PENDING: "Running",
    DONE: "Done",
    FAILED: "Failed",
  };

export const inspectionCountry = (country: string): string =>
  country === "" ? DEFAULT_INSPECTION_COUNTRY : country;

export function shownScore(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

export function scoreChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return Math.round(current) - Math.round(previous);
}

export function signedChange(change: number | null): string {
  if (change === null) return "—";
  if (change === 0) return "no change";
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

export interface CompetitionFact {
  label: string;
  value: string;
  note: string;
}

const countOrDash = (value: number | null): string =>
  value === null ? "—" : formatCompact(value);

export function competitionFacts(
  competition: KeywordInspectionCompetition,
): CompetitionFact[] {
  const top = competition.topCount;
  return [
    {
      label: "Typical ratings",
      value: countOrDash(competition.medianRatingCount),
      note: `Median of the top ${top}`,
    },
    {
      label: "Strongest app",
      value: countOrDash(competition.strongestRatingCount),
      note: "Most ratings in the top results",
    },
    {
      label: "Average rating",
      value:
        competition.averageRating === null
          ? "—"
          : formatRating(competition.averageRating),
      note: `Across the top ${top}`,
    },
    {
      label: "Titles that target it",
      value: `${formatNumber(competition.titleMatches)} of ${formatNumber(top)}`,
      note: `${formatNumber(competition.exactTitleMatches)} with the exact phrase`,
    },
    {
      label: "Heavyweights",
      value: `${formatNumber(competition.appsOverHundredThousandRatings)} of ${formatNumber(top)}`,
      note: "Apps with 100K ratings or more",
    },
    {
      label: "Recently updated",
      value: `${formatNumber(competition.freshlyUpdated)} of ${formatNumber(top)}`,
      note:
        competition.medianDaysSinceUpdate === null
          ? "Update dates unavailable"
          : `Typical update ${formatNumber(competition.medianDaysSinceUpdate)} days ago`,
    },
  ];
}
