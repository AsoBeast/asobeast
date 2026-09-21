import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient } from './apple-popularity';
import { OfficialPopularityLookup } from './official-popularity';

interface Dataset {
  enabled?: boolean;
  latestWeek?: Date | null;
  highest?: number | null;
  floor?: number | null;
}

const build = ({
  enabled = true,
  latestWeek = new Date('2026-09-13T00:00:00Z'),
  highest = 71,
  floor = 41,
}: Dataset = {}) => {
  const prisma = {
    searchTermPopularity: {
      findFirst: jest
        .fn()
        .mockResolvedValue(latestWeek ? { week: latestWeek } : null),
      aggregate: jest
        .fn()
        .mockImplementation(({ where }: { where: { term?: string } }) =>
          Promise.resolve(
            where.term === undefined
              ? { _min: { popularity: floor } }
              : {
                  _max: { popularity: where.term === 'quiz' ? highest : null },
                },
          ),
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

    await expect(lookup.for(keyword('quiz'))).resolves.toEqual({ value: 71 });
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenCalledWith({
      where: {
        country: 'us',
        week: new Date('2026-09-13T00:00:00Z'),
        term: 'quiz',
      },
      _max: { popularity: true },
    });
  });

  it('caps a term missing from a loaded week below its floor', async () => {
    const { lookup, prisma } = build();

    await expect(lookup.for(keyword('geo quiz world'))).resolves.toEqual({
      absentBelow: 41,
    });
    expect(prisma.searchTermPopularity.aggregate).toHaveBeenLastCalledWith({
      where: { country: 'us', week: new Date('2026-09-13T00:00:00Z') },
      _min: { popularity: true },
    });
  });

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
});
