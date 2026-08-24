export interface VisibilitySummary {
  current: number;
  delta7d: number | null;
  delta30d: number | null;
}

export interface RankDistribution {
  top1: number;
  top3: number;
  top10: number;
  top50: number;
  beyond: number;
  unranked: number;
}

export interface KeywordMover {
  keywordId: string;
  text: string;
  from: number | null;
  to: number | null;
  fromDepth: number;
  toDepth: number;
}

export interface KeywordMovers {
  up: KeywordMover[];
  down: KeywordMover[];
}

export interface UncoveredKeyword {
  keywordId: string;
  text: string;
  opportunity: number;
}

export interface CoverageSummary {
  inTitle: number;
  inSubtitle: number;
  inDescription: number;
  uncoveredHighOpportunity: UncoveredKeyword[];
}

export interface AppSummary {
  visibility: VisibilitySummary;
  rankDistribution: RankDistribution;
  movers: KeywordMovers;
  coverage: CoverageSummary;
  lastRefreshAt: string | null;
  trackedKeywords: number;
  competitors: number;
}

export interface VisibilityPoint {
  date: string;
  visibility: number;
}

export interface VisibilityHistory {
  points: VisibilityPoint[];
}

export interface RankDistributionPoint {
  date: string;
  rank1: number;
  rank2to3: number;
  rank4to10: number;
  rank11to50: number;
  rank51plus: number;
  unranked: number;
}

export interface RankDistributionHistory {
  points: RankDistributionPoint[];
}
