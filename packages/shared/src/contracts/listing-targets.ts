import type { Store } from '../index';
import type { KeywordClass, KeywordImportQuota } from './keywords';

export const LISTING_TARGET_LIMIT = 10;

export const TARGET_SLOT_ROLES = ['title', 'subtitle', 'subtitle'] as const;
export type TargetSlotRole = (typeof TARGET_SLOT_ROLES)[number] | 'extra';

export const targetSlotRole = (index: number): TargetSlotRole =>
  index >= 0 && index < TARGET_SLOT_ROLES.length
    ? TARGET_SLOT_ROLES[index]
    : 'extra';

export interface TargetMarket {
  country: string;
  keywordId: string;
  active: boolean;
}

export interface TargetScores {
  country: string;
  keywordId: string;
  popularity: number | null;
  difficulty: number | null;
  opportunity: number | null;
  relevance: number | null;
  position: number | null;
  depth: number | null;
  checkedOn: string | null;
  keywordClass?: KeywordClass;
  scoreOutdated?: boolean;
  floorAnswer?: boolean;
}

export const PLACEMENT_SUGGESTIONS = [
  'title',
  'subtitle',
  'keywordField',
  'shortDescription',
  'description',
  'skip',
] as const;
export type PlacementSuggestionField = (typeof PLACEMENT_SUGGESTIONS)[number];

export const PLACEMENT_REASONS = [
  'strongestReachable',
  'nextReachable',
  'hardToRank',
  'singleWord',
  'longTail',
  'noStrongRoom',
  'noRoom',
  'lowPopularity',
  'lowRelevance',
  'competitorBrand',
  'ownBrand',
] as const;
export type PlacementReason = (typeof PLACEMENT_REASONS)[number];

export interface PlacementSuggestion {
  field: PlacementSuggestionField;
  reason: PlacementReason;
  popularity: number | null;
  difficulty: number | null;
  position: number | null;
}

const PLACEMENT_FIELDS: Record<Store, readonly PlacementSuggestionField[]> = {
  APP_STORE: ['title', 'subtitle', 'keywordField'],
  GOOGLE_PLAY: ['title', 'shortDescription', 'description'],
};

export const placementFieldsOf = (
  store: Store,
): readonly PlacementSuggestionField[] => PLACEMENT_FIELDS[store];

export interface ListingTargetItem {
  position: number;
  role: TargetSlotRole;
  text: string;
  trackedIn: TargetMarket[];
  untrackedIn: string[];
  lead: TargetScores | null;
  placement?: PlacementSuggestion;
}

export interface ListingTargetCandidate {
  text: string;
  markets: string[];
  lead: TargetScores;
  placement?: PlacementSuggestion;
}

export interface ListingTargetsResult {
  appId: string;
  localization: string;
  readers: string[];
  slots: (ListingTargetItem | null)[];
  candidates: ListingTargetCandidate[];
  updatedAt: string | null;
}

export interface ListingTargetsRequest {
  slots: (string | null)[];
  trackMissing?: boolean;
}

export const TARGET_NOT_TRACKED_REASONS = ['keywordLimit'] as const;
export type TargetNotTrackedReason =
  (typeof TARGET_NOT_TRACKED_REASONS)[number];

export interface TargetNotTracked {
  text: string;
  country: string;
  reason: TargetNotTrackedReason;
}

export interface ListingTargetsSaveResult extends ListingTargetsResult {
  tracked: number;
  notTracked: TargetNotTracked[];
  quota: KeywordImportQuota | null;
}
