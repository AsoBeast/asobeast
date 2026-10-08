import { Store } from '@prisma/client';
import {
  countMaxLengthChars,
  isKeywordTag,
  isStorefront,
  KEYWORD_NOTE_MAX_LENGTH,
  KEYWORD_TAG_RULE,
  KEYWORD_TAGS_MAX,
  KeywordImportReason,
  KeywordImportRow,
  normalizeKeywordNote,
  normalizeKeywordTags,
  UnknownStorefrontError,
} from '@asobeast/shared';
import { checkKeywordText } from './keywords.support';

export interface ImportContext {
  store: Store;
  country: string;
}

export interface ImportCandidate {
  index: number;
  text: string;
  country: string;
  tags: string[];
  note: string | null;
}

export type ClassifiedRow =
  | {
      kind: 'invalid';
      index: number;
      keyword: string;
      country: string;
      reason: KeywordImportReason;
      message: string;
    }
  | {
      kind: 'duplicate';
      index: number;
      keyword: string;
      country: string;
      duplicateOf: number;
    }
  | { kind: 'candidate'; candidate: ImportCandidate };

interface Refusal {
  reason: KeywordImportReason;
  message: string;
}

interface Annotations {
  tags: string[];
  note: string | null;
}

export const pairKey = (country: string, text: string): string =>
  `${country}~${text}`;

const isRefusal = (value: Annotations | Refusal): value is Refusal =>
  'reason' in value;

function annotationsOf(row: KeywordImportRow): Annotations | Refusal {
  const tags = normalizeKeywordTags(row.tags ?? []);
  if (tags.length > KEYWORD_TAGS_MAX) {
    return {
      reason: 'tooManyTags',
      message: `A keyword takes at most ${KEYWORD_TAGS_MAX} tags, this row has ${tags.length}`,
    };
  }
  const invalid = tags.find((tag) => !isKeywordTag(tag));
  if (invalid !== undefined) {
    return {
      reason: 'invalidTag',
      message: `Tag "${invalid}" is not valid, a tag is ${KEYWORD_TAG_RULE}`,
    };
  }
  const note = normalizeKeywordNote(row.note ?? null);
  const noteLength = note === null ? 0 : countMaxLengthChars(note);
  if (noteLength > KEYWORD_NOTE_MAX_LENGTH) {
    return {
      reason: 'noteTooLong',
      message: `A note is at most ${KEYWORD_NOTE_MAX_LENGTH} characters, this one has ${noteLength}`,
    };
  }
  return { tags, note };
}

function classifyRow(
  row: KeywordImportRow,
  index: number,
  context: ImportContext,
): ClassifiedRow {
  const country = row.country?.trim().toLowerCase() || context.country;
  const refuse = (
    keyword: string,
    { reason, message }: Refusal,
  ): ClassifiedRow => ({
    kind: 'invalid',
    index,
    keyword,
    country,
    reason,
    message,
  });

  const check = checkKeywordText(row.keyword);
  if (!check.ok) {
    return refuse(row.keyword.trim(), check);
  }
  if (!isStorefront(context.store, country)) {
    return refuse(check.text, {
      reason: 'unknownCountry',
      message: new UnknownStorefrontError(context.store, country).message,
    });
  }
  const annotations = annotationsOf(row);
  if (isRefusal(annotations)) {
    return refuse(check.text, annotations);
  }
  return {
    kind: 'candidate',
    candidate: { index, text: check.text, country, ...annotations },
  };
}

export function classifyImportRows(
  rows: readonly KeywordImportRow[],
  context: ImportContext,
): ClassifiedRow[] {
  const claimed = new Map<string, number>();
  return rows.map((row, index) => {
    const classified = classifyRow(row, index, context);
    if (classified.kind !== 'candidate') {
      return classified;
    }
    const { text, country } = classified.candidate;
    const key = pairKey(country, text);
    const first = claimed.get(key);
    if (first === undefined) {
      claimed.set(key, index);
      return classified;
    }
    return {
      kind: 'duplicate',
      index,
      keyword: text,
      country,
      duplicateOf: first,
    };
  });
}
