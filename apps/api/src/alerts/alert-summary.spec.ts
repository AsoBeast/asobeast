import {
  RANK_DEPTH,
  RankImprovedPayload,
  RankMilestonePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { position, rank, sectionBlocks, summarize } from './alert-summary';
import {
  firstRanking,
  milestone,
  overtake,
  rankEventSection,
  withoutRankEvents,
} from './rank-events.fixture';

const improvement: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'My App' },
  keyword: {
    id: 'k',
    text: 'habit tracker',
    store: 'APP_STORE',
    country: 'us',
  },
  from: 20,
  to: 7,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

const entrant: SerpEntrantPayload = {
  event: 'serp.entrant',
  occurredAt: '2026-07-22T10:00:00.000Z',
  keyword: {
    id: 'k',
    text: 'habit tracker',
    store: 'APP_STORE',
    country: 'us',
  },
  date: '2026-07-22',
  entrants: [
    {
      position: 4,
      storeAppId: 'x',
      title: 'Newcomer',
      appId: null,
      isCompetitor: false,
    },
  ],
};

const milestoneCases: Array<[Partial<RankMilestonePayload>, string]> = [
  [{}, 'My App entered the top 10 for "habit tracker (US)": #14 → #8'],
  [
    { tier: 3, from: 15, to: 2 },
    'My App entered the top 3 for "habit tracker (US)": #15 → #2',
  ],
  [
    { tier: 1, from: 3, to: 1 },
    'My App reached first place for "habit tracker (US)": #3 → #1',
  ],
  [
    { tier: 3, direction: 'left', from: 2, to: 5 },
    'My App left the top 3 for "habit tracker (US)": #2 → #5',
  ],
  [
    { direction: 'left', from: 8, to: null },
    'My App left the top 10 for "habit tracker (US)": #8 → outside top 200',
  ],
  [
    { tier: 1, direction: 'left', from: 1, to: 2 },
    'My App lost first place for "habit tracker (US)": #1 → #2',
  ],
];

describe('position', () => {
  it.each([
    [1, undefined, '#1'],
    [200, undefined, '#200'],
    [0, undefined, 'outside top 200'],
    [-1, undefined, 'outside top 200'],
    [null, undefined, 'outside top 200'],
    [null, 100, 'outside top 100'],
    [0, 100, 'outside top 100'],
  ])('renders %s at depth %s as %s', (value, depth, expected) => {
    expect(position(value, depth)).toBe(expected);
  });
});

describe('rank', () => {
  it.each([
    [3, undefined, '3'],
    [0, undefined, '>200'],
    [-1, 100, '>100'],
    [null, 100, '>100'],
  ])('renders %s at depth %s as %s', (value, depth, expected) => {
    expect(rank(value, depth)).toBe(expected);
  });
});

describe('summarize for rank milestones', () => {
  it.each(milestoneCases)('renders %p', (overrides, expected) => {
    expect(summarize(milestone(overrides))).toBe(expected);
  });
});

describe('summarize for first rankings and overtakes', () => {
  it('renders a first ranking with its position', () => {
    expect(summarize(firstRanking())).toBe(
      'My App ranks for "habit tracker (US)" for the first time: #37',
    );
  });

  it('renders an overtake with both moves', () => {
    expect(summarize(overtake())).toBe(
      'Rival Focus overtook My App for "habit tracker (US)": Rival Focus #9 → #4, My App #5 → #6',
    );
  });

  it('names an unnamed app or competitor generically', () => {
    expect(summarize(firstRanking({ app: { id: 'a', name: null } }))).toBe(
      'An app ranks for "habit tracker (US)" for the first time: #37',
    );
    expect(
      summarize(
        overtake({
          competitor: { id: 'r', name: null, from: null, to: 4 },
        }),
      ),
    ).toBe(
      'An app overtook My App for "habit tracker (US)": An app outside top 200 → #4, My App #5 → #6',
    );
  });
});

describe('sectionBlocks for the new rank events', () => {
  it('lists the new blocks after the rank improvements', () => {
    const blocks = sectionBlocks({
      ...rankEventSection(),
      rankImprovements: [improvement],
      serpEntrants: [entrant],
    });

    expect(blocks.map((block) => block.title)).toEqual([
      'Rank improvements',
      'Milestones',
      'First rankings',
      'Overtaken by competitors',
      'New entrants',
    ]);
    expect(blocks.slice(1, 4).map((block) => block.lines)).toEqual([
      ['habit tracker (US)  14 → 8  entered the top 10'],
      ['habit tracker (US)  37'],
      ['habit tracker (US)  Rival Focus 9 → 4, My App 5 → 6'],
    ]);
  });

  it('writes a milestone out of view with the captured depth', () => {
    const [block] = sectionBlocks({
      ...rankEventSection(),
      rankMilestones: [milestone({ direction: 'left', from: 8, to: null })],
      firstRankings: [],
      overtakes: [],
    });

    expect(block.lines).toEqual([
      'habit tracker (US)  8 → >200  left the top 10',
    ]);
  });

  it('renders a section queued before the new arrays existed', () => {
    const queued = withoutRankEvents({
      ...rankEventSection(),
      rankImprovements: [improvement],
    });

    expect(sectionBlocks(queued).map((block) => block.title)).toEqual([
      'Rank improvements',
    ]);
  });
});
