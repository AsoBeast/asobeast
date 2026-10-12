import {
  AppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordCoverageRow,
  KeywordFieldSuggestion,
  keywordFieldChars,
  packKeywordField,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';

const singular = (word: string): string =>
  word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
    ? word.slice(0, -1)
    : word;

const candidateText = (
  text: string,
  localization: AppStoreLocalization | undefined,
): string => {
  const words = tokenize(text);
  return (
    localization === undefined || localization.startsWith('en')
      ? words.map(singular)
      : words
  ).join(' ');
};

export function suggestKeywordField(
  tracked: TrackedKeywordItem[],
  coverage: KeywordCoverageRow[],
  localization: AppStoreLocalization | undefined,
): KeywordFieldSuggestion {
  const uncovered = new Set(
    coverage.filter((row) => row.uncovered).map((row) => row.keywordId),
  );
  const candidates = tracked
    .filter((item) => uncovered.has(item.keywordId))
    .map((item) => ({
      text: candidateText(item.text, localization),
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
