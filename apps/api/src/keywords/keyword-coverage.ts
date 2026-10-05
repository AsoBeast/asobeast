import { normalizeText } from '@asobeast/shared';
import { containsTerm } from '../common/text/scripts';

export const coversKeyword = (field: string, keyword: string): boolean =>
  containsTerm(normalizeText(field), normalizeText(keyword));
