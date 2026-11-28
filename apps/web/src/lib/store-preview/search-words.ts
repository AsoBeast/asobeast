import {
  STORE_FIELD_LIMITS,
  tokenize,
  type DraftWastedWord,
  type MetadataField,
  type Store,
} from "@asobeast/shared";

export interface SearchWord {
  word: string;
  readFrom: MetadataField | null;
}

const READ_ORDER: readonly MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

const firstRead = (fields: readonly MetadataField[]): MetadataField | null =>
  READ_ORDER.find((field) => fields.includes(field)) ?? null;

export function searchWords(
  store: Store,
  field: MetadataField,
  value: string,
  wasted: readonly DraftWastedWord[],
): SearchWord[] | null {
  if (STORE_FIELD_LIMITS[store][field]?.indexed !== true) return null;
  const readFrom = new Map(
    wasted.flatMap((entry) => {
      if (entry.reason !== "repeated" || !entry.fields.includes(field)) {
        return [];
      }
      const first = firstRead(entry.fields);
      return first === null || first === field ? [] : [[entry.word, first]];
    }),
  );
  return [...new Set(tokenize(value))].map((word) => ({
    word,
    readFrom: readFrom.get(word) ?? null,
  }));
}
