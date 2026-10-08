import { PrismaService } from '../prisma/prisma.service';
import { latestListingTexts, relevanceText } from './listing-texts';

const texts = (title: string) => ({
  id: `snap_${title}`,
  title,
  subtitle: `${title} subtitle`,
  summary: null,
  description: `${title} description`,
});

const prismaOf = (
  byCountry: Record<string, ReturnType<typeof texts> | null>,
) => {
  const findFirst = jest.fn(
    ({ where }: { where: { country: string | null } }) =>
      Promise.resolve(byCountry[where.country ?? 'home'] ?? null),
  );
  return {
    findFirst,
    prisma: { appSnapshot: { findFirst } } as unknown as PrismaService,
  };
};

describe('latestListingTexts', () => {
  it('reads the newest listing of each market once', async () => {
    const { findFirst, prisma } = prismaOf({
      home: texts('Habit'),
      de: texts('Gewohnheit'),
    });

    const listings = await latestListingTexts(prisma, 'app_1', 'us', [
      'us',
      'de',
      'de',
    ]);

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(listings.get('us')?.title).toBe('Habit');
    expect(listings.get('de')?.title).toBe('Gewohnheit');
  });

  it('reads the home listing through the home filter', async () => {
    const { findFirst, prisma } = prismaOf({ home: texts('Habit') });

    await latestListingTexts(prisma, 'app_1', 'us', ['us']);

    expect(findFirst.mock.calls[0][0].where).toEqual({
      appId: 'app_1',
      country: null,
      localization: null,
    });
  });

  it('leaves out a market that has no listing', async () => {
    const { prisma } = prismaOf({ home: texts('Habit'), pl: null });

    const listings = await latestListingTexts(prisma, 'app_1', 'us', [
      'us',
      'pl',
    ]);

    expect([...listings.keys()]).toEqual(['us']);
  });
});

describe('relevanceText', () => {
  it('joins the indexed words of a listing, leaving out empty fields', () => {
    expect(relevanceText(texts('Habit'))).toBe('Habit Habit subtitle');
  });
});
