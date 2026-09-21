import { Store } from '@asobeast/shared';

import { SuggestReach } from './suggest-reach';

export { toDifficulty100, toVolume } from '@asobeast/shared';
export { clamp, linear, logScale } from './curves';

export interface PreviousSerpApp {
  storeAppId: string;
  ratingCount: number;
}

export interface KeywordStats {
  store: Store;
  keywordText: string;
  resultCount: number;
  top10: Array<{
    storeAppId?: string;
    title: string;
    developer?: string;
    ratingCount?: number;
    ratingAvg?: number;
    daysSinceUpdate?: number;
    installs?: number;
  }>;
  top30TitleMatchCount: number;
  suggest: SuggestReach;
  previousTop10?: PreviousSerpApp[];
  previousCapturedDaysAgo?: number;
}
