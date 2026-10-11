export interface CompetitorMetadataRow {
  appId: string;
  name: string | null;
  isYou: boolean;
  title: string | null;
  titleChars: number;
  subtitle: string | null;
  subtitleChars: number;
}

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
}

export interface CompetitorGaps {
  theyRankYouDont: CompetitorGapKeyword[];
  youRankTheyDont: CompetitorGapKeyword[];
  outranked: CompetitorGapKeyword[];
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

export interface CompetitorKeywordIdea {
  text: string;
  popularity: number | null;
  suggestRank: number;
  seed: string;
  usedBy: Array<{ appId: string; name: string | null }>;
}

export interface CompetitorKeywordIdeas {
  country: string;
  seeds: string[];
  popularityWeek: string | null;
  ideas: CompetitorKeywordIdea[];
}
