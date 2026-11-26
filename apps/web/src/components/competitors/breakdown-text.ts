import type {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  KeywordBreakdownInsight,
  KeywordBreakdownRanking,
  KeywordBreakdownStanding,
  KeywordPlacement,
  MetadataField,
  Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enCompetitors from "../../../messages/en/competitors.json";
import { PRODUCT_NAME } from "@/lib/brand";
import type { MessageTranslator } from "@/i18n/translator";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatListInLocale,
  formatNumberInLocale,
  formatRating,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { localizationName } from "@/lib/localizations";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

type SpreadPlacement = "split" | "partial" | "none";

const isSpread = (placement: KeywordPlacement): placement is SpreadPlacement =>
  placement === "split" || placement === "partial" || placement === "none";

const quoted = (words: readonly string[], locale: Locale) =>
  formatListInLocale(
    words.map((word) => `“${word}”`),
    locale,
  );

export const fieldLabel = (
  field: MetadataField,
  t: MessageTranslator = english,
): string => t(`fields.${field}`);

function matchedWords(
  { phrase, words }: KeywordBreakdownField,
  t: MessageTranslator,
): string {
  const matched = words.filter(({ match }) => match !== "none").length;
  if (phrase) return t("verdicts.wholePhrase");
  if (matched === 0) return t("verdicts.noMatch");
  if (words.length === 1) return t("verdicts.found");
  if (matched === words.length) return t("verdicts.everyWord");
  return t("verdicts.matchedWords", { matched, total: words.length });
}

export function fieldVerdict(
  field: KeywordBreakdownField,
  t: MessageTranslator = english,
): string {
  const verdict = matchedWords(field, t);
  const folded = field.words.some(({ match }) => match === "folded");
  return folded ? t("verdicts.accentsDiffer", { verdict }) : verdict;
}

export function rankingLabel(
  ranking: KeywordBreakdownRanking | null,
  t: MessageTranslator = english,
): string {
  if (ranking === null) return t("comparison.notChecked");
  return ranking.position === null
    ? `>${ranking.depth}`
    : `#${ranking.position}`;
}

export function placementPhrase(
  placement: KeywordPlacement,
  yours: boolean,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (isSpread(placement)) return t(`breakdown.text.spread.${placement}`);
  const field = fieldLabel(placement, t);
  return t("breakdown.text.placementField", {
    owner: t(`breakdown.text.${yours ? "ownerYour" : "ownerIts"}`),
    field: locale === "en" ? field.toLowerCase() : field,
  });
}

function placementText(
  theirs: KeywordPlacement,
  yours: KeywordPlacement,
  t: MessageTranslator,
  locale: Locale,
): string {
  const it = isSpread(theirs)
    ? placementPhrase(theirs, false, t, locale)
    : t("breakdown.text.placementTheirs", {
        placement: placementPhrase(theirs, false, t, locale),
      });
  const you = isSpread(yours)
    ? t("breakdown.text.placementYoursSpread", {
        placement: placementPhrase(yours, true, t, locale),
      })
    : t("breakdown.text.placementYoursField", {
        placement: placementPhrase(yours, true, t, locale),
      });
  return t("breakdown.text.placementSentence", { theirs: it, yours: you });
}

const lackOf = (placement: KeywordPlacement, t: MessageTranslator): string =>
  placement === "partial"
    ? t("breakdown.text.lackPartial")
    : t("breakdown.text.lackNone");

function unreadText(
  localizations: readonly string[],
  placement: KeywordPlacement,
  t: MessageTranslator,
  locale: Locale,
): string {
  const many = localizations.length > 1;
  const names = formatListInLocale(localizations.map(localizationName), locale);
  return t(`breakdown.text.unread${many ? "Many" : "One"}`, {
    lack: lackOf(placement, t),
    product: PRODUCT_NAME,
    names,
  });
}

export function insightText(
  insight: KeywordBreakdownInsight,
  store: Store,
  placement: KeywordPlacement,
  copy: { t: MessageTranslator; locale: Locale } = {
    t: english,
    locale: "en",
  },
): string | null {
  const { t, locale } = copy;
  switch (insight.rule) {
    case "placement":
      return placementText(insight.theirs, insight.yours, t, locale);
    case "spelling":
      return t("breakdown.text.spelling", {
        words: quoted(insight.words, locale),
      });
    case "ratings":
      return t("breakdown.text.ratings", {
        theirs: formatNumberInLocale(insight.theirs, locale),
        yours: formatNumberInLocale(insight.yours, locale),
      });
    case "unread":
      return unreadText(insight.localizations, placement, t, locale);
    case "hidden":
      return t("breakdown.text.hidden", { lack: lackOf(placement, t) });
    case "similar":
      return t(
        store === "APP_STORE"
          ? "breakdown.text.similarAppStore"
          : "breakdown.text.similarPlay",
      );
    default:
      return null;
  }
}

function competitorLine(
  { above, competitors }: KeywordBreakdownStanding,
  t: MessageTranslator,
): string | null {
  if (competitors === 0) return null;
  if (above === 0) return t("breakdown.text.competitorNone");
  return t("breakdown.text.competitorAbove", { above, competitors });
}

function changeLine(
  { recentChange }: KeywordBreakdownStanding,
  t: MessageTranslator,
  locale: Locale,
): string | null {
  if (recentChange === null) return null;
  const day = formatDateInLocale(recentChange.date, locale);
  return t(
    recentChange.source === "listing"
      ? "breakdown.text.changeListing"
      : "breakdown.text.changeKeywordField",
    { date: day, settling: t("breakdown.text.settling") },
  );
}

export function standingLines(
  standing: KeywordBreakdownStanding,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string[] {
  const { checked, missingWords, foldedWords } = standing;
  return [
    checked ? competitorLine(standing, t) : t("breakdown.text.notChecked"),
    missingWords.length > 0
      ? t("breakdown.text.missingWords", {
          words: quoted(missingWords, locale),
        })
      : null,
    foldedWords.length > 0
      ? t(
          foldedWords.length === 1
            ? "breakdown.text.foldedOne"
            : "breakdown.text.foldedMany",
          { words: quoted(foldedWords, locale) },
        )
      : null,
    changeLine(standing, t, locale),
  ].filter((line): line is string => line !== null);
}

export function ratingLine(
  app: KeywordBreakdownApp,
  market: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  const { rating } = app;
  if (rating === null) return null;
  const parts = [
    rating.average === null ? null : formatRating(rating.average),
    rating.count === null
      ? null
      : t("breakdown.ratingCount", {
          count: formatNumberInLocale(rating.count, locale),
        }),
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const elsewhere =
    rating.country === market
      ? ""
      : t("breakdown.ratingElsewhere", {
          market: formatCountryInLocale(rating.country, locale),
        });
  return t("breakdown.rating", { value: parts.join(" ") }) + elsewhere;
}
