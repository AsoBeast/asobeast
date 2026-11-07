import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { listingFacts } from './listing-facts';

const listing = (title: string, subtitle: string | null = null) => ({
  id: `snap-${title}`,
  title,
  subtitle,
  summary: null,
  description: '',
});

const buildPrisma = () => ({
  appSnapshot: {
    findFirst: jest
      .fn()
      .mockResolvedValue(listing('Focus Timer', 'Pomodoro and study')),
    findMany: jest.fn().mockResolvedValue([
      {
        ...listing('Temporizador'),
        localization: 'es-MX',
      },
    ]),
  },
  appLocalization: {
    findMany: jest.fn().mockResolvedValue([{ localization: 'es-MX' }]),
  },
  keywordField: {
    findMany: jest
      .fn()
      .mockResolvedValue([{ localization: 'en-US', phrases: ['deep work'] }]),
  },
});

const appStore = { id: 'app1', country: 'us', store: Store.APP_STORE };
const play = { id: 'app2', country: 'us', store: Store.GOOGLE_PLAY };

const factsOf = (
  prisma: ReturnType<typeof buildPrisma>,
  app: Pick<typeof appStore, 'id' | 'country'> & { store: Store },
  coverage?: boolean,
  marks?: boolean,
) =>
  listingFacts(prisma as unknown as PrismaService, app, ['us'], {
    coverage,
    marks,
  });

describe('listingFacts', () => {
  it('judges App Store coverage with the captured localizations', async () => {
    const prisma = buildPrisma();

    const facts = await factsOf(prisma, appStore, true);

    expect(prisma.appSnapshot.findMany).toHaveBeenCalled();
    expect(facts.uncovered?.({ country: 'us', text: 'pomodoro' })).toBe(false);
    expect(facts.uncovered?.({ country: 'us', text: 'temporizador' })).toBe(
      false,
    );
    expect(facts.uncovered?.({ country: 'us', text: 'habit planner' })).toBe(
      true,
    );
  });

  it('reads the stored keyword fields once for both the source and the coverage', async () => {
    const prisma = buildPrisma();

    const facts = await factsOf(prisma, appStore, true);

    expect(prisma.keywordField.findMany).toHaveBeenCalledTimes(1);
    expect(facts.inKeywordField?.('us', 'deep work')).toBe(true);
    expect(facts.uncovered?.({ country: 'us', text: 'deep work' })).toBe(false);
  });

  it('reads no localization of a Google Play app', async () => {
    const prisma = buildPrisma();

    const facts = await factsOf(prisma, play, true);

    expect(prisma.appSnapshot.findMany).not.toHaveBeenCalled();
    expect(prisma.appLocalization.findMany).not.toHaveBeenCalled();
    expect(facts.uncovered?.({ country: 'us', text: 'temporizador' })).toBe(
      true,
    );
  });

  it('reads no localization and judges nothing without the option', async () => {
    const prisma = buildPrisma();

    const facts = await factsOf(prisma, appStore);

    expect(prisma.appSnapshot.findMany).not.toHaveBeenCalled();
    expect(prisma.appLocalization.findMany).not.toHaveBeenCalled();
    expect(facts).not.toHaveProperty('uncovered');
    expect(facts).not.toHaveProperty('marks');
  });

  it('marks the listing words with the sources coverage reads', async () => {
    const prisma = buildPrisma();

    const facts = await factsOf(prisma, appStore, false, true);

    expect(prisma.keywordField.findMany).toHaveBeenCalledTimes(1);
    expect(facts).not.toHaveProperty('uncovered');
    expect(facts.marks?.({ country: 'us', text: 'deep sleep' })).toEqual([
      { text: 'deep', surface: 'keywordField', match: 'exact' },
      { text: ' sleep', surface: null },
    ]);
    expect(facts.marks?.({ country: 'us', text: 'temporizador' })).toEqual([
      { text: 'temporizador', surface: 'title', match: 'exact' },
    ]);
    expect(facts.marks?.({ country: 'us', text: 'habit planner' })).toBeNull();
  });

  it('reads the localized title of the keyword market as a name of the app', async () => {
    const prisma = {
      ...buildPrisma(),
      app: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'talabat: Food & Grocery',
          snapshots: [],
          competitors: [],
        }),
      },
    };
    prisma.appSnapshot.findFirst.mockResolvedValue(
      listing('talabat: Food & Grocery', 'Everyday delivery made easy'),
    );
    prisma.appSnapshot.findMany.mockResolvedValue([
      { ...listing('طلبات: الطعام والبقالة وغيره'), localization: 'ar' },
    ]);
    prisma.appLocalization.findMany.mockResolvedValue([]);

    const facts = await listingFacts(
      prisma as unknown as PrismaService,
      { id: 'app3', country: 'kw', store: Store.APP_STORE },
      ['kw'],
      { brand: true },
    );
    const classOf = (text: string) =>
      facts.classOf?.({ text, country: 'kw', flags: [], serpRelevance: null });

    expect(classOf('طلبات')).toBe('ownBrand');
    expect(classOf('talabat')).toBe('ownBrand');
    expect(classOf('الطعام')).toBe('generic');
  });
});
