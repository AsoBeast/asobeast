import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadCoverageSources } from './coverage-sources';

const listing = (id: string, title: string) => ({
  id,
  title,
  subtitle: null,
  summary: null,
  description: '',
});

type Listings = Record<string, ReturnType<typeof listing>>;

const prismaWith = (
  listings: Listings,
  fields: { localization: string; phrases: string[] }[] = [],
  shipped: string[] = [],
) => {
  const appSnapshot = {
    findFirst: jest.fn(
      ({
        where,
      }: {
        where: { country: string | null; localization: string | null };
      }) =>
        Promise.resolve(
          listings[
            [where.country ?? 'home', where.localization]
              .filter(Boolean)
              .join(':')
          ] ?? null,
        ),
    ),
    findMany: jest.fn(
      ({
        where,
      }: {
        where: { country: string | null; localization: { in: string[] } };
      }) =>
        Promise.resolve(
          where.localization.in.flatMap((tag) => {
            const found = listings[`${where.country ?? 'home'}:${tag}`];
            return found ? [{ ...found, localization: tag }] : [];
          }),
        ),
    ),
  };
  const prisma = {
    appSnapshot,
    keywordField: { findMany: jest.fn().mockResolvedValue(fields) },
    appLocalization: {
      findMany: jest
        .fn()
        .mockResolvedValue(shipped.map((localization) => ({ localization }))),
    },
  } as unknown as PrismaService;
  return { prisma, appSnapshot };
};

const app = { id: 'app_1', store: Store.APP_STORE, country: 'us' };

describe('loadCoverageSources', () => {
  it('loads the home listing, the market listing and every tracked market', async () => {
    const { prisma, appSnapshot } = prismaWith({
      home: listing('snap_us', 'Focus Timer'),
      de: listing('snap_de', 'Fokus Timer'),
      gb: listing('snap_gb', 'Focus Timer UK'),
    });

    const { sources, view } = await loadCoverageSources(
      prisma,
      app,
      ['de', 'de', 'fr'],
      { market: 'gb', localization: null },
    );

    expect(appSnapshot.findFirst).toHaveBeenCalledTimes(4);
    expect([...sources.listings.keys()]).toEqual(['us', 'gb', 'de']);
    expect(view?.title).toBe('Focus Timer UK');
  });

  it('loads the captured localized texts of each market', async () => {
    const { prisma } = prismaWith(
      {
        home: listing('snap_us', 'Where Am I? GeoGuess Map Quiz'),
        pl: listing('snap_pl', 'Where Am I? GeoGuess Map Quiz'),
        'pl:pl': listing('snap_pl_pl', 'Where Am I? Quiz Geograficzny'),
      },
      [],
      ['pl'],
    );

    const { sources, view } = await loadCoverageSources(prisma, app, ['pl'], {
      market: 'pl',
      localization: 'pl',
    });

    expect(
      sources.localized
        .get('pl')
        ?.map((entry) => [entry.localization, entry.texts.id]),
    ).toEqual([['pl', 'snap_pl_pl']]);
    expect(view?.title).toBe('Where Am I? Quiz Geograficzny');
  });

  it('reads saved keyword fields into phrases by localization', async () => {
    const { prisma } = prismaWith({ home: listing('snap_us', 'Focus Timer') }, [
      { localization: 'en-US', phrases: ['timer', 'focus'] },
    ]);

    const { sources } = await loadCoverageSources(prisma, app, [], {
      market: 'us',
      localization: null,
    });

    expect(sources.keywordFields.get('en-US')).toEqual(['timer', 'focus']);
  });

  it('never throws for a localization that is not captured', async () => {
    const { prisma } = prismaWith({ home: listing('snap_us', 'Focus Timer') });

    const { sources, view } = await loadCoverageSources(prisma, app, [], {
      market: 'us',
      localization: 'fr-FR',
    });

    expect(view).toBeUndefined();
    expect(sources.listings.get('us')?.title).toBe('Focus Timer');
  });

  it('reads no localized texts on Google Play', async () => {
    const { prisma, appSnapshot } = prismaWith({
      home: listing('snap_us', 'Focus Timer'),
    });

    const { sources } = await loadCoverageSources(
      prisma,
      { ...app, store: Store.GOOGLE_PLAY },
      [],
      { market: 'us', localization: null },
    );

    expect(appSnapshot.findMany).not.toHaveBeenCalled();
    expect(sources.localized.size).toBe(0);
  });
});
