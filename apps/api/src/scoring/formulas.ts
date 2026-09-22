import { Store } from '@asobeast/shared';

import { SuggestReach } from './suggest-reach';

export { toDifficulty100, toVolume } from '@asobeast/shared';
export { clamp, linear, logScale } from './curves';

export type OfficialPopularity = { value: number } | { absentBelow: number };

export interface SerpApp {
  storeAppId?: string;
  title: string;
  developer?: string;
  ratingCount?: number;
  ratingAvg?: number;
  daysSinceUpdate?: number;
  daysSinceRelease?: number;
  installs?: number;
}

export interface KeywordStats {
  store: Store;
  keywordText: string;
  resultCount: number;
  top10: SerpApp[];
  competitors?: SerpApp[];
  top30TitleMatchCount: number;
  suggest: SuggestReach;
  official?: OfficialPopularity;
}
