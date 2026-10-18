import { Store } from '@prisma/client';

export interface SuggestionRequest {
  appId: string;
  limit: number;
  tracked: Set<string>;
  market: { store: Store; country: string; storeAppId: string };
  languages: { home: readonly string[]; market: readonly string[] };
}
