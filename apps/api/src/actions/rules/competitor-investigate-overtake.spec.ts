import { ChangeField, TrackedKeywordItem } from '@asobeast/shared';
import {
  ActionCompetitorChange,
  competitorRankingKey,
} from '../action-competitors';
import type { ActionContextApp, ActionRankingDay } from '../action-context';
import { actionFingerprint } from '../action-fingerprint';
import { scoreImpact } from '../action-impact';
import {
  competitorInvestigateOvertakeDetector,
  detectCompetitorInvestigateOvertake,
  OVERTAKE_MAX_KEYWORDS,
} from './competitor-investigate-overtake';
import {
  actionContext,
  contextApp,
  trackedKeyword,
} from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const OFFSETS = [5, 4, 3, 2, 1];

const captures = (
  positions: Array<number | null>,
  offsets = OFFSETS,
): ActionRankingDay[] =>
  positions.map((position, index) => ({ date: day(offsets[index]), position }));

const keyword = (
  keywordId: string,
  text: string,
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem =>
  trackedKeyword({ keywordId, text, volume: 60, relevance: 80, ...overrides });

const change = (
  field: ChangeField,
  after: string | null,
  offset = 3,
  competitorAppId = 'comp_1',
): ActionCompetitorChange => ({
  competitorAppId,
  competitorName: 'Tomato Focus',
  field,
  after,
  capturedAt: new Date(`${day(offset)}T05:00:00.000Z`),
});

interface Race {
  keyword: TrackedKeywordItem;
  yours: Array<number | null>;
  theirs: Array<number | null>;
}

const race = (
  item: TrackedKeywordItem,
  theirs: Array<number | null> = [14, 14, 4, 4, 4],
  yours: Array<number | null> = [6, 6, 9, 9, 9],
): Race => ({ keyword: item, yours, theirs });

const app = (
  races: Race[],
  changes: ActionCompetitorChange[] = [
    change('title', 'Tomato Focus: Habit Tracker'),
  ],
): ActionContextApp =>
  contextApp({
    trackedKeywords: races.map(({ keyword: item }) => item),
    rankingDaysByKeyword: new Map(
      races.map(({ keyword: item, yours }) => [
        item.keywordId,
        captures(yours),
      ]),
    ),
    competitors: [{ id: 'comp_1', name: 'Tomato Focus' }],
    competitorChanges: changes,
    competitorRankingDays: new Map(
      races.map(({ keyword: item, theirs }) => [
        competitorRankingKey('comp_1', item.keywordId),
        captures(theirs).filter((capture) => capture.position !== null),
      ]),
    ),
  });

const HABIT = keyword('kw_1', 'habit tracker');
const FOCUS = keyword('kw_2', 'focus timer', { volume: 50 });

const detect = (apps: ActionContextApp[]) =>
  detectCompetitorInvestigateOvertake(actionContext(apps), NOW);

describe('competitor.investigate_overtake', () => {
  it('fires when a competitor changed its title and passed you on two keywords', () => {
    const [detection] = detect([app([race(HABIT), race(FOCUS)])]);

    expect(detection).toEqual({
      rule: 'competitor.investigate_overtake',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: `comp_1~${day(3)}`,
      terms: { reach: 0.6, severity: 0.6, confidence: 3 / 7 },
      evidence: {
        rule: 'competitor.investigate_overtake',
        competitorAppId: 'comp_1',
        competitorName: 'Tomato Focus',
        changedAt: day(3),
        fields: ['title'],
        newTitle: 'Tomato Focus: Habit Tracker',
        newSubtitle: null,
        keywords: [
          {
            keywordId: 'kw_1',
            text: 'habit tracker',
            yourBefore: 6,
            yourAfter: 9,
            theirBefore: 14,
            theirAfter: 4,
            volume: 60,
            mentioned: true,
          },
          {
            keywordId: 'kw_2',
            text: 'focus timer',
            yourBefore: 6,
            yourAfter: 9,
            theirBefore: 14,
            theirAfter: 4,
            volume: 50,
            mentioned: false,
          },
        ],
      },
    });
    expect(scoreImpact(detection.rule, detection.terms)).toEqual({
      impact: 57,
      priority: 'medium',
    });
    expect(competitorInvestigateOvertakeDetector.rule).toBe(
      'competitor.investigate_overtake',
    );
  });

  it('stays silent when the overtake lasted a single capture', () => {
    expect(
      detect([app([race(HABIT, [14, 14, 4, 12, 12], [6, 6, 9, 9, 9])])]),
    ).toEqual([]);
  });

  it('stays silent with only one capture since the change', () => {
    const single = app([race(HABIT)]);
    single.rankingDaysByKeyword.set('kw_1', captures([6, 6, 9], [5, 4, 3]));

    expect(detect([single])).toEqual([]);
  });

  it('stays silent when the competitor was already ahead', () => {
    expect(detect([app([race(HABIT, [3, 3, 4, 4, 4])])])).toEqual([]);
  });

  it('stays silent when your position before the change was 25', () => {
    expect(
      detect([app([race(HABIT, [30, 30, 4, 4, 4], [25, 25, 26, 26, 26])])]),
    ).toEqual([]);
  });

  it('fires when the competitor was unranked before and ahead after', () => {
    const [detection] = detect([app([race(HABIT, [null, null, 4, 4, 4])])]);

    expect(detection.evidence).toMatchObject({
      keywords: [{ keywordId: 'kw_1', theirBefore: null, theirAfter: 4 }],
    });
  });

  it('counts a description change without a mention', () => {
    const [detection] = detect([
      app([race(HABIT)], [change('description', '4000')]),
    ]);

    expect(detection.evidence).toMatchObject({
      fields: ['description'],
      newTitle: null,
      newSubtitle: null,
      keywords: [{ keywordId: 'kw_1', mentioned: false }],
    });
    expect(detection.terms.severity).toBeCloseTo(0.2);
  });

  it('stays silent when the competitor fell back behind you', () => {
    expect(
      detect([app([race(HABIT, [14, 14, 4, 4, 11], [6, 6, 9, 9, 9])])]),
    ).toEqual([]);
  });

  it('keeps the five keywords with the most volume', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      race(
        keyword(`kw_${index + 1}`, `phrase ${index + 1}`, {
          volume: 30 + index * 5,
        }),
      ),
    );

    const [detection] = detect([app(many)]);

    expect(detection.evidence).toMatchObject({
      keywords: [
        { keywordId: 'kw_7' },
        { keywordId: 'kw_6' },
        { keywordId: 'kw_5' },
        { keywordId: 'kw_4' },
        { keywordId: 'kw_3' },
      ],
    });
    expect(
      detection.evidence.rule === 'competitor.investigate_overtake' &&
        detection.evidence.keywords.length,
    ).toBe(OVERTAKE_MAX_KEYWORDS);
  });

  it('opens one action per competitor and change day', () => {
    const detections = detect([
      app(
        [race(HABIT), race(FOCUS, [14, 14, 14, 4, 4], [6, 6, 6, 9, 9])],
        [change('title', 'Tomato Focus'), change('subtitle', 'Timer', 2)],
      ),
    ]);

    expect(
      detections.map((detection) => ({
        discriminator: detection.discriminator,
        keywords:
          detection.evidence.rule === 'competitor.investigate_overtake'
            ? detection.evidence.keywords.map((item) => item.keywordId)
            : [],
      })),
    ).toEqual([
      { discriminator: `comp_1~${day(3)}`, keywords: ['kw_1'] },
      { discriminator: `comp_1~${day(2)}`, keywords: ['kw_2'] },
    ]);
    expect(new Set(detections.map(actionFingerprint)).size).toBe(2);
  });

  it('ignores keywords below the volume or relevance floor', () => {
    expect(
      detect([
        app([
          race(keyword('kw_1', 'habit tracker', { volume: 19 })),
          race(keyword('kw_2', 'focus timer', { relevance: 59 })),
        ]),
      ]),
    ).toEqual([]);
  });

  it('ignores a change older than the window', () => {
    expect(
      detect([app([race(HABIT)], [change('title', 'Tomato Focus', 15)])]),
    ).toEqual([]);
  });
});
