import {
  chanceShift,
  computeOpportunity,
  OPPORTUNITY_HIGH,
} from './opportunity';

describe('computeOpportunity', () => {
  it.each([
    [0, 0, 100, 0],
    [100, 0, 1, 1],
    [100, 100, 100, 0],
    [64.4, 68.3, 90, 30.9],
    [47.7, 43.7, 90, 34.7],
    [50, 50, 150, 37.5],
  ])(
    'volume %s, difficulty %s, relevance %s is %s',
    (volume, difficulty, relevance, expected) => {
      expect(computeOpportunity(volume, difficulty, relevance)).toBe(expected);
    },
  );

  it.each([
    [null, 50, 80],
    [50, null, 80],
    [Number.NaN, 50, 80],
    [50, 50, Number.NaN],
  ])('has no value for %s, %s, %s', (volume, difficulty, relevance) => {
    expect(computeOpportunity(volume, difficulty, relevance)).toBeNull();
  });

  it('rises with volume and relevance and falls with difficulty', () => {
    expect(computeOpportunity(60, 40, 80)).toBeGreaterThan(
      computeOpportunity(50, 40, 80) ?? 0,
    );
    expect(computeOpportunity(50, 40, 90)).toBeGreaterThan(
      computeOpportunity(50, 40, 80) ?? 0,
    );
    expect(computeOpportunity(50, 60, 80)).toBeLessThan(
      computeOpportunity(50, 40, 80) ?? 0,
    );
  });

  it('names one threshold for a high opportunity', () => {
    expect(OPPORTUNITY_HIGH).toBe(35);
  });
});

describe('chanceShift', () => {
  it.each([
    [4, 21_500, 15],
    [2_000_000, 21_500, -14.764],
    [21_500, 21_500, 0],
    [null, 21_500, 0],
    [4, null, 0],
    [0, 0, 0],
  ])(
    'an app with %s ratings against a median of %s shifts by %s',
    (app, median, expected) => {
      expect(chanceShift(app, median)).toBeCloseTo(expected, 3);
    },
  );
});
