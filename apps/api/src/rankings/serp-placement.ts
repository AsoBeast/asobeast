import type {
  KeywordBreakdownField,
  KeywordBreakdownSegment,
  SerpKeywordPlacement,
} from '@asobeast/shared';
import { judgeField, keywordWords } from '../keywords/keyword-breakdown-fields';

export interface PlacementJudgement {
  placement?: SerpKeywordPlacement;
  secondSegments?: KeywordBreakdownSegment[];
}

const isExact = (field: KeywordBreakdownField, index: number) =>
  field.words[index]?.match === 'exact';

const holdsEvery = (field: KeywordBreakdownField) =>
  field.phrase ||
  (field.words.length > 0 &&
    field.words.every((_, index) => isExact(field, index)));

function placementOf(
  title: KeywordBreakdownField,
  second: KeywordBreakdownField | undefined,
): SerpKeywordPlacement | undefined {
  const inTitle = holdsEvery(title);
  if (second === undefined) return inTitle ? 'title' : undefined;
  const inSecond = holdsEvery(second);
  if (inTitle) return inSecond ? 'both' : 'title';
  if (inSecond) return 'subtitle';
  const split = title.words.every(
    (_, index) => isExact(title, index) || isExact(second, index),
  );
  return split ? 'split' : 'none';
}

export function placementJudge(
  keyword: string,
): (title: string, second: string | null | undefined) => PlacementJudgement {
  const words = keywordWords(keyword);
  return (title, second) => {
    if (words.length === 0) return {};
    const titleField = judgeField(
      { field: 'title', value: title },
      keyword,
      words,
      false,
    );
    const secondField =
      second === undefined
        ? undefined
        : judgeField(
            { field: 'subtitle', value: second ?? '' },
            keyword,
            words,
            Boolean(second),
          );
    const placement = placementOf(titleField, secondField);
    return {
      ...(placement ? { placement } : {}),
      ...(secondField?.segments
        ? { secondSegments: secondField.segments }
        : {}),
    };
  };
}

export function serpPlacement(
  keyword: string,
  title: string,
  subtitle: string | null | undefined,
): SerpKeywordPlacement | undefined {
  return placementJudge(keyword)(title, subtitle).placement;
}
