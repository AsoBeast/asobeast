import { lowerCase } from '../text';

export const KEYWORD_TAG_MAX_LENGTH = 24;
export const KEYWORD_TAGS_MAX = 8;
export const KEYWORD_NOTE_MAX_LENGTH = 500;
export const SUGGESTED_KEYWORD_TAGS = ['brand', 'core', 'testing'] as const;
export const KEYWORD_TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u;

export function normalizeKeywordTag(raw: string): string {
  return lowerCase(raw.normalize('NFC')).trim().replace(/\s+/g, ' ');
}

export function normalizeKeywordTags(raw: readonly string[]): string[] {
  return [...new Set(raw.map(normalizeKeywordTag).filter(Boolean))];
}

export function isKeywordTag(tag: string): boolean {
  return (
    [...tag].length <= KEYWORD_TAG_MAX_LENGTH && KEYWORD_TAG_PATTERN.test(tag)
  );
}

export function normalizeKeywordNote(raw: string | null): string | null {
  const note = raw?.trim() ?? '';
  return note === '' ? null : note;
}
