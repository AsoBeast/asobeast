import { createTranslator } from "next-intl";
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
import enKeywordInspector from "../../../messages/en/keywordInspector.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import {
  formatCompactInLocale,
  formatCountryInLocale,
  formatRatingInLocale,
  storeLabel,
} from "@/lib/format";

const english = createTranslator({
  locale: "en",
  namespace: "keywordInspector",
  messages: { keywordInspector: enKeywordInspector },
});

const DEFAULT_INSPECTION_COUNTRY = "us";

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

export function updatedAgo(
  days: number,
  t: MessageTranslator = english,
): string {
  return days === 0
    ? t("inspector.format.typicalUpdatedToday")
    : t("inspector.format.typicalUpdateAgo", { count: days });
}

export function signedChange(
  change: number | null,
  t: MessageTranslator = english,
): string {
  if (change === null) return "—";
  if (change === 0) return t("inspector.format.noChange");
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

export interface CompetitionFact {
  label: string;
  value: string;
  note: string;
}

const countOrDash = (value: number | null, locale: Locale): string =>
  value === null ? "—" : formatCompactInLocale(value, locale);

const ratio = (count: number, total: number, t: MessageTranslator): string =>
  t("inspector.format.competition.newcomersValue", { count, total });

export function competitionFacts(
  competition: KeywordInspectionCompetition,
  newcomers: number | null = null,
  t: MessageTranslator = english,
  locale: Locale = "en",
): CompetitionFact[] {
  const top = competition.topCount;
  const labels = "inspector.format.competition";
  const newcomerFact: CompetitionFact[] =
    newcomers === null
      ? []
      : [
          {
            label: t(`${labels}.newcomers`),
            value: ratio(newcomers, top, t),
            note: t(`${labels}.newcomersNote`),
          },
        ];
  return [
    {
      label: t(`${labels}.typicalRatings`),
      value: countOrDash(competition.medianRatingCount, locale),
      note: t(`${labels}.typicalRatingsNote`, { count: top }),
    },
    {
      label: t(`${labels}.strongestApp`),
      value: countOrDash(competition.strongestRatingCount, locale),
      note: t(`${labels}.strongestAppNote`),
    },
    {
      label: t(`${labels}.averageRating`),
      value:
        competition.averageRating === null
          ? "—"
          : formatRatingInLocale(competition.averageRating, locale),
      note: t(`${labels}.averageRatingNote`, { count: top }),
    },
    {
      label: t(`${labels}.titlesTarget`),
      value: ratio(competition.titleMatches, top, t),
      note: t(`${labels}.exactTitlesNote`, {
        count: competition.exactTitleMatches,
      }),
    },
    {
      label: t(`${labels}.heavyweights`),
      value: ratio(competition.appsOverHundredThousandRatings, top, t),
      note: t(`${labels}.heavyweightsNote`),
    },
    {
      label: t(`${labels}.recentlyUpdated`),
      value: ratio(competition.freshlyUpdated, top, t),
      note:
        competition.medianDaysSinceUpdate === null
          ? t(`${labels}.updatesUnavailable`)
          : updatedAgo(competition.medianDaysSinceUpdate, t),
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

export const storefrontName = (
  store: Store,
  country: string,
  locale: Locale = "en",
): string => `${storeLabel(store)} · ${formatCountryInLocale(country, locale)}`;

const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS);

export function inspectionCostText(
  limits: Pick<PlanLimits, "onDemand"> | undefined,
  t: MessageTranslator = english,
): string {
  const score = limits?.onDemand?.score;
  if (!score) return t("inspector.format.costRead");
  if (score.limit === 0) return t("inspector.format.costNone");
  return score.windowSeconds === DAY_SECONDS
    ? t("inspector.format.costDaily", { limit: score.limit })
    : t("inspector.format.costHourly", { limit: score.limit });
}

export function sinceUpdate(
  updatedAt: string | null,
  at: string,
  t: MessageTranslator = english,
): string | null {
  if (updatedAt === null) return null;
  const days = Math.max(0, daysBetween(updatedAt, at));
  if (days === 0) return t("inspector.format.updatedToday");
  if (days < MONTHS_FROM_DAYS) {
    return t("inspector.format.updatedDaysAgo", { count: days });
  }
  return t("inspector.format.updatedMonthsAgo", {
    count: Math.floor(days / MONTH_DAYS),
  });
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

export function autocompleteLine(
  signals: ScoreSignals | null,
  t: MessageTranslator = english,
): string | null {
  switch (signals?.suggestReach) {
    case "hit": {
      const typed = signals.suggestPrefixLength;
      const position = signals.suggestPosition;
      return typed === null || position === null
        ? t("inspector.format.autocompleteWhileTyping")
        : t("inspector.format.autocompleteAfter", {
            count: typed,
            position,
          });
    }
    case "listed":
      return t("inspector.format.autocompleteListed");
    case "absent":
      return t("inspector.format.autocompleteAbsent");
    default:
      return null;
  }
}

export function titleMatchLabel(
  match: SerpTitleMatch,
  t: MessageTranslator = english,
): string {
  return t(`inspector.results.matches.${match}`);
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
