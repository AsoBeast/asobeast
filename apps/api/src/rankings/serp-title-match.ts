import type {
  KeywordBreakdownSegment,
  KeywordWordMatch,
  SerpTitleMatch,
} from '@asobeast/shared';
import { judgeField, keywordWords } from '../keywords/keyword-breakdown-fields';

export interface TitleJudgement {
  titleMatch: SerpTitleMatch;
  titleSegments: KeywordBreakdownSegment[];
}

export function titleMatchOf(
  phrase: boolean,
  matches: readonly KeywordWordMatch[],
): SerpTitleMatch {
  if (phrase) return 'phrase';
  const exact = matches.filter((match) => match === 'exact').length;
  if (exact > 0 && exact === matches.length) return 'words';
  return exact > 0 ? 'partial' : 'none';
}

export function titleJudge(keyword: string): (title: string) => TitleJudgement {
  const words = keywordWords(keyword);
  return (title) => {
    const field = judgeField(
      { field: 'title', value: title },
      keyword,
      words,
      true,
    );
    return {
      titleMatch: titleMatchOf(
        field.phrase,
        field.words.map((word) => word.match),
      ),
      titleSegments: field.segments ?? [],
    };
  };
}
