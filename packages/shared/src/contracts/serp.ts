import type { KeywordScope } from './keywords';
export interface SerpEntryItem {
  position: number;
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  appId: string | null;
  isCompetitor: boolean;
}

export interface SerpSnapshot {
  keywordId: string;
  text: string;
  date: string | null;
  entries: SerpEntryItem[];
}

export interface CompetitorDiscoveryItem {
  storeAppId: string;
  title: string;
  developer: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  appearances: number;
  keywordCount: number;
  bestPosition: number;
  avgPosition: number;
  keywords: string[];
}

export interface CompetitorDiscovery {
  windowDays: number;
  items: CompetitorDiscoveryItem[];
}

export interface SerpMoverItem {
  date: string;
  keywordId: string;
  text: string;
  position: number;
  storeAppId: string;
  title: string;
  appId: string | null;
  isCompetitor: boolean;
}

export interface SerpMovers {
  windowDays: number;
  items: SerpMoverItem[];
}

export interface SerpEntrant {
  position: number;
  storeAppId: string;
  title: string;
  appId: string | null;
  isCompetitor: boolean;
}

export interface SerpEntrantPayload {
  event: 'serp.entrant';
  occurredAt: string;
  keyword: KeywordScope;
  date: string;
  entrants: SerpEntrant[];
}
