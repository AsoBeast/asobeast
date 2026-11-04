import { PrismaService } from '../prisma/prisma.service';
import { POPULARITY_MAX_AGE_DAYS } from '../scoring/official-popularity';
import { DiscoveryPopularity } from './discovery-popularity.service';

const NOW = new Date('2026-11-04T09:00:00.000Z');
const WEEK = new Date('2026-11-02T00:00:00.000Z');
const DAY_MS = 86_400_000;

const setup = (week: Date | null = WEEK) => {
  const findFirst = jest.fn().mockResolvedValue(week ? { week } : null);
  const findMany = jest.fn().mockResolvedValue([]);
  const popularity = new DiscoveryPopularity({
    searchTermPopularity: { findFirst, findMany },
  } as unknown as PrismaService);
  return { popularity, findFirst, findMany };
};

describe('DiscoveryPopularity', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('weekFor', () => {
    it('answers the newest week no older than the popularity age limit', async () => {
      const { popularity, findFirst } = setup();

      await expect(popularity.weekFor('us')).resolves.toEqual(WEEK);
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          country: 'us',
          week: {
            gte: new Date(NOW.getTime() - POPULARITY_MAX_AGE_DAYS * DAY_MS),
          },
        },
        orderBy: { week: 'desc' },
        select: { week: true },
      });
    });

    it('answers null when no recent week is stored', async () => {
      const { popularity } = setup(null);

      await expect(popularity.weekFor('us')).resolves.toBeNull();
    });
  });

  describe('genreTerms', () => {
    it("reads the genre's most popular terms of the newest week", async () => {
      const { popularity, findMany } = setup();
      findMany.mockResolvedValue([{ term: 'habit tracker', popularity: 52 }]);

      await expect(
        popularity.genreTerms('us', 'HEALTH_FITNESS'),
      ).resolves.toEqual([{ term: 'habit tracker', popularity: 52 }]);
      expect(findMany).toHaveBeenCalledWith({
        where: { country: 'us', week: WEEK, genre: 'HEALTH_FITNESS' },
        orderBy: { popularity: 'desc' },
        take: 500,
        select: { term: true, popularity: true },
      });
    });

    it('reads nothing without a recent week', async () => {
      const { popularity, findMany } = setup(null);

      await expect(
        popularity.genreTerms('us', 'HEALTH_FITNESS'),
      ).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('listedTraffic', () => {
    it("answers each listed term's highest popularity on the traffic scale", async () => {
      const { popularity, findMany } = setup();
      findMany.mockResolvedValue([
        { term: 'habit tracker', popularity: 40 },
        { term: 'habit tracker', popularity: 52 },
        { term: 'mood journal', popularity: 18 },
      ]);

      const traffic = await popularity.listedTraffic('us', [
        'habit tracker',
        'mood journal',
        'unlisted',
      ]);

      expect([...traffic]).toEqual([
        ['habit tracker', 5.2],
        ['mood journal', 1.8],
      ]);
      expect(findMany).toHaveBeenCalledWith({
        where: {
          country: 'us',
          week: WEEK,
          term: { in: ['habit tracker', 'mood journal', 'unlisted'] },
        },
        select: { term: true, popularity: true },
      });
    });

    it('makes no query for no texts', async () => {
      const { popularity, findFirst, findMany } = setup();

      await expect(popularity.listedTraffic('us', [])).resolves.toEqual(
        new Map(),
      );
      expect(findFirst).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    });

    it('answers nothing without a recent week', async () => {
      const { popularity, findMany } = setup(null);

      await expect(
        popularity.listedTraffic('us', ['habit tracker']),
      ).resolves.toEqual(new Map());
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
