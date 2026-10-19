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
import { PRODUCT_NAME } from "@/lib/brand";
import {
  formatCountry,
  formatDate,
  formatList,
  formatNumber,
  formatRating,
} from "@/lib/format";
import { localizationName } from "@/lib/localizations";

const FIELD_LABELS: Record<MetadataField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  shortDescription: "Short description",
  description: "Long description",
  promotionalText: "Promotional text",
  whatsNew: "What's new",
};

type SpreadPlacement = "split" | "partial" | "none";

const SPREAD: Record<SpreadPlacement, string> = {
  split: "every word, spread over fields",
  partial: "some of the words",
  none: "none of the words",
};

const isSpread = (placement: KeywordPlacement): placement is SpreadPlacement =>
  Object.hasOwn(SPREAD, placement);

const SETTLING = "ranks usually settle two to four weeks after a change.";

const quoted = (words: readonly string[]) =>
  formatList(words.map((word) => `“${word}”`));

export const fieldLabel = (field: MetadataField): string => FIELD_LABELS[field];

function matchedWords({ phrase, words }: KeywordBreakdownField): string {
  const matched = words.filter(({ match }) => match !== "none").length;
  if (phrase) return "Whole phrase";
  if (matched === 0) return "No match";
  if (words.length === 1) return "Found";
  if (matched === words.length) return "Every word";
  return `${matched} of ${words.length} words`;
}

export function fieldVerdict(field: KeywordBreakdownField): string {
  const verdict = matchedWords(field);
  const folded = field.words.some(({ match }) => match === "folded");
  return folded ? `${verdict}, accents differ` : verdict;
}

export function rankingLabel(ranking: KeywordBreakdownRanking | null): string {
  if (ranking === null) return "Not checked yet";
  return ranking.position === null
    ? `>${ranking.depth}`
    : `#${ranking.position}`;
}

export function placementPhrase(
  placement: KeywordPlacement,
  yours: boolean,
): string {
  if (isSpread(placement)) return SPREAD[placement];
  const owner = yours ? "your" : "its";
  return `in ${owner} ${fieldLabel(placement).toLowerCase()}`;
}

function placementText(
  theirs: KeywordPlacement,
  yours: KeywordPlacement,
): string {
  const it = isSpread(theirs)
    ? placementPhrase(theirs, false)
    : `the keyword ${placementPhrase(theirs, false)}`;
  const you = isSpread(yours)
    ? `your listings hold ${placementPhrase(yours, true)}`
    : `yours is ${placementPhrase(yours, true)}`;
  return `May rank above you because it has ${it}, while ${you}.`;
}

function unreadText(localizations: readonly string[]): string {
  const many = localizations.length > 1;
  const names = formatList(localizations.map(localizationName));
  return `No visible match in what ${PRODUCT_NAME} read, and its ${names} ${many ? "listings have" : "listing has"} not been captured.`;
}

export function insightText(
  insight: KeywordBreakdownInsight,
  store: Store,
): string | null {
  switch (insight.rule) {
    case "placement":
      return placementText(insight.theirs, insight.yours);
    case "spelling":
      return `Spells ${quoted(insight.words)} exactly as searched, where your listings match it only with accents ignored. Stores usually match both spellings, but the exact one can still help.`;
    case "ratings":
      return `Its listing here has ${formatNumber(insight.theirs)} ratings to your ${formatNumber(insight.yours)}.`;
    case "unread":
      return unreadText(insight.localizations);
    case "hidden":
      return "No visible match in any listing this market searches, so it may rank through its private keyword field.";
    case "similar":
      return store === "APP_STORE"
        ? "Placement and ratings are close to yours; installs and its keyword field are not visible."
        : "Placement and ratings are close to yours; installs are not visible.";
    default:
      return null;
  }
}

function competitorLine({
  above,
  competitors,
}: KeywordBreakdownStanding): string | null {
  if (competitors === 0) return null;
  if (above === 0) return "No tracked competitor ranks above you.";
  const noun = competitors === 1 ? "competitor" : "competitors";
  const verb = above === 1 ? "ranks" : "rank";
  return `${above} of ${competitors} ${noun} ${verb} above you.`;
}

function changeLine({ recentChange }: KeywordBreakdownStanding): string | null {
  if (recentChange === null) return null;
  const day = formatDate(recentChange.date);
  return recentChange.source === "listing"
    ? `Your listing changed on ${day}; ${SETTLING}`
    : `You saved a keyword field this market reads on ${day}; ${SETTLING}`;
}

export function standingLines(standing: KeywordBreakdownStanding): string[] {
  const { checked, missingWords, foldedWords } = standing;
  return [
    checked
      ? competitorLine(standing)
      : "Your app has not been checked for this keyword yet.",
    missingWords.length > 0
      ? `Your listings hold no ${quoted(missingWords)}, so you may not be eligible for this search.`
      : null,
    foldedWords.length > 0
      ? `${quoted(foldedWords)} ${foldedWords.length === 1 ? "matches" : "match"} only with accents ignored.`
      : null,
    changeLine(standing),
  ].filter((line): line is string => line !== null);
}

export function ratingLine(
  app: KeywordBreakdownApp,
  market: string,
): string | null {
  const { rating } = app;
  if (rating === null) return null;
  const parts = [
    rating.average === null ? null : formatRating(rating.average),
    rating.count === null ? null : `from ${formatNumber(rating.count)} ratings`,
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const elsewhere =
    rating.country === market
      ? ""
      : ` (${formatCountry(rating.country)} listing)`;
  return `Rating ${parts.join(" ")}${elsewhere}`;
}
