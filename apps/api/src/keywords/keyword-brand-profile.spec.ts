import { Store } from '@prisma/client';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { keywordClassifier, loadBrandProfile } from './keyword-brand-profile';
import { brandProfileOf } from './keyword-class';

const prismaWith = (row: unknown) => {
  const findFirst = jest.fn().mockResolvedValue(row);
  return {
    prisma: { app: { findFirst } } as unknown as PrismaService,
    findFirst,
  };
};

describe('loadBrandProfile', () => {
  const stored = {
    name: 'Forest: Stay Focused',
    snapshots: [{ raw: { developer: 'Seekrtech Inc.' } }],
    competitors: [{ name: 'Todoist - To-Do List' }, { name: null }],
  };

  it('reads the app name, the newest home listing and the competitor names in one query', async () => {
    const { prisma, findFirst } = prismaWith(stored);
    await loadBrandProfile(prisma, { id: 'app1', store: Store.APP_STORE });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'app1' },
      select: {
        name: true,
        snapshots: {
          where: HOME_LISTING,
          orderBy: NEWEST_FIRST,
          take: 1,
          select: { raw: true },
        },
        competitors: {
          where: { isCompetitor: true },
          orderBy: { createdAt: 'asc' },
          select: { name: true },
        },
      },
    });
  });

  it.each([Store.APP_STORE, Store.GOOGLE_PLAY])(
    'builds the profile with the developer of a %s payload',
    async (store) => {
      const { prisma } = prismaWith(stored);
      await expect(
        loadBrandProfile(prisma, { id: 'app1', store }),
      ).resolves.toEqual(
        brandProfileOf({
          title: 'Forest: Stay Focused',
          developer: 'Seekrtech Inc.',
          competitorTitles: ['Todoist - To-Do List', null],
        }),
      );
    },
  );

  it('answers no own name for an app without a name or a listing', async () => {
    const { prisma } = prismaWith({
      name: null,
      snapshots: [{ raw: null }],
      competitors: [],
    });
    await expect(
      loadBrandProfile(prisma, { id: 'app1', store: Store.APP_STORE }),
    ).resolves.toEqual({ own: [], competitors: [], categories: [] });
  });

  it('answers an empty profile when the app is gone', async () => {
    const { prisma } = prismaWith(null);
    await expect(
      loadBrandProfile(prisma, { id: 'app1', store: Store.APP_STORE }),
    ).resolves.toEqual({ own: [], competitors: [], categories: [] });
  });
});

describe('keywordClassifier', () => {
  const profile = brandProfileOf({
    title: null,
    developer: null,
    competitorTitles: ['Focus Timer: Pomodoro'],
  });
  const keyword = (country: string) => ({
    text: 'focus timer',
    country,
    flags: [],
    serpRelevance: null,
  });

  it('reads the listing of the keyword market and falls back to the home one', () => {
    const classOf = keywordClassifier(profile, {
      snapshotText: 'Forest: a focus timer',
      marketTexts: new Map([['de', 'Wald: Konzentration']]),
    });
    expect(classOf(keyword('de'))).toBe('competitorBrand');
    expect(classOf(keyword('fr'))).toBe('generic');
    expect(classOf(keyword('us'))).toBe('generic');
  });

  it('reads the words of each market once', () => {
    const marketTexts = new Map([['de', 'Wald']]);
    const get = jest.spyOn(marketTexts, 'get');
    const classOf = keywordClassifier(profile, {
      snapshotText: '',
      marketTexts,
    });
    classOf(keyword('de'));
    classOf(keyword('de'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reads the title of the keyword market as an own name', () => {
    const classOf = keywordClassifier(
      brandProfileOf({
        title: 'WeChat',
        developer: null,
        competitorTitles: [],
      }),
      {
        snapshotText: 'WeChat',
        marketTexts: new Map([['cn', '微信']]),
        marketTitles: new Map([['cn', ['微信']]]),
      },
    );

    expect(classOf({ ...keyword('cn'), text: '微信' })).toBe('ownBrand');
    expect(classOf({ ...keyword('us'), text: '微信' })).toBe('generic');
  });
});
