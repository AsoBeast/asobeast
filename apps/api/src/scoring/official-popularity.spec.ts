import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient } from './apple-popularity';
import { OfficialPopularityLookup } from './official-popularity';

interface Dataset {
  enabled?: boolean;
  latestWeek?: Date | null;
  floor?: number | null;
  genreFloors?: Record<string, number>;
  rows?: Record<string, { genre: string; popularity: number }[]>;
  history?: { week: Date; popularity: number } | null;
}

interface FindFirstArgs {
  where: { week: { gte?: Date; lt?: Date } };
}

const WEEK = new Date('2026-09-13T00:00:00Z');

const build = ({
  enabled = true,
  latestWeek = WEEK,
  floor = 41,
  genreFloors = { GAMES: 56 },
  rows = { quiz: [{ genre: 'GAMES', popularity: 71 }] },
  history = null,
}: Dataset = {}) => {
  const floorOf = (genre?: string | { in: string[] }): number | null => {
    if (genre === undefined) {
      return floor;
    }
    const floors = (typeof genre === 'string' ? [genre] : genre.in)
      .map((name) => genreFloors[name])
      .filter((value) => value !== undefined);
    return floors.length === 0 ? null : Math.min(...floors);
  };
  const prisma = {
    searchTermPopularity: {
      findFirst: jest.fn().mockImplementation(({ where }: FindFirstArgs) => {
        return Promise.resolve(
          'gte' in where.week ? latestWeek && { week: latestWeek } : history,
        );
      }),
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { term: string } }) =>
          Promise.resolve(rows[where.term] ?? []),
        ),
      aggregate: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { genre?: string | { in: string[] } } }) =>
            Promise.resolve({ _min: { popularity: floorOf(where.genre) } }),
        ),
    },
  };
  const lookup = new OfficialPopularityLookup(
    prisma as unknown as PrismaService,
    { enabled } as ApplePopularityClient,
  );
  return { lookup, prisma };
};

const keyword = (
  text: string,
  store: 'APP_STORE' | 'GOOGLE_PLAY' = 'APP_STORE',
) => ({
  text,
  store,
  country: 'us',
});

describe('OfficialPopularityLookup', () => {
  it('takes the highest value across genres for a listed term', async () => {
    const { lookup, prisma } = build();

    await expect(lookup.for(keyword('quiz'))).resolves.toMatchObject({
      value: 71,
    });
    expect(prisma.searchTermPopularity.findMany).toHaveBeenCalledWith({
      where: { country: 'us', week: WEEK, term: 'quiz' },
      select: { genre: true, popularity: true },
    });
  });

  it('caps a term missing from a loaded week below its floor', async () => {
    const { lookup, prisma } = build();

    await expect(lookup.for(keyword('geo quiz world'))).resolves.toMatchObject({
      absentBelow: 41,
    });
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenLastCalledWith({
      where: { country: 'us', week: new Date('2026-09-13T00:00:00Z') },
      _min: { popularity: true },
    });
  });

  it.each([
    ['its own category', 'GAMES', 56],
    ['the whole week when its category has no terms', 'SPORTS', 41],
  ])(
    'caps a missing term below the floor of %s',
    async (_name, genre, floor) => {
      const { lookup } = build();
      await expect(
        lookup.for(keyword('geo quiz world'), genre),
      ).resolves.toMatchObject({ absentBelow: floor });
    },
  );

  it('only reads a week from the last 28 days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T00:00:00Z'));
    const { lookup, prisma } = build();

    await lookup.for(keyword('quiz'));

    expect(prisma.searchTermPopularity.findFirst).toHaveBeenCalledWith({
      where: { country: 'us', week: { gte: new Date('2026-08-24T00:00:00Z') } },
      orderBy: { week: 'desc' },
      select: { week: true },
    });
    jest.useRealTimers();
  });

  it('says nothing without a dataset for the market', async () => {
    const { lookup } = build({ latestWeek: null });

    await expect(lookup.for(keyword('quiz'))).resolves.toBeUndefined();
  });

  it.each([
    ['a google play keyword', build(), keyword('quiz', 'GOOGLE_PLAY')],
    ['a disabled feature', build({ enabled: false }), keyword('quiz')],
  ])('never queries for %s', async (_name, { lookup, prisma }, input) => {
    await expect(lookup.for(input)).resolves.toBeUndefined();
    expect(prisma.searchTermPopularity.findFirst).not.toHaveBeenCalled();
  });

  it('answers a term listed above the floor of its genre without a history probe', async () => {
    const { lookup, prisma } = build();

    await expect(lookup.for(keyword('quiz'))).resolves.toEqual({
      value: 71,
      context: { week: '2026-09-13', floor: 56, lastAboveFloor: null },
    });
    expect(prisma.searchTermPopularity.findFirst).toHaveBeenCalledTimes(1);
  });

  it('judges a listed term against its own genre, not the guessed one', async () => {
    const { lookup, prisma } = build();

    const answer = await lookup.for(keyword('quiz'), 'SPORTS');

    expect(answer?.context?.floor).toBe(56);
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenCalledWith({
      where: { country: 'us', week: WEEK, genre: { in: ['GAMES'] } },
      _min: { popularity: true },
    });
  });

  it('answers the highest value of a term listed in several genres', async () => {
    const { lookup } = build({
      rows: {
        quiz: [
          { genre: 'SPORTS', popularity: 48 },
          { genre: 'GAMES', popularity: 71 },
        ],
      },
      genreFloors: { GAMES: 56, SPORTS: 41 },
    });

    await expect(lookup.for(keyword('quiz'))).resolves.toEqual({
      value: 71,
      context: { week: '2026-09-13', floor: 56, lastAboveFloor: null },
    });
  });

  it('judges a value several genres share against the lowest of their floors', async () => {
    const { lookup, prisma } = build({
      rows: {
        quiz: [
          { genre: 'GAMES', popularity: 56 },
          { genre: 'TRIVIA', popularity: 56 },
        ],
      },
      genreFloors: { GAMES: 56, TRIVIA: 44 },
    });

    await expect(lookup.for(keyword('quiz'))).resolves.toEqual({
      value: 56,
      context: { week: '2026-09-13', floor: 44, lastAboveFloor: null },
    });
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenCalledWith({
      where: {
        country: 'us',
        week: WEEK,
        genre: { in: ['GAMES', 'TRIVIA'] },
      },
      _min: { popularity: true },
    });
  });

  it('answers a term listed at the floor of its genre with its last listed value', async () => {
    const { lookup, prisma } = build({
      rows: { quiz: [{ genre: 'GAMES', popularity: 56 }] },
      history: { week: new Date('2026-09-06T00:00:00Z'), popularity: 63 },
    });

    await expect(lookup.for(keyword('quiz'))).resolves.toEqual({
      value: 56,
      context: {
        week: '2026-09-13',
        floor: 56,
        lastAboveFloor: { value: 63, week: '2026-09-06' },
      },
    });
    expect(prisma.searchTermPopularity.findFirst).toHaveBeenLastCalledWith({
      where: {
        country: 'us',
        term: 'quiz',
        week: { lt: WEEK },
        popularity: { gt: 56 },
      },
      orderBy: [{ week: 'desc' }, { popularity: 'desc' }],
      select: { week: true, popularity: true },
    });
  });

  it('answers a term Apple left out with its last listed value', async () => {
    const { lookup } = build({
      history: { week: new Date('2026-09-06T00:00:00Z'), popularity: 58 },
    });

    await expect(lookup.for(keyword('geo quiz world'))).resolves.toEqual({
      absentBelow: 41,
      context: {
        week: '2026-09-13',
        floor: 41,
        lastAboveFloor: { value: 58, week: '2026-09-06' },
      },
    });
  });

  it('answers no last listed value for a term the kept weeks never list', async () => {
    const { lookup } = build({ history: null });

    const answer = await lookup.for(keyword('geo quiz world'));

    expect(answer?.context?.lastAboveFloor).toBeNull();
  });

  it('names the genre floor in the context of a term left out', async () => {
    const { lookup } = build();

    await expect(
      lookup.for(keyword('geo quiz world'), 'GAMES'),
    ).resolves.toEqual({
      absentBelow: 56,
      context: { week: '2026-09-13', floor: 56, lastAboveFloor: null },
    });
  });

  it('names the week as a UTC day', async () => {
    const { lookup } = build({ latestWeek: new Date('2026-09-13T00:00:00Z') });

    const answer = await lookup.for(keyword('quiz'));

    expect(answer?.context?.week).toBe('2026-09-13');
  });
});
