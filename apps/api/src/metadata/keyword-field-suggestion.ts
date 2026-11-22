import {
  AppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordCoverageRow,
  KeywordFieldSuggestion,
  isPluralOf,
  keywordFieldChars,
  packKeywordField,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { fitsOwnListing } from '../keywords/keyword-class';

const candidateText = (
  text: string,
  localization: AppStoreLocalization | undefined,
  trackedWords: readonly string[],
): string => {
  const words = tokenize(text);
  return (
    localization === undefined || localization.startsWith('en')
      ? words.map(
          (word) =>
            trackedWords.find((singular) => isPluralOf(word, singular)) ?? word,
        )
      : words
  ).join(' ');
};

export function suggestKeywordField(
  tracked: TrackedKeywordItem[],
  coverage: KeywordCoverageRow[],
  localization: AppStoreLocalization | undefined,
): KeywordFieldSuggestion {
  const eligible = tracked.filter((item) => fitsOwnListing(item.keywordClass));
  const trackedWords = [
    ...new Set(eligible.flatMap((item) => tokenize(item.text))),
  ];
  const uncovered = new Set(
    coverage.filter((row) => row.uncovered).map((row) => row.keywordId),
  );
  const candidates = eligible
    .filter((item) => uncovered.has(item.keywordId))
    .map((item) => ({
      text: candidateText(item.text, localization, trackedWords),
      score: (item.volume ?? 0) * (item.relevance ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const added = packKeywordField([
    ...new Set(candidates.map((candidate) => candidate.text).filter(Boolean)),
  ]);
  const value = added.join(',');

  return {
    value,
    charactersUsed: keywordFieldChars(added),
    charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
    addedTerms: added,
    ...(localization ? { localization } : {}),
  };
}
