import type {
  VisibilityPoint,
  KeywordMover,
  RankDistribution,
} from './analytics';
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

export interface AppActionCounts {
  open: number;
  critical: number;
  high: number;
}

export interface AppAuditTrend {
  current: number | null;
  delta7d: number | null;
}

export interface PortfolioMovement {
  up: number;
  down: number;
  entered: number;
  lost: number;
}

export interface AppRatingTrend {
  average: number | null;
  count: number | null;
  averageDelta7d: number | null;
}

export interface OwnedChangeCounts {
  own: number;
  competitors: number;
}

export interface PortfolioAppInsight {
  appId: string;
  rankDistribution: RankDistribution;
  top10Delta7d: number | null;
  movement: PortfolioMovement;
  rating: AppRatingTrend;
  audit: AppAuditTrend | null;
  actions: AppActionCounts | null;
  changes7d: OwnedChangeCounts;
  negativeReviews7d: number;
}

export interface PortfolioKeywordMover extends KeywordMover {
  appId: string;
  country: string;
}

export interface PortfolioInsightTotals {
  top10: number;
  top10Delta7d: number | null;
  movement: PortfolioMovement;
  changes7d: OwnedChangeCounts;
  negativeReviews7d: number;
}

export interface PortfolioInsights {
  apps: PortfolioAppInsight[];
  movers: { up: PortfolioKeywordMover[]; down: PortfolioKeywordMover[] };
  totals: PortfolioInsightTotals;
}

export interface DigestAppSummary {
  id: string;
  name: string | null;
  visibility: { current: number; delta7d: number | null };
  moversUp: KeywordMover[];
  moversDown: KeywordMover[];
  changes: number;
  negativeReviews: number | null;
  audit: AppAuditTrend | null;
  actions: AppActionCounts | null;
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
