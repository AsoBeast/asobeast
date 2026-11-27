import { Store } from '@prisma/client';
import {
  DraftWastedWord,
  isStopword,
  MetadataField,
  tokenize,
} from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';
import { Surface } from './localized-coverage';

const READ_ONCE_FIELDS: readonly MetadataField[] = [
  'title',
  'subtitle',
  'keywordField',
];

const SPARE_ROOM_FIELDS: readonly MetadataField[] = [
  'subtitle',
  'keywordField',
  'shortDescription',
];

const wordFields = (
  fields: readonly Surface[],
): Map<string, MetadataField[]> => {
  const found = new Map<string, MetadataField[]>();
  for (const { field, value } of fields) {
    for (const word of tokenize(value)) {
      const holding = found.get(word) ?? [];
      if (!holding.includes(field)) found.set(word, [...holding, field]);
    }
  }
  return found;
};

export function draftWastedWords(
  store: Store,
  fields: readonly Surface[],
  trackedTexts: readonly string[],
  brandWords: readonly string[],
): DraftWastedWord[] {
  const brand = new Set(brandWords);
  const repeated: DraftWastedWord[] = [];
  const unused: DraftWastedWord[] = [];
  for (const [word, holding] of wordFields(fields)) {
    if (isStopword(word) || brand.has(word)) continue;
    const readOnce = holding.filter((field) =>
      READ_ONCE_FIELDS.includes(field),
    );
    if (store === Store.APP_STORE && readOnce.length > 1) {
      repeated.push({ word, reason: 'repeated', fields: readOnce });
      continue;
    }
    const spare = holding.filter((field) => SPARE_ROOM_FIELDS.includes(field));
    if (
      !holding.includes('title') &&
      spare.length > 0 &&
      !trackedTexts.some((text) => coversKeyword(text, word))
    ) {
      unused.push({ word, reason: 'unused', fields: spare });
    }
  }
  return [...repeated, ...unused];
}
