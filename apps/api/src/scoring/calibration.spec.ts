import {
  CalibrationPair,
  calibrationPairs,
  calibrationReport,
  spearman,
} from './calibration';

const pair = (
  keyword: string,
  estimated: number,
  official: number,
): CalibrationPair => ({
  keyword,
  estimated,
  official,
  reach: 'hit',
  flags: [],
});

describe('spearman', () => {
  it('ranks ties by their mean rank', () => {
    expect(spearman([1, 2, 2, 4], [10, 20, 20, 40])).toBeCloseTo(1, 6);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 6);
  });

  it('is 0 when one side does not vary', () => {
    expect(spearman([1, 1, 1], [1, 2, 3])).toBe(0);
  });
});

describe('calibrationReport', () => {
  it('needs ten pairs', () => {
    const report = calibrationReport([
      {
        keyword: 'quiz',
        estimated: 6.2,
        official: 71,
        reach: 'hit',
        flags: [],
      },
    ]);
    expect(report).toEqual({ status: 'not_enough_data', pairs: 1 });
  });

  it('reports the error on the shown scale', () => {
    const pairs = Array.from({ length: 12 }, (_, index) => {
      const official = (index + 1) * 5;
      const offset = index < 8 ? 0.5 : -0.2;
      return pair(`term ${index}`, official / 10 + offset, official);
    });

    const report = calibrationReport(pairs);

    expect(report).toMatchObject({
      status: 'ok',
      pairs: 12,
      meanAbsoluteError: expect.closeTo(4, 6) as number,
      meanSignedError: expect.closeTo(2.6667, 3) as number,
    });
    expect(report.status === 'ok' && report.largest).toHaveLength(10);
    expect(report.status === 'ok' && report.largest[0].error).toBeCloseTo(5, 6);
  });
});

describe('calibrationPairs', () => {
  const signals = {
    suggestReach: 'hit',
    suggestPrefixLength: 2,
    suggestPosition: 1,
    serpRelevance: 1,
    medianRatingCount: 1000,
    flags: ['padded'],
    officialPopularity: 71,
    estimatedTraffic: 6.2,
  };

  it('keeps current rows that carry both numbers', () => {
    expect(
      calibrationPairs([
        { text: 'quiz', formulaVersion: 'app-store-v3', stats: { signals } },
        {
          text: 'old',
          formulaVersion: 'app-store-v1',
          stats: { signals },
        },
        {
          text: 'estimate only',
          formulaVersion: 'app-store-v3',
          stats: { signals: { ...signals, officialPopularity: null } },
        },
      ]),
    ).toEqual([
      {
        keyword: 'quiz',
        estimated: 6.2,
        official: 71,
        reach: 'hit',
        flags: ['padded'],
      },
    ]);
  });
});
