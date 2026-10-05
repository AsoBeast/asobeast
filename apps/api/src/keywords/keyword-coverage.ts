import { normalizeText } from '@asobeast/shared';
import { containsTerm, isUnsegmented } from '../common/text/scripts';

export const coversKeyword = (field: string, keyword: string): boolean => {
  const text = normalizeText(field);
  const target = normalizeText(keyword);
  return isUnsegmented(target)
    ? target.split(' ').every((term) => containsTerm(text, term))
    : containsTerm(text, target);
};
