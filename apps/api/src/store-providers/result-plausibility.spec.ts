import {
  DAY_MS,
  IMPLAUSIBLE_LOOKBACK_DAYS,
  isImplausiblyEmpty,
} from './result-plausibility';

const TODAY = new Date('2026-08-08T00:00:00.000Z');
const daysAgo = (days: number) => new Date(TODAY.getTime() - days * DAY_MS);

describe('isImplausiblyEmpty', () => {
  it('accepts a result that found something', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 12,
        lastRankedOn: daysAgo(1),
        today: TODAY,
      }),
    ).toBe(false);
  });

  it('rejects nothing found for a phrase that ranked apps yesterday', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastRankedOn: daysAgo(1),
        today: TODAY,
      }),
    ).toBe(true);
  });

  it('accepts nothing found for a phrase that never ranked anything', () => {
    expect(
      isImplausiblyEmpty({ resultCount: 0, lastRankedOn: null, today: TODAY }),
    ).toBe(false);
  });

  it('stops suspecting the proxy once the phrase has been dead for a week', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastRankedOn: daysAgo(IMPLAUSIBLE_LOOKBACK_DAYS),
        today: TODAY,
      }),
    ).toBe(true);
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastRankedOn: daysAgo(IMPLAUSIBLE_LOOKBACK_DAYS + 1),
        today: TODAY,
      }),
    ).toBe(false);
  });

  it('ignores a snapshot that is not in the past', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastRankedOn: TODAY,
        today: TODAY,
      }),
    ).toBe(false);
  });
});
