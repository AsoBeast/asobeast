import { toTrackedKeywordItem, TrackedKeywordRow } from './keywords.mapper';

const row = (
  overrides: Partial<TrackedKeywordRow> = {},
): TrackedKeywordRow => ({
  keywordId: 'k1',
  source: 'COMPETITOR',
  active: true,
  relevance: null,
  keyword: {
    text: 'habit tracker',
    country: 'us',
    rankings: [],
    metrics: [
      {
        traffic: 8,
        difficulty: 4,
        date: new Date('2026-07-01'),
        scoringSource: 'APPLE_SUGGEST_SEARCH',
        formulaVersion: 'app-store-v1',
        confidence: 'HIGH',
        capturedAt: new Date('2026-07-01T09:30:00.000Z'),
      },
    ],
  },
  ...overrides,
});

describe('toTrackedKeywordItem', () => {
  it('derives volume, difficulty and a default relevance', () => {
    const item = toTrackedKeywordItem(row(), 'daily habit tracker');
    expect(item.volume).toBeCloseTo(80, 2);
    expect(item.relevance).toBe(60);
    expect(item.opportunity).toBeCloseTo(80 * 0.4 + 60 * 0.3 + 60 * 0.3, 1);
    expect(item.latestDepth).toBeNull();
  });

  it('lets a manual relevance override beat the default', () => {
    const item = toTrackedKeywordItem(
      row({ relevance: 95 }),
      'daily habit tracker',
    );
    expect(item.relevance).toBe(95);
  });

  it('returns a null opportunity for unscored keywords', () => {
    const item = toTrackedKeywordItem(
      row({
        keyword: {
          text: 'habit tracker',
          country: 'us',
          rankings: [],
          metrics: [],
        },
      }),
      '',
    );
    expect(item.volume).toBeNull();
    expect(item.opportunity).toBeNull();
    expect(item.scoreProvenance).toBeNull();
  });

  it('maps complete score provenance', () => {
    expect(toTrackedKeywordItem(row()).scoreProvenance).toEqual({
      source: 'APPLE_SUGGEST_SEARCH',
      formulaVersion: 'app-store-v1',
      capturedAt: '2026-07-01T09:30:00.000Z',
      confidence: 'HIGH',
    });
  });

  it('maps partial and unknown provenance to null', () => {
    const base = row().keyword.metrics[0];
    expect(
      toTrackedKeywordItem(
        row({
          keyword: {
            ...row().keyword,
            metrics: [{ ...base, formulaVersion: null }],
          },
        }),
      ).scoreProvenance,
    ).toBeNull();
    expect(
      toTrackedKeywordItem(
        row({
          keyword: {
            ...row().keyword,
            metrics: [{ ...base, confidence: 'UNKNOWN' }],
          },
        }),
      ).scoreProvenance,
    ).toBeNull();
  });

  const withRankings = (
    rankings: { position: number | null; date: string; depth?: number }[],
  ): TrackedKeywordRow =>
    row({
      keyword: {
        text: 'habit tracker',
        country: 'us',
        rankings: rankings.map((ranking) => ({
          position: ranking.position,
          date: new Date(ranking.date),
          depth: ranking.depth ?? 100,
        })),
        metrics: [],
      },
    });

  it('carries the latest captured depth through the response', () => {
    const item = toTrackedKeywordItem(
      withRankings([{ position: null, date: '2026-07-02', depth: 200 }]),
    );
    expect(item.latestPosition).toBeNull();
    expect(item.latestDepth).toBe(200);
  });

  it('reports an improvement as a negative daily delta', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 4, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(4);
    expect(item.positionDelta1d).toBe(-1);
  });

  it('reports a drop as a positive daily delta', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 5, date: '2026-07-02' },
        { position: 3, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(3);
    expect(item.positionDelta1d).toBe(2);
  });

  it('reports a zero daily delta when unchanged', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 3, date: '2026-07-01' },
      ]),
    );
    expect(item.positionDelta1d).toBe(0);
  });

  it('yields a null delta when there is no row for yesterday', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: 4, date: '2026-06-30' },
      ]),
    );
    expect(item.previousPosition).toBeNull();
    expect(item.positionDelta1d).toBeNull();
  });

  it('yields a null delta when yesterday had no position', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: 3, date: '2026-07-02' },
        { position: null, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBeNull();
    expect(item.positionDelta1d).toBeNull();
  });

  it('yields a null delta when today has no position', () => {
    const item = toTrackedKeywordItem(
      withRankings([
        { position: null, date: '2026-07-02' },
        { position: 4, date: '2026-07-01' },
      ]),
    );
    expect(item.previousPosition).toBe(4);
    expect(item.positionDelta1d).toBeNull();
  });
});
