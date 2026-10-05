import { normalizeText } from '@asobeast/shared';
import { isUnsegmented } from '../scoring/unsegmented';

export const coversKeyword = (field: string, keyword: string): boolean => {
  const text = normalizeText(field);
  const target = normalizeText(keyword);
  return isUnsegmented(target)
    ? text.includes(target)
    : ` ${text} `.includes(` ${target} `);
};
