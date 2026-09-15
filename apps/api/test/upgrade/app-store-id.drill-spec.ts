import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('App Store ids against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const storeAppIdOf = async (id: string): Promise<string> =>
    (await prisma.app.findUniqueOrThrow({ where: { id } })).storeAppId;

  it('renames a zero padded id that has no canonical twin', async () => {
    expect(await storeAppIdOf('app_padded')).toBe('333333333');
  });

  it('leaves a zero padded id whose canonical twin is already tracked', async () => {
    expect(await storeAppIdOf('app_padded_twin')).toBe('0111111111');
    expect(await storeAppIdOf('app_ios')).toBe('111111111');
  });

  it('renames only the first of two padded ids that share one listing', async () => {
    expect(await storeAppIdOf('app_padded_pair_a')).toBe('444444444');
    expect(await storeAppIdOf('app_padded_pair_b')).toBe('00444444444');
  });

  it('leaves canonical ids and google play package names untouched', async () => {
    expect(await storeAppIdOf('app_rival')).toBe('222222222');
    expect(await storeAppIdOf('app_play')).toBe('com.drill.fitness');
  });
});
