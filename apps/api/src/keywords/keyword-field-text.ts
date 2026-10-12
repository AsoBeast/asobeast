import { BadRequestException } from '@nestjs/common';
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  parseKeywordField,
} from '@asobeast/shared';
import { normalizeKeyword } from './keywords.support';

export interface KeywordFieldText {
  phrases: string[];
  duplicatesRemoved: number;
}

export function parseFieldText(text: string): KeywordFieldText {
  const parsed = parseKeywordField(text);
  const phrases = parsed.phrases.map(normalizeKeyword);
  if (keywordFieldChars(phrases) > KEYWORD_FIELD_CHAR_LIMIT) {
    throw new BadRequestException(
      `Keyword field exceeds ${KEYWORD_FIELD_CHAR_LIMIT} characters`,
    );
  }
  return { phrases, duplicatesRemoved: parsed.duplicatesRemoved };
}
