import { normalizeText } from '@asobeast/shared';
import {
  AuditKeyword,
  CheckAdvice,
  coversPhrase,
  keywordMatchScore,
  quoteList,
} from '../audit-scoring';

export interface TitleMatch {
  score: number;
  keyword: AuditKeyword | null;
  phrase: boolean;
  present: string[];
  missing: string[];
}

const NO_MATCH: TitleMatch = {
  score: 0,
  keyword: null,
  phrase: false,
  present: [],
  missing: [],
};

const BRAND_FIRST = 'keeping your brand first if people already search for it.';

const quoted = (text: string): string => quoteList([text]);

const matchOf = (title: string, keyword: AuditKeyword): TitleMatch => {
  const words = normalizeText(keyword.text).split(' ').filter(Boolean);
  const inTitle = (word: string): boolean => coversPhrase(title, word);
  return {
    score: keywordMatchScore(title, [keyword.text]),
    keyword,
    phrase: coversPhrase(title, keyword.text),
    present: words.filter(inTitle),
    missing: words.filter((word) => !inTitle(word)),
  };
};

export const bestTitleMatch = (
  title: string,
  primary: AuditKeyword[],
): TitleMatch =>
  primary
    .map((keyword) => matchOf(title, keyword))
    .reduce(
      (best, match) => (match.score > best.score ? match : best),
      NO_MATCH,
    );

export const titleKeywordDetail = (
  match: TitleMatch,
  primary: AuditKeyword[],
): string => {
  const { keyword, phrase, present, missing } = match;
  if (primary.length === 0) {
    return 'No primary keywords tracked to match.';
  }
  if (keyword === null) {
    return `None of your primary keywords appear in the title: ${quoteList(
      primary.map((item) => item.text),
    )}.`;
  }
  if (phrase) {
    return `The title contains ${quoted(keyword.text)}, a primary keyword.`;
  }
  if (missing.length === 0) {
    return `The title has every word of ${quoted(keyword.text)}, but not the whole phrase.`;
  }
  return `The title has ${quoteList(present, present.length)} from ${quoted(keyword.text)}, but not the whole phrase.`;
};

export const titleKeywordAdvice = (
  match: TitleMatch,
  strongest: AuditKeyword | null,
  limit: number,
): CheckAdvice | null => {
  const { keyword, missing } = match;
  if (keyword === null) {
    return strongest
      ? {
          title: `Put ${quoted(strongest.text)} in your title`,
          fix: `Your strongest keyword is missing from the most heavily weighted field. Rewrite the title to include ${quoted(strongest.text)} within ${limit} characters, ${BRAND_FIRST}`,
        }
      : null;
  }
  if (missing.length === 0) {
    return null;
  }
  return {
    title: `Put the whole phrase ${quoted(keyword.text)} in your title`,
    fix: `Add ${quoteList(missing, missing.length)} to the words already there so the title carries the whole phrase within ${limit} characters, ${BRAND_FIRST}`,
  };
};
