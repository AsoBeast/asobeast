import { Store } from '../index';

export interface AppSnapshotSummary {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  installs: number | null;
  price: number | null;
  version: string | null;
  capturedAt: string;
}

export interface CompetitorItem {
  id: string;
  store: Store;
  name: string | null;
  iconUrl: string | null;
  latestSnapshot: AppSnapshotSummary | null;
}

export interface AppGroupMember {
  id: string;
  store: Store;
  country: string;
  name: string | null;
  iconUrl: string | null;
}

export interface AppGroupSummary {
  id: string;
  name: string;
  members: AppGroupMember[];
}

export interface AppDetail {
  id: string;
  store: Store;
  storeAppId: string;
  country: string;
  name: string | null;
  iconUrl: string | null;
  createdAt: string;
  latestSnapshot: AppSnapshotSummary | null;
  competitors: CompetitorItem[];
  group: AppGroupSummary | null;
}

export interface AppListItem {
  id: string;
  store: Store;
  country: string;
  name: string | null;
  iconUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  capturedAt: string | null;
  trackedKeywordCount: number;
  competitorCount: number;
  groupId: string | null;
}

export const MARKET_AVAILABILITY = [
  'available',
  'unavailable',
  'unknown',
] as const;
export type MarketAvailability = (typeof MARKET_AVAILABILITY)[number];

export interface MarketAvailabilityResult {
  country: string;
  status: MarketAvailability;
}

export interface SnapshotChange {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface SnapshotDiffResult {
  snapshotId: string;
  changes: SnapshotChange[];
}

export interface AppImportRequest {
  url: string;
  country?: string;
}

export interface AppLinkRequest {
  appId: string;
}
