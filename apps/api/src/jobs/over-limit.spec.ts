import { applyKeywordLimit, OVER_LIMIT_GRACE_DAYS } from './over-limit';

const NOW = new Date('2026-08-08T03:00:00Z');
const DAY_MS = 24 * 60 * 60_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const keywords = (ids: string[]) => ids.map((keywordId) => ({ keywordId }));

describe('applyKeywordLimit', () => {
  it('covers everything while the workspace is inside its limit', () => {
    const all = keywords(['k1', 'k2']);

    expect(
      applyKeywordLimit({
        keywords: all,
        limit: 5,
        overLimitSince: null,
        now: NOW,
      }),
    ).toEqual({ covered: all, dropped: 0, truncating: false });
  });

  it('covers everything on the day a downgrade puts it over', () => {
    const all = keywords(['k1', 'k2', 'k3']);

    expect(
      applyKeywordLimit({
        keywords: all,
        limit: 2,
        overLimitSince: null,
        now: NOW,
      }),
    ).toEqual({ covered: all, dropped: 0, truncating: false });
  });

  it('keeps covering everything inside the grace period', () => {
    const all = keywords(['k1', 'k2', 'k3']);

    expect(
      applyKeywordLimit({
        keywords: all,
        limit: 2,
        overLimitSince: daysAgo(OVER_LIMIT_GRACE_DAYS - 1),
        now: NOW,
      }).truncating,
    ).toBe(false);
  });

  it('truncates once the grace period has run out', () => {
    const decision = applyKeywordLimit({
      keywords: keywords(['k3', 'k1', 'k2']),
      limit: 2,
      overLimitSince: daysAgo(OVER_LIMIT_GRACE_DAYS),
      now: NOW,
    });

    expect(decision.truncating).toBe(true);
    expect(decision.dropped).toBe(1);
    expect(decision.covered.map((row) => row.keywordId)).toEqual(['k1', 'k2']);
  });

  it('covers the same keywords every day rather than a rotating subset', () => {
    const input = {
      limit: 2,
      overLimitSince: daysAgo(OVER_LIMIT_GRACE_DAYS + 30),
      now: NOW,
    };

    const monday = applyKeywordLimit({
      ...input,
      keywords: keywords(['k3', 'k1', 'k2']),
    });
    const tuesday = applyKeywordLimit({
      ...input,
      keywords: keywords(['k2', 'k3', 'k1']),
    });

    expect(monday.covered).toEqual(tuesday.covered);
  });

  it('leaves the caller list untouched', () => {
    const all = keywords(['k3', 'k1']);

    applyKeywordLimit({
      keywords: all,
      limit: 1,
      overLimitSince: daysAgo(OVER_LIMIT_GRACE_DAYS),
      now: NOW,
    });

    expect(all.map((row) => row.keywordId)).toEqual(['k3', 'k1']);
  });
});
