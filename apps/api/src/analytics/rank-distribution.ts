import { RankDistributionPoint } from '@asobeast/shared';

export type RankDistributionBands = Omit<RankDistributionPoint, 'date'>;

export const bucketPositions = (
  positions: Array<number | null>,
): RankDistributionBands => {
  const bands: RankDistributionBands = {
    rank1: 0,
    rank2to3: 0,
    rank4to10: 0,
    rank11to50: 0,
    rank51plus: 0,
    unranked: 0,
  };
  for (const position of positions) {
    if (position === null) {
      bands.unranked += 1;
    } else if (position <= 1) {
      bands.rank1 += 1;
    } else if (position <= 3) {
      bands.rank2to3 += 1;
    } else if (position <= 10) {
      bands.rank4to10 += 1;
    } else if (position <= 50) {
      bands.rank11to50 += 1;
    } else {
      bands.rank51plus += 1;
    }
  }
  return bands;
};
