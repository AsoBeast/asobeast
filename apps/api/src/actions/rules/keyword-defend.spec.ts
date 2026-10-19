import { KeywordDefendEvidence, TrackedKeywordItem } from '@asobeast/shared';
import { SerpSnapshotDay } from '../../rankings/serp-movers';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import {
  DEFEND_MIN_ENTRANTS,
  DEFEND_MIN_OBSERVED_DAYS,
  DEFEND_NEUTRAL_VOLUME,
  DEFEND_WINDOW_DAYS,
  DEFEND_YOUR_POSITION_MAX,
  detectKeywordDefend,
  keywordDefendDetector,
} from './keyword-defend';
import { VOLATILITY_THRESHOLD } from './serp-volatility';
import {
  actionContext,
  contextApp,
  trackedKeyword,
} from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const OWN = 'own-app';

const keyword = (
  overrides: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem =>
  trackedKeyword({
    latestPosition: 6,
    latestDepth: 200,
    previousPosition: 4,
    traffic: 5.5,
    difficulty: 4,
    volume: 55,
    relevance: 80,
    opportunity: 60,
    ...overrides,
  });

const day = (offset: number): string =>
  new Date(NOW.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

const snapshot = (
  offset: number,
  ids: Array<[string, number]>,
): SerpSnapshotDay => ({
  date: day(offset),
  entries: ids.map(([storeAppId, position]) => ({
    storeAppId,
    position,
    title: `Budget ${storeAppId}`,
  })),
});

const BASELINE: Array<[string, number]> = [
  ['x1', 1],
  ['x2', 2],
  ['x3', 3],
  [OWN, 6],
];

const INVADED: Array<[string, number]> = [
  ['new1', 1],
  ['new2', 2],
  ['x1', 3],
  [OWN, 6],
];

const DEFAULT_SNAPSHOTS: SerpSnapshotDay[] = [
  snapshot(4, BASELINE),
  snapshot(3, BASELINE),
  snapshot(2, BASELINE),
  snapshot(1, INVADED),
];

const rankingDays = (positions: Array<number | null>): ActionRankingDay[] =>
  positions.map((position, index) => ({
    date: day(positions.length - index),
    position,
  }));

const app = (overrides: Partial<ActionContextApp> = {}): ActionContextApp =>
  contextApp({
    storeAppId: OWN,
    trackedKeywords: [keyword()],
    rankingDaysByKeyword: new Map([['kw_1', rankingDays([4, 5, 6, 6])]]),
    serpDaysByKeyword: new Map([['kw_1', DEFAULT_SNAPSHOTS]]),
    volatilityByKeyword: new Map([['kw_1', 12]]),
    ...overrides,
  });

const context = (apps: ActionContextApp[]): ActionContext =>
  actionContext(apps);

const evidenceOf = (detections: DetectedList): KeywordDefendEvidence =>
  detections[0].evidence as KeywordDefendEvidence;

type DetectedList = ReturnType<typeof detectKeywordDefend>;

describe('keyword.defend', () => {
  it('registers for its rule', () => {
    expect(keywordDefendDetector.rule).toBe('keyword.defend');
  });

  it('returns nothing for an empty context', () => {
    expect(detectKeywordDefend(context([]), NOW)).toEqual([]);
  });

  it('fires when two entrants land above you', () => {
    const detections = detectKeywordDefend(context([app()]), NOW);

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      rule: 'keyword.defend',
      appId: 'app_1',
      keywordId: 'kw_1',
      country: 'us',
      discriminator: null,
    });
    const evidence = evidenceOf(detections);
    expect(evidence.yourPosition).toBe(6);
    expect(evidence.entrantsAtOrAbove).toBe(2);
    expect(evidence.windowDays).toBe(DEFEND_WINDOW_DAYS);
    expect(evidence.observedDays).toBe(4);
  });

  it('never lists your own app as an entrant', () => {
    const arrival: SerpSnapshotDay[] = [
      snapshot(4, [['x1', 1]]),
      snapshot(3, [['x1', 1]]),
      snapshot(2, [['x1', 1]]),
      snapshot(1, [
        ['new1', 1],
        ['new2', 2],
        [OWN, 5],
      ]),
    ];
    const detections = detectKeywordDefend(
      context([app({ serpDaysByKeyword: new Map([['kw_1', arrival]]) })]),
      NOW,
    );

    expect(
      evidenceOf(detections).entrants.map((entrant) => entrant.storeAppId),
    ).toEqual(['new1', 'new2']);
  });

  it('does not count an app that held the top ten when the window opened', () => {
    const returning: SerpSnapshotDay[] = [
      snapshot(4, BASELINE),
      snapshot(3, [
        ['x2', 1],
        ['x3', 2],
        [OWN, 6],
      ]),
      snapshot(2, BASELINE),
      snapshot(1, INVADED),
    ];
    const detections = detectKeywordDefend(
      context([app({ serpDaysByKeyword: new Map([['kw_1', returning]]) })]),
      NOW,
    );

    expect(
      evidenceOf(detections).entrants.map((entrant) => entrant.storeAppId),
    ).toEqual(['new1', 'new2']);
  });

  it('does not count an entrant that has left the top ten again', () => {
    const passing: SerpSnapshotDay[] = [
      snapshot(4, BASELINE),
      snapshot(3, [...BASELINE, ['gone', 4]]),
      snapshot(2, BASELINE),
      snapshot(1, INVADED),
    ];
    const detections = detectKeywordDefend(
      context([app({ serpDaysByKeyword: new Map([['kw_1', passing]]) })]),
      NOW,
    );

    expect(evidenceOf(detections)).toMatchObject({ entrantsAtOrAbove: 2 });
    expect(
      evidenceOf(detections).entrants.map((entrant) => entrant.storeAppId),
    ).toEqual(['new1', 'new2']);
  });

  it('places each entrant where it sits in the latest snapshot', () => {
    const climbing: SerpSnapshotDay[] = [
      snapshot(4, BASELINE),
      snapshot(3, [...BASELINE, ['new1', 9], ['new2', 10]]),
      snapshot(2, BASELINE),
      snapshot(1, INVADED),
    ];
    const detections = detectKeywordDefend(
      context([app({ serpDaysByKeyword: new Map([['kw_1', climbing]]) })]),
      NOW,
    );

    expect(
      evidenceOf(detections).entrants.map((entrant) => entrant.position),
    ).toEqual([1, 2]);
  });

  it('marks a tracked competitor entrant and resolves its app id', () => {
    const detections = detectKeywordDefend(
      context([
        app({
          competitorAppIdsByStoreAppId: new Map([['new1', 'competitor_1']]),
        }),
      ]),
      NOW,
    );
    const entrants = evidenceOf(detections).entrants;

    expect(entrants[0]).toMatchObject({
      storeAppId: 'new1',
      isCompetitor: true,
      appId: 'competitor_1',
    });
    expect(entrants[1]).toMatchObject({
      storeAppId: 'new2',
      isCompetitor: false,
      appId: null,
    });
  });

  it('needs at least the minimum entrants', () => {
    const single: SerpSnapshotDay[] = [
      snapshot(4, BASELINE),
      snapshot(3, BASELINE),
      snapshot(2, BASELINE),
      snapshot(1, [
        ['new1', 1],
        ['x1', 2],
        ['x2', 3],
        [OWN, 6],
      ]),
    ];

    expect(DEFEND_MIN_ENTRANTS).toBe(2);
    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map([['kw_1', single]]) })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('needs at least the minimum observed days', () => {
    const thin = DEFAULT_SNAPSHOTS.slice(-(DEFEND_MIN_OBSERVED_DAYS - 1));

    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map([['kw_1', thin]]) })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('ignores entrants that all sit below you', () => {
    const below: SerpSnapshotDay[] = [
      snapshot(4, BASELINE),
      snapshot(3, BASELINE),
      snapshot(2, BASELINE),
      snapshot(1, [
        ['x1', 1],
        [OWN, 6],
        ['new1', 8],
        ['new2', 9],
      ]),
    ];

    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map([['kw_1', below]]) })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('defends at exactly the position ceiling and not beyond it', () => {
    const at = detectKeywordDefend(
      context([
        app({
          rankingDaysByKeyword: new Map([
            ['kw_1', rankingDays([4, 5, 6, DEFEND_YOUR_POSITION_MAX])],
          ]),
        }),
      ]),
      NOW,
    );
    const beyond = detectKeywordDefend(
      context([
        app({
          rankingDaysByKeyword: new Map([
            ['kw_1', rankingDays([4, 5, 6, DEFEND_YOUR_POSITION_MAX + 1])],
          ]),
        }),
      ]),
      NOW,
    );

    expect(at).toHaveLength(1);
    expect(beyond).toEqual([]);
  });

  it('defends ground you just lost after holding the top ten', () => {
    const detections = detectKeywordDefend(
      context([
        app({
          rankingDaysByKeyword: new Map([
            ['kw_1', rankingDays([4, 5, 6, null])],
          ]),
        }),
      ]),
      NOW,
    );

    expect(detections).toHaveLength(1);
    expect(evidenceOf(detections)).toMatchObject({
      yourPosition: null,
      previousPosition: 4,
      entrantsAtOrAbove: 2,
    });
    expect(detections[0].terms.severity).toBeCloseTo((2 / 3) * 0.6 + 0.4, 10);
  });

  it('never defends ground you never held', () => {
    expect(
      detectKeywordDefend(
        context([
          app({
            rankingDaysByKeyword: new Map([
              ['kw_1', rankingDays([null, null, null, null])],
            ]),
          }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('skips an inactive keyword and a keyword with no SERP history', () => {
    expect(
      detectKeywordDefend(
        context([app({ trackedKeywords: [keyword({ active: false })] })]),
        NOW,
      ),
    ).toEqual([]);
    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map() })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('tolerates a gap in the middle of the window', () => {
    const gapped: SerpSnapshotDay[] = [
      snapshot(6, BASELINE),
      snapshot(5, BASELINE),
      snapshot(2, BASELINE),
      snapshot(1, INVADED),
    ];

    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map([['kw_1', gapped]]) })]),
        NOW,
      ),
    ).toHaveLength(1);
  });

  it('observes no more days than the window holds across a full week of daily captures', () => {
    const week: SerpSnapshotDay[] = Array.from(
      { length: DEFEND_WINDOW_DAYS + 1 },
      (_, index) => {
        const offset = DEFEND_WINDOW_DAYS - index;
        return snapshot(offset, offset === 0 ? INVADED : BASELINE);
      },
    );
    const detections = detectKeywordDefend(
      context([app({ serpDaysByKeyword: new Map([['kw_1', week]]) })]),
      NOW,
    );

    expect(evidenceOf(detections)).toMatchObject({
      windowDays: DEFEND_WINDOW_DAYS,
      observedDays: DEFEND_WINDOW_DAYS,
    });
    expect(detections[0].terms.confidence).toBe(1);
  });

  it('opens the window on the day after the cutoff, not on the cutoff day', () => {
    const openedOnCutoff: SerpSnapshotDay[] = [
      snapshot(DEFEND_WINDOW_DAYS, INVADED),
      snapshot(DEFEND_WINDOW_DAYS - 1, BASELINE),
      snapshot(3, BASELINE),
      snapshot(2, BASELINE),
      snapshot(1, INVADED),
    ];
    const detections = detectKeywordDefend(
      context([
        app({
          serpDaysByKeyword: new Map([['kw_1', openedOnCutoff]]),
          rankingDaysByKeyword: new Map([
            [
              'kw_1',
              [
                { date: day(DEFEND_WINDOW_DAYS), position: 2 },
                { date: day(DEFEND_WINDOW_DAYS - 1), position: 4 },
                { date: day(1), position: 6 },
              ],
            ],
          ]),
        }),
      ]),
      NOW,
    );

    expect(evidenceOf(detections)).toMatchObject({
      previousPosition: 4,
      observedDays: 4,
    });
    expect(
      evidenceOf(detections).entrants.map((entrant) => entrant.storeAppId),
    ).toEqual(['new1', 'new2']);
  });

  it('ignores snapshots older than the window', () => {
    const stale = DEFAULT_SNAPSHOTS.map((snap, index) => ({
      ...snap,
      date: day(DEFEND_WINDOW_DAYS + 4 - index),
    }));

    expect(
      detectKeywordDefend(
        context([app({ serpDaysByKeyword: new Map([['kw_1', stale]]) })]),
        NOW,
      ),
    ).toEqual([]);
  });

  it('uses a neutral reach for an unscored keyword', () => {
    const detections = detectKeywordDefend(
      context([app({ trackedKeywords: [keyword({ volume: null })] })]),
      NOW,
    );

    expect(DEFEND_NEUTRAL_VOLUME).toBe(30);
    expect(detections[0].terms.reach).toBe(0.3);
  });

  describe('volatility damping', () => {
    it('leaves confidence untouched below the threshold', () => {
      const detections = detectKeywordDefend(
        context([
          app({
            volatilityByKeyword: new Map([['kw_1', VOLATILITY_THRESHOLD - 1]]),
          }),
        ]),
        NOW,
      );

      expect(detections[0].terms.confidence).toBeCloseTo(4 / 7, 10);
      expect(detections[0].dampenedBy).toBeUndefined();
    });

    it('clamps confidence and flags the advisory at the threshold', () => {
      const detections = detectKeywordDefend(
        context([
          app({
            volatilityByKeyword: new Map([['kw_1', VOLATILITY_THRESHOLD]]),
          }),
        ]),
        NOW,
      );

      expect(detections[0].terms.confidence).toBe(0.3);
      expect(detections[0].dampenedBy).toBe('serp.hold_volatile');
    });
  });

  describe('niche entrants', () => {
    const titled = (
      offset: number,
      entries: Array<[string, number, string]>,
    ): SerpSnapshotDay => ({
      date: day(offset),
      entries: entries.map(([storeAppId, position, title]) => ({
        storeAppId,
        position,
        title,
      })),
    });

    const OPENING: Array<[string, number, string]> = [
      ['worldguessr', 1, 'WorldGuessr'],
      ['seterra', 2, 'Seterra Geography'],
      [OWN, 6, 'Where Am I? GeoGuess Map Quiz'],
    ];

    const invadedBy = (
      first: [string, string],
      second: [string, string],
    ): SerpSnapshotDay[] => [
      titled(4, OPENING),
      titled(3, OPENING),
      titled(2, OPENING),
      titled(1, [
        [first[0], 1, first[1]],
        [second[0], 2, second[1]],
        [OWN, 6, 'Where Am I? GeoGuess Map Quiz'],
      ]),
    ];

    const PADDING = invadedBy(['x', 'X'], ['maps', 'Google Maps']);
    const GUESSERS = invadedBy(
      ['city-map', 'City Map Guesser'],
      ['country', 'Country Guesser'],
    );

    const cityguessr = keyword({ text: 'cityguessr' });
    const otherKeyword = (country = 'us') =>
      keyword({ keywordId: 'kw_2', text: 'location guesser', country });

    const defendWith = (overrides: Partial<ActionContextApp>) =>
      detectKeywordDefend(
        context([
          app({
            trackedKeywords: [cityguessr],
            serpDaysByKeyword: new Map([['kw_1', PADDING]]),
            ...overrides,
          }),
        ]),
        NOW,
      ).filter((detection) => detection.keywordId === 'kw_1');

    it('ignores popular apps padding the results', () => {
      expect(defendWith({})).toEqual([]);
    });

    it('counts apps that also rank for another keyword of the app', () => {
      const detections = defendWith({
        trackedKeywords: [cityguessr, otherKeyword()],
        serpDaysByKeyword: new Map([
          ['kw_1', GUESSERS],
          ['kw_2', GUESSERS],
        ]),
      });

      expect(detections).toHaveLength(1);
      expect(
        evidenceOf(detections).entrants.map((entrant) => entrant.title),
      ).toEqual(['City Map Guesser', 'Country Guesser']);
    });

    it('never counts padding that only another keyword of the app shares', () => {
      expect(
        defendWith({
          trackedKeywords: [cityguessr, otherKeyword()],
          serpDaysByKeyword: new Map([
            ['kw_1', PADDING],
            ['kw_2', GUESSERS],
          ]),
        }),
      ).toEqual([]);
    });

    it('counts a paused keyword as no evidence', () => {
      expect(
        defendWith({
          trackedKeywords: [cityguessr, { ...otherKeyword(), active: false }],
          serpDaysByKeyword: new Map([
            ['kw_1', PADDING],
            ['kw_2', PADDING],
          ]),
        }),
      ).toEqual([]);
    });

    it('counts a keyword in another storefront as no evidence', () => {
      expect(
        defendWith({
          trackedKeywords: [cityguessr, otherKeyword('de')],
          serpDaysByKeyword: new Map([
            ['kw_1', PADDING],
            ['kw_2', PADDING],
          ]),
        }),
      ).toEqual([]);
    });

    it('counts an app whose title shares a word with the keyword', () => {
      const detections = defendWith({
        trackedKeywords: [keyword({ text: 'city guesser' })],
        serpDaysByKeyword: new Map([['kw_1', GUESSERS]]),
      });

      expect(evidenceOf(detections).entrants).toHaveLength(2);
    });

    it('never counts a shared stopword as a shared word', () => {
      expect(
        defendWith({
          trackedKeywords: [keyword({ text: 'guess the map' })],
          serpDaysByKeyword: new Map([
            [
              'kw_1',
              invadedBy(['sims', 'The Sims'], ['x', 'X the everything app']),
            ],
          ]),
        }),
      ).toEqual([]);
    });

    it('counts a tracked competitor', () => {
      expect(
        defendWith({
          competitorAppIdsByStoreAppId: new Map([
            ['x', 'competitor_x'],
            ['maps', 'competitor_maps'],
          ]),
        }),
      ).toHaveLength(1);
    });
  });
});
