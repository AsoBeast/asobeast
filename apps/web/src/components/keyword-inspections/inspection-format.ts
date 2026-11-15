import {
  DAY_SECONDS,
  normalizeText,
  type KeywordInspectionCompetition,
  type KeywordInspectionResult,
  type KeywordInspectionSummary,
  type PlanLimits,
  type ScoreSignals,
  type SerpTitleMatch,
  type Store,
} from "@asobeast/shared";
import {
  formatCompact,
  formatCountry,
  formatNumber,
  formatRating,
  pluralize,
  storeLabel,
} from "@/lib/format";

const DEFAULT_INSPECTION_COUNTRY = "us";

export const TITLE_MATCH_LABELS: Record<SerpTitleMatch, string> = {
  phrase: "Exact phrase",
  words: "All words",
  partial: "Some words",
  none: "No match",
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

export type ChangeTone = "better" | "worse" | "same";

export function changeTone(
  change: number | null,
  higherIsBetter: boolean,
): ChangeTone {
  if (change === null || change === 0) return "same";
  return change > 0 === higherIsBetter ? "better" : "worse";
}

export function updatedAgo(days: number): string {
  return days === 0
    ? "Typically updated today"
    : `Typical update ${pluralize(days, "day")} ago`;
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
  newcomers: number | null = null,
): CompetitionFact[] {
  const top = competition.topCount;
  const newcomerFact: CompetitionFact[] =
    newcomers === null
      ? []
      : [
          {
            label: "Newcomers",
            value: `${formatNumber(newcomers)} of ${formatNumber(top)}`,
            note: "Released in the last year",
          },
        ];
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
          : updatedAgo(competition.medianDaysSinceUpdate),
    },
    ...newcomerFact,
  ];
}

const DAY_MS = 86_400_000;
const NEWCOMER_DAYS = 365;
const MONTH_DAYS = 30;
const MONTHS_FROM_DAYS = 60;

export const storefrontCode = (store: Store, country: string): string =>
  `${storeLabel(store)} · ${country.toUpperCase()}`;

export const storefrontName = (store: Store, country: string): string =>
  `${storeLabel(store)} · ${formatCountry(country)}`;

const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS);

export function inspectionCostText(
  limits: Pick<PlanLimits, "onDemand"> | undefined,
): string {
  const score = limits?.onDemand?.score;
  if (!score) return "Each inspection reads the store once.";
  if (score.limit === 0) return "Your plan includes no on demand scores.";
  const window = score.windowSeconds === DAY_SECONDS ? "a day" : "an hour";
  return `Each inspection uses one of the ${formatNumber(score.limit)} on demand scores your plan allows ${window}.`;
}

export function sinceUpdate(
  updatedAt: string | null,
  at: string,
): string | null {
  if (updatedAt === null) return null;
  const days = Math.max(0, daysBetween(updatedAt, at));
  if (days === 0) return "updated today";
  if (days < MONTHS_FROM_DAYS) return `updated ${pluralize(days, "day")} ago`;
  return `updated ${pluralize(Math.floor(days / MONTH_DAYS), "month")} ago`;
}

export function newcomerCount(
  results: readonly KeywordInspectionResult[],
  topCount: number,
  at: string,
): number | null {
  const top = results.slice(0, topCount);
  if (top.every((result) => result.releasedAt === null)) return null;
  return top.filter(
    (result) =>
      result.releasedAt !== null &&
      daysBetween(result.releasedAt, at) <= NEWCOMER_DAYS,
  ).length;
}

export function autocompleteLine(signals: ScoreSignals | null): string | null {
  switch (signals?.suggestReach) {
    case "hit": {
      const typed = signals.suggestPrefixLength;
      const position = signals.suggestPosition;
      return typed === null || position === null
        ? "Autocomplete suggests it while it is typed"
        : `Autocomplete suggests it in position ${position} after ${pluralize(typed, "typed character")}`;
    }
    case "listed":
      return "Autocomplete suggests it only once the whole phrase is typed";
    case "absent":
      return "Autocomplete never suggests it";
    default:
      return null;
  }
}

export function otherStorefronts(
  items: readonly KeywordInspectionSummary[],
  inspection: Pick<KeywordInspectionSummary, "keyword" | "store" | "country">,
): KeywordInspectionSummary[] {
  const term = normalizeText(inspection.keyword);
  const seen = new Set<string>();
  return items.filter((item) => {
    const storefront = `${item.store}|${item.country}`;
    if (
      item.status !== "DONE" ||
      normalizeText(item.keyword) !== term ||
      (item.store === inspection.store &&
        item.country === inspection.country) ||
      seen.has(storefront)
    ) {
      return false;
    }
    seen.add(storefront);
    return true;
  });
}
