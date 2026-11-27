import type {
  KeywordBreakdownField,
  KeywordBreakdownSegment,
  SerpKeywordPlacement,
} from '@asobeast/shared';
import { judgeField, keywordWords } from '../keywords/keyword-breakdown-fields';

export interface PlacementJudgement {
  placement?: SerpKeywordPlacement;
  subtitleSegments?: KeywordBreakdownSegment[];
}

const isExact = (field: KeywordBreakdownField, index: number) =>
  field.words[index]?.match === 'exact';

const holdsEvery = (field: KeywordBreakdownField) =>
  field.phrase ||
  (field.words.length > 0 &&
    field.words.every((_, index) => isExact(field, index)));

function placementOf(
  title: KeywordBreakdownField,
  subtitle: KeywordBreakdownField | undefined,
): SerpKeywordPlacement | undefined {
  const inTitle = holdsEvery(title);
  if (subtitle === undefined) return inTitle ? 'title' : undefined;
  const inSubtitle = holdsEvery(subtitle);
  if (inTitle) return inSubtitle ? 'both' : 'title';
  if (inSubtitle) return 'subtitle';
  const split = title.words.every(
    (_, index) => isExact(title, index) || isExact(subtitle, index),
  );
  return split ? 'split' : 'none';
}

export function placementJudge(
  keyword: string,
): (title: string, subtitle: string | null | undefined) => PlacementJudgement {
  const words = keywordWords(keyword);
  return (title, subtitle) => {
    if (words.length === 0) return {};
    const titleField = judgeField(
      { field: 'title', value: title },
      keyword,
      words,
      false,
    );
    const subtitleField =
      subtitle === undefined
        ? undefined
        : judgeField(
            { field: 'subtitle', value: subtitle ?? '' },
            keyword,
            words,
            Boolean(subtitle),
          );
    const placement = placementOf(titleField, subtitleField);
    return {
      ...(placement ? { placement } : {}),
      ...(subtitleField?.segments
        ? { subtitleSegments: subtitleField.segments }
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
