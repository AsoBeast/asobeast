import {
  type AppLocalizationsResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  UnknownStorefrontError,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppLocalizationsService } from './app-localizations.service';
import { MarketKeywordFieldsService } from './market-keyword-fields.service';

const listed = (home: string): AppLocalizationsResult => ({
  home,
  markets: [home],
  localizations: [
    {
      localization: 'es-MX',
      origin: 'manual',
      phrases: ['uno', 'dos'],
      charactersUsed: 7,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      readBy: [],
      updatedAt: null,
    },
  ],
});

const prisma = {
  trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
  appSnapshot: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const serviceFor = (home: string) =>
  new MarketKeywordFieldsService(
    {
      list: jest.fn().mockResolvedValue(listed(home)),
    } as unknown as AppLocalizationsService,
    prisma as unknown as PrismaService,
  );

describe('MarketKeywordFieldsService.read', () => {
  it('reads the home market when no country is given', async () => {
    const result = await serviceFor('us').read('app1');

    expect(result).toMatchObject({ country: 'us', home: true });
    expect(result.localizations[0].localization).toBe('en-US');
  });

  it('reads a storefront that is not the home market', async () => {
    await expect(serviceFor('us').read('app1', 'de')).resolves.toMatchObject({
      country: 'de',
      home: false,
    });
  });

  it('refuses a country that is not an App Store storefront', async () => {
    await expect(serviceFor('us').read('app1', 'zz')).rejects.toBeInstanceOf(
      UnknownStorefrontError,
    );
  });

  it('does not check the home country against the storefront list', async () => {
    await expect(serviceFor('zz').read('app1', 'zz')).resolves.toMatchObject({
      country: 'zz',
      home: true,
    });
  });

  it('builds the shipped origins and the fields from the list items', async () => {
    const { localizations } = await serviceFor('us').read('app1', 'mx');

    expect(localizations).toEqual([
      expect.objectContaining({
        localization: 'es-MX',
        shipped: true,
        origin: 'manual',
        phrases: ['uno', 'dos'],
        charactersUsed: 7,
      }),
      expect.objectContaining({ localization: 'en-GB', shipped: false }),
    ]);
  });
});
