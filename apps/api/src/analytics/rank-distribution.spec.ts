import { bucketPositions } from './rank-distribution';

describe('bucketPositions', () => {
  it('assigns positions to disjoint bands', () => {
    const bands = bucketPositions([1, 2, 3, 4, 10, 11, 50, 51, 200, null]);
    expect(bands).toEqual({
      rank1: 1,
      rank2to3: 2,
      rank4to10: 2,
      rank11to50: 2,
      rank51plus: 2,
      unranked: 1,
    });
  });

  it('bands sum to the row count', () => {
    const positions = [1, 1, 3, 7, 40, 90, null, null];
    const bands = bucketPositions(positions);
    const total =
      bands.rank1 +
      bands.rank2to3 +
      bands.rank4to10 +
      bands.rank11to50 +
      bands.rank51plus +
      bands.unranked;
    expect(total).toBe(positions.length);
  });

  it('returns all zeros for no positions', () => {
    expect(bucketPositions([])).toEqual({
      rank1: 0,
      rank2to3: 0,
      rank4to10: 0,
      rank11to50: 0,
      rank51plus: 0,
      unranked: 0,
    });
  });
});
