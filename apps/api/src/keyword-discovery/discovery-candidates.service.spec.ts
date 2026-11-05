import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { defaultRelevance } from '../scoring/relevance';
import {
  DiscoveryApp,
  DiscoveryCandidates,
} from './discovery-candidates.service';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { keywordSourceOf, PoolCandidate } from './discovery-pool';

const NOW = new Date('2026-11-04T09:00:00.000Z');
const WEEK = new Date('2026-11-02T00:00:00.000Z');
const SNAPSHOT_TEXT = 'Habit Tracker Daily Streak Planner';

interface Listing {
  title: string;
  subtitle: string | null;
  summary: string | null;
}

interface Fixture {
  store?: Store;
  listing?: Listing;
  reviews?: { title: string | null; text: string }[];
  competitors?: Listing[];
  portfolio?: string[];
  metrics?: { text: string; traffic: number | null }[];
  genreTerms?: { term: string; popularity: number }[];
  listed?: { term: string; popularity: number }[];
  week?: Date | null;
}

const app = (store: Store = Store.APP_STORE): DiscoveryApp => ({
  id: 'app1',
  workspaceId: 'ws1',
  store,
  country: 'us',
  storeAppId: 'store1',
});

const setup = (fixture: Fixture = {}) => {
  const listing = fixture.listing ?? {
    title: 'Habit Tracker',
    subtitle: 'Daily Streak Planner',
    summary: 'Build better routines',
  };
  const prisma = {
    appLocalization: { findMany: jest.fn().mockResolvedValue([]) },
    appSnapshot: {
      findFirst: jest.fn((args: { select: Record<string, boolean> }) =>
        Promise.resolve(
          args.select.raw ? { raw: { primaryGenreId: 6013 } } : listing,
        ),
      ),
    },
    review: {
      findMany: jest.fn().mockResolvedValue(fixture.reviews ?? []),
    },
    app: {
      findMany: jest.fn().mockResolvedValue(
        (fixture.competitors ?? []).map((snapshot) => ({
          snapshots: [snapshot],
        })),
      ),
    },
    keyword: {
      findMany: jest.fn((args: { where: { tracked?: unknown } }) =>
        Promise.resolve(
          args.where.tracked
            ? (fixture.portfolio ?? []).map((text) => ({ text }))
            : (fixture.metrics ?? []).map(({ text, traffic }) => ({
                text,
                metrics: [{ traffic }],
              })),
        ),
      ),
    },
    searchTermPopularity: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          fixture.week === null ? null : { week: fixture.week ?? WEEK },
        ),
      findMany: jest.fn((args: { where: { genre?: string } }) =>
        Promise.resolve(
          args.where.genre
            ? (fixture.genreTerms ?? [])
            : (fixture.listed ?? []),
        ),
      ),
    },
  };
  const service = new DiscoveryCandidates(
    prisma as unknown as PrismaService,
    new DiscoveryPopularity(prisma as unknown as PrismaService),
  );
  return { service, prisma };
};

const bySource = (candidates: PoolCandidate[], source: string) =>
  candidates.filter((candidate) => candidate.source === source);

const textsOf = (candidates: PoolCandidate[]) =>
  candidates.map(({ text }) => text);

const reviewSaying = (text: string) => ({ title: null, text });

describe('DiscoveryCandidates.forMarket', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('proposes the title and subtitle of an app store listing with their relevance', async () => {
    const { service } = setup();

    const candidates = await service.forMarket(app(), 'us', SNAPSHOT_TEXT);

    expect(textsOf(bySource(candidates, 'title'))).toContain('habit tracker');
    expect(textsOf(bySource(candidates, 'subtitle'))).toContain(
      'daily streak planner',
    );
    expect(bySource(candidates, 'description')).toEqual([]);
    const title = candidates.find(({ text }) => text === 'habit tracker');
    expect(title?.relevance).toBe(
      defaultRelevance(keywordSourceOf.title, 'habit tracker', SNAPSHOT_TEXT),
    );
  });

  it('proposes the title and short description of a google play listing', async () => {
    const { service } = setup({
      listing: {
        title: 'Habit Tracker',
        subtitle: null,
        summary: 'Routine planner',
      },
    });

    const candidates = await service.forMarket(
      app(Store.GOOGLE_PLAY),
      'us',
      SNAPSHOT_TEXT,
    );

    expect(textsOf(bySource(candidates, 'title'))).toContain('habit tracker');
    expect(textsOf(bySource(candidates, 'description'))).toContain(
      'routine planner',
    );
    expect(bySource(candidates, 'subtitle')).toEqual([]);
  });

  it('proposes competitor and review phrases in the home market only', async () => {
    const fixture: Fixture = {
      competitors: [
        { title: 'Streak Keeper', subtitle: 'Goal tracker', summary: null },
      ],
      reviews: [
        reviewSaying('love the dark mode'),
        reviewSaying('the dark mode is great'),
        reviewSaying('dark mode works'),
        reviewSaying('focus timer please'),
        reviewSaying('need focus timer'),
      ],
    };
    const home = await setup(fixture).service.forMarket(
      app(),
      'us',
      SNAPSHOT_TEXT,
    );
    const abroad = await setup(fixture).service.forMarket(
      app(),
      'de',
      SNAPSHOT_TEXT,
    );

    expect(textsOf(bySource(home, 'competitors'))).toContain('streak keeper');
    expect(textsOf(bySource(home, 'reviews'))).toEqual(['dark mode']);
    expect(bySource(abroad, 'competitors')).toEqual([]);
    expect(bySource(abroad, 'reviews')).toEqual([]);
  });

  it('never proposes a single review word however many reviews use it', async () => {
    const candidates = await setup({
      reviews: [
        reviewSaying('great widget, great day'),
        reviewSaying('great widget for every day'),
        reviewSaying('great widget, simple day'),
        reviewSaying('the great widget'),
      ],
    }).service.forMarket(app(), 'us', SNAPSHOT_TEXT);

    expect(textsOf(bySource(candidates, 'reviews'))).toEqual(['great widget']);
  });

  it("proposes popular terms of the app's genre that share a listing word", async () => {
    const { service, prisma } = setup({
      genreTerms: [
        { term: 'habit streak', popularity: 50 },
        { term: 'photo editor', popularity: 70 },
      ],
      listed: [{ term: 'habit streak', popularity: 50 }],
    });

    const candidates = await service.forMarket(app(), 'us', SNAPSHOT_TEXT);

    expect(bySource(candidates, 'popularity')).toEqual([
      expect.objectContaining({ text: 'habit streak', traffic: 5 }),
    ]);
    expect(prisma.searchTermPopularity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { country: 'us', week: WEEK, genre: 'HEALTH_FITNESS' },
      }),
    );
  });

  it('proposes no popular terms without a recent week', async () => {
    const { service } = setup({
      week: null,
      genreTerms: [{ term: 'habit streak', popularity: 50 }],
    });

    const candidates = await service.forMarket(app(), 'us', SNAPSHOT_TEXT);

    expect(bySource(candidates, 'popularity')).toEqual([]);
  });

  it('proposes no popular terms on google play', async () => {
    const { service, prisma } = setup({
      genreTerms: [{ term: 'habit streak', popularity: 50 }],
    });

    const candidates = await service.forMarket(
      app(Store.GOOGLE_PLAY),
      'us',
      SNAPSHOT_TEXT,
    );

    expect(bySource(candidates, 'popularity')).toEqual([]);
    expect(prisma.searchTermPopularity.findMany).not.toHaveBeenCalled();
  });

  it("proposes the phrases the workspace's other apps track in the market", async () => {
    const { service, prisma } = setup({
      portfolio: ['meditation timer'],
    });

    const candidates = await service.forMarket(app(), 'de', SNAPSHOT_TEXT);

    expect(textsOf(bySource(candidates, 'portfolio'))).toEqual([
      'meditation timer',
    ]);
    expect(prisma.keyword.findMany).toHaveBeenCalledWith({
      where: {
        store: Store.APP_STORE,
        country: 'de',
        tracked: { some: { appId: { not: 'app1' } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { text: true },
    });
    expect(JSON.stringify(prisma.keyword.findMany.mock.calls)).not.toContain(
      'workspaceId',
    );
  });

  it('takes traffic from a stored score before the popularity week', async () => {
    const { service } = setup({
      metrics: [{ text: 'habit tracker', traffic: 3.4 }],
      listed: [
        { term: 'habit tracker', popularity: 80 },
        { term: 'daily streak planner', popularity: 20 },
      ],
    });

    const candidates = await service.forMarket(app(), 'us', SNAPSHOT_TEXT);

    expect(
      candidates.find(({ text }) => text === 'habit tracker')?.traffic,
    ).toBe(3.4);
    expect(
      candidates.find(({ text }) => text === 'daily streak planner')?.traffic,
    ).toBe(2);
  });
});
