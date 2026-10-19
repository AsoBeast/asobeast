import { Store } from '../index';
import type { MetadataField } from '../aso/limits';
import type { LocalizationReadRole } from './localizations';

export const KEYWORD_PLACEMENTS = [
  'title',
  'subtitle',
  'shortDescription',
  'keywordField',
  'description',
  'split',
  'partial',
  'none',
] as const;
export type KeywordPlacement = (typeof KEYWORD_PLACEMENTS)[number];

export const isKeywordPlacement = (value: string): value is KeywordPlacement =>
  KEYWORD_PLACEMENTS.some((placement) => placement === value);

export type KeywordWordMatch = 'exact' | 'folded' | 'none';

export interface KeywordBreakdownWord {
  word: string;
  match: KeywordWordMatch;
}

export interface KeywordBreakdownSegment {
  text: string;
  match: KeywordWordMatch;
}

export interface KeywordBreakdownField {
  field: MetadataField;
  phrase: boolean;
  words: KeywordBreakdownWord[];
  segments: KeywordBreakdownSegment[] | null;
}

export interface KeywordBreakdownListing {
  localization: string | null;
  role: LocalizationReadRole | null;
  fields: KeywordBreakdownField[];
  placement: KeywordPlacement;
}

export interface KeywordBreakdownRanking {
  position: number | null;
  depth: number;
  date: string;
}

export interface KeywordBreakdownRating {
  average: number | null;
  count: number | null;
  country: string;
}

export const KEYWORD_BREAKDOWN_RULES = [
  'placement',
  'spelling',
  'ratings',
  'unread',
  'hidden',
  'similar',
] as const;
export type KeywordBreakdownRule = (typeof KEYWORD_BREAKDOWN_RULES)[number];

export type KeywordBreakdownInsight =
  | { rule: 'placement'; theirs: KeywordPlacement; yours: KeywordPlacement }
  | { rule: 'spelling'; words: string[] }
  | { rule: 'ratings'; theirs: number; yours: number }
  | { rule: 'unread'; localizations: string[] }
  | { rule: 'hidden' }
  | { rule: 'similar' };

export interface KeywordBreakdownApp {
  appId: string;
  name: string | null;
  iconUrl: string | null;
  isYou: boolean;
  ranking: KeywordBreakdownRanking | null;
  listingCountry: string | null;
  capturedAt: string | null;
  listings: KeywordBreakdownListing[];
  unread: string[];
  placement: KeywordPlacement;
  rating: KeywordBreakdownRating | null;
  insight: KeywordBreakdownInsight | null;
}

export interface KeywordBreakdownChange {
  date: string;
  source: 'listing' | 'keywordField';
}

export interface KeywordBreakdownStanding {
  checked: boolean;
  above: number;
  competitors: number;
  missingWords: string[];
  foldedWords: string[];
  recentChange: KeywordBreakdownChange | null;
}

export interface KeywordBreakdown {
  keywordId: string;
  text: string;
  store: Store;
  country: string;
  words: string[];
  standing: KeywordBreakdownStanding;
  apps: KeywordBreakdownApp[];
}
