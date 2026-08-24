import type { VisibilityPoint, KeywordMover } from './analytics';
import type { Store } from '../index';

export interface PortfolioApp {
  id: string;
  store: Store;
  storeAppId: string;
  country: string;
  name: string | null;
  iconUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  visibility: { current: number; delta7d: number | null };
  sparkline: VisibilityPoint[];
  trackedKeywords: number;
  competitors: number;
  lastCapturedAt: string | null;
}

export interface PortfolioGroup {
  id: string;
  name: string;
  memberAppIds: string[];
  visibility: { current: number; delta7d: number | null };
  sparkline: VisibilityPoint[];
}

export interface PortfolioTotals {
  apps: number;
  competitors: number;
  trackedKeywords: number;
  changes7d: number;
}

export interface PortfolioSummary {
  apps: PortfolioApp[];
  groups: PortfolioGroup[];
  totals: PortfolioTotals;
}

export interface DigestAppSummary {
  id: string;
  name: string | null;
  visibility: { current: number; delta7d: number | null };
  moversUp: KeywordMover[];
  moversDown: KeywordMover[];
  changes: number;
  negativeReviews: number | null;
  audit: { current: number | null; delta7d: number | null } | null;
  actions: { open: number; critical: number; high: number } | null;
}

export interface DigestGroupSummary {
  id: string;
  name: string;
  visibility: { current: number; delta7d: number | null };
}

export interface DigestWeeklyPayload {
  event: 'digest.weekly';
  occurredAt: string;
  window: { from: string; to: string };
  apps: DigestAppSummary[];
  groups: DigestGroupSummary[];
}
