import type { Store } from '../index';

export interface RankingPoint {
  date: string;
  position: number | null;
  depth: number;
  resultCount?: number | null;
}

export interface RankingSeriesItem {
  keywordId: string;
  text: string;
  store: Store;
  country: string;
  points: RankingPoint[];
}

export interface RankingSeries {
  series: RankingSeriesItem[];
}
