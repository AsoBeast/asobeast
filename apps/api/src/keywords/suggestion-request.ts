import { Store } from '@prisma/client';
import { KeywordSuggestion } from '@asobeast/shared';

export interface SuggestionRequest {
  appId: string;
  limit: number;
  tracked: Set<string>;
  market: { store: Store; country: string; storeAppId: string };
  languages: { home: readonly string[]; market: readonly string[] };
}

export type StoreLookup = () => Promise<KeywordSuggestion[]>;
