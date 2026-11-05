export interface CompetitorMetadataRow {
  appId: string;
  name: string | null;
  isYou: boolean;
  title: string | null;
  titleChars: number;
  subtitle: string | null;
  subtitleChars: number;
}

export const GAP_TOP = 30;
export const GAP_YOU_BELOW = 100;
export const WINNABLE_COMPETITOR_FROM = 11;
export const THREAT_WITHIN = 3;
export const THREAT_WINDOW_DAYS = 7;

export const COMPETITOR_THREAT_KINDS = ['closing', 'overtook'] as const;
export type CompetitorThreatKind = (typeof COMPETITOR_THREAT_KINDS)[number];

export interface CompetitorGapKeyword {
  keywordId: string;
  text: string;
  volume: number | null;
  difficulty: number | null;
  opportunity: number | null;
  yourPosition: number | null;
  bestCompetitorPosition: number | null;
  bestCompetitorId: string | null;
  gap: number | null;
  country?: string;
  lastCheckedOn?: string | null;
  threat?: CompetitorThreatKind;
  competitorDelta?: number | null;
  overtookOn?: string | null;
}

export interface CompetitorGapMarket {
  country: string;
  keywords: number;
  compared: number;
}

export interface CompetitorGapCoverage {
  competitors: number;
  delisted: number;
  markets: CompetitorGapMarket[];
}

export interface CompetitorGaps {
  theyRankYouDont: CompetitorGapKeyword[];
  youRankTheyDont: CompetitorGapKeyword[];
  outranked: CompetitorGapKeyword[];
  keywordGaps?: CompetitorGapKeyword[];
  winnable?: CompetitorGapKeyword[];
  threats?: CompetitorGapKeyword[];
  lead?: CompetitorGapKeyword[];
  coverage?: CompetitorGapCoverage;
}

export interface PositionMapPoint {
  appId: string;
  name: string | null;
  visibility: number;
  ratingAvg: number | null;
  isYou: boolean;
}

export interface CompetitorAnalysis {
  metadataComparison: CompetitorMetadataRow[];
  gaps: CompetitorGaps;
  positionMap: PositionMapPoint[];
}

export interface CompetitorAddRequest {
  url: string;
}
