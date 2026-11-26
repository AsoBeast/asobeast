import {
  KEYWORD_MIN_RELEVANCE,
  KeywordClass,
  PlacementSuggestion,
  Store,
  TargetScores,
} from '@asobeast/shared';
import {
  PUSH_MAX_POSITION,
  PUSH_MIN_POSITION,
  PUSH_MIN_RELEVANCE,
  PUSH_MIN_VOLUME,
} from '../../actions/rules/keyword-push-to-top10';
import { UNCOVERED_MIN_VOLUME } from '../../actions/rules/keyword-add-uncovered';
import { LONGTAIL_MAX_VOLUME, LONGTAIL_MIN_WORDS } from '../buckets';
import {
  LONG_TAIL_POPULARITY,
  LONG_TAIL_WORDS,
  PLACEMENT_MIN_POPULARITY,
  PLACEMENT_MIN_RELEVANCE,
  PlacementItem,
  placementVerdicts,
  SUBTITLE_KEYWORDS,
} from './placement';

const TODAY = '2026-11-26';
const THREE_DAYS_AGO = '2026-11-23';

interface ItemOverrides {
  text?: string;
  popularity?: number | null;
  difficulty?: number | null;
  opportunity?: number | null;
  relevance?: number | null;
  position?: number | null;
  checkedOn?: string | null;
  keywordClass?: KeywordClass;
  floorAnswer?: boolean;
  scoreOutdated?: boolean;
}

function scores(overrides: ItemOverrides): TargetScores {
  return {
    country: 'us',
    keywordId: `kw-${overrides.text ?? 'habit tracker'}`,
    popularity: 60,
    difficulty: 30,
    opportunity: 70,
    relevance: 80,
    position: 14,
    depth: 200,
    checkedOn: TODAY,
    keywordClass: 'generic',
    scoreOutdated: false,
    floorAnswer: false,
    ...overrides,
  };
}

function item(overrides: ItemOverrides = {}): PlacementItem {
  return { text: overrides.text ?? 'habit tracker', lead: scores(overrides) };
}

const unreachable = (overrides: ItemOverrides): PlacementItem =>
  item({ difficulty: 90, position: null, checkedOn: null, ...overrides });

function verdicts(
  targets: PlacementItem[],
  candidates: PlacementItem[] = [],
  store: Store = 'APP_STORE',
): Map<string, PlacementSuggestion> {
  return placementVerdicts({ store, targets, candidates, today: TODAY });
}

function only(
  overrides: ItemOverrides,
  store: Store = 'APP_STORE',
): PlacementSuggestion | undefined {
  const target = item(overrides);
  return verdicts([target], [], store).get(target.text);
}

const strongFieldsTaken = (): PlacementItem[] => [
  item({ text: 'meditation', popularity: 80, opportunity: 99 }),
  item({ text: 'calm', popularity: 70, opportunity: 98 }),
  item({ text: 'sleep', popularity: 70, opportunity: 97 }),
];

const fieldFillers = (): PlacementItem[] =>
  Array.from({ length: 8 }, (_, index) =>
    unreachable({
      text: `${'x'.repeat(10)}${index}`,
      popularity: 30,
      opportunity: 10,
    }),
  );

describe('placementVerdicts', () => {
  describe('thresholds mirror their sources', () => {
    it('keeps the floor at the push and add uncovered floors', () => {
      expect(PLACEMENT_MIN_POPULARITY).toBe(PUSH_MIN_VOLUME);
      expect(PLACEMENT_MIN_POPULARITY).toBe(UNCOVERED_MIN_VOLUME);
    });

    it('reads relevance and long tail edges from their sources', () => {
      expect(PLACEMENT_MIN_RELEVANCE).toBe(KEYWORD_MIN_RELEVANCE);
      expect(PLACEMENT_MIN_RELEVANCE).toBe(PUSH_MIN_RELEVANCE);
      expect(LONG_TAIL_WORDS).toBe(LONGTAIL_MIN_WORDS);
      expect(LONG_TAIL_POPULARITY).toBe(LONGTAIL_MAX_VOLUME);
    });

    it('allows as many subtitle keywords as there are subtitle slots', () => {
      expect(SUBTITLE_KEYWORDS).toBe(2);
    });
  });

  describe('no verdict', () => {
    it('answers nothing for a keyword without a lead market', () => {
      expect(
        verdicts([{ text: 'habit tracker', lead: null }]).has('habit tracker'),
      ).toBe(false);
    });

    it('answers nothing for an unscored keyword', () => {
      expect(only({ popularity: null })).toBeUndefined();
    });

    it('answers nothing for an outdated score', () => {
      expect(only({ scoreOutdated: true })).toBeUndefined();
    });
  });

  describe('skip', () => {
    it.each<[string, ItemOverrides, string]>([
      [
        'a competitor brand with the best scores',
        { keywordClass: 'competitorBrand', popularity: 90, opportunity: 99 },
        'competitorBrand',
      ],
      ['the own brand', { keywordClass: 'ownBrand' }, 'ownBrand'],
      ['popularity 19', { popularity: 19 }, 'lowPopularity'],
      [
        'a floor answer at 15',
        { popularity: 15, floorAnswer: true },
        'lowPopularity',
      ],
      [
        'a floor answer above the floor',
        { popularity: 45, floorAnswer: true },
        'lowPopularity',
      ],
      ['relevance 59', { relevance: 59 }, 'lowRelevance'],
      [
        'a competitor brand at popularity 5',
        { keywordClass: 'competitorBrand', popularity: 5 },
        'competitorBrand',
      ],
    ])('skips %s', (_, overrides, reason) => {
      expect(only(overrides)).toMatchObject({ field: 'skip', reason });
    });

    it.each<[string, ItemOverrides]>([
      ['popularity 20', { popularity: 20 }],
      ['relevance 60', { relevance: 60 }],
      ['an unknown relevance', { relevance: null }],
    ])('does not skip %s', (_, overrides) => {
      expect(only(overrides)?.field).not.toBe('skip');
    });
  });

  describe('title', () => {
    it('gives the title to the strongest reachable keyword of popularity 40 or more', () => {
      const result = verdicts([
        item({ text: 'daily goals', popularity: 30, opportunity: 90 }),
        item({ text: 'habit tracker', popularity: 50, opportunity: 60 }),
      ]);
      expect(result.get('habit tracker')).toMatchObject({
        field: 'title',
        reason: 'strongestReachable',
      });
      expect(result.get('daily goals')).toMatchObject({
        field: 'subtitle',
        reason: 'nextReachable',
      });
    });

    it('counts beatable as reachable', () => {
      expect(
        only({
          popularity: 45,
          difficulty: 30,
          position: null,
          checkedOn: null,
        }),
      ).toMatchObject({ field: 'title', reason: 'strongestReachable' });
    });

    it('does not count a difficulty equal to the popularity as beatable', () => {
      expect(
        only({
          popularity: 45,
          difficulty: 45,
          position: null,
          checkedOn: null,
        }),
      ).toMatchObject({ field: 'keywordField', reason: 'hardToRank' });
    });

    it('gives the title at popularity 40', () => {
      expect(only({ popularity: 40, difficulty: 10 })).toMatchObject({
        field: 'title',
        reason: 'strongestReachable',
      });
    });

    it('counts a fresh rank within 30 as reachable', () => {
      expect(
        only({
          popularity: 60,
          difficulty: 80,
          position: 14,
          checkedOn: TODAY,
        }),
      ).toMatchObject({ field: 'title', reason: 'strongestReachable' });
    });

    it('counts a rank checked yesterday as fresh', () => {
      expect(
        only({
          popularity: 60,
          difficulty: 80,
          position: 30,
          checkedOn: '2026-11-25',
        }),
      ).toMatchObject({ field: 'title' });
    });

    it('does not count a fresh rank below 30', () => {
      expect(
        only({
          popularity: 60,
          difficulty: 80,
          position: 31,
          checkedOn: TODAY,
        }),
      ).toMatchObject({ field: 'keywordField', reason: 'hardToRank' });
    });

    it('ignores a stale rank', () => {
      expect(
        only({
          popularity: 60,
          difficulty: 80,
          position: 14,
          checkedOn: THREE_DAYS_AGO,
        }),
      ).toMatchObject({ field: 'keywordField', reason: 'hardToRank' });
    });

    it('gives the title to one keyword only', () => {
      const result = verdicts([
        item({ text: 'habit tracker', opportunity: 80 }),
        item({ text: 'daily goals', opportunity: 70 }),
      ]);
      expect(result.get('habit tracker')?.field).toBe('title');
      expect(result.get('daily goals')?.field).toBe('subtitle');
    });

    it('skips a keyword too long for the title to the next', () => {
      const long = 'a'.repeat(15) + ' ' + 'b'.repeat(15);
      const result = verdicts([
        item({ text: long, opportunity: 90 }),
        item({ text: 'habit tracker', opportunity: 60 }),
      ]);
      expect(result.get('habit tracker')?.field).toBe('title');
      expect(result.get(long)).toMatchObject({
        field: 'keywordField',
        reason: 'noStrongRoom',
      });
    });

    it('counts code points, not UTF-16 units', () => {
      const fits = `${'a'.repeat(28)} 🔥`;
      const tooLong = `${'a'.repeat(29)} 🔥`;
      expect(fits.length).toBe(31);
      expect(only({ text: fits })?.field).toBe('title');
      expect(only({ text: tooLong })?.field).not.toBe('title');
    });

    it('judges each candidate alone against the targets', () => {
      const candidates = Array.from({ length: 50 }, (_, index) =>
        item({ text: `keyword ${index}`, opportunity: 99 - index }),
      );
      const result = verdicts([], candidates);
      expect(
        [...result.values()].filter(({ reason }) => reason === 'noRoom'),
      ).toEqual([]);
      expect(result.get('keyword 0')).toMatchObject({
        field: 'title',
        reason: 'strongestReachable',
      });
    });

    it('lets a candidate compete only for room the targets left', () => {
      const result = verdicts(
        [item({ text: 'habit tracker', popularity: 45, opportunity: 40 })],
        [item({ text: 'daily goals', popularity: 80, opportunity: 95 })],
      );
      expect(result.get('habit tracker')?.field).toBe('title');
      expect(result.get('daily goals')).toMatchObject({
        field: 'subtitle',
        reason: 'nextReachable',
      });
    });

    it('never gives the title under popularity 40', () => {
      expect(only({ popularity: 39, difficulty: 10 })).toMatchObject({
        field: 'subtitle',
        reason: 'nextReachable',
      });
    });
  });

  describe('subtitle and short description', () => {
    const titleHolder = item({
      text: 'meditation',
      popularity: 80,
      opportunity: 99,
    });

    it('fills the subtitle with the next two reachable keywords that fit together', () => {
      const result = verdicts([
        titleHolder,
        item({ text: 'habit tracker', opportunity: 80 }),
        item({ text: 'daily goals', opportunity: 75 }),
      ]);
      expect(result.get('habit tracker')?.field).toBe('subtitle');
      expect(result.get('daily goals')?.field).toBe('subtitle');
    });

    it('stops at two subtitle keywords', () => {
      const result = verdicts([
        titleHolder,
        item({ text: 'habit', opportunity: 80 }),
        item({ text: 'goals', opportunity: 75 }),
        item({ text: 'focus', opportunity: 70 }),
      ]);
      expect(result.get('focus')).toMatchObject({
        field: 'keywordField',
        reason: 'noStrongRoom',
      });
    });

    it('stops when the next keyword would not fit', () => {
      const twenty = 'mindful breathing ap';
      expect([...twenty].length).toBe(20);
      const result = verdicts([
        titleHolder,
        item({ text: 'habit tracker', opportunity: 80 }),
        item({ text: twenty, opportunity: 75 }),
      ]);
      expect(result.get('habit tracker')?.field).toBe('subtitle');
      expect(result.get(twenty)).toMatchObject({
        field: 'keywordField',
        reason: 'noStrongRoom',
      });
    });

    it('uses the short description on Google Play with its 80 characters', () => {
      const first = 'a'.repeat(14) + ' ' + 'b'.repeat(15);
      const second = 'c'.repeat(14) + ' ' + 'd'.repeat(15);
      const targets = [
        titleHolder,
        item({ text: first, opportunity: 80 }),
        item({ text: second, opportunity: 75 }),
      ];
      const play = verdicts(targets, [], 'GOOGLE_PLAY');
      expect(play.get('meditation')?.field).toBe('title');
      expect(play.get(first)).toMatchObject({
        field: 'shortDescription',
        reason: 'nextReachable',
      });
      expect(play.get(second)?.field).toBe('shortDescription');
      expect(verdicts(targets).get(second)?.field).toBe('keywordField');
    });
  });

  describe('keyword field and description', () => {
    it.each<[string, PlacementItem, string]>([
      [
        'a reachable keyword with no strong room left',
        item({ text: 'timer', popularity: 30, difficulty: 28, position: null }),
        'noStrongRoom',
      ],
      [
        'a reachable long phrase with no strong room left',
        item({ text: 'habit tracker for adhd', popularity: 22, difficulty: 5 }),
        'noStrongRoom',
      ],
      [
        'an unreachable single word',
        unreachable({ text: 'focus', popularity: 30 }),
        'singleWord',
      ],
      [
        'an unreachable phrase of three words',
        unreachable({ text: 'habit tracker for', popularity: 45 }),
        'longTail',
      ],
      [
        'an unreachable phrase of popularity 24',
        unreachable({ text: 'sleep sounds', popularity: 24 }),
        'longTail',
      ],
      [
        'an unreachable phrase of popularity 25',
        unreachable({ text: 'sleep sounds', popularity: 25 }),
        'hardToRank',
      ],
    ])('places %s', (_, candidate, reason) => {
      const appStore = verdicts(strongFieldsTaken(), [candidate]);
      expect(appStore.get(candidate.text)).toMatchObject({
        field: 'keywordField',
        reason,
      });
      const play = verdicts(strongFieldsTaken(), [candidate], 'GOOGLE_PLAY');
      expect(play.get(candidate.text)).toMatchObject({
        field: 'description',
        reason,
      });
    });

    it('counts a word placed in the title or subtitle once', () => {
      const candidate = unreachable({
        text: 'habit tracker pro',
        popularity: 30,
      });
      const result = verdicts(
        [item({ text: 'habit tracker', opportunity: 99 }), ...fieldFillers()],
        [candidate],
      );
      expect(result.get('habit tracker')?.field).toBe('title');
      expect(result.get(candidate.text)).toMatchObject({
        field: 'keywordField',
        reason: 'longTail',
      });
    });

    it('skips with noRoom once the 100 characters are used', () => {
      const candidate = unreachable({ text: 'meditation', popularity: 30 });
      const result = verdicts(fieldFillers(), [candidate]);
      expect(
        [...result.values()].filter(({ field }) => field === 'keywordField'),
      ).toHaveLength(8);
      expect(result.get('meditation')).toMatchObject({
        field: 'skip',
        reason: 'noRoom',
      });
    });

    it('never runs out of room on Google Play', () => {
      const targets = Array.from({ length: 10 }, (_, index) =>
        unreachable({
          text: `long phrase number ${index} for the store`,
          popularity: 30,
        }),
      );
      const candidates = Array.from({ length: 50 }, (_, index) =>
        unreachable({ text: `candidate phrase ${index}`, popularity: 30 }),
      );
      const result = verdicts(targets, candidates, 'GOOGLE_PLAY');
      expect(result.size).toBe(60);
      expect(
        [...result.values()].every(({ field }) => field === 'description'),
      ).toBe(true);
    });
  });

  describe('the judged figures', () => {
    it('carries the popularity, difficulty and a fresh position', () => {
      expect(only({ popularity: 62, difficulty: 70, position: 14 })).toEqual({
        field: 'title',
        reason: 'strongestReachable',
        popularity: 62,
        difficulty: 70,
        position: 14,
      });
    });

    it('never quotes a stale position', () => {
      expect(only({ checkedOn: THREE_DAYS_AGO })?.position).toBeNull();
    });

    it('never quotes a position when the keyword is not ranked', () => {
      expect(only({ position: null })?.position).toBeNull();
    });
  });

  describe('consistency with push to top 10', () => {
    const phrases = [
      'alpha',
      'alpha beta',
      'alpha beta gamma',
      'alpha beta gamma delta',
    ];
    const cases = Array.from(
      { length: PUSH_MAX_POSITION - PUSH_MIN_POSITION + 1 },
      (_, offset) => PUSH_MIN_POSITION + offset,
    ).flatMap((position) =>
      [20, 30, 40, 50, 60].flatMap((popularity) =>
        phrases.map((text) => ({ position, popularity, text })),
      ),
    );

    it('never tells a keyword ranked 11 to 20 that the keyword field is enough', () => {
      for (const { position, popularity, text } of cases) {
        const pushed = item({
          text,
          popularity,
          difficulty: 95,
          relevance: PUSH_MIN_RELEVANCE,
          position,
          checkedOn: TODAY,
        });
        for (const result of [
          verdicts([pushed]).get(text),
          verdicts(strongFieldsTaken(), [pushed]).get(text),
        ]) {
          const strong =
            result?.field === 'title' || result?.field === 'subtitle';
          expect(strong || result?.reason === 'noStrongRoom').toBe(true);
        }
      }
    });
  });

  describe('determinism', () => {
    const targets = [
      item({ text: 'habit tracker', popularity: 62, opportunity: 30 }),
      item({
        text: 'daily goals',
        popularity: 35,
        opportunity: 80,
        difficulty: 20,
      }),
      item({
        text: 'streaks',
        popularity: 30,
        opportunity: 75,
        difficulty: 25,
      }),
      unreachable({ text: 'routine planner', popularity: 45, opportunity: 20 }),
      item({ text: 'timer', popularity: 30, opportunity: 72, difficulty: 28 }),
      ...fieldFillers(),
    ];
    const candidates = [
      unreachable({ text: 'focus', popularity: 30, opportunity: 55 }),
      item({ text: 'calm', popularity: 50, opportunity: 50 }),
      unreachable({ text: 'meditation', popularity: 30, opportunity: 50 }),
    ];
    const sorted = (result: Map<string, PlacementSuggestion>) =>
      [...result.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );

    it('answers the same for the same input in any order', () => {
      const expected = sorted(verdicts(targets, candidates));
      expect(
        sorted(verdicts([...targets].reverse(), [...candidates].reverse())),
      ).toEqual(expected);
      expect(
        sorted(
          verdicts([...targets.slice(3), ...targets.slice(0, 3)], candidates),
        ),
      ).toEqual(expected);
    });
  });
});
