import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  type AppLocalizationItem,
  type AppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
} from '@asobeast/shared';
import { QuotaService, WorkspaceUsage } from '../auth/quota.service';
import { type SecretBox } from '../common/crypto/secret-box';
import { PrismaService } from '../prisma/prisma.service';
import { AppLocalizationsService } from './app-localizations.service';
import { loadAppMarkets } from './app-markets';
import {
  KeywordFieldSave,
  KeywordFieldWrite,
  KeywordFieldWriter,
} from './keyword-field-writer';
import { loadTrackingStates } from './keyword-tracking-state';
import { STORE_FIELD_MANAGED } from './keyword-field-managed';
import { LocalizedKeywordFieldService } from './localized-keyword-field.service';

jest.mock('./app-markets', () => ({ loadAppMarkets: jest.fn() }));
jest.mock('./keyword-tracking-state', () => ({
  loadTrackingStates: jest.fn(),
}));

const APP = {
  id: 'app1',
  workspaceId: 'ws1',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: 'store1',
};

const item = (
  localization: AppStoreLocalization,
  phrases: string[],
): AppLocalizationItem => ({
  localization,
  origin: 'manual',
  phrases,
  charactersUsed: keywordFieldChars(phrases),
  charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
  readBy: [],
  updatedAt: null,
});

const usageWith = (limit: number | null): WorkspaceUsage =>
  ({
    plan: 'indie',
    limits: { keywordMarkets: limit },
    apps: 1,
    keywordMarkets: 7,
  }) as unknown as WorkspaceUsage;

const build = (
  markets: string[],
  items: AppLocalizationItem[],
  store: Store = Store.APP_STORE,
  stored: string[] | null = null,
  box: SecretBox | null = null,
) => {
  jest.mocked(loadAppMarkets).mockReset().mockResolvedValue(markets);
  jest.mocked(loadTrackingStates).mockReset().mockResolvedValue(new Map());
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue({ ...APP, store }) },
    keywordFieldSync: { findFirst: jest.fn().mockResolvedValue(null) },
    storeConnection: { findFirst: jest.fn().mockResolvedValue(null) },
    keywordField: {
      findUnique: jest
        .fn()
        .mockResolvedValue(stored === null ? null : { phrases: stored }),
    },
  };
  const quota = {
    usage: jest.fn().mockResolvedValue(usageWith(1000)),
    upgradeFrom: jest.fn().mockReturnValue('ultimate'),
  };
  const writer = {
    save: jest
      .fn<Promise<KeywordFieldWrite>, [KeywordFieldSave]>()
      .mockResolvedValue({ keywordIds: [], trackedIn: [] }),
  };
  const localizations = {
    list: jest
      .fn()
      .mockResolvedValue({ home: 'us', markets, localizations: items }),
  };
  const service = new LocalizedKeywordFieldService(
    prisma as unknown as PrismaService,
    writer as unknown as KeywordFieldWriter,
    localizations as unknown as AppLocalizationsService,
    quota as unknown as QuotaService,
    box,
  );
  return { prisma, writer, localizations, quota, service };
};

describe('LocalizedKeywordFieldService.save', () => {
  it('hands the normalized phrases and the chosen markets to the writer', async () => {
    const { service, writer } = build(['us', 'mx'], [item('es-MX', [])]);

    await service.save(APP.id, 'es-MX', {
      text: 'uno, dos, uno',
      trackIn: ['us', 'mx'],
    });

    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(writer.save).toHaveBeenCalledWith({
      app: APP,
      localization: 'es-MX',
      phrases: ['uno', 'dos'],
      markets: ['us', 'mx'],
    });
  });

  it('answers the list item of the localization with the duplicates removed and the markets tracked', async () => {
    const saved = item('es-MX', ['uno', 'dos']);
    const { service, writer } = build(['us', 'mx'], [item('en-US', []), saved]);
    writer.save.mockResolvedValue({ keywordIds: ['k1'], trackedIn: ['mx'] });

    await expect(
      service.save(APP.id, 'es-MX', { text: 'uno,dos,uno', trackIn: ['mx'] }),
    ).resolves.toEqual({
      localization: saved,
      duplicatesRemoved: 1,
      trackedIn: ['mx'],
    });
  });

  it('refuses a trackIn the markets of the app do not allow, before the writer runs', async () => {
    const { service, writer } = build(['us', 'mx'], []);

    await expect(
      service.save(APP.id, 'es-MX', { text: 'uno', trackIn: ['de'] }),
    ).rejects.toThrow(
      new BadRequestException("DE is not one of this app's markets"),
    );
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('refuses a field over 100 characters before it reads the markets', async () => {
    const { service, writer } = build(['us'], []);
    const text = Array.from(
      { length: 12 },
      (_, index) => `phrase ${index}`,
    ).join(',');

    await expect(
      service.save(APP.id, 'en-US', { text, trackIn: [] }),
    ).rejects.toThrow('Keyword field exceeds 100 characters');
    expect(loadAppMarkets).not.toHaveBeenCalled();
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('refuses a phrase the tracker would not accept', async () => {
    const { service, writer } = build(['us'], []);

    await expect(
      service.save(APP.id, 'en-US', {
        text: 'one two three four five six',
        trackIn: [],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('answers 404 for an empty save of a localization the app does not ship', async () => {
    const { service } = build(['us'], [item('en-US', [])]);

    await expect(
      service.save(APP.id, 'fr', { text: '', trackIn: [] }),
    ).rejects.toThrow(
      new NotFoundException("French is not one of this app's localizations"),
    );
  });

  it('refuses a Google Play app', async () => {
    const { service, writer } = build(['us'], [], Store.GOOGLE_PLAY);

    await expect(
      service.save(APP.id, 'en-US', { text: 'uno', trackIn: [] }),
    ).rejects.toThrow(
      new BadRequestException(
        'The keyword field is only available for App Store apps',
      ),
    );
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('refuses a manual save once App Store Connect imported the field', async () => {
    const { service, prisma, writer } = build(
      ['us'],
      [item('en-US', [])],
      Store.APP_STORE,
      null,
      {} as unknown as SecretBox,
    );
    prisma.keywordFieldSync.findFirst.mockResolvedValue({
      syncedAt: new Date(),
    });
    prisma.storeConnection.findFirst.mockResolvedValue({ id: 'con1' });

    await expect(
      service.save(APP.id, 'en-US', { text: 'uno', trackIn: ['us'] }),
    ).rejects.toThrow(STORE_FIELD_MANAGED);
    expect(writer.save).not.toHaveBeenCalled();
  });
});

describe('LocalizedKeywordFieldService.preview', () => {
  it('reports the normalized phrases, the duplicates removed and the characters used', async () => {
    const { service } = build(['us'], [], Store.APP_STORE, ['uno', 'viejo']);

    await expect(
      service.preview(APP.id, 'es-MX', { text: 'Uno, dos, uno' }),
    ).resolves.toMatchObject({
      localization: 'es-MX',
      phrases: ['uno', 'dos'],
      added: ['dos'],
      dropped: ['viejo'],
      duplicatesRemoved: 1,
      charactersUsed: 7,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
    });
  });

  it('asks for the tracking of every phrase in every reading market', async () => {
    const { service, prisma } = build(['us', 'mx'], []);

    await service.preview(APP.id, 'es-MX', { text: 'uno,dos' });

    expect(loadTrackingStates).toHaveBeenCalledWith(prisma, APP, [
      { text: 'uno', country: 'us' },
      { text: 'dos', country: 'us' },
      { text: 'uno', country: 'mx' },
      { text: 'dos', country: 'mx' },
    ]);
  });

  it('writes nothing and queues nothing', async () => {
    const { service, writer, prisma } = build(['us', 'mx'], []);

    await service.preview(APP.id, 'es-MX', { text: 'uno,dos' });

    expect(writer.save).not.toHaveBeenCalled();
    expect(Object.keys(prisma.keywordField)).toEqual(['findUnique']);
    expect(Object.keys(prisma.app)).toEqual(['findFirst']);
  });

  it('reports the plan quota like the import, and none when the plan has no limit', async () => {
    const limited = build(['us'], []);

    await expect(
      limited.service.preview(APP.id, 'en-US', { text: 'uno' }),
    ).resolves.toMatchObject({
      quota: { used: 7, limit: 1000, upgradeTo: 'ultimate' },
    });

    const unlimited = build(['us'], []);
    unlimited.quota.usage.mockResolvedValue(usageWith(null));

    await expect(
      unlimited.service.preview(APP.id, 'en-US', { text: 'uno' }),
    ).resolves.toMatchObject({ quota: null });
  });

  it('refuses a field over 100 characters before it reads the markets', async () => {
    const { service } = build(['us'], []);
    const text = Array.from(
      { length: 12 },
      (_, index) => `phrase ${index}`,
    ).join(',');

    await expect(service.preview(APP.id, 'en-US', { text })).rejects.toThrow(
      'Keyword field exceeds 100 characters',
    );
    expect(loadAppMarkets).not.toHaveBeenCalled();
  });
});
