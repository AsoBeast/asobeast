import { PrismaService } from '../prisma/prisma.service';
import {
  latestListingTexts,
  latestLocalizedTexts,
  relevanceText,
} from './listing-texts';

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

describe('latestLocalizedTexts', () => {
  const localizedPrisma = (rows: unknown[]) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    return {
      findMany,
      prisma: { appSnapshot: { findMany } } as unknown as PrismaService,
    };
  };

  it('asks nothing for a market that reads no localization beside its default', async () => {
    const { findMany, prisma } = localizedPrisma([]);

    const localized = await latestLocalizedTexts(prisma, 'app_1', 'us', [
      'za',
      'zz',
    ]);

    expect(findMany).not.toHaveBeenCalled();
    expect(localized.get('za')).toEqual([]);
  });

  it('reads a captured localization the market reads besides its default', async () => {
    const { findMany, prisma } = localizedPrisma([
      { ...texts('Suisse'), localization: 'fr' },
    ]);

    const localized = await latestLocalizedTexts(prisma, 'app_1', 'us', ['ch']);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app_1',
          country: 'ch',
          localization: { in: ['en-GB', 'fr', 'it'] },
        },
      }),
    );
    expect(
      localized
        .get('ch')
        ?.map((entry) => [entry.localization, entry.texts.title]),
    ).toEqual([['fr', 'Suisse']]);
  });

  it('reads the newest snapshot of every localization a market reads beside its default in one query', async () => {
    const { findMany, prisma } = localizedPrisma([
      { ...texts('Frans'), localization: 'fr' },
      { ...texts('Nederlands'), localization: 'nl' },
    ]);

    const localized = await latestLocalizedTexts(prisma, 'app_1', 'us', [
      'be',
      'be',
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app_1',
        country: 'be',
        localization: { in: ['nl', 'fr'] },
      },
      orderBy: { capturedAt: 'desc' },
      distinct: ['localization'],
      select: {
        id: true,
        title: true,
        subtitle: true,
        summary: true,
        description: true,
        localization: true,
      },
    });
    expect(
      localized
        .get('be')
        ?.map((entry) => [entry.localization, entry.texts.title]),
    ).toEqual([
      ['nl', 'Nederlands'],
      ['fr', 'Frans'],
    ]);
  });
});
