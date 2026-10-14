import {
  KeywordFieldMarketPreview,
  KeywordFieldSavePreview,
  LocalizationReader,
} from '@asobeast/shared';
import { pairKey } from './keyword-import';
import { TrackingLookup } from './keyword-import-plan';

export interface FieldSaveInput {
  stored: readonly string[];
  phrases: readonly string[];
  readers: readonly LocalizationReader[];
  tracking: TrackingLookup;
  requestsPerKeyword: number;
}

export type FieldSavePlan = Pick<
  KeywordFieldSavePreview,
  'phrases' | 'added' | 'dropped' | 'markets'
>;

const without = (
  phrases: readonly string[],
  others: readonly string[],
): string[] => phrases.filter((phrase) => !others.includes(phrase));

function marketPlan(
  reader: LocalizationReader,
  input: FieldSaveInput,
): KeywordFieldMarketPreview {
  const stateOf = (text: string) =>
    input.tracking.get(pairKey(reader.country, text));
  const newPhrases = input.phrases.filter(
    (text) => stateOf(text)?.own !== 'active',
  );
  const keywordMarkets = newPhrases.filter(
    (text) => !stateOf(text)?.elsewhere,
  ).length;
  return {
    ...reader,
    newPhrases,
    keywordMarkets,
    dailyRequests: keywordMarkets * input.requestsPerKeyword,
  };
}

export function planFieldSave(input: FieldSaveInput): FieldSavePlan {
  return {
    phrases: [...input.phrases],
    added: without(input.phrases, input.stored),
    dropped: without(input.stored, input.phrases),
    markets: input.readers.map((reader) => marketPlan(reader, input)),
  };
}
