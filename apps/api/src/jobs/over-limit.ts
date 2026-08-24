export const OVER_LIMIT_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60_000;

export interface LimitDecision<T> {
  covered: T[];
  dropped: number;
  truncating: boolean;
}

export function applyKeywordLimit<T extends { keywordId: string }>(input: {
  keywords: T[];
  limit: number;
  overLimitSince: Date | null;
  now: Date;
}): LimitDecision<T> {
  const { keywords, limit, overLimitSince, now } = input;
  if (keywords.length <= limit) {
    return { covered: keywords, dropped: 0, truncating: false };
  }
  if (!withinTruncation(overLimitSince, now)) {
    return { covered: keywords, dropped: 0, truncating: false };
  }

  const covered = [...keywords]
    .sort((a, b) => a.keywordId.localeCompare(b.keywordId))
    .slice(0, limit);
  return {
    covered,
    dropped: keywords.length - covered.length,
    truncating: true,
  };
}

function withinTruncation(overLimitSince: Date | null, now: Date): boolean {
  if (!overLimitSince) return false;
  return now.getTime() - overLimitSince.getTime() >= graceMs();
}

function graceMs(): number {
  return OVER_LIMIT_GRACE_DAYS * DAY_MS;
}
