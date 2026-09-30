import {
  computeOpportunity,
  OPPORTUNITY_HIGH,
  SUFFICIENT_VOLUME,
} from './opportunity';

describe('computeOpportunity', () => {
  it.each([
    [0, 0, 0],
    [30, 0, 100],
    [100, 0, 100],
    [100, 100, 0],
    [15, 40, 30],
    [33, 23, 77],
    [68, 71, 29],
    [22.5, 37.3, 47],
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

  it('rises with volume until the volume is sufficient', () => {
    expect(computeOpportunity(20, 40)).toBeGreaterThan(
      computeOpportunity(10, 40) ?? 0,
    );
    expect(computeOpportunity(SUFFICIENT_VOLUME, 40)).toBe(
      computeOpportunity(90, 40),
    );
  });

  it('falls with difficulty at every volume', () => {
    expect(computeOpportunity(90, 60)).toBeLessThan(
      computeOpportunity(90, 40) ?? 0,
    );
    expect(computeOpportunity(10, 60)).toBeLessThan(
      computeOpportunity(10, 40) ?? 0,
    );
  });

  it('ranks an open long tail phrase above a contested head term', () => {
    expect(computeOpportunity(33, 23)).toBeGreaterThan(
      computeOpportunity(68, 71) ?? 0,
    );
  });

  it('names one threshold for a high opportunity', () => {
    expect(OPPORTUNITY_HIGH).toBe(35);
  });
});
