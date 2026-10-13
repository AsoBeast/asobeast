import { normalizeText } from '../text';
import { countChars, KEYWORD_FIELD_CHAR_LIMIT } from './limits';

export interface ParsedKeywordField {
  phrases: string[];
  duplicatesRemoved: number;
}

export function parseKeywordField(text: string): ParsedKeywordField {
  const parts = text
    .split(',')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0);
  const phrases = [...new Set(parts)];
  return { phrases, duplicatesRemoved: parts.length - phrases.length };
}

export function keywordFieldChars(phrases: readonly string[]): number {
  return countChars(phrases.join(','));
}

export function packKeywordField(phrases: readonly string[]): string[] {
  const packed: string[] = [];
  for (const phrase of phrases) {
    if (keywordFieldChars([...packed, phrase]) <= KEYWORD_FIELD_CHAR_LIMIT) {
      packed.push(phrase);
    }
  }
  return packed;
}
