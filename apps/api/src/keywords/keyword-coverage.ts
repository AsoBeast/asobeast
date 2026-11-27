import { containsTerm, isUnsegmented, normalizeText } from '@asobeast/shared';

export const fieldCoverage = (
  field: string,
): ((keyword: string) => boolean) => {
  const text = normalizeText(field);
  return (keyword) => {
    const target = normalizeText(keyword);
    return isUnsegmented(target)
      ? target.split(' ').every((term) => containsTerm(text, term))
      : containsTerm(text, target);
  };
};

export const coversKeyword = (field: string, keyword: string): boolean =>
  fieldCoverage(field)(keyword);
