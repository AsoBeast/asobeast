import type { LanguageStorefront } from '../storefronts/language-storefronts';
import type { KeywordImportCost } from './keywords';

export const MARKET_SEED_LIMIT = 15;

export interface MarketDailyRequests {
  listing: number;
  perKeyword: number;
}

export interface MarketSuggestion extends LanguageStorefront {
  tracked: boolean;
  dailyRequests: MarketDailyRequests;
}

export interface MarketSuggestionsResult {
  home: string;
  languages: string[];
  suggestions: MarketSuggestion[];
}

export interface MarketSeedRequest {
  country: string;
}

export const MARKET_SEED_STATUSES = ['seeded', 'unavailable'] as const;

export type MarketSeedStatus = (typeof MARKET_SEED_STATUSES)[number];

export interface MarketSeedResult {
  country: string;
  status: MarketSeedStatus;
  seeded: number;
  skipped: number;
  cost: KeywordImportCost;
}
