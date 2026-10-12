import type { PrismaService } from '../prisma/prisma.service';
import { loadAppMarkets } from './app-markets';

const clientReturning = (countries: string[]) => {
  const findMany = jest
    .fn()
    .mockResolvedValue(countries.map((country) => ({ country })));
  return {
    client: { keyword: { findMany } } as unknown as PrismaService,
    findMany,
  };
};

describe('loadAppMarkets', () => {
  it('reads the countries of the keywords the app tracks, home first', async () => {
    const { client, findMany } = clientReturning(['mx', 'de']);

    await expect(
      loadAppMarkets(client, { id: 'app1', country: 'us' }),
    ).resolves.toEqual(['us', 'de', 'mx']);
    expect(findMany).toHaveBeenCalledWith({
      where: { tracked: { some: { appId: 'app1' } } },
      distinct: ['country'],
      select: { country: true },
    });
  });

  it('answers the home market alone when the app tracks nothing', async () => {
    const { client } = clientReturning([]);

    await expect(
      loadAppMarkets(client, { id: 'app1', country: 'jp' }),
    ).resolves.toEqual(['jp']);
  });
});
