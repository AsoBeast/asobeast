import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordsService } from '../keywords.service';
import { COMPETITOR_HAS_NO_LOCALIZATIONS } from '../keywords.support';
import {
  ListingTargetsService,
  TARGETS_ON_APP_STORE_ONLY,
} from './listing-targets.service';

const APP = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
  isCompetitor: false,
};

const build = (app: typeof APP | null = APP) => {
  const prisma = {
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    keyword: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ country: 'us' }, { country: 'gb' }]),
    },
    listingTarget: {
      findUnique: jest.fn().mockResolvedValue({
        slots: ['habit tracker'],
        updatedAt: new Date('2026-11-25T00:00:00.000Z'),
      }),
    },
  };
  const keywords = { listTracked: jest.fn().mockResolvedValue([]) };
  const service = new ListingTargetsService(
    prisma as unknown as PrismaService,
    keywords as unknown as KeywordsService,
  );
  return { prisma, keywords, service };
};

describe('ListingTargetsService.read', () => {
  it('answers the stored slots and the markets reading the localization', async () => {
    const { service, keywords } = build();

    const result = await service.read('app1', 'en-US');

    expect(result).toMatchObject({
      appId: 'app1',
      localization: 'en-US',
      readers: ['us'],
      updatedAt: '2026-11-25T00:00:00.000Z',
    });
    expect(result.slots[0]).toMatchObject({
      text: 'habit tracker',
      untrackedIn: ['us'],
    });
    expect(keywords.listTracked).toHaveBeenCalledWith(
      'app1',
      undefined,
      undefined,
      { brandFacts: true },
    );
  });

  it('refuses a competitor', async () => {
    const { service } = build({ ...APP, isCompetitor: true });

    await expect(service.read('app1', 'en-US')).rejects.toThrow(
      new BadRequestException(COMPETITOR_HAS_NO_LOCALIZATIONS),
    );
  });

  it('refuses a Google Play app', async () => {
    const { service } = build({ ...APP, store: Store.GOOGLE_PLAY });

    await expect(service.read('app1', 'en-US')).rejects.toThrow(
      new BadRequestException(TARGETS_ON_APP_STORE_ONLY),
    );
  });

  it('answers 404 for a missing app', async () => {
    const { service } = build(null);

    await expect(service.read('app1', 'en-US')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
