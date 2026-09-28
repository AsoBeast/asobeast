import { RankDistribution, RankDistributionPoint } from '@asobeast/shared';
import { positionAt, TrackedRow } from './analytics.support';

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

export const rankDistributionAt = (
  rows: TrackedRow[],
  date: Date | null,
): RankDistribution => {
  const distribution: RankDistribution = {
    top1: 0,
    top3: 0,
    top10: 0,
    top50: 0,
    beyond: 0,
    unranked: 0,
  };
  for (const row of rows) {
    const position = date ? positionAt(row.keyword.rankings, date) : null;
    if (position === null) {
      distribution.unranked += 1;
      continue;
    }
    if (position <= 1) distribution.top1 += 1;
    if (position <= 3) distribution.top3 += 1;
    if (position <= 10) distribution.top10 += 1;
    if (position <= 50) distribution.top50 += 1;
    if (position > 50) distribution.beyond += 1;
  }
  return distribution;
};
