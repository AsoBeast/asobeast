import {
  computeOpportunity,
  dailySearches,
  OPPORTUNITY_HIGH,
} from './opportunity';

describe('dailySearches', () => {
  it.each([
    [0, 0],
    [0.5, 0.5],
    [40, 70],
    [47.5, 210],
    [56, 686],
    [100, 300_000],
    [120, 300_000],
  ])('reads a volume of %s as %s searches a day', (volume, expected) => {
    expect(dailySearches(volume)).toBeCloseTo(expected, 6);
  });
});

describe('computeOpportunity', () => {
  it.each([
    [0, 0, 0],
    [100, 0, 100],
    [100, 100, 0],
    [56, 41, 43],
    [40, 41, 28],
    [47.7, 43.7, 34],
  ])('volume %s at difficulty %s is %s', (volume, difficulty, expected) => {
    expect(computeOpportunity(volume, difficulty)).toBe(expected);
  });

  it.each([
    [null, 50],
    [50, null],
    [Number.NaN, 50],
    [50, Number.NaN],
  ])('has no value for %s, %s', (volume, difficulty) => {
    expect(computeOpportunity(volume, difficulty)).toBeNull();
  });

  it('rises with volume and falls with difficulty', () => {
    expect(computeOpportunity(60, 40)).toBeGreaterThan(
      computeOpportunity(50, 40) ?? 0,
    );
    expect(computeOpportunity(50, 60)).toBeLessThan(
      computeOpportunity(50, 40) ?? 0,
    );
  });

  it('barely penalizes an easy page and closes on a hard one', () => {
    const open = computeOpportunity(60, 0) ?? 0;
    expect(computeOpportunity(60, 20)).toBeGreaterThan(open * 0.95);
    expect(computeOpportunity(60, 90)).toBeLessThan(open * 0.2);
  });

  it('names one threshold for a high opportunity', () => {
    expect(OPPORTUNITY_HIGH).toBe(35);
  });
});
