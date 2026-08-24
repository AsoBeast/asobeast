import { KeywordSource, Store, tokenize } from '@asobeast/shared';

export const clamp = (v: number, lo = 0, hi = 10): number =>
  Math.min(hi, Math.max(lo, v));

export const linear = (v: number, min: number, max: number): number =>
  clamp(((v - min) / (max - min)) * 10);

export const logScale = (v: number, min: number, max: number): number =>
  v <= 0 ? 0 : linear(Math.log10(v), Math.log10(min), Math.log10(max));

export interface KeywordStats {
  store: Store;
  keywordText: string;
  top10: Array<{
    title: string;
    ratingCount?: number;
    ratingAvg?: number;
    daysSinceUpdate?: number;
    installs?: number;
  }>;
  top30TitleMatchCount: number;
  suggest: {
    priority?: number;
    partialPriority?: number;
    prefixHitLength?: number | null;
  };
}

export const WEIGHTS = {
  difficulty: {
    titleMatch: 0.35,
    strength: 0.3,
    competitors: 0.2,
    freshness: 0.15,
  },
  traffic: {
    suggest: 0.5,
    strength: 0.3,
    length: 0.2,
  },
} as const;

export const APP_STORE_FORMULA_VERSION = 'app-store-v1';

export const GPLAY_WEIGHTS = {
  difficulty: {
    titleMatch: 0.35,
    strength: 0.3,
    competitors: 0.2,
    freshness: 0.15,
  },
  traffic: {
    suggest: 0.4,
    installs: 0.3,
    strength: 0.1,
    length: 0.2,
  },
} as const;

export const GOOGLE_PLAY_FORMULA_VERSION = 'google-play-v1';

const average = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const definedNumbers = (values: Array<number | undefined>): number[] =>
  values.filter((value): value is number => typeof value === 'number');

function titleScore(title: string, keyword: string): number {
  const haystack = title.toLowerCase();
  const phrase = keyword.toLowerCase().trim();
  if (phrase.length === 0) {
    return 0;
  }
  if (haystack.includes(phrase)) {
    return 10;
  }
  const words = phrase.split(/\s+/);
  const present = words.filter((word) => haystack.includes(word));
  if (present.length === words.length) {
    return 7;
  }
  return present.length > 0 ? 4 : 0;
}

export const titleMatchScore = (stats: KeywordStats): number =>
  average(stats.top10.map((item) => titleScore(item.title, stats.keywordText)));

export const strengthScore = (stats: KeywordStats): number =>
  logScale(
    average(definedNumbers(stats.top10.map((item) => item.ratingCount))),
    100,
    2_000_000,
  );

export const competitorsScore = (stats: KeywordStats): number =>
  clamp(stats.top30TitleMatchCount / 3);

export const freshnessScore = (stats: KeywordStats): number => {
  const days = definedNumbers(stats.top10.map((item) => item.daysSinceUpdate));
  return days.length === 0 ? 0 : clamp(10 - average(days) / 9);
};

export const suggestScore = (stats: KeywordStats): number => {
  const { priority, partialPriority } = stats.suggest;
  if (typeof priority === 'number') {
    return clamp(priority / 1000);
  }
  if (typeof partialPriority === 'number') {
    return clamp(partialPriority / 2000);
  }
  return 1;
};

export const installsScore = (stats: KeywordStats): number =>
  logScale(
    average(definedNumbers(stats.top10.map((item) => item.installs))),
    1_000,
    1_000_000_000,
  );

export const gplaySuggestScore = (stats: KeywordStats): number => {
  const hit = stats.suggest.prefixHitLength;
  if (typeof hit === 'number') {
    return clamp(10 * (1 - (hit - 1) / stats.keywordText.length));
  }
  return 1;
};

export const lengthScore = (stats: KeywordStats): number => {
  const chars = stats.keywordText.length;
  if (chars <= 7) {
    return 10;
  }
  if (chars >= 25) {
    return 2;
  }
  return 10 - ((chars - 7) / (25 - 7)) * (10 - 2);
};

export const computeDifficulty = (stats: KeywordStats): number => {
  const weights =
    stats.store === 'GOOGLE_PLAY'
      ? GPLAY_WEIGHTS.difficulty
      : WEIGHTS.difficulty;
  return clamp(
    weights.titleMatch * titleMatchScore(stats) +
      weights.strength * strengthScore(stats) +
      weights.competitors * competitorsScore(stats) +
      weights.freshness * freshnessScore(stats),
  );
};

export const computeTraffic = (stats: KeywordStats): number => {
  if (stats.store === 'GOOGLE_PLAY') {
    return clamp(
      GPLAY_WEIGHTS.traffic.suggest * gplaySuggestScore(stats) +
        GPLAY_WEIGHTS.traffic.installs * installsScore(stats) +
        GPLAY_WEIGHTS.traffic.strength * strengthScore(stats) +
        GPLAY_WEIGHTS.traffic.length * lengthScore(stats),
    );
  }
  return clamp(
    WEIGHTS.traffic.suggest * suggestScore(stats) +
      WEIGHTS.traffic.strength * strengthScore(stats) +
      WEIGHTS.traffic.length * lengthScore(stats),
  );
};

const round1 = (v: number): number => Math.round(v * 10) / 10;

export const OPPORTUNITY_WEIGHTS = {
  volume: 0.4,
  difficulty: 0.3,
  relevance: 0.3,
} as const;

export const ASOBEAST_DEFAULTS = {
  relevanceBySource: {
    TITLE: 90,
    SUBTITLE: 90,
    KEYWORD_FIELD: 90,
    MANUAL: 80,
    DESCRIPTION: 70,
    SUGGESTED: 60,
    COMPETITOR: 50,
  } satisfies Record<KeywordSource, number>,
  relevanceOverlapBonus: 10,
} as const;

export const toVolume = (traffic: number): number =>
  clamp(traffic * 10, 0, 100);

export const toDifficulty100 = (difficulty: number): number =>
  clamp(difficulty * 10, 0, 100);

export const defaultRelevance = (
  source: KeywordSource,
  keywordText: string,
  snapshotText: string,
): number => {
  const base = ASOBEAST_DEFAULTS.relevanceBySource[source];
  const tokens = tokenize(keywordText);
  const snapshotTokens = new Set(tokenize(snapshotText));
  let relevance = base;
  if (tokens.length > 0) {
    const overlap = tokens.filter((token) => snapshotTokens.has(token)).length;
    if (overlap === tokens.length) {
      relevance = base + ASOBEAST_DEFAULTS.relevanceOverlapBonus;
    } else if (overlap === 0) {
      relevance = base - ASOBEAST_DEFAULTS.relevanceOverlapBonus;
    }
  }
  return clamp(relevance, 1, 100);
};

export const computeOpportunity = (
  volume: number | null,
  difficulty100: number | null,
  relevance: number,
): number | null => {
  if (volume === null || difficulty100 === null) {
    return null;
  }
  const score =
    volume * OPPORTUNITY_WEIGHTS.volume +
    (100 - difficulty100) * OPPORTUNITY_WEIGHTS.difficulty +
    relevance * OPPORTUNITY_WEIGHTS.relevance;
  return round1(clamp(score, 0, 100));
};
