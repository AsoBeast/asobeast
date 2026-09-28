import {
  KeywordCoverageRow,
  KeywordPushToTop10Evidence,
  MetadataField,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type { SerpSnapshotDay } from '../../rankings/serp-movers';
import type { ActionContextApp, ActionRankingDay } from '../action-context';
import { scoreImpact } from '../action-impact';
import {
  detectKeywordPushToTop10,
  keywordPushToTop10Detector,
  PUSH_MAX_PER_APP,
  PUSH_WINDOW_DAYS,
} from './keyword-push-to-top10';
import {
  actionContext,
  contextApp,
  trackedKeyword,
} from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const lastWeek = (positions: Array<number | null>): ActionRankingDay[] =>
  positions.map((position, index) => ({
    date: day(positions.length - 1 - index),
    position,
  }));

const keyword = (
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem =>
  trackedKeyword({
    text: 'habit tracker',
    latestPosition: 12,
    volume: 60,
    relevance: 80,
    opportunity: 44,
    ...overrides,
  });

const coverage = (
  keywordId: string,
  covered: MetadataField[],
  fields: MetadataField[] = ['title', 'subtitle', 'keywordField'],
): KeywordCoverageRow => ({
  keywordId,
  text: 'habit tracker',
  bucket: null,
  uncovered: covered.length === 0,
  fields: fields.map((field) => ({ field, covered: covered.includes(field) })),
});

const IN_BAND = [22, 14, 13, 12, 12, 12, 12];

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp =>
  contextApp({
    trackedKeywords: [keyword()],
    coverage: [coverage('kw_1', ['keywordField'])],
    rankingDaysByKeyword: new Map([['kw_1', lastWeek(IN_BAND)]]),
    volatilityByKeyword: new Map([['kw_1', 12]]),
    ...overrides,
  });

const detect = (apps: ActionContextApp[]) =>
  detectKeywordPushToTop10(actionContext(apps), NOW);

const live = (apps: ActionContextApp[]) =>
  detect(apps).filter((detection) => !detection.withheld);

describe('keyword.push_to_top10', () => {
  it('registers for its rule', () => {
    expect(keywordPushToTop10Detector.rule).toBe('keyword.push_to_top10');
  });

  it('fires on a keyword held just outside the top 10 by a weak field', () => {
    const [detection] = detect([app()]);

    expect(detection).toMatchObject({
      rule: 'keyword.push_to_top10',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: 'kw_1',
      discriminator: null,
    });
    expect(detection.withheld).toBeUndefined();
    expect(detection.evidence).toEqual<KeywordPushToTop10Evidence>({
      rule: 'keyword.push_to_top10',
      latestPosition: 12,
      bestPosition: 12,
      daysInBand: 6,
      windowDays: PUSH_WINDOW_DAYS,
      volume: 60,
      relevance: 80,
      opportunity: 44,
      coveredFields: ['keywordField'],
      strongFields: ['title', 'subtitle'],
    });
    expect(scoreImpact(detection.rule, detection.terms)).toEqual({
      impact: 76,
      priority: 'high',
    });
  });

  it.each([10, 21])('stays silent at position %i', (position) => {
    expect(
      detect([
        app({
          trackedKeywords: [keyword({ latestPosition: position })],
          rankingDaysByKeyword: new Map([
            ['kw_1', lastWeek([14, 13, 12, 12, 12, 12, position])],
          ]),
        }),
      ]),
    ).toEqual([]);
  });

  it('counts no more days in the band than the window holds', () => {
    const [detection] = detect([
      app({
        rankingDaysByKeyword: new Map([
          ['kw_1', lastWeek([12, 12, 12, 12, 12, 12, 12, 12])],
        ]),
      }),
    ]);

    expect(detection.evidence).toMatchObject({ daysInBand: 7, windowDays: 7 });
    expect(detection.terms.confidence).toBe(1);
  });

  it('stays silent with only four days in the band', () => {
    expect(
      detect([
        app({
          rankingDaysByKeyword: new Map([
            ['kw_1', lastWeek([30, 25, 24, 12, 12, 12, 12])],
          ]),
        }),
      ]),
    ).toEqual([]);
  });

  it('stays silent while the keyword is falling', () => {
    expect(
      detect([
        app({
          trackedKeywords: [keyword({ latestPosition: 18 })],
          rankingDaysByKeyword: new Map([
            ['kw_1', lastWeek([12, 12, 14, 16, 18, 18, 18])],
          ]),
        }),
      ]),
    ).toEqual([]);
  });

  it('stays silent once a strong field covers the keyword', () => {
    expect(
      detect([app({ coverage: [coverage('kw_1', ['subtitle'])] })]),
    ).toEqual([]);
    expect(
      detect([
        app({
          store: 'GOOGLE_PLAY',
          coverage: [
            coverage(
              'kw_1',
              ['shortDescription'],
              ['title', 'shortDescription', 'description'],
            ),
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it('asks a Play app to use its title or short description', () => {
    const [detection] = detect([
      app({
        store: 'GOOGLE_PLAY',
        coverage: [
          coverage(
            'kw_1',
            ['description'],
            ['title', 'shortDescription', 'description'],
          ),
        ],
      }),
    ]);

    expect(detection.evidence).toMatchObject({
      coveredFields: ['description'],
      strongFields: ['title', 'shortDescription'],
    });
  });

  it('withholds a keyword whose results are volatile', () => {
    const detections = detect([
      app({ volatilityByKeyword: new Map([['kw_1', 60]]) }),
    ]);

    expect(detections).toHaveLength(1);
    expect(detections[0].withheld).toBe(true);
  });

  it('withholds a keyword the defend rule already covers', () => {
    const snapshot = (offset: number, ids: string[]): SerpSnapshotDay => ({
      date: day(offset),
      entries: ids.map((storeAppId, index) => ({
        storeAppId,
        position: index + 1,
        title: `App ${storeAppId}`,
      })),
    });
    const settled = ['x1', 'x2', 'x3'];
    const invaded = ['new1', 'new2', 'x1'];
    const detections = detect([
      app({
        serpDaysByKeyword: new Map([
          [
            'kw_1',
            [
              snapshot(4, settled),
              snapshot(3, settled),
              snapshot(2, settled),
              snapshot(1, invaded),
            ],
          ],
        ]),
      }),
    ]);

    expect(detections).toHaveLength(1);
    expect(detections[0].withheld).toBe(true);
  });

  it('keeps the five strongest keywords and withholds the rest', () => {
    const ids = Array.from(
      { length: PUSH_MAX_PER_APP + 2 },
      (_, index) => `kw_${index}`,
    );
    const detections = detect([
      app({
        trackedKeywords: ids.map((keywordId, index) =>
          keyword({ keywordId, volume: 90 - index * 5 }),
        ),
        coverage: ids.map((keywordId) => coverage(keywordId, ['keywordField'])),
        rankingDaysByKeyword: new Map(ids.map((id) => [id, lastWeek(IN_BAND)])),
      }),
    ]);

    expect(
      detections
        .filter((detection) => !detection.withheld)
        .map((d) => d.keywordId),
    ).toEqual(ids.slice(0, PUSH_MAX_PER_APP));
    expect(
      detections
        .filter((detection) => detection.withheld)
        .map((d) => d.keywordId),
    ).toEqual(ids.slice(PUSH_MAX_PER_APP));
  });

  it('never considers another market or an outdated score', () => {
    expect(
      live([app({ trackedKeywords: [keyword({ country: 'de' })] })]),
    ).toEqual([]);
    expect(
      live([app({ trackedKeywords: [keyword({ scoreOutdated: true })] })]),
    ).toEqual([]);
  });
});
