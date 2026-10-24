import { lowerCase } from '../text';

export const ANNOTATION_LABEL_MAX_LENGTH = 80;
export const ANNOTATION_TAG_MAX_LENGTH = 24;
export const ANNOTATION_TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u;
export const ANNOTATION_TAG_RULE = `at most ${ANNOTATION_TAG_MAX_LENGTH} letters, numbers, spaces, hyphens or underscores and starts with a letter or number`;

export function normalizeAnnotationLabel(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function normalizeAnnotationTag(raw: string): string {
  return lowerCase(raw.normalize('NFC')).trim().replace(/\s+/g, ' ');
}

export function isAnnotationTag(tag: string): boolean {
  return (
    [...tag].length <= ANNOTATION_TAG_MAX_LENGTH &&
    ANNOTATION_TAG_PATTERN.test(tag)
  );
}
