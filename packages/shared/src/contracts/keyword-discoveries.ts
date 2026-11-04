import type { Store } from '../index';

export const DISCOVERY_SOURCES = [
  'title',
  'subtitle',
  'description',
  'competitors',
  'reviews',
  'popularity',
  'portfolio',
] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];
export const isDiscoverySource = (value: string): value is DiscoverySource =>
  (DISCOVERY_SOURCES as readonly string[]).includes(value);

export const DISCOVERY_STATES = ['all', 'ranked', 'opportunity'] as const;
export type DiscoveryState = (typeof DISCOVERY_STATES)[number];
export type DiscoveryRowState = 'ranked' | 'opportunity' | 'open';

export const DISCOVERY_CHECKS_PER_RUN: Record<Store, number> = {
  APP_STORE: 40,
  GOOGLE_PLAY: 20,
};
export const DISCOVERY_RECOMMENDED = 50;
export const DISCOVERY_POOL_LIMIT = 200;
export const DISCOVERY_RECHECK_DAYS = 7;
export const DISCOVERY_CAPTURE_DEPTH = 50;
export const DISCOVERY_ACTION_LIMIT = 200;
export const DISCOVERY_LIST_LIMIT = { min: 1, max: 500, default: 200 } as const;

export interface KeywordDiscoveryItem {
  keywordId: string;
  text: string;
  country: string;
  source: DiscoverySource;
  position: number | null;
  depth: number | null;
  checkedOn: string | null;
  traffic: number | null;
  difficulty: number | null;
  volume: number | null;
  relevance: number;
  opportunity: number | null;
  state: DiscoveryRowState;
  recommended: boolean;
}

export interface KeywordDiscoveryCounts {
  all: number;
  ranked: number;
  opportunity: number;
}

export interface KeywordDiscoveryChecks {
  perWeek: number;
  usedThisWeek: number;
  pending: number;
  checkedAt: string | null;
  nextRunAt: string | null;
}

export interface KeywordDiscoveryList {
  items: KeywordDiscoveryItem[];
  counts: KeywordDiscoveryCounts;
  autoTrackRanked: boolean;
  unfit: number;
  checks: KeywordDiscoveryChecks;
}

export interface KeywordDiscoveryTrackRequest {
  keywordIds?: string[];
  allRanked?: boolean;
  country?: string;
}

export interface KeywordDiscoveryTrackResult {
  tracked: number;
  skipped: number;
}

export interface KeywordDiscoveryDismissRequest {
  keywordIds: string[];
}

export interface KeywordDiscoveryDismissResult {
  dismissed: number;
}

export interface KeywordDiscoveryRefreshResult {
  queued: number;
  resolved: number;
}

export interface KeywordDiscoverySettingsRequest {
  autoTrackRanked: boolean;
}

export interface KeywordDiscoverySettings {
  autoTrackRanked: boolean;
  tracked: number;
  skipped: number;
}

export interface KeywordDiscoveryCount {
  open: number;
  ranked: number;
}
