import {
  STORE_FIELD_LIMITS,
  tokenize,
  type DraftWastedWord,
  type MetadataField,
  type Store,
} from "@asobeast/shared";

export interface SearchWord {
  word: string;
  repeat: boolean;
}

export function searchWords(
  store: Store,
  field: MetadataField,
  value: string,
  wasted: readonly DraftWastedWord[],
): SearchWord[] | null {
  if (STORE_FIELD_LIMITS[store][field]?.indexed !== true) return null;
  const repeats = new Set(
    wasted
      .filter(
        (entry) => entry.reason === "repeated" && entry.fields.includes(field),
      )
      .map((entry) => entry.word),
  );
  return [...new Set(tokenize(value))].map((word) => ({
    word,
    repeat: repeats.has(word),
  }));
}
