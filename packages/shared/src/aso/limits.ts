import { Store } from '../index';

export const METADATA_FIELDS = [
  'title',
  'subtitle',
  'keywordField',
  'description',
  'promotionalText',
  'whatsNew',
  'shortDescription',
] as const;
export type MetadataField = (typeof METADATA_FIELDS)[number];

export interface FieldLimit {
  limit: number;
  indexed: boolean;
}

export const STORE_FIELD_LIMITS: Record<
  Store,
  Partial<Record<MetadataField, FieldLimit>>
> = {
  APP_STORE: {
    title: { limit: 30, indexed: true },
    subtitle: { limit: 30, indexed: true },
    keywordField: { limit: 100, indexed: true },
    description: { limit: 4000, indexed: false },
    promotionalText: { limit: 170, indexed: false },
    whatsNew: { limit: 4000, indexed: false },
  },
  GOOGLE_PLAY: {
    title: { limit: 30, indexed: true },
    shortDescription: { limit: 80, indexed: true },
    description: { limit: 4000, indexed: true },
  },
};

export const KEYWORD_FIELD_CHAR_LIMIT =
  STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;

export function countChars(text: string): number {
  return text.length;
}
