import { PlacementSuggestion, TrackedKeywordItem } from '@asobeast/shared';
import {
  listingTargetsOf,
  TARGET_CANDIDATE_LIMIT,
  targetCandidates,
  targetSlots,
  withPlacements,
} from './listing-targets';

const tracked = (
  text: string,
  country: string,
  extra: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: `${country}:${text}`,
  text,
  country,
  source: 'MANUAL',
  active: true,
  latestPosition: 12,
  latestDepth: 200,
  latestCheckedOn: '2026-11-25',
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: 5,
  difficulty: 4,
  volume: 40,
  relevance: 80,
  opportunity: 50,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  keywordClass: 'generic',
  ...extra,
});

const result = (
  slots: string[] | null,
  readers: string[],
  rows: TrackedKeywordItem[],
) =>
  listingTargetsOf({
    appId: 'app1',
    localization: 'en-US',
    readers,
    stored:
      slots === null
        ? null
        : { slots, updatedAt: new Date('2026-11-25T10:00:00.000Z') },
    tracked: rows,
  });

describe('targetSlots', () => {
  it('reads empty strings as empty slots and pads to ten', () => {
    expect(targetSlots(['habit tracker', '', 'focus'])).toEqual([
      'habit tracker',
      null,
      'focus',
      ...Array<null>(7).fill(null),
    ]);
  });

  it('reads an absent row as ten empty slots', () => {
    expect(targetSlots(null)).toEqual(Array<null>(10).fill(null));
  });
});

describe('targetItem', () => {
  it('names the markets that track the phrase and those that do not', () => {
    const { slots } = result(
      ['habit tracker'],
      ['us', 'gb'],
      [tracked('habit tracker', 'us')],
    );

    expect(slots[0]).toEqual({
      position: 1,
      role: 'title',
      text: 'habit tracker',
      trackedIn: [
        { country: 'us', keywordId: 'us:habit tracker', active: true },
      ],
      untrackedIn: ['gb'],
      lead: {
        country: 'us',
        keywordId: 'us:habit tracker',
        popularity: 40,
        difficulty: 40,
        opportunity: 50,
        relevance: 80,
        position: 12,
        depth: 200,
        checkedOn: '2026-11-25',
        keywordClass: 'generic',
        scoreOutdated: undefined,
        floorAnswer: false,
      },
    });
  });

  it('marks a popularity under the official floor', () => {
    const { slots } = result(
      ['habit tracker'],
      ['us'],
      [
        tracked('habit tracker', 'us', {
          scoreSignals: {
            suggestReach: 'absent',
            suggestPrefixLength: null,
            suggestPosition: null,
            serpRelevance: 0.5,
            medianRatingCount: null,
            flags: [],
            officialPopularity: null,
            estimatedTraffic: null,
            officialPopularityState: 'floor',
          },
        }),
      ],
    );

    expect(slots[0]?.lead?.floorAnswer).toBe(true);
  });

  it('counts a paused keyword as tracked', () => {
    const { slots } = result(
      ['habit tracker'],
      ['us'],
      [tracked('habit tracker', 'us', { active: false })],
    );

    expect(slots[0]?.trackedIn).toEqual([
      { country: 'us', keywordId: 'us:habit tracker', active: false },
    ]);
    expect(slots[0]?.untrackedIn).toEqual([]);
    expect(slots[0]?.lead?.country).toBe('us');
  });

  it('leads with an active market before a paused one', () => {
    const { slots } = result(
      ['habit tracker'],
      ['us', 'gb'],
      [
        tracked('habit tracker', 'us', { active: false }),
        tracked('habit tracker', 'gb'),
      ],
    );

    expect(slots[0]?.lead?.country).toBe('gb');
  });

  it('keeps the positions and roles of the stored slots', () => {
    const { slots } = result(['a', '', 'b', 'c'], ['us'], []);

    expect(
      slots.map((slot) => slot && [slot.position, slot.role, slot.text]),
    ).toEqual([
      [1, 'title', 'a'],
      null,
      [3, 'subtitle', 'b'],
      [4, 'extra', 'c'],
      ...Array<null>(6).fill(null),
    ]);
  });

  it('answers a target of a localization no market reads with no markets', () => {
    const { slots, candidates } = result(
      ['kaizen'],
      [],
      [tracked('kaizen', 'us')],
    );

    expect(slots[0]).toMatchObject({
      trackedIn: [],
      untrackedIn: [],
      lead: null,
    });
    expect(candidates).toEqual([]);
  });
});

describe('targetCandidates', () => {
  it('ranks by opportunity, then popularity, then text', () => {
    const candidates = targetCandidates(
      ['us'],
      [
        tracked('beta', 'us', { opportunity: 30, volume: 10 }),
        tracked('alpha', 'us', { opportunity: 30, volume: 10 }),
        tracked('gamma', 'us', { opportunity: 30, volume: 60 }),
        tracked('delta', 'us', { opportunity: 70 }),
        tracked('none', 'us', { opportunity: null }),
      ],
      new Set(),
    );

    expect(candidates.map(({ text }) => text)).toEqual([
      'delta',
      'gamma',
      'alpha',
      'beta',
      'none',
    ]);
  });

  it("keeps one row per phrase with the first reader's scores", () => {
    const candidates = targetCandidates(
      ['gb', 'au'],
      [
        tracked('habit', 'au', { opportunity: 10 }),
        tracked('habit', 'gb', { opportunity: 60 }),
        tracked('habit', 'us', { opportunity: 90 }),
      ],
      new Set(),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      text: 'habit',
      markets: ['gb', 'au'],
      lead: { country: 'gb', opportunity: 60 },
    });
  });

  it('leaves out competitor brands', () => {
    const candidates = targetCandidates(
      ['us', 'gb'],
      [
        tracked('rival app', 'us', { keywordClass: 'competitorBrand' }),
        tracked('rival app', 'gb'),
        tracked('own app', 'us', { keywordClass: 'ownBrand' }),
      ],
      new Set(),
    );

    expect(candidates.map(({ text }) => text)).toEqual(['own app']);
  });

  it('leaves out paused keywords and phrases already in a slot', () => {
    const candidates = targetCandidates(
      ['us'],
      [
        tracked('paused', 'us', { active: false }),
        tracked('taken', 'us'),
        tracked('free', 'us'),
      ],
      new Set(['taken']),
    );

    expect(candidates.map(({ text }) => text)).toEqual(['free']);
  });

  it('stops at fifty', () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      tracked(`phrase ${String(index).padStart(2, '0')}`, 'us'),
    );

    expect(targetCandidates(['us'], rows, new Set())).toHaveLength(
      TARGET_CANDIDATE_LIMIT,
    );
  });
});

describe('withPlacements', () => {
  it('puts each verdict on its slot and candidate', () => {
    const verdict = (
      field: PlacementSuggestion['field'],
    ): PlacementSuggestion => ({
      field,
      reason: 'strongestReachable',
      popularity: 40,
      difficulty: 40,
      position: 12,
    });
    const placed = withPlacements(
      result(
        ['habit tracker', '', 'focus timer'],
        ['us'],
        [tracked('habit tracker', 'us'), tracked('daily goals', 'us')],
      ),
      new Map([
        ['habit tracker', verdict('title')],
        ['daily goals', verdict('subtitle')],
      ]),
    );

    expect(placed.slots[0]?.placement).toEqual(verdict('title'));
    expect(placed.slots[1]).toBeNull();
    expect(placed.slots[2]).not.toHaveProperty('placement');
    expect(placed.candidates).toEqual([
      expect.objectContaining({
        text: 'daily goals',
        placement: verdict('subtitle'),
      }),
    ]);
  });
});
