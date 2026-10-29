import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { utcDayOf } from '@asobeast/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApplePopularityClient } from '../src/scoring/apple-popularity';
import { newestCompleteWeek } from '../src/scoring/apple-popularity.sync';
import { OfficialPopularityLookup } from '../src/scoring/official-popularity';
import { testDb } from './helpers/test-db';

const COUNTRY = 'zz';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('official popularity lookup against the database (e2e)', () => {
  const newest = newestCompleteWeek(new Date());
  const weeksAgo = (weeks: number) =>
    new Date(newest.getTime() - weeks * WEEK_MS);
  const row = (
    term: string,
    weeks: number,
    genre: string,
    popularity: number,
  ) => ({ country: COUNTRY, term, week: weeksAgo(weeks), genre, popularity });
  const keyword = (text: string) => ({
    text,
    store: 'APP_STORE' as const,
    country: COUNTRY,
  });
  let prisma: PrismaClient;
  let lookup: OfficialPopularityLookup;

  beforeAll(() => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
    lookup = new OfficialPopularityLookup(
      prisma as unknown as PrismaService,
      { enabled: true } as ApplePopularityClient,
    );
  });

  beforeEach(async () => {
    await prisma.searchTermPopularity.deleteMany({
      where: { country: COUNTRY },
    });
    await prisma.searchTermPopularity.createMany({
      data: [
        row('big quiz', 0, 'GAMES', 90),
        row('big quiz', 0, 'SPORTS', 60),
        row('mid quiz', 0, 'GAMES', 70),
        row('edge quiz', 0, 'GAMES', 50),
        row('sports edge', 0, 'SPORTS', 44),
        row('shared quiz', 0, 'GAMES', 50),
        row('shared quiz', 0, 'SPORTS', 50),
        row('edge quiz', 2, 'GAMES', 66),
        row('edge quiz', 2, 'SPORTS', 48),
        row('filler', 2, 'GAMES', 52),
        row('edge quiz', 5, 'GAMES', 75),
        row('gone quiz', 5, 'GAMES', 61),
        row('gone quiz', 6, 'GAMES', 63),
        row('filler', 6, 'GAMES', 49),
      ],
    });
  });

  afterAll(async () => {
    await prisma.searchTermPopularity.deleteMany({
      where: { country: COUNTRY },
    });
    await prisma.$disconnect();
  });

  it('answers the highest value across genres, judged against its own genre', async () => {
    await expect(lookup.for(keyword('big quiz'))).resolves.toEqual({
      value: 90,
      context: { week: utcDayOf(newest), floor: 50, lastAboveFloor: null },
    });
  });

  it('answers a term listed at its floor with the newest week that held it above', async () => {
    await expect(lookup.for(keyword('edge quiz'))).resolves.toEqual({
      value: 50,
      context: {
        week: utcDayOf(newest),
        floor: 50,
        lastAboveFloor: { value: 66, week: utcDayOf(weeksAgo(2)) },
      },
    });
  });

  it('answers a term left out below the floor of the guessed genre', async () => {
    await expect(lookup.for(keyword('gone quiz'), 'GAMES')).resolves.toEqual({
      absentBelow: 50,
      context: {
        week: utcDayOf(newest),
        floor: 50,
        lastAboveFloor: { value: 61, week: utcDayOf(weeksAgo(5)) },
      },
    });
  });

  it('finds no last listed value for a term the kept weeks never list', async () => {
    await expect(lookup.for(keyword('never quiz'))).resolves.toEqual({
      absentBelow: 44,
      context: { week: utcDayOf(newest), floor: 44, lastAboveFloor: null },
    });
  });

  it('judges a value several genres share against the lowest of their floors', async () => {
    await expect(lookup.for(keyword('shared quiz'))).resolves.toEqual({
      value: 50,
      context: { week: utcDayOf(newest), floor: 44, lastAboveFloor: null },
    });
  });

  it('judges a sports term against the sports floor', async () => {
    await expect(lookup.for(keyword('sports edge'))).resolves.toEqual({
      value: 44,
      context: { week: utcDayOf(newest), floor: 44, lastAboveFloor: null },
    });
  });
});
